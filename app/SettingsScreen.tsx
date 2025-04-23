import React, { useState } from "react";
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import BottomNavigation from "./BottomNavigation";
import { useAuth } from "./auth/AuthContext";
import { logoutDB } from "./services/ApiService";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types/types";

type SettingScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Login"
>;

const SettingsScreen = () => {
  const [darkMode, setDarkMode] = useState(false);
  const navigation = useNavigation<SettingScreenNavigationProp>();
  const { logout } = useAuth();

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const handleLogout = () => {
    logoutDB();
    logout();
    navigation.navigate("Login");
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <Text style={styles.sectionHeader}>Account</Text>

        <View style={styles.card}>
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
        </View>

        <Text style={styles.sectionHeader}>Preferences</Text>

        <View style={styles.card}>
          <View style={styles.settingRow}>
            <Text style={styles.settingText}>Dark Mode</Text>
            <Switch value={darkMode} onValueChange={toggleDarkMode} />
          </View>
        </View>

        <Text style={styles.sectionHeader}>Danger Zone</Text>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNavigation activeScreen="Settings" />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 8,
    color: "#111827",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  settingText: {
    fontSize: 16,
    color: "#111827",
  },
  arrow: {
    fontSize: 20,
    color: "#9CA3AF",
  },
  logoutButton: {
    marginTop: 16,
    backgroundColor: "#EF4444",
    paddingVertical: 16,
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
