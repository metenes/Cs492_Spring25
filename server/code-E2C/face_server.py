# ========================= emved_server.py (on EC2) =========================
"""
For word2vec embeding for the journal entries, 
guided journal entries and check-ins 
"""

from flask import Flask, request, jsonify
from PIL import Image
import torch, io
from torchvision import transforms
#from model import FacialEmotionModel  # Your `.pt` model structure

app = Flask(__name__)
model = FacialEmotionModel()
model.load_state_dict(torch.load("face_model.pt", map_location="cpu"))
model.eval()

transform = transforms.Compose([
    transforms.Resize((48, 48)),
    transforms.Grayscale(),
    transforms.ToTensor()
])

@app.route("/face-detect", methods=["POST"])
def detect_face_emotion():
    try:
        image = Image.open(io.BytesIO(request.files['image'].read()))
        input_tensor = transform(image).unsqueeze(0)
        with torch.no_grad():
            prediction = model(input_tensor).softmax(dim=1).squeeze().tolist()
        return jsonify({"prediction": prediction})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
