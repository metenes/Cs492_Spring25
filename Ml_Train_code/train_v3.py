import torch
from torch.nn import BCEWithLogitsLoss
from torch.utils.data import DataLoader
from torch.optim import AdamW
from transformers import (BertTokenizer, BertForSequenceClassification,
                          DataCollatorWithPadding, get_scheduler)
from datasets import load_dataset
from sklearn.metrics import classification_report, precision_recall_curve, precision_recall_fscore_support
from tqdm import tqdm
import matplotlib.pyplot as plt
import numpy as np
from collections import defaultdict, Counter
import json

###############################################
# 1. Data Loading, Tokenization, Preprocessing
###############################################

# Load GoEmotions dataset
dataset = load_dataset("go_emotions")
train_data, valid_data, test_data = dataset['train'], dataset['validation'], dataset['test']

# Tokenizer and model
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
device = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
model.to(device)

# Label names (from GoEmotions, note that "neutral" is included here)
label_names = dataset["train"].features["labels"].feature.names

def tokenize_function(example):
    return tokenizer(example['text'], padding="max_length", truncation=True, max_length=128)

def format_labels(example):
    multi_hot = [0] * 28
    for label in example['labels']:
        multi_hot[label] = 1
    example['labels'] = multi_hot
    return example

encoded_train = train_data.map(tokenize_function, batched=True).map(format_labels)
encoded_valid = valid_data.map(tokenize_function, batched=True).map(format_labels)
encoded_test = test_data.map(tokenize_function, batched=True).map(format_labels)

data_collator = DataCollatorWithPadding(tokenizer=tokenizer)
for ds in [encoded_train, encoded_valid, encoded_test]:
    ds.set_format("torch", columns=["input_ids", "attention_mask", "labels"])

train_loader = DataLoader(encoded_train, batch_size=32, shuffle=True, collate_fn=data_collator)
valid_loader = DataLoader(encoded_valid, batch_size=32, collate_fn=data_collator)
test_loader = DataLoader(encoded_test, batch_size=32, collate_fn=data_collator)

###############################################
# 2. Define the Custom Hierarchy Using Nested Clusters
###############################################
# This nested structure (excluding "neutral") is based on your specification.
# Note: Corrected typos ("amusment" -> "amusement", "exitment" -> "excitement", etc.)
clusters = [
    [   # First outer branch (positive & ambiguous)
        [   # First sub-branch: positive part 1
            "amusement",
            [ ["excitement", "joy"], "love" ]
        ],
        [   # Second sub-branch: positive part 2
            [ "desire", "optimism" ],
            "caring",
            [ [ ["pride", "admiration"], ["gratitude", "relief"] ], ["approval", "realization"] ]
        ],
        [   # Third sub-branch: ambiguous
            [ "surprise" ],
            [ "curiosity", "confusion" ]
        ]
    ],
    [   # Second outer branch (negative)
        [   # First sub-branch: negative part 1
            [ "fear", "nervousness" ],

           [[ "remorse", "embarrassment" ],[ ["disappointment", "sadness"], ["grief"] ]]
        ],
        [   # Second sub-branch: negative part 2
            [["disgust", ["anger", "annoyance"]], "disapproval"]
        ]
    ]
]

###############################################
# 3. Build Hierarchy Mapping from Nested Structure
###############################################
def get_label_paths(structure, current_path=None):
    """
    Recursively traverse the nested structure to assign a path (list of indices)
    to each label (string).
    """
    if current_path is None:
        current_path = []
    paths = {}
    if isinstance(structure, list):
        for idx, item in enumerate(structure):
            sub_paths = get_label_paths(item, current_path + [idx])
            paths.update(sub_paths)
    elif isinstance(structure, str):
        paths[structure] = current_path
    return paths

def similarity_weight(path1, path2):
    """
    Compute a similarity weight based on the common prefix length:
      - If the two labels are immediate siblings (i.e. share the entire shorter path), return 0.3.
      - If they share at least one level, return 0.1.
      - Otherwise, 0.0.
    """
    common = 0
    for a, b in zip(path1, path2):
        if a == b:
            common += 1
        else:
            break
    if common >= min(len(path1), len(path2)):
        return 0.3
    elif common >= 1:
        return 0.1
    else:
        return 0.0

def build_hierarchy_mapping_from_structure(structure):
    """
    Build a mapping: mapping[label][other_label] = smoothing weight.
    """
    paths = get_label_paths(structure)
    mapping = {}
    for label, path in paths.items():
        mapping[label] = {}
        for other, other_path in paths.items():
            if label == other:
                continue
            mapping[label][other] = similarity_weight(path, other_path)
    return mapping

new_hierarchy_mapping = build_hierarchy_mapping_from_structure(clusters)
# For any label not in our custom structure (e.g., "neutral"), assign 0.0 to all.
for lbl in label_names:
    if lbl not in new_hierarchy_mapping:
        new_hierarchy_mapping[lbl] = {other: 0.0 for other in label_names if other != lbl}

# Optionally, save the new mapping:
with open("new_hierarchy_mapping.json", "w") as f:
    json.dump(new_hierarchy_mapping, f, indent=2)

###############################################
# 4. Hierarchical Smoothing Function
###############################################
def apply_hierarchical_smoothing(binary_targets, label_names, hierarchy_mapping, default_weight=0.0):
    """
    Convert a binary target array (shape: [batch_size, num_labels])
    into soft targets where for each true label, related labels receive the
    corresponding smoothing weight.
    """
    soft_targets = np.copy(binary_targets).astype(np.float32)
    for i in range(binary_targets.shape[0]):
        for idx, val in enumerate(binary_targets[i]):
            if val == 1:
                label = label_names[idx]
                if label in hierarchy_mapping:
                    for related_label, weight in hierarchy_mapping[label].items():
                        if related_label in label_names:
                            rel_idx = label_names.index(related_label)
                            soft_targets[i, rel_idx] = max(soft_targets[i, rel_idx], weight)
    return soft_targets

###############################################
# 5. Loss, Optimizer, and Scheduler Setup
###############################################
# Optionally use Focal Loss; set USE_FOCAL_LOSS=True to try it.
USE_FOCAL_LOSS = True

if USE_FOCAL_LOSS:
    class FocalLoss(torch.nn.Module):
        def __init__(self, alpha=1, gamma=2, reduction='mean'):
            super(FocalLoss, self).__init__()
            self.alpha = alpha
            self.gamma = gamma
            self.reduction = reduction

        def forward(self, inputs, targets):
            BCE_loss = torch.nn.functional.binary_cross_entropy_with_logits(inputs, targets, reduction='none')
            pt = torch.exp(-BCE_loss)
            focal_loss = self.alpha * (1 - pt) ** self.gamma * BCE_loss
            if self.reduction == 'mean':
                return focal_loss.mean()
            elif self.reduction == 'sum':
                return focal_loss.sum()
            else:
                return focal_loss
    criterion = FocalLoss(alpha=1, gamma=2)
else:
    label_counts = Counter([label for example in train_data for label in example['labels']])
    total_labels = sum(label_counts.values())
    class_weights = [total_labels / (len(label_counts) * label_counts.get(i, 1)) for i in range(28)]
    class_weights = torch.tensor(class_weights).to(device)
    criterion = BCEWithLogitsLoss(pos_weight=class_weights)

optimizer = AdamW(model.parameters(), lr=5e-5)
num_training_steps = len(train_loader) * 10  # 10 epochs
scheduler = get_scheduler("linear", optimizer=optimizer, num_warmup_steps=0, num_training_steps=num_training_steps)

###############################################
# 6. Training and Evaluation Functions
###############################################
def train_one_epoch(model, loader, optimizer, criterion, device, label_names, hierarchy_mapping):
    model.train()
    total_loss = 0
    loop = tqdm(loader, leave=False)
    for batch in loop:
        batch = {k: v.to(device) for k, v in batch.items()}
        binary_targets = batch["labels"].cpu().numpy()
        soft_targets_np = apply_hierarchical_smoothing(binary_targets, label_names, hierarchy_mapping)
        soft_targets = torch.tensor(soft_targets_np, dtype=torch.float32, device=device)
        optimizer.zero_grad()
        outputs = model(input_ids=batch["input_ids"], attention_mask=batch["attention_mask"])
        loss = criterion(outputs.logits, soft_targets)
        loss.backward()
        optimizer.step()
        scheduler.step()
        total_loss += loss.item()
        loop.set_postfix(loss=loss.item())
    return total_loss / len(loader)

def find_best_thresholds(y_true, y_probs):
    thresholds = []
    for i in range(y_true.shape[1]):
        precision, recall, thresh = precision_recall_curve(y_true[:, i], y_probs[:, i])
        f1_scores = 2 * (precision * recall) / (precision + recall + 1e-8)
        best_thresh = thresh[np.argmax(f1_scores)]
        thresholds.append(best_thresh)
    return thresholds

def apply_thresholds(probs, thresholds):
    return (probs >= thresholds).astype(int)

def evaluate_with_threshold_tuning(model, loader, criterion, device, label_names, draw_curves=False, save_path="pr_curves"):
    model.eval()
    total_loss = 0
    all_probs, all_labels = [], []
    with torch.no_grad():
        for batch in loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            labels = batch["labels"].float()
            outputs = model(input_ids=batch["input_ids"], attention_mask=batch["attention_mask"])
            loss = criterion(outputs.logits, labels)
            total_loss += loss.item()
            all_probs.append(outputs.logits.sigmoid().cpu().numpy())
            all_labels.append(labels.cpu().numpy())
    y_probs = np.vstack(all_probs)
    y_true = np.vstack(all_labels)
    thresholds = find_best_thresholds(y_true, y_probs)
    y_pred = apply_thresholds(y_probs, thresholds)
    print(classification_report(y_true, y_pred, target_names=label_names, zero_division=0))
    print_macro_micro_scores(y_true, y_pred)
    label_stats(y_true, y_pred, label_names)
    if draw_curves:
        draw_precision_recall_curves(y_true, y_probs, thresholds, label_names, save_path)
    return total_loss / len(loader), y_true, y_pred, thresholds

def print_macro_micro_scores(y_true, y_pred):
    precision, recall, f1, _ = precision_recall_fscore_support(y_true, y_pred, average='macro', zero_division=0)
    print(f"\n🔹 Macro Precision: {precision:.4f}, Recall: {recall:.4f}, F1: {f1:.4f}")
    precision, recall, f1, _ = precision_recall_fscore_support(y_true, y_pred, average='micro', zero_division=0)
    print(f"🔸 Micro Precision: {precision:.4f}, Recall: {recall:.4f}, F1: {f1:.4f}")

def label_stats(y_true, y_pred, label_names):
    missed, false_positives = defaultdict(int), defaultdict(int)
    for t, p in zip(y_true, y_pred):
        for i, (ti, pi) in enumerate(zip(t, p)):
            if ti == 1 and pi == 0:
                missed[label_names[i]] += 1
            elif ti == 0 and pi == 1:
                false_positives[label_names[i]] += 1
    print("\n❌ Most Missed Labels:")
    for label, count in sorted(missed.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"{label}: {count}")
    print("\n⚠️ Most Common False Positives:")
    for label, count in sorted(false_positives.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"{label}: {count}")

def draw_precision_recall_curves(y_true, y_probs, thresholds, label_names, save_dir):
    import os
    os.makedirs(save_dir, exist_ok=True)
    for i, label in enumerate(label_names):
        precision, recall, _ = precision_recall_curve(y_true[:, i], y_probs[:, i])
        f1_scores = 2 * (precision * recall) / (precision + recall + 1e-8)
        best_thresh = thresholds[i]
        best_idx = np.argmax(f1_scores)
        plt.figure()
        plt.plot(recall, precision, label='PR curve')
        plt.scatter(recall[best_idx], precision[best_idx], marker='o', color='red', label=f'Best threshold: {best_thresh:.2f}')
        plt.title(f'Precision-Recall curve for {label}')
        plt.xlabel('Recall')
        plt.ylabel('Precision')
        plt.legend()
        plt.savefig(f"{save_dir}/pr_{label.replace(' ', '_')}.png")
        plt.close()

###############################################
# 7. Training Loop with Hierarchical Smoothing
###############################################
epochs = 10
best_loss = float('inf')
patience = 3
no_improve_epochs = 0

for epoch in range(epochs):
    print(f"\nEpoch {epoch + 1}/{epochs}")
    train_loss = train_one_epoch(model, train_loader, optimizer, criterion, device, label_names, new_hierarchy_mapping)
    val_loss, _, _, thresholds = evaluate_with_threshold_tuning(
        model, valid_loader, criterion, device, label_names, draw_curves=(epoch == 0)
    )
    print(f"Training Loss: {train_loss:.4f}, Validation Loss: {val_loss:.4f}")
    if val_loss < best_loss:
        best_loss = val_loss
        no_improve_epochs = 0
        torch.save(model.state_dict(), "best_model_v2.pt")
        print("✅ Best model saved.")
    else:
        no_improve_epochs += 1
        if no_improve_epochs >= patience:
            print("⛔ Early stopping triggered.")
            break
    with open("best_thresholds.json", "w") as f:
        json.dump({name: float(th) for name, th in zip(label_names, thresholds)}, f)

###############################################
# 8. Final Test Evaluation
###############################################
model.load_state_dict(torch.load("best_model_v2.pt"))
test_loss, test_labels, test_preds, _ = evaluate_with_threshold_tuning(
    model, test_loader, criterion, device, label_names, draw_curves=True, save_path="test_pr_curves"
)
print(f"\n🧪 Test Loss: {test_loss:.4f}")
