from flask_mail import Mail
from flask import Flask, request, jsonify
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token
import uuid
import datetime
import smtplib
from email.mime.text import MIMEText
from pymongo import MongoClient

mail = Mail()  # Create a global mail instance


