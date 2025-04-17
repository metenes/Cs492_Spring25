# ========================= trainer_server.py (on EC2) =========================
import os, json, torch, boto3
from flask import Flask, request, jsonify
from transformers import BertTokenizer, BertForSequenceClassification
from torch.utils.data import DataLoader, Dataset
from sklearn.preprocessing import MultiLabelBinarizer

app = Flask(__name__)
BUCKET = "sentiobucket"
s3 = boto3.client("s3")
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
mlb = MultiLabelBinarizer(classes=list(range(28)))

class EmotionDataset(Dataset):
    def __init__(self, inputs, labels):
        self.inputs = tokenizer(inputs, padding="max_length", truncation=True, max_length=128, return_tensors="pt")
        self.labels = torch.tensor(labels, dtype=torch.float32)

    def __getitem__(self, idx):
        return {key: val[idx] for key, val in self.inputs.items()}, self.labels[idx]

    def __len__(self):
        return len(self.labels)

@app.route("/retrain", methods=["POST"])
def retrain():
    try:
        user_id = request.json.get("user_id")
        key = f"training_data/{user_id}.json"
        local_json = f"/tmp/{user_id}_data.json"
        s3.download_file(BUCKET, key, local_json)
        data = json.load(open(local_json))
        dataset = EmotionDataset(data["inputs"], mlb.fit_transform(data["labels"]))
        loader = DataLoader(dataset, batch_size=8, shuffle=True)
        model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
        optimizer = torch.optim.AdamW(model.parameters(), lr=1e-5)

        for epoch in range(2):
            model.train()
            for batch, targets in loader:
                optimizer.zero_grad()
                outputs = model(**batch).logits
                loss = torch.nn.functional.binary_cross_entropy_with_logits(outputs, targets)
                loss.backward()
                optimizer.step()

        torch.save(model.state_dict(), f"/tmp/{user_id}_model.pt")
        s3.upload_file(f"/tmp/{user_id}_model.pt", BUCKET, f"models/{user_id}/model.pt")
        return jsonify({"status": "updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8081)
