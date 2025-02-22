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
import { loginUser } from "./services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RootStackParamList } from "./types/types"; // Import route types
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

// Get screen width & height dynamically
const { width, height } = Dimensions.get("window");

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Login">;

const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigation = useNavigation<LoginScreenNavigationProp>();

  const handleLogin = async () => {
    try {
      const response = await loginUser(email, password);
  
      if (!response.access_token) {
        throw new Error("No access token received");
      }
  
      await AsyncStorage.setItem("token", response.access_token);
      Alert.alert("Success", "Logged in successfully!");
      navigation.navigate("Home");
    } catch (error: unknown) {
      if (error instanceof Error) {
        Alert.alert("Login failed", error.message);
      } else {
        Alert.alert("Login failed", "An unknown error occurred");
      }
    }
  };
  

  return (
    <View style={styles.container}>
      {/* App Title */}
      <Text style={styles.appTitle}>Sentio</Text>
      <Text style={styles.subtitle}>Login to journal</Text>

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

      {/* Login Button */}
      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginButtonText}>Login</Text>
      </TouchableOpacity>

      {/* Sign Up & Forgot Password */}
      <Text style={styles.signupText}>Don't have an account?</Text>
      <Text style={styles.signUpLink} onPress={() => navigation.navigate("Register")}>
        Sign up
      </Text>
      <Text style={styles.forgotPasswordText} onPress={() => Alert.alert("Reset Password")}>
        Forgot your password?
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
  loginButton: {
    width: "90%",
    backgroundColor: "#000000",
    paddingVertical: height * 0.018, // 1.8% of screen height
    borderRadius: 8,
    alignItems: "center",
    marginBottom: height * 0.025, // 2.5% of screen height
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: width * 0.045, // 4.5% of screen width
    fontWeight: "bold",
  },
  signupText: {
    fontSize: width * 0.04, // 4% of screen width
    color: "#666",
  },
  signUpLink: {
    fontSize: width * 0.04, // 4% of screen width
    color: "#007bff",
    marginBottom: height * 0.001,
    textDecorationLine: "underline",
  },
  forgotPasswordText: {
    fontSize: width * 0.04, // 4% of screen width
    color: "#007bff",
    textDecorationLine: "underline",
  },
});

export default LoginScreen;
