import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { useAuth } from "./auth/AuthContext";
import { fetchProfile, updatePassword } from "./services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNavigation from "./BottomNavigation";

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getProfile = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const data = await fetchProfile(token!); // Fetch profile data
        setEmail(data.email);                    // Update state 
      } catch (error) {
        Alert.alert("Error");
      }
    };
    getProfile();
  }, []);
  

  const handleUpdatePassword = async () => {
    if (!newPassword) {
      Alert.alert("Error", "Password cannot be empty");
      return;
    }
  
    try {
      const token = await AsyncStorage.getItem("token");
      await updatePassword(token!, newPassword); // Send new password to backend
      Alert.alert("Success", "Password updated successfully");
      setNewPassword("");
    } catch (error) {
      Alert.alert("Error");
    }
  };
  

  const handleLogout = async () => {
    await logout();
    Alert.alert("Logged out", "You have been logged out.");
  };

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.label}>Email: {email}</Text>
        
        <TextInput
          style={styles.input}
          placeholder="New Password"
          value={newPassword}
          secureTextEntry
          onChangeText={setNewPassword}
        />
        <Button
          title={loading ? "Updating..." : "Update Password"}
          onPress={handleUpdatePassword}
          disabled={loading}
        />
        <Button title="Logout" onPress={handleLogout} color="red" />
      </View>
      <BottomNavigation activeScreen="Profile" />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
});

export default ProfileScreen;
