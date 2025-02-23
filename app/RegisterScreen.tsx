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
import { registerUser } from "./services/ApiService";
import { RootStackParamList } from "./types/types"; // Import route types
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

// Get screen width & height for responsiveness
const { width, height } = Dimensions.get("window");

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Register">;

const RegisterScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigation = useNavigation<RegisterScreenNavigationProp>();

  const handleRegister = async () => {
    try {
      await registerUser(email, password);
      Alert.alert("Success", "Registration successful. You can now log in.");
      navigation.navigate("Login");
    } catch (error) {
      Alert.alert("Registration Failed");
    }
  };

  return (
    <View style={styles.container}>
      {/* App Title */}
      <Text style={styles.appTitle}>Sentio</Text>
      <Text style={styles.subtitle}>Create an account</Text>

      {/* Email Input */}
      <TextInput
        style={styles.input}
        placeholder="email@domain.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {/* Password Input */}
      <TextInput
        style={styles.input}
        placeholder="password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
      />

      {/* Register Button */}
      <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
        <Text style={styles.registerButtonText}>Register</Text>
      </TouchableOpacity>

      {/* Navigate to Login */}
      <Text style={styles.loginText}>Already have an account?</Text>
      <Text style={styles.loginLink} onPress={() => navigation.navigate("Login")}>
        Log in
      </Text>
    </View>
  );
};

// 🔹 RESPONSIVE STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: width * 0.03, // 3% of screen width
    backgroundColor: "#FFFFFF",
  },
  appTitle: {
    fontSize: width * 0.08, // 8% of screen width
    fontWeight: "bold",
    marginBottom: height * 0.02, // 2% of screen height
  },
  subtitle: {
    fontSize: width * 0.045, // 4.5% of screen width
    color: "#666",
    marginBottom: height * 0.04, // 4% of screen height
  },
  input: {
    width: "90%", // 90% of screen width
    height: height * 0.06, // 6% of screen height
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: "#F4F4F4",
    marginBottom: height * 0.02, // 2% of screen height
  },
  registerButton: {
    width: "90%",
    backgroundColor: "#000000",
    paddingVertical: height * 0.018, // 1.8% of screen height
    borderRadius: 8,
    alignItems: "center",
    marginBottom: height * 0.025, // 2.5% of screen height
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: width * 0.045, // 4.5% of screen width
    fontWeight: "bold",
  },
  loginText: {
    fontSize: width * 0.04, // 4% of screen width
    color: "#666",
  },
  loginLink: {
    fontSize: width * 0.04, // 4% of screen width
    color: "#007bff",
    marginBottom: height * 0.1,
    textDecorationLine: "underline",
  },
});

export default RegisterScreen;
