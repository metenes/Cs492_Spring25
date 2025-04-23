from functools import wraps
import os
import pymongo
import certifi
import torch
import boto3
import json
import logging
import time
import uuid
# User token 
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Any, Union
from flask import Flask, request, jsonify, Blueprint
from transformers import pipeline
from flask_cors import CORS
from flask_jwt_extended import jwt_required, get_jwt_identity, JWTManager, create_access_token
from flask_bcrypt import Bcrypt
from flask_apscheduler import APScheduler
# import bcrypt
from flask_mail import Mail, Message
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request
from pydantic import BaseModel, Field

from bson import ObjectId
from datetime import datetime, timedelta
# User token 
import jwt

# importing the controller blueprints
from controller.user_controller import user_bp
from controller.sentiments_controller import sentiments_bp
from controller.activities_controller import activities_bp
from controller.journal_controller import journal_bp
from controller.chat_controller import chat_bp, model_bp
from controller.check_in_controller import check_bp
from controller.notification_controller import notification_bp, send_journal_reminders

# importing the database and mail configurations
from utils.database import db, journal_entries_collection, check_in_collection
from utils.mail_config import mail
from utils.jwt_config import jwt_manager
from botocore.exceptions import ClientError
# Chat API from chat.py
# from chat import Chat

app = Flask(__name__)
CORS(app)

# JWT Config

JWT_SECRET = os.getenv("JWT_SECRET", "sentioSecretKey")
JWT_ALGORITHM = "HS256"
app.config['JWT_SECRET_KEY'] = 'sentioSecretKey'  # Replace with a strong random key
app.config['SECRET_KEY'] = 'sentioSecretKey'    # If you want to use the same key for both Flask and JWT
JWT_EXPIRATION_MINUTES = 60 * 24  # 24 hours
app.config["JWT_SECRET"] = os.getenv("JWT_SECRET_KEY", JWT_SECRET)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=1)
# datetime.timedelta(days=1)

# Mail Config (Hide Credentials in Environment Variables)
app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME", "sentiooffical@gmail.com")
app.config["MAIL_PASSWORD"] = "dpgn mvbv kias nmtx"
# app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD", "1234SR714567SR33")

app.config["MAIL_DEFAULT_SENDER"] = ("Sentio App", os.getenv("MAIL_USERNAME", "sentiooffical@gmail.com"))
app.config["MAIL_MAX_EMAILS"] = 5
app.config["MAIL_USE_SSL"] = False
app.config["MAIL_ASCII_ATTACHMENTS"] = False

# app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME", "sentioanalysis.co@gmail.com")
# app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD", "1234SR71456.")


mail.init_app(app)
jwt_manager.init_app(app)
bcrypt = Bcrypt(app)


app.register_blueprint(user_bp, url_prefix="/user")
app.register_blueprint(sentiments_bp, url_prefix="/sentiment")
app.register_blueprint(activities_bp, url_prefix="/activity")
app.register_blueprint(journal_bp, url_prefix="/journal")
app.register_blueprint(chat_bp, url_prefix="/chat")
app.register_blueprint(check_bp, url_prefix="/check-in")
app.register_blueprint(model_bp, url_prefix="/models") # metadata for S3 models 
app.register_blueprint(notification_bp, url_prefix="/notification")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

