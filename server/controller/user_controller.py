from flask import Blueprint, request, jsonify, current_app
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token
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


# Initialize Blueprint for user routes
user_bp = Blueprint("user_bp", __name__)

# Initialize bcrypt instance
bcrypt = Bcrypt()

# ---------------------------------------
#  ** S3 Configure ** Profile Images only 
# ---------------------------------------

# AWS S3 bucket
S3_BUCKET = "sentiobucket"

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
            "created_at": registration_time,
            "name": "User Name",
            "bio": "User biography or description",
            "phone": "+1234567890",
            "location": "City, Country",
            "profileImageUrl": "",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "last_login": datetime.now(),
            "preferences": {
                "darkMode": "false",
                "notifications": {
                "email": "false",
                "push": "false"
                },
                "language": "en"
            },
            "account_status": "active",  # active, suspended, deactivated
            "role": "user"               # user, admin
        }
        users_collection.insert_one(new_user)
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

        print(f"🔹 Login Attempt: email={email}, password={password}")

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        # Fetch user from MongoDB
        user = users_collection.find_one({"email": email})
        if not user:
            return jsonify({"error": "Invalid credentials"}), 401

        # Check password
        if not bcrypt.check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid credentials"}), 401

        # Generate JWT token
        access_token = create_access_token(identity=str(user["_id"]))  # You can pass user ID as string
        print(f"LOGIN {access_token}")

        return jsonify({"access_token": access_token}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
#  **Forgot Password**
# ---------------------------------------
@user_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    try:
        data = request.json
        email = data.get("email")
        print(f"🔍 Received email: {email}")  # Debug log

        user = users_collection.find_one({"email": email})
        if not user:
            print("❌ User not found in DB")
            return jsonify({"error": "User not found"}), 404

        reset_token = create_access_token(identity=str(user["_id"]), expires_delta=timedelta(minutes=15))

        # MODIFY HERE SIMIAR TI API FOR NOW, WE WILL SORT THIS OUT SMHW - TODO
        
        # const API_URL = "http://10.0.2.2:5000"; // Mete's API - LAN
        # const API_URL = "http://192.168.1.103:5000"; // Bilkent Dorms - LAN 
        # const API_URL = "http://192.168.1.104:5000";
        # const API_URL = "http://10.203.122.69:5000";
        # const API_URL = "http://192.168.1.82:5000"; // Melisa's API - LAN

        reset_link = f"http://http://192.168.1.104:5000/reset-password?token={reset_token}"

        print(f"✅ Reset link: {reset_link}")

        # Create a more descriptive email
        msg = Message(
            "Password Reset Request for Your Account", 
            sender=("Sentio Support", current_app.config["MAIL_USERNAME"]), 
            recipients=[email]
        )
        
        # HTML body for better formatting
        msg.html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>You recently requested to reset your password for your account. Use the button below to reset it.</p>
            <p style="margin: 25px 0;">
                <a href="{reset_link}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Your Password</a>
            </p>
            <p>This password reset link is only valid for the next 15 minutes.</p>
            <p>If you did not request a password reset, please ignore this email or contact support if you have questions.</p>
            <p>Regards,<br>The Sentio Team</p>
        </div>
        """
        
        # Plain text alternative for email clients that don't support HTML
        msg.body = f"""
        Password Reset Request for Your Account
        
        You recently requested to reset your password for your account. Click the link below to reset it:
        
        {reset_link}
        
        This password reset link is only valid for the next 15 minutes.
        
        If you did not request a password reset, please ignore this email or contact support if you have questions.
        
        Regards,
        The Sentio Team
        """
        
        mail.send(msg)

        return jsonify({"message": "Password reset email sent"}), 200
    except Exception as e:
        print(f"🔥 Exception: {e}")  # Print exact error
        import traceback
        traceback.print_exc()  # Print full traceback for better debugging
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
#  **Reset Password**
# ---------------------------------------
@user_bp.route("/reset-password", methods=["POST"])
def reset_password():
    try:
        data = request.json
        token = data.get("token")
        new_password = data.get("newPassword")

        if not token or not new_password:
            return jsonify({"error": "Invalid request"}), 400

        try:
            decoded_token = decode_token(token)
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
#  **Delete User**
# ---------------------------------------


