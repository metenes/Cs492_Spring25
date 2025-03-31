import React, { useState } from "react";
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Text, 
  Dimensions, 
  ActivityIndicator 
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { resetPassword } from "./services/ApiService";
import { RootStackParamList } from "./types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

const { width, height } = Dimensions.get("window");

type ResetPasswordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "ResetPasswordScreen">;

const ResetPasswordScreen = ({ route }: { route: any }) => {
  const { token } = route.params;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<ResetPasswordScreenNavigationProp>();

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await resetPassword(token, newPassword);
      Alert.alert("Success", "Your password has been reset successfully!");
      navigation.navigate("Login");
    } catch (error: unknown) {
      let errorMessage = "An unknown error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message.includes("400")
          ? "Invalid or expired reset token."
          : error.message;
      }
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.appTitle}>Sentio</Text>
      <Text style={styles.subtitle}>Set a New Password</Text>

      <TextInput
        style={styles.input}
        placeholder="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        testID="new-password-input"
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        testID="confirm-password-input"
      />

      <TouchableOpacity 
        style={[styles.resetButton, loading && styles.disabledButton]} 
        onPress={handleResetPassword}
        disabled={loading}
        testID="submit-reset-button"
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.resetButtonText}>Reset Password</Text>}
      </TouchableOpacity>

      <Text style={styles.backToLoginText} onPress={() => navigation.navigate("Login")} testID="back-to-login">
        Back to Login
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  appTitle: {
    fontSize: width * 0.08,
    fontWeight: "bold",
    marginBottom: height * 0.02,
  },
  backToLoginText: {
    fontSize: width * 0.04,
    color: "#007bff",
    textDecorationLine: "underline",
  },
  container: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: width * 0.03,
  },
  subtitle: {
    fontSize: width * 0.045,
    color: "#666",
    marginBottom: height * 0.04,
  },
  input: {
    width: "90%",
    height: height * 0.06,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: "#F4F4F4",
    marginBottom: height * 0.02,
  },
  resetButton: {
    width: "90%",
    backgroundColor: "#000000",
    paddingVertical: height * 0.018,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: height * 0.025,
  },
  resetButtonText: {
    color: "#FFFFFF",
    fontSize: width * 0.045,
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: "#555",
  },
});

export default ResetPasswordScreen;
