import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  StyleSheet,
  ScrollView,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

const ProfileScreen = () => {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [email, setEmail] = useState("doga@ozdemir.com");
  const [name, setName] = useState("Doğa Özdemir");
  const [bio, setBio] = useState("Here's a little bit about me...");
  const [phone, setPhone] = useState("+90 555 555 55 55");
  const [location, setLocation] = useState("Remote");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    requestPermissions();
  }, []);

  // ✅ Request permissions for Camera & Media Library
  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || mediaStatus !== "granted") {
      Alert.alert("Permissions Required", "Please enable camera and gallery permissions in settings.");
    }
  };

  // ✅ Pick an image from the gallery (only one image)
  const pickImage = async () => {
    setModalVisible(false);

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [ImagePicker.MediaType.IMAGE], // ✅ Fixes warning
      allowsEditing: true,
      aspect: [1, 1], // Crop to square
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  // ✅ Take a photo using the camera
  const takePhoto = async () => {
    setModalVisible(false);

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: [ImagePicker.MediaType.IMAGE], // ✅ Fixes warning
      allowsEditing: true,
      aspect: [1, 1], // Crop to square
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Display Section */}
      <View style={styles.profileContainer}>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <View style={styles.avatarWrapper}>
            <Image
              source={
                profileImage
                  ? { uri: profileImage }
                  : require("../assets/default-avatar.jpeg")
              }
              style={styles.avatar}
            />
            <View style={styles.editIcon}>
              <Ionicons name="camera-outline" size={18} color="black" />
            </View>
          </View>
        </TouchableOpacity>
        <Text style={styles.username}>{name}</Text>
        <Text style={styles.bio}>{bio}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={18} color="#555" />
          <Text style={styles.infoText}>{email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={18} color="#555" />
          <Text style={styles.infoText}>{phone}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={18} color="#555" />
          <Text style={styles.infoText}>{location}</Text>
        </View>

        <View style={styles.toggleRow}>
          <Ionicons name="moon-outline" size={18} color="#555" />
          <Text style={styles.infoText}>Dark Mode</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} />
        </View>
      </View>

      {/* Editable Section */}
      <View style={styles.editContainer}>
        <Text style={styles.sectionTitle}>Change Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter new password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Retype new password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>

      {/* Image Picker Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity
              onPress={takePhoto}
              style={styles.modalButton}
            >
              <Ionicons name="camera" size={20} color="black" />
              <Text style={styles.modalText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickImage}
              style={styles.modalButton}
            >
              <Ionicons name="image" size={20} color="black" />
              <Text style={styles.modalText}>Photo Library</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalCancel}
            >
              <Text style={styles.modalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  profileContainer: {
    alignItems: "center",
    padding: 15,
    backgroundColor: "#f9f9f9",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  avatarWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  editIcon: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  username: { fontSize: 20, fontWeight: "bold", marginTop: 5 },
  bio: { color: "#666", marginBottom: 10, textAlign: "center", fontSize: 14 },
  infoRow: { flexDirection: "row", alignItems: "center", marginVertical: 4 },
  infoText: { fontSize: 15, marginLeft: 10, color: "#444" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
    marginTop: 10,
  },
  editContainer: { padding: 15 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  saveButton: {
    backgroundColor: "black",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: { color: "white", fontSize: 14, fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
  },
  modalButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  modalText: { fontSize: 16, marginLeft: 10 },
  modalCancel: { padding: 10, alignItems: "center" },
});

export default ProfileScreen;
