import React, { useState } from "react";
import { View, Text, Switch, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import BottomNavigation from "./BottomNavigation";

const SettingsScreen = () => {
  const [darkMode, setDarkMode] = useState(false);
  const navigation = useNavigation();

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const handleLogout = () => {
    // TODO: Implement logout functionality
    console.log("User logged out");
  };

  return (
    <>
      <View style={styles.container}>
        {/* <Text style={styles.title}>Settings</Text> */}

        {/* Payment Settings */}
        <TouchableOpacity 
          style={styles.settingRow} 
          onPress={() => navigation.navigate("PaymentMethodSettingScreen")}
        >
          <Text style={styles.settingText}>Payment Settings</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {/* Notification Settings */}
        <TouchableOpacity 
          style={styles.settingRow} 
          onPress={() => navigation.navigate("NotificationSettingsScreen")}
        >
          <Text style={styles.settingText}>Notification Settings</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        {/* Dark Mode Toggle */}
        <View style={styles.settingToggle}>
          <Text style={styles.settingText}>Dark Mode</Text>
          <Switch value={darkMode} onValueChange={toggleDarkMode} />
        </View>

        {/* Logout Button */}
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
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
