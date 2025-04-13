from typing import Optional
from flask_jwt_extended import JWTManager
from flask import request, jsonify
import jwt
import os
from functools import wraps
from datetime import datetime, timedelta

# Environment variables and configuration
JWT_SECRET = os.getenv("JWT_SECRET", "sentioSecretKey")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 60 * 24  # 24 hours

# Initialize Flask JWT Manager
jwt_manager = JWTManager()

# Function to generate a JWT token
def generate_token(user_id):
    token = jwt.encode(
        {
            "user_id": str(user_id),
            "exp": datetime.now() + timedelta(days=1)  # Token expires in 1 day
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )
    return token

# Function to decode a JWT token
def decode_token(token):
    try:
        decoded_token = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return decoded_token["user_id"]
    except jwt.ExpiredSignatureError:
        return {"error": "Token has expired"}
    except jwt.InvalidTokenError:
        return {"error": "Invalid token"}

# Middleware to verify JWT in routes (alternative to @jwt_required())
# Middleware to verify token
def token_required(f):
    @wraps(f)
    def decorator(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"error": "Token is missing"}), 403

        try:
            # Decode the token using the JWT_SECRET
            token = token.split(" ")[1]  # Extract token from "Bearer token" format
            decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            request.user = decoded  # Store decoded data in request for access in route
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(*args, **kwargs)

    return decorator

# ---------------------------------------
# Function to create a JWT token
# ---------------------------------------

#def create_access_token(user_id):
#    payload = {
#        'user_id': user_id,
#        'exp': datetime.utcnow() + timedelta(hours=1)  # Token expiration time (1 hour)
#    }
#    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
#    return token