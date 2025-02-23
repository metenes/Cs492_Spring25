import React, { useState } from "react";
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Text, 
  Dimensions 
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { resetPassword } from "./services/ApiService";
import { RootStackParamList } from "./types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

// Get screen width & height dynamically
const { width, height } = Dimensions.get("window");

type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "ForgotPassword">;

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState("");
  const navigation = useNavigation<ForgotPasswordScreenNavigationProp>();

  const handleResetPassword = async () => {
    try {
      await resetPassword(email);
      Alert.alert("Success", "A password reset link has been sent to your email.");
      navigation.navigate("Login");
    } catch (error: unknown) {
      if (error instanceof Error) {
        Alert.alert("Error", error.message);
      } else {
        Alert.alert("Error", "An unknown error occurred");
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.appTitle}>Sentio</Text>
      <Text style={styles.subtitle}>Reset Your Password</Text>

      <TextInput
        style={styles.input}
        placeholder="email@domain.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.resetButton} onPress={handleResetPassword}>
        <Text style={styles.resetButtonText}>Send Reset Link</Text>
      </TouchableOpacity>

      <Text style={styles.backToLoginText} onPress={() => navigation.navigate("Login")}>
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
});

export default ForgotPasswordScreen;
