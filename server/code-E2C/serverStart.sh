#!/bin/bash

EC2_IP=13.61.141.224
KEY_PATH="SentioKeyPair.pem"
USER="ec2-user"

echo -i "Starting all services on $EC2_IP..."

ssh -i "$KEY_PATH" $USER@$EC2_IP << EOF
    nohup python3 inference_server.py > inference.log 2>&1 &
    nohup python3 trainer_server.py > trainer.log 2>&1 &
    nohup python3 federated_server.py > federated.log 2>&1 &
    echo " All services started on ports 8080, 8081, 8082 on E2c "
EOF

