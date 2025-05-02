# 💙 Sentio - AI-Powered Emotional Wellness Companion

> An AI-driven mental health and journaling app that understands your emotions, adapts to your personality, and provides personalized support over time.

![Sentio Banner](./assets/logo_main.png)

---

## 🚀 Features

### 🧠 AI Emotional Insight
- Detect emotions from journal entries, check-ins, chatbot interactions, and facial analysis.
- Advanced deep learning model deployed on AWS for real-time emotion recognition.

### 💬 Chatbot with Personalized AI
- Powered by a personalized language model (LLM) hosted on EC2/SageMaker.
- Gives motivational replies and recommends mindfulness exercises based on detected emotions.
- Continuously improves using per-user interaction data.

### 📓 Journaling & Check-ins
- Guided and free-form journaling.
- Real-time emotional analysis of journal entries.
- Timeline for past entries with filters by type and emotional tag.

### 📷 Facial Emotion Detection
- Capture live emotion states via facial analysis using OpenCV on device or remote inference API.

### 📊 Emotional Analytics Dashboard
- Aggregated trends and dominant emotion charts across the user base.
- Keyword-based insights about public sentiment on specific topics.
- Privacy-focused (only shows anonymous aggregated metrics).

### 👤 User Profile Management
- Profile photo upload to AWS S3.
- Update personal information, preferences, and password.
- Multi-device JWT auth with token expiry.

### 🌙 Dark / Light Mode + Accessibility
- Fully responsive on various screen sizes.
- Supports screen readers and keyboard navigation.

### 🛟 Help & Support
- In-app contact form for technical/emotional support.
- Sends emails to support inbox via Flask backend.

---

## 🛠️ Tech Stack

| Layer          | Tech                                      |
|----------------|-------------------------------------------|
| Frontend       | React Native + Expo                       |
| Backend API    | Python Flask (JWT, MongoDB, Flask-Mail)   |
| Database       | MongoDB Atlas                             |
| AI Models      | PyTorch + HuggingFace Transformers        |
| Cloud Hosting  | AWS EC2, S3, SageMaker, CloudWatch        |
| DevOps         | CI/CD (GitHub Actions), systemd services  |

---

## 📁 Project Structure

```bash
Sentio/
│
├── frontend/              # React Native app
│   ├── screens/           # Journal, Chatbot, Home, Profile etc.
│   ├── auth/              # Login/Register logic
│   ├── services/          # API wrappers
│   ├── components/        # Reusable UI
│
├── backend/               # Flask app
│   ├── routes/            # Blueprint routes (auth, journal, chat, emotion)
│   ├── models/            # MongoDB schemas
│   ├── ml/                # Emotion + LLM inference logic
│   ├── utils/             # S3, token mgmt, etc.
│   └── app.py             # Flask entry point
│
├── inference_server/      # EC2 Inference + Emotion Analysis
│   └── inference_server.py
│
├── model_training/        # Training + personalization logic
│
└── README.md              # This file
