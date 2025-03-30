import React, { useState } from "react";
import { View, Text, Switch, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import BottomNavigation from "./BottomNavigation";
import { useAuth } from "./auth/AuthContext"; // ✅ Correct import
import { logoutDB } from "./services/ApiService";
import { RootStackParamList } from "./types/types"; // Import route types
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type SettingScreenNavigationProp = NativeStackNavigationProp<
RootStackParamList,
"Login", 
"PaymentMethodSettingScreen"
>;

const SettingsScreen = () => {
  const [darkMode, setDarkMode] = useState(false);
  const navigation = useNavigation<SettingScreenNavigationProp>();
  const { logout } = useAuth(); // ✅ Get logout function from AuthContext

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const handleLogout = () => {
    logoutDB(); 
    console.log("✅ DB logout ");
    logout(); // ✅ Call logout from AuthContext
    console.log("✅ User token removed out successfully");
    navigation.navigate("Login"); 
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

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

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
