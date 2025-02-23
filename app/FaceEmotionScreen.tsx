import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Camera, useCameraDevices } from "react-native-vision-camera";
import axios from "axios";

const FaceEmotionScreen = () => {
  const devices = useCameraDevices();
  const cameraDevice =  devices.filter((device) => device.position === 'front')[0]; // Get the front camera
  const [emotion, setEmotion] = useState("Detecting...");
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    (async () => {
      const cameraPermission = await Camera.requestCameraPermission();
      if (cameraPermission.toString() !== "authorized") {
        alert("Camera permission denied");
      }
    })();
  }, []);

  const captureAndAnalyze = async (camera: React.RefObject<Camera>) => {
    if (!camera.current) return;

    try {
        setCapturing(true);
        const photo = await camera.current.takePhoto({
          flash: 'off'
        });

      // Convert to Base64 and send to backend
      // AWS 
      const response = await axios.post("http://api/emotion", {
        image: photo.path,
      });

      setEmotion(response.data.emotion);
    } catch (error) {
      console.error("Error capturing or analyzing image:", error);
    } finally {
      setCapturing(false);
    }
  };

  // Create a ref for the camera
  const cameraRef = React.useRef<Camera>(null);

  if (!cameraDevice) return <Text>No camera found</Text>;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={cameraDevice}
        isActive={true}
        photo={true}
      />
      <Text style={styles.emotionText}>Emotion: {emotion}</Text>

      <TouchableOpacity
        style={[styles.captureButton, capturing && { backgroundColor: "#999" }]}
        onPress={() => captureAndAnalyze(cameraRef)}
        disabled={capturing}
      >
        <Text style={styles.buttonText}>
          {capturing ? "Analyzing..." : "Capture Emotion"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff"
  },
  camera: {
    width: "100%",
    height: 400
  },
  emotionText: {
    fontSize: 18,
    fontWeight: "bold",
    margin: 16
  },
  captureButton: {
    backgroundColor: "#000",
    padding: 12,
    borderRadius: 10
  },
  buttonText: {
    color: "#fff",
    fontSize: 16
  },
});

export default FaceEmotionScreen;