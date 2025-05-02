import React, { useState } from "react";
import { View, Text, Switch, TouchableOpacity, StyleSheet, TextInput, Modal } from "react-native";
import { useNavigation } from "@react-navigation/native";
import BottomNavigation from "./BottomNavigation";
import { useAuth } from "./auth/AuthContext";
import { logoutUser, changePassword } from "./services/ApiService";
import { RootStackParamList } from "./types/types"; // Import route types
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "./context/ThemeContext";

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
  const navigation = useNavigation<SettingScreenNavigationProp>();
  const { logout } = useAuth();
  const { theme, darkMode } = useTheme();

  const handleLogout = () => {
    logoutUser();
    logout();
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
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity
          style={[styles.settingRow, { borderBottomColor: theme.border }]}
          onPress={() => navigation.navigate("PaymentMethodSettingScreen")}
        >
          <Text style={[styles.settingText, { color: theme.text }]}>Payment Settings</Text>
          <Text style={[styles.arrow, { color: theme.placeholder }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, { borderBottomColor: theme.border }]}
          onPress={() => navigation.navigate("NotificationSettingsScreen")}
        >
          <Text style={[styles.settingText, { color: theme.text }]}>Notification Settings</Text>
          <Text style={[styles.arrow, { color: theme.placeholder }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, { borderBottomColor: theme.border }]}
          onPress={() => navigation.navigate("ContactSupport")}
        >
          <Text style={[styles.settingText, { color: theme.text }]}>FAQ & Support</Text>
          <Text style={[styles.arrow, { color: theme.placeholder }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.changePasswordButton, { backgroundColor: darkMode ? '#2d2d2d' : '#1a1a1a' }]} 
          onPress={handleChangePasswordModal}
        >
          <Text style={styles.logoutText}>Change Password</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: darkMode ? '#2d2d2d' : '#1a1a1a' }]} 
          onPress={handleLogout}
        >
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
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <View style={[styles.modalContent, { backgroundColor: darkMode ? '#1a1a1a' : theme.backgroundColor }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Change Password</Text>

              <View style={{ position: "relative" }}>
                <TextInput
                  placeholder="Old Password"
                  placeholderTextColor={theme.placeholder}
                  secureTextEntry={!showOldPassword}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  style={[styles.input, { 
                    backgroundColor: darkMode ? '#2d2d2d' : '#f0f0f0',
                    borderColor: theme.border,
                    color: theme.text
                  }]}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowOldPassword(prev => !prev)}
                >
                  <Feather name={showOldPassword ? "eye" : "eye-off"} size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>

              <View style={{ position: "relative" }}>
                <TextInput
                  placeholder="New Password"
                  placeholderTextColor={theme.placeholder}
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  style={[styles.input, { 
                    backgroundColor: darkMode ? '#2d2d2d' : '#f0f0f0',
                    borderColor: theme.border,
                    color: theme.text
                  }]}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowNewPassword(prev => !prev)}
                >
                  <Feather name={showNewPassword ? "eye" : "eye-off"} size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>

              <View style={{ position: "relative" }}>
                <TextInput
                  placeholder="Confirm New Password"
                  placeholderTextColor={theme.placeholder}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={[styles.input, { 
                    backgroundColor: darkMode ? '#2d2d2d' : '#f0f0f0',
                    borderColor: theme.border,
                    color: theme.text
                  }]}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(prev => !prev)}
                >
                  <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  onPress={() => setOpenPasswordChangeModal(false)} 
                  style={[styles.cancelButton, { backgroundColor: darkMode ? '#2d2d2d' : '#1a1a1a' }]}
                >
                  <Text style={[styles.cancelButtonText, { color: '#fff' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleChangePassword} 
                  style={[styles.confirmButton, { backgroundColor: darkMode ? '#2d2d2d' : '#1a1a1a' }]}
                >
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
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingText: {
    fontSize: 16,
  },
  arrow: {
    fontSize: 18,
  },
  changePasswordButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
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
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  cancelButtonText: {
    fontWeight: "bold",
  },
  confirmButton: {
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
  logoutButton: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});

export default SettingsScreen;
