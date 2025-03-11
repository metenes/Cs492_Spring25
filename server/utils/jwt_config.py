from flask_jwt_extended import JWTManager
from flask import request, jsonify
import jwt
import os
from functools import wraps
from datetime import datetime, timedelta

# Load SECRET_KEY from environment variables or use a default
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "sentioSecretKey")

# Initialize Flask JWT Manager
jwt_manager = JWTManager()

# Function to generate a JWT token
def generate_token(user_id):
    token = jwt.encode(
        {
            "user_id": str(user_id),
            "exp": datetime.utcnow() + timedelta(days=1)  # Token expires in 1 day
        },
        SECRET_KEY,
        algorithm="HS256"
    )
    return token

# Function to decode a JWT token
def decode_token(token):
    try:
        decoded_token = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
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
            # Decode the token using the SECRET_KEY
            token = token.split(" ")[1]  # Extract token from "Bearer token" format
            decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.user = decoded  # Store decoded data in request for access in route
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(*args, **kwargs)

    return decorator
