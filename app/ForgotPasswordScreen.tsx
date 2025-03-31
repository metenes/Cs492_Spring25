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
import { requestPasswordReset } from "./services/ApiService";
import { RootStackParamList } from "./types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

const { width, height } = Dimensions.get("window");

type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "ResetPassword">;

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<ForgotPasswordScreenNavigationProp>();

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }
  
    setLoading(true);
  
    try {
      const response = await requestPasswordReset(email);
      if (response.message) {
        Alert.alert("Success", "A password reset link has been sent to your email.");
        navigation.navigate("ResetPassword", { token: response.token }); // ✅ Fixed navigation
      } else {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    } catch (error: unknown) {
      let errorMessage = "An unknown error occurred";
      if (error instanceof Error) {
        if (error.message.includes("404")) {
          errorMessage = "Email not registered.";
        } else {
          errorMessage = error.message;
        }
      }
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <View style={styles.container}>
      <Text style={styles.appTitle}>Sentio</Text>
      <Text style={styles.subtitle}>Forgot Your Password?</Text>
      <Text style={styles.instructions}>
        Enter your email, and we will send you a link to reset your password.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="email@domain.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        testID="email-input"
      />

      <TouchableOpacity 
        style={[styles.resetButton, loading && styles.disabledButton]} 
        onPress={handleForgotPassword}
        disabled={loading}
        testID="forgot-password-button"
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.resetButtonText}>Send Reset Link</Text>}
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
    marginBottom: height * 0.02,
  },
  instructions: {
    fontSize: width * 0.04,
    color: "#888",
    textAlign: "center",
    marginBottom: height * 0.03,
    width: "90%",
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

export default ForgotPasswordScreen;
