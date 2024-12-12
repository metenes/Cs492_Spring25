import React, { useState } from "react";
import { View, TextInput, Button, Alert, StyleSheet } from "react-native";
import { resetPassword } from "./services/ApiService";

const PasswordResetScreen = () => {
  const [email, setEmail] = useState("");

  const handleResetPassword = async () => {
    try {
      await resetPassword(email);
      Alert.alert("Success", "Password reset link sent to your email");
    } catch (error) {
      Alert.alert("Error", "Failed to send reset link");
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
      />
      <Button title="Send Reset Link" onPress={handleResetPassword} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
});

export default PasswordResetScreen;
