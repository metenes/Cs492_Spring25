import random
from flask import Blueprint, request, jsonify, current_app
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token, create_refresh_token
from datetime import datetime, timedelta
from models.user import User  # Import the User model
from utils.database import users_collection
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_mail import Message
from utils.mail_config import mail
from utils.jwt_config import decode_token
import uuid
from pymongo import MongoClient

from werkzeug.security import generate_password_hash
from bson import ObjectId
from bson.objectid import ObjectId

import boto3
from botocore.exceptions import ClientError
import os
from werkzeug.utils import secure_filename
import time

from flask_dance.contrib.google import make_google_blueprint

"""
// Sample MongoDB User Schema 
// ----> documentation purposes
{
  "_id": ObjectId("..."),
  "email": "user@example.com",
  "password": "hashed_password",
  "name": "User Name",
  "bio": "User biography or description",
  "phone": "+1234567890",
  "location": "City, Country",
  "profileImageUrl": "https://bucket-name.s3.amazonaws.com/profile-images/user_id_filename.jpg",
  "created_at": ISODate("2025-03-30T12:00:00Z"),
  "updated_at": ISODate("2025-03-30T12:00:00Z"),
  "last_login": ISODate("2025-03-30T12:00:00Z"),
  "preferences": {
    "darkMode": false,
    "notifications": {
      "email": true,
      "push": true
    },
    "language": "en"
  },
  "account_status": "active", // active, suspended, deactivated
  "role": "user" // user, admin
}
"""

# Sample FAQs
FAQ_LIST = [
    {
        "question": "How do I reset my password?",
        "answer": "Go to Settings > Account > Reset Password. You'll receive an email with a secure link to create a new password."
    },
    {
        "question": "How is my data secured?",
        "answer": "We use AES-256 encryption for data at rest and TLS 1.3 for data in transit. All data is stored in secure AWS servers with regular security audits."
    },
    {
        "question": "Can I use this app anonymously?",
        "answer": "Yes. You can skip personal info during registration and use a pseudonym. We never require identifiable information."
    },
    {
        "question": "How are emotions detected in my entries?",
        "answer": "Our AI uses advanced NLP (Natural Language Processing) to analyze sentiment, emotional tone, and recurring themes while respecting your privacy."
    },
    {
        "question": "Can I export my journal entries?",
        "answer": "Yes. Go to Settings > Data > Export to download all your entries in PDF, TXT, or JSON format."
    },
    {
        "question": "Is there a limit to entry length?",
        "answer": "You can write up to 10,000 characters per entry. For longer reflections, consider breaking them into multiple entries."
    },
    {
        "question": "How often should I journal?",
        "answer": "We recommend writing daily, but even weekly reflections show benefits. The app will suggest prompts if you're stuck."
    },
    {
        "question": "Can I add images or voice notes?",
        "answer": "Currently we support text only, but multimedia features are coming in our next update."
    },
    {
        "question": "What happens if I forget my encryption passphrase?",
        "answer": "We cannot recover it (by design for security). You'll need to create a new account and manually transfer old entries."
    },
    {
        "question": "Do you offer therapy or mental health advice?",
        "answer": "No. While journaling has therapeutic benefits, we're not a substitute for professional care. See our Resources section for crisis hotlines."
    },
    {
        "question": "How does the streak counter work?",
        "answer": "Your streak increases with consecutive days of journaling. A 12-hour grace period is allowed between entries."
    },
    {
        "question": "Can I use markdown formatting?",
        "answer": "Yes! Basic markdown like **bold**, *italics*, and bullet points are supported. Use the help icon (?) for formatting tips."
    },
    {
        "question": "Why can't I delete my account from the app?",
        "answer": "For security, account deletion requires email verification. Contact support@journalapp.com from your registered email."
    },
    {
        "question": "Are my entries used to train AI?",
        "answer": "Never. Your data remains private unless you explicitly opt-in to our (fully anonymized) research program."
    }
]

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
FACEBOOK_APP_ID = os.getenv("FACEBOOK_APP_ID")
APPLE_TEAM_ID = os.getenv("APPLE_TEAM_ID")
TWITTER_CLIENT_ID = os.getenv("TWITTER_CLIENT_ID")

# Initialize Blueprint for user routes
user_bp = Blueprint("user_bp", __name__)

# Initialize bcrypt instance
bcrypt = Bcrypt()

# ---------------------------------------
#  ** S3 Configure ** Profile Images 
#  ** Base Model Upload for inference  
# ---------------------------------------

# AWS S3 bucket
S3_BUCKET = "sentiobucket"
BASE_MODEL_PATH = "models/model.pt"

# S3 Configuration (for profile images)
s3_client  = boto3.client(
        's3',
        aws_access_key_id='AKIAXGZAMH3HUVQSPNED',
        aws_secret_access_key='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',
        region_name='eu-north-1'
    )

# Initialize STS client to check identity
sts_client = boto3.client(
    'sts',
    aws_access_key_id='AKIAXGZAMH3HUVQSPNED',
    aws_secret_access_key='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',
    region_name='eu-north-1'
)

# Check AWS identity
try:
    identity = sts_client.get_caller_identity()
    print("Caller identity:", identity)
except ClientError as e:
    print("❌ Failed to get caller identity:", e)

# Test S3 write permissions with simple put_object
try:
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key='test-upload.txt',
        Body='This is a test',
        ContentType='text/plain'
    )
    print("✅ S3 write permission OK")
except ClientError as e:
    print("❌ S3 write permission failed:", e)

# List all buckets
try:
    response = s3_client.list_buckets()
    print("Buckets available:")
    for bucket in response['Buckets']:
        print(f"  - {bucket['Name']}")
except ClientError as e:
    print("Error listing buckets:", e)

# List objects in your specific bucket
try:
    response = s3_client.list_objects_v2(Bucket=S3_BUCKET)
    print(f"Objects in {S3_BUCKET}:")
    for obj in response.get('Contents', []):
        print(f"  - {obj['Key']}")
except ClientError as e:
    print("Error listing objects in bucket:", e)

# ---------------------------------------
#  **User Registration**
# ---------------------------------------
@user_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")
        if not email or not password:
            print("Email and password are required")
            return jsonify({"error": "Email and password are required"}), 400

        # Check if the user already exists
        if users_collection.find_one({"email": email}):
            return jsonify({"error": "User already exists"}), 400

        # Hash password before saving
        registration_time = datetime.now()
        hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
        new_user = {
            "email": email,
            "password": hashed_password,
            "name": "User Name",
            "bio": "User biography or description",
            "phone": "+1234567890",
            "location": "City, Country",
            "profileImageUrl": "",
            "created_at": registration_time,
            "updated_at": registration_time,
            "last_login": registration_time,
            "preferences": {
                "darkMode": "false",
                "notifications": {
                "email": "false",
                "push": "false"
                },
                "language": "en"
            },
            "account_status": "active",  # active, suspended, deactivated
            "role": "user",               # user, admin
            "failed_login_attempts": 0,
            "lockout_until": None,
            "hasSeenOnboarding": False,

        }
        users_collection.insert_one(new_user)

        # Upload base model to S3 
        user_model_path = f"models/{ObjectId(new_user['_id'])}/model.pt"
        print(user_model_path," creating user model ")
        try:
            s3_client.copy_object(
                Bucket=S3_BUCKET,
                CopySource=f"{S3_BUCKET}/{BASE_MODEL_PATH}",
                Key=user_model_path
            )
            print(f"User model initialized at {S3_BUCKET}/{user_model_path}")
        except Exception as e:
            print(f"Error copying base model: {e}")

        print("model for user ", new_user["_id"], "created in registraion")
        # for real time infarence upload the sagamaker 


        
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------
#  **User Login**
# ---------------------------------------
@user_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")

        print(f"🔹 Login Attempt: email={email}")

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        user = users_collection.find_one({"email": email})
        if not user:
            return jsonify({"error": "Invalid credentials"}), 401

        # Check if locked out
        lockout_until = user.get("lockout_until")
        if lockout_until and datetime.now() < lockout_until:
            return jsonify({
                "error": f"Account locked. Please try again after {lockout_until.strftime('%H:%M:%S')}."
            }), 403

        # Check password
        if not bcrypt.check_password_hash(user["password"], password):
            failed_attempts = user.get("failed_login_attempts", 0) + 1

            if failed_attempts >= 5:
                lockout_time = datetime.now() + timedelta(minutes=5)
                users_collection.update_one(
                    {"_id": user["_id"]},
                    {"$set": {
                        "lockout_until": lockout_time,
                        "failed_login_attempts": 0  # reset after lock
                    }}
                )
                return jsonify({
                    "error": "Too many failed login attempts. Your account is locked for 5 minutes."
                }), 403

            else:
                users_collection.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"failed_login_attempts": failed_attempts}}
                )
                return jsonify({"error": "Invalid credentials"}), 401

        # Generate JWT token
        access_token = create_access_token(identity=str(user["_id"]), expires_delta=timedelta(minutes=15))  # You can pass user ID as string
        print(f"LOGIN {access_token}")

        return jsonify({"access_token": access_token}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
#  **Onboarding**
# ---------------------------------------
@user_bp.route("/onboarding", methods=["GET", "PATCH"])
@jwt_required()
def onboarding_status():
    user_id = get_jwt_identity()

    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404

    if request.method == "GET":
        # Return the onboarding completion status
        return jsonify({"hasSeenOnboarding": user.get("hasSeenOnboarding", False)}), 200

    elif request.method == "PATCH":
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"hasSeenOnboarding": True}}
        )
        return jsonify({"message": "Onboarding marked as completed"}), 200


# ---------------------------------------
#  **Profile Route**
# ---------------------------------------

@user_bp.route("/get-user-id", methods=["GET"])
@jwt_required()
def get_user_id():
    try:
        user_id = get_jwt_identity()
        print(f"🔍 Fetching profile for user: {user_id}")
        
        # Ensure user_id is converted to ObjectId
        try:
            user_object_id = ObjectId(user_id)
        except Exception as e:
            print(f"❌ Invalid user ID format: {user_id}")
            return jsonify({"error": "Invalid user ID format"}), 400
        
        # Print the exact query we're running
        print(f"🔍 Running query: db.collection.findOne({{_id: ObjectId('{user_id}')}}")
        
        # Retrieve user's journal entries from MongoDB
        user_data = users_collection.find_one({"_id": user_object_id})
        print(f"🔍 Raw user data: {user_data}")
        
        if not user_data:
            print("⚠️ No document found for this user at all.")
            return jsonify({"_id" : -1}), 200
            
        return jsonify({"_id" : user_id}), 200
        
    except Exception as e:
        print(f"❌ Error fetching journal entries: {str(e)}")
        import traceback
        traceback.print_exc()  # Print the full stack trace
        return jsonify({"error": str(e)}), 500
    

# Get user profile
@user_bp.route('/<user_id>', methods=['GET'])
@jwt_required()
def get_user_profile(user_id):
    # Verify the requesting user is accessing their own profile
    current_user_id = get_jwt_identity()

    if current_user_id != user_id:
        return jsonify({"error": "Unauthorized access"}), 403
    
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Remove sensitive information
    user.pop('password', None)
    user['_id'] = str(user['_id'])
    
    return jsonify(user), 200

# Update user profile
@user_bp.route('/<user_id>/update-user', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    # Verify the requesting user is updating their own profile
    current_user_id = get_jwt_identity()
    if current_user_id != user_id:
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get user data from request
    data = request.json
    
    # Check if user exists
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Create update document
    update_data = {}
    
    # Update profile fields if provided
    if 'name' in data:
        update_data['name'] = data['name']
    if 'bio' in data:
        update_data['bio'] = data['bio']
    if 'phone' in data:
        update_data['phone'] = data['phone']
    if 'location' in data:
        update_data['location'] = data['location']
    
    # Handle password update if provided
    if 'password' in data and data['password']:
        update_data['password'] = generate_password_hash(data['password'])
    
    # Update user document
    if update_data:
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
    
    return jsonify({"message": "Profile updated successfully"}), 200

# Upload profile picture
@user_bp.route('/<user_id>/profile-image', methods=['POST'])
@jwt_required()
def upload_profile_image(user_id):
    try:
        # Verify user is updating their own profile
        current_user_id = get_jwt_identity()
        if str(current_user_id) != user_id:
            return jsonify({"error": "Unauthorized"}), 403

        # Log request details
        print(f"Request files: {request.files}")
        print(f"Request form: {request.form}")

        if 'profileImage' not in request.files:
            print("No 'profileImage' found in request.files")
            return jsonify({"error": "No image provided"}), 400

        file = request.files['profileImage']
        print(f"File received: filename={file.filename}, content_type={file.content_type}")
        
        # Handle missing filename
        original_filename = "profile-image.jpg"  # Use a guaranteed valid name
        filename = f"profile-images/{user_id}/{int(time.time())}_{secure_filename(original_filename)}"

        print(f"Generated S3 filename: {filename}")
        
        # Try to read the file
        try:
            file_content = file.read()
            file_size = len(file_content)
            print(f"File size read: {file_size} bytes")
            # Seek back to beginning for upload
            file.seek(0)
        except Exception as read_error:
            print(f"Error reading file: {str(read_error)}")
            return jsonify({"error": "Could not read uploaded file"}), 400
        
        # Upload to S3
        try:
            print(f"Attempting to upload to S3: bucket={S3_BUCKET}, filename={filename}")
            s3_client.upload_fileobj(
            file.stream, 
            S3_BUCKET,
            filename,
            ExtraArgs={
                "ContentType": file.content_type or "image/jpeg"
            }
        )
            print("S3 upload successful")

            # Generate the URL for the uploaded image
            image_url = f"https://{S3_BUCKET}.s3.amazonaws.com/{filename}"
            print(f"Generated image URL: {image_url}")
            
            # Update user's profile image URL in database
            user = users_collection.find_one({"_id": ObjectId(user_id)})
            if user:
                users_collection.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": {"profileImageUrl": image_url}}
                )
                print(f"Updated user {user_id} profile with new image URL")
            
            return jsonify({
                "message": "Profile image uploaded successfully",
                "profileImageUrl": image_url
            }), 200

        except ClientError as e:
            error_message = e.response.get('Error', {}).get('Message', str(e))
            print(f"Error uploading to S3: {error_message}")
            print(f"Error code: {e.response.get('Error', {}).get('Code', 'Unknown')}")
            print(f"Request ID: {e.response.get('ResponseMetadata', {}).get('RequestId', 'Unknown')}")
            return jsonify({"error": f"Failed to upload image: {error_message}"}), 500

    except Exception as e:
        import traceback
        print(f"Error in upload_profile_image: {str(e)}")
        traceback.print_exc()  # Print the full stack trace
        return jsonify({"error": "Server error"}), 500

# ---------------------------------------
#  **Delete User**
# ---------------------------------------
@user_bp.route('/<user_id>/delete-user', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    # Verify the requesting user is deleting their own account
    current_user_id = get_jwt_identity()
    if current_user_id != user_id:
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Check if user exists
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Delete user's data from all collections
    # First, delete user profile
    users_collection.delete_one({"_id": ObjectId(user_id)})
    
    # Delete user's posts
    # users_collection.delete_many({"userId": user_id})
    
    # Delete user's comments
    # users_collection.delete_many({"userId": user_id})
    
    # Delete user's likes
    # users_collection.delete_many({"userId": user_id})
    
    # Delete user's follows
    # users_collection.delete_many({"followerId": user_id})
    # users_collection.delete_many({"followingId": user_id})
    
    # Handle profile image deletion from S3 if available
    if s3_client and 'profileImageUrl' in user and user['profileImageUrl']:
        try:
            # Extract the S3 key from the URL
            s3_key = user['profileImageUrl'].split('amazonaws.com/')[1]
            s3_client.delete_user(Bucket=S3_BUCKET, Key=s3_key)
        except (ClientError, IndexError) as e:
            # Log the error but continue with account deletion
            current_app.logger.error(f"Failed to delete profile image: {str(e)}")
    
    return jsonify({"message": "Account deleted successfully"}), 200


# ---------------------------------------
#  **Forgot Password & Check mail **
# ---------------------------------------
@user_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    try:
        data = request.json
        email = data.get("email")
        api = data.get("API_URL")
        print(f"🔍 Received email: {email}")  # Debug log
        print(f"🔍 Received api: {api}")  # Debug log

        user = users_collection.find_one({"email": email})
        if not user:
            print("❌ User not found in DB")
            return jsonify({"error": "User not found"}), 404

        import random
        verification_code = str(random.randint(100000, 999999))

        reset_token = create_access_token(
                identity=str(user["_id"]),
                expires_delta=timedelta(minutes=15),
                additional_claims={"reset_code": verification_code})

        reset_link = f"{api}/user/reset-password?token={reset_token}"

        print(f"✅ Reset link: {reset_link}")

        # Create a more descriptive email
        msg = Message(
            "Password Reset Request for Your Account", 
            sender=("Sentio Support", current_app.config["MAIL_USERNAME"]), 
            recipients=[email]
        )
        
        # HTML body for better formatting
        msg.html = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px; border-radius: 5px;">
            <h2>Sentio Password Reset</h2>
            <p>Use the code below to reset your password. It will expire in 15 minutes.</p>
            <p style="font-size: 24px; font-weight: bold;">{verification_code}</p>
            <p>If you didn't request this, ignore this email.</p>
        </div>
        """
        
        # Plain text alternative for email clients that don't support HTML
        msg.body = f"""
        Password Reset Request for Your Account
        
        You recently requested to reset your password for your account. Click the link below to reset it:

        Your code is: {verification_code}

        Your reset link : {reset_link}
        
        This password reset link is only valid for the next 15 minutes.
        
        If you did not request a password reset, please ignore this email or contact support if you have questions.
        
        Regards,
        The Sentio Team
        """
        
        mail.send(msg)

        return jsonify({"message": "Password reset email sent" , "token": reset_token}), 200
    except Exception as e:
        print(f"🔥 Exception: {e}")  # Print exact error
        import traceback
        traceback.print_exc()  
        return jsonify({"error": str(e)}), 500

# ---------------------------------------
#  **Support mail **
# ---------------------------------------

@user_bp.route("/support/contact", methods=["POST"])
def send_support_email():
    try:
        data = request.json
        user_email = data.get("email")
        subject = data.get("subject")
        message = data.get("message")

        if not user_email or not subject or not message:
            return jsonify({"error": "Email, subject, and message are required"}), 400

        # Create a more descriptive email
        msg = Message(
            "Password Reset Request for Your Account", 
            subject=f"[Support] {subject}",
            sender=("Sentio Support", current_app.config["MAIL_USERNAME"]), 
            recipients=[ current_app.config["MAIL_USERNAME"]],  # ✅ same mail adress send 
            body=f"From: {user_email}\n\nMessage:\n{message}"

        )
        
        # HTML body for better formatting
        msg.html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
            <h2 style="color: #333;">Sentio App Support Mail</h2>
            <p>You recently requested to reset your password for your account. Use the button below to reset it.</p>
            <p>This password reset link is only valid for the next 15 minutes.</p>
            <p>If you did not request a password reset, please ignore this email or contact support if you have questions.</p>
            <p>Regards,<br>The Sentio Team</p>
        </div>
        """
        
        # Plain text alternative for email clients that don't support HTML
        msg.body = f"""
        Sentio App Support Request - Mail #{ObjectId()} 

        From User : {user_email}

        Subject : {subject} 
        
        Message : {message}
        
        This support mail produced automatically, do not response the mail. 
                
        Regards,
        The Sentio Team
        """
        
        mail.send(msg)
        return jsonify({"message": "Your email was sent successfully"}), 200

    except Exception as e:
        print(f"Email error: {e}")
        return jsonify({"error": "Failed to send email"}), 500

@user_bp.route("/support/faqs", methods=["POST"])
def get_faqs():
    return jsonify({"faqs": FAQ_LIST}), 200

# ---------------------------------------
#  **Reset Password**
# ---------------------------------------

@user_bp.route("/reset-password", methods=["POST"])
def reset_password():
    try:
        data = request.get_json()
        token = data.get("token")
        """ if(token is None) :
          token = reset_token     """
        new_password = data.get("newPassword")

        if not token or not new_password:
            return jsonify({"error": "Invalid request"}), 400

        try:
            decoded_token = decode_token_full(token)
            user_id = decoded_token.get("sub")
        except Exception as token_error:
            print(f"Token validation error: {token_error}")
            return jsonify({"error": "Invalid or expired token"}), 401

        if not user_id:
            return jsonify({"error": "Invalid token content"}), 400

        # Password validation
        if len(new_password) < 6:
            return jsonify({"error": "Password must be at least 6 characters long"}), 400

        hashed_password = bcrypt.generate_password_hash(new_password).decode("utf-8")
        result = users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"password": hashed_password}})
        
        if result.modified_count == 0:
            return jsonify({"error": "Failed to update password"}), 500

        return jsonify({"message": "Password reset successful"}), 200
    except Exception as e:
        print(f"Password reset error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
#  **Password reset with verification code**
# ---------------------------------------
@user_bp.route("/request-reset-code", methods=["POST"])
def request_reset_code():
    try:
        data = request.get_json()
        email = data.get("email")
        if not email:
            return jsonify({"error": "Email is required"}), 400

        user = users_collection.find_one({"email": email})
        if not user:
            return jsonify({"error": "User not found"}), 404

        code = str(random.randint(100000, 999999))
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"reset_code": code, "code_expiry": datetime.utcnow() + timedelta(minutes=15)}}
        )

        msg = Message("Your Sentio Reset Code", recipients=[email])
        msg.body = f"Your password reset code is: {code}"
        mail.send(msg)

        return jsonify({"message": "Reset code sent to email"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@user_bp.route("/verify-reset-code", methods=["POST"])
def verify_reset_code():
    try:
        data = request.get_json()
        email = data.get("email")
        code = data.get("code")
        token = data.get("token")
        print(code)
        print(token)

        if not code or not token:
            return jsonify({"error": "Missing code or token"}), 400

        # Decode the token
        try:
            decoded_token = decode_token_full(token)
            print("DECODED TOKEN")
            print(decoded_token)
            original_code = decoded_token.get("reset_code")
            print("ORIGINAL CODE")
            print(original_code)
            user_id = decoded_token.get("sub")
            print("SUB???????????????")
            print(user_id)
        except Exception as e:
            print("❌ Token decoding error:", e)
            import traceback
            traceback.print_exc()
            return jsonify({"error": "Invalid or expired token"}), 401

        if not original_code:
            return jsonify({"error": "Token is missing required fields"}), 400

        if code != original_code:
            return jsonify({"error": "Invalid code"}), 400

        # All good – issue a short-lived password reset token
        """ password_reset_token = create_access_token(
            identity=email,
            expires_delta=timedelta(minutes=10)
        ) """
        # Find the user again (you already have the email)
        user = users_collection.find_one({"email": email})
        if not user:
            return jsonify({"error": "User not found"}), 404

        user_id = str(user["_id"])  # 🆗 convert ObjectId to string
        print("USER ID")
        print(user_id)

        password_reset_token = create_access_token(
            identity=user_id,
            expires_delta=timedelta(minutes=10)
        )


        return jsonify({
            "message": "Code verified",
            "token": password_reset_token
        }), 200

    except Exception as e:
        print("❌ Exception in verify_reset_code:", e)
        return jsonify({"error": str(e)}), 500

    
# ---------------------------------------
#  **Trend Analysis**
# ---------------------------------------
@user_bp.route('/community-trends', methods=['GET'])
def community_trends():
    pipeline = [
        {"$group": {
            "_id": "$sentiments.emotion",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    stats = list(users_collection.aggregate(pipeline))
    return jsonify(stats)

# ---------------------------------------
#  **Google / Appple Authentication **
# ---------------------------------------

@user_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    # Get user data from request
    data = request.json
    old_password = data.get("oldPassword")
    new_password = data.get("newPassword")

    # Check if user exists
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    # Check old password
    if not bcrypt.check_password_hash(user["password"], old_password):
        return jsonify({"error": "Old password is incorrect"}), 401
        
    # Update password
    hashed_password = bcrypt.generate_password_hash(new_password).decode("utf-8")
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": hashed_password}}
    )
    return jsonify({"message": "Password changed successfully"}), 200   


@user_bp.route("/auth/oauth", methods=["POST"])
def oauth_callback():
    data = request.json
    token = data.get("token")
    provider = data.get("provider")

    user_info = None

    if provider == "google":
        r = request.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": f"Bearer {token}"})
        user_info = r.json()
    elif provider == "facebook":
        r = request.get(f"https://graph.facebook.com/me?fields=id,name,email&access_token={token}")
        user_info = r.json()
    elif provider == "apple":
        # Apple provides ID token as JWT - decode using `pyjwt`
        import jwt
        user_info = jwt.decode(token, options={"verify_signature": False})
    elif provider == "twitter":
        # Twitter requires OAuth1.0a flow — separate endpoint needed
        return jsonify({"error": "Twitter login not yet supported"}), 501

    if not user_info:
        return jsonify({"error": "Failed to fetch user info"}), 400

    email = user_info.get("email") or user_info.get("sub")
    user = users_collection.find_one({"email": email})
    if not user:
        user = {
            "email": email,
            "provider": provider,
            "external_id": user_info.get("sub") or user_info.get("id"),
            "name": user_info.get("name") or "",
            "user_settings": {"notification_frequency": "daily"},
        }
        users_collection.insert_one(user)

    token = create_access_token(identity=str(user["_id"]))
    return jsonify({"token": token, "user": user})


@user_bp.route("/email-exists", methods=["GET"])
def check_email_exists():
    email = request.args.get("email")
    if not email:
        return jsonify({"error": "Email is required"}), 400

    exists = users_collection.find_one({"email": email}) is not None
    return jsonify({"exists": exists}), 200
