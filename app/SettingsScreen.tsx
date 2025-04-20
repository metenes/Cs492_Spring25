import React, { useState } from "react";
import { View, Text, Switch, TouchableOpacity, StyleSheet, TextInput, Modal } from "react-native";
import { useNavigation } from "@react-navigation/native";
import BottomNavigation from "./BottomNavigation";
import { useAuth } from "./auth/AuthContext";
import { logoutDB, changePassword } from "./services/ApiService";
import { RootStackParamList } from "./types/types"; // Import route types
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";

type SettingScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Login",
  "PaymentMethodSettingScreen"
>;

const SettingsScreen = () => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [openPasswordChangeModal, setOpenPasswordChangeModal] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const navigation = useNavigation<SettingScreenNavigationProp>();
  const { logout } = useAuth();

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const handleLogout = () => {
    logoutDB();
    logout(); // ✅ Call logout from AuthContext
    navigation.navigate("Login");
  };

  const handleChangePasswordModal = () => { setOpenPasswordChangeModal(true); };

  const handleChangePassword = async () => {
    const userToken = await AsyncStorage.getItem('userToken');
    if (!userToken) {
      alert("User token not found. Please login again.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("New password and confirm password do not match.");
      return;
    }
    if (oldPassword === "" || newPassword === "" || confirmPassword === "") {
      alert("Please fill in all fields.");
      return;
    }
    try {
      const response = await changePassword(userToken, oldPassword, newPassword);
      if (response.status === 200) {
        alert("Password changed successfully.");
        setOpenPasswordChangeModal(false);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        alert("Failed to change password. " + response.message);
      }
    }
    catch (error) {
      alert("An error occurred while changing the password. Please try again.");
    }
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => navigation.navigate("PaymentMethodSettingScreen")}
        >
          <Text style={styles.settingText}>Payment Settings</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => navigation.navigate("NotificationSettingsScreen")}
        >
          <Text style={styles.settingText}>Notification Settings</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.settingToggle}>
          <Text style={styles.settingText}>Dark Mode</Text>
          <Switch value={darkMode} onValueChange={toggleDarkMode} />
        </View>
        <TouchableOpacity style={styles.changePasswordButton} onPress={handleChangePasswordModal}>
          <Text style={styles.logoutText}>Change Password</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
      {openPasswordChangeModal && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={openPasswordChangeModal}
          onRequestClose={() => setOpenPasswordChangeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Change Password</Text>

              <View style={{ position: "relative" }}>
                <TextInput
                  placeholder="Old Password"
                  secureTextEntry={!showOldPassword}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  style={styles.input}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowOldPassword(prev => !prev)}
                >
                  <Feather name={showOldPassword ? "eye" : "eye-off"} size={20} color="#007BFF" />
                </TouchableOpacity>

              </View>

              <View style={{ position: "relative" }}>
                <TextInput
                  placeholder="New Password"
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  style={styles.input}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowNewPassword(prev => !prev)}
                >
                  <Feather name={showNewPassword ? "eye" : "eye-off"} size={20} color="#007BFF" />
                </TouchableOpacity>
              </View>

              <View style={{ position: "relative" }}>
                <TextInput
                  placeholder="Confirm New Password"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={styles.input}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(prev => !prev)}
                >
                  <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={20} color="#007BFF" />
                </TouchableOpacity>
              </View>


              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setOpenPasswordChangeModal(false)} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { handleChangePassword(); }} style={styles.confirmButton}>
                  <Text style={styles.confirmButtonText}>Update</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <BottomNavigation activeScreen="Settings" />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  settingToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  settingText: {
    fontSize: 16,
    color: "#333",
  },
  arrow: {
    fontSize: 18,
    color: "#999",
  },
  changePasswordButton: {
    marginTop: 40,
    backgroundColor: "#007BFF",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: "#ccc",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: "#333",
  },
  confirmButton: {
    backgroundColor: "#007BFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  eyeButton: {
    position: "absolute",
    right: 10,
    top: 12,
    padding: 5,
  },
  eyeText: {
    color: "#007BFF",
    fontSize: 14,
  },
  logoutButton: {
    marginTop: 40,
    backgroundColor: "#ff4d4d",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "bold",
  },
});

export default SettingsScreen;
