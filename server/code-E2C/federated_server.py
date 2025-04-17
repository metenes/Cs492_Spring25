 ========================= federated_server.py (on EC2) =========================
import os, json, torch, boto3
from flask import Flask, request, jsonify
from transformers import BertForSequenceClassification

app = Flask(__name__)
s3 = boto3.client("s3")
BUCKET = "sentiobucket"
USER_MODEL_PREFIX = "models/"
GLOBAL_MODEL_KEY = "models/global_model.pt"

@app.route("/aggregate", methods=["POST"])
def aggregate_models():
    user_ids = request.json.get("user_ids")
    if not user_ids:
        return jsonify({"error": "Missing user_ids[]"}), 400

    try:
        state_dicts = []
        for user_id in user_ids:
            local_path = f"/tmp/{user_id}_model.pt"
            s3.download_file(BUCKET, f"models/{user_id}/model.pt", local_path)
            weights = torch.load(local_path, map_location="cpu")
            state_dicts.append(weights)

        # Average weights
        agg_model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
        agg_weights = state_dicts[0]

        for key in agg_weights.keys():
            for i in range(1, len(state_dicts)):
                agg_weights[key] += state_dicts[i][key]
            agg_weights[key] = agg_weights[key] / len(state_dicts)

        agg_model.load_state_dict(agg_weights)
        torch.save(agg_model.state_dict(), "/tmp/global_model.pt")
        s3.upload_file("/tmp/global_model.pt", BUCKET, GLOBAL_MODEL_KEY)

        return jsonify({"status": "Global model aggregated"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8082)