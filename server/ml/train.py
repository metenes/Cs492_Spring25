import torch
from torch.nn import BCEWithLogitsLoss
from torch.utils.data import DataLoader
from torch.optim import AdamW
from transformers import (BertTokenizer, BertForSequenceClassification,
                          DataCollatorWithPadding, get_scheduler)
from sklearn.metrics import classification_report
from collections import Counter
from datasets import load_dataset
from tqdm import tqdm

# Load GoEmotions dataset..
dataset = load_dataset("go_emotions")
train_data = dataset['train']
valid_data = dataset['validation']
test_data = dataset['test']

# Tokenizer and model
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
model = BertForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=28)
device = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
model.to(device)


# Tokenize and preprocess labels
def tokenize_function(example):
    return tokenizer(example['text'], padding="max_length", truncation=True, max_length=128)


def format_labels(example):
    multi_hot = [0] * 28  # 28 possible labels
    for label in example['labels']:
        multi_hot[label] = 1
    example['labels'] = multi_hot
    return example


# Prepare datasets
encoded_train = train_data.map(tokenize_function, batched=True).map(format_labels)
encoded_valid = valid_data.map(tokenize_function, batched=True).map(format_labels)
encoded_test = test_data.map(tokenize_function, batched=True).map(format_labels)
data_collator = DataCollatorWithPadding(tokenizer=tokenizer)
encoded_train.set_format("torch", columns=["input_ids", "attention_mask", "labels"])
encoded_valid.set_format("torch", columns=["input_ids", "attention_mask", "labels"])
encoded_test.set_format("torch", columns=["input_ids", "attention_mask", "labels"])

# Dataloaders
batch_size = 32
train_loader = DataLoader(encoded_train, batch_size=batch_size, shuffle=True, collate_fn=data_collator)
valid_loader = DataLoader(encoded_valid, batch_size=batch_size, collate_fn=data_collator)
test_loader = DataLoader(encoded_test, batch_size=batch_size, collate_fn=data_collator)

# Compute class weights
label_counts = Counter([label for example in train_data for label in example['labels']])
total_labels = sum(label_counts.values())
class_weights = [total_labels / (len(label_counts) * label_counts.get(i, 1)) for i in range(28)]
class_weights = torch.tensor(class_weights).to(device)

# Loss, optimizer, and scheduler
criterion = BCEWithLogitsLoss(weight=class_weights)
optimizer = AdamW(model.parameters(), lr=5e-5)
num_training_steps = len(train_loader) * 10  # Adjust for 10 epochs
scheduler = get_scheduler("linear", optimizer=optimizer, num_warmup_steps=0, num_training_steps=num_training_steps)


# Training function
def train_one_epoch(model, train_loader, optimizer, criterion, device):
    model.train()
    total_loss = 0
    loop = tqdm(train_loader, leave=False)
    for batch in loop:
        batch = {k: v.to(device) for k, v in batch.items()}
        labels = batch["labels"].float()
        optimizer.zero_grad()
        outputs = model(input_ids=batch["input_ids"], attention_mask=batch["attention_mask"])
        loss = criterion(outputs.logits, labels)
        loss.backward()
        optimizer.step()
        scheduler.step()
        total_loss += loss.item()
        loop.set_postfix(loss=loss.item())
    return total_loss / len(train_loader)


# Validation function
def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss = 0
    all_preds = []
    all_labels = []
    with torch.no_grad():
        for batch in loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            labels = batch["labels"].float()
            outputs = model(input_ids=batch["input_ids"], attention_mask=batch["attention_mask"])
            loss = criterion(outputs.logits, labels)
            total_loss += loss.item()
            preds = (outputs.logits.sigmoid() > 0.5).int()
            all_preds.append(preds.cpu())
            all_labels.append(labels.cpu())
    all_preds = torch.cat(all_preds)
    all_labels = torch.cat(all_labels)
    return total_loss / len(loader), all_labels, all_preds


# Training loop with loss logging and optional early stopping
epochs = 10
best_loss = float('inf')
patience = 3  # Stop if validation loss doesn't improve for this many epochs
no_improve_epochs = 0

for epoch in range(epochs):
    print(f"Epoch {epoch + 1}/{epochs}")
    train_loss = train_one_epoch(model, train_loader, optimizer, criterion, device)
    val_loss, val_labels, val_preds = evaluate(model, valid_loader, criterion, device)

    print(f"Training Loss: {train_loss:.4f}, Validation Loss: {val_loss:.4f}")

    # Save best model
    if val_loss < best_loss:
        best_loss = val_loss
        no_improve_epochs = 0
        torch.save(model.state_dict(), "best_model.pt")
        print("Best model saved.")
    else:
        no_improve_epochs += 1

    # Print classification report for debugging
    label_names = dataset["train"].features["labels"].feature.names
    print(classification_report(val_labels, val_preds, target_names=label_names))

    # Early stopping check
    if no_improve_epochs >= patience:
        print("Early stopping triggered.")
        break

# Test the model
model.load_state_dict(torch.load("best_model.pt"))
test_loss, test_labels, test_preds = evaluate(model, test_loader, criterion, device)
print(f"Test Loss: {test_loss:.4f}")
print(classification_report(test_labels, test_preds, target_names=label_names))
