import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Text,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { registerUser, checkEmailExists } from "./services/ApiService"; // ✅ add checkEmailExists
import { RootStackParamList } from "./types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

const { width, height } = Dimensions.get("window");

type RegisterScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Register"
>;

const RegisterScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [emailError, setEmailError] = useState("");

  const navigation = useNavigation<RegisterScreenNavigationProp>();

  const handleEmailBlur = async () => {
    if (!email) return;

    try {
      const exists = await checkEmailExists(email);
      if (exists) {
        setEmailError("Email already in use");
      } else {
        setEmailError("");
      }
    } catch (err) {
      console.log("Email check failed", err);
      setEmailError("Could not verify email");
    }
  };

  const handleRegister = async () => {
    setEmailError("");

    if (!email || !password || !dob) {
      Alert.alert("Missing Fields", "Please fill out all required fields.");
      return;
    }

    if (emailError) {
      Alert.alert("Registration Failed", emailError);
      return;
    }

    try {
      const response = await registerUser(email, password, dob);

      if (response.error) {
        if (response.error.toLowerCase().includes("already")) {
          setEmailError("Email already in use");
          Alert.alert("Registration Failed", "Email already in use.");
        } else {
          Alert.alert("Registration Failed", response.error);
        }
        return;
      }

      Alert.alert("Success", "Registration successful. You can now log in.");
      navigation.navigate("Login");
    } catch (error: any) {
      setEmailError("Something went wrong");
      Alert.alert("Error", error.message || "Please try again later.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.appTitle}>Sentio</Text>
      <Text style={styles.subtitle}>Create an account</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="email@domain.com"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setEmailError("");
        }}
        onBlur={handleEmailBlur} // ✅ live check on blur
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={dob}
        onChangeText={setDob}
        keyboardType="default"
      />

      <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
        <Text style={styles.registerButtonText}>Register</Text>
      </TouchableOpacity>

      <Text style={styles.loginText}>Already have an account?</Text>
      <Text
        style={styles.loginLink}
        onPress={() => navigation.navigate("Login")}
      >
        Log in
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: width * 0.03,
    backgroundColor: "#FFFFFF",
  },
  appTitle: {
    fontSize: width * 0.08,
    fontWeight: "bold",
    marginBottom: height * 0.02,
  },
  subtitle: {
    fontSize: width * 0.045,
    color: "#666",
    marginBottom: height * 0.04,
  },
  label: {
    alignSelf: "flex-start",
    marginLeft: "5%",
    fontSize: width * 0.04,
    fontWeight: "500",
    marginBottom: 4,
  },
  input: {
    width: "90%",
    height: height * 0.06,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: "#F4F4F4",
    marginBottom: height * 0.015,
  },
  errorText: {
    color: "red",
    fontSize: width * 0.035,
    marginBottom: height * 0.015,
    alignSelf: "flex-start",
    marginLeft: "5%",
  },
  registerButton: {
    width: "90%",
    backgroundColor: "#000000",
    paddingVertical: height * 0.018,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: height * 0.025,
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: width * 0.045,
    fontWeight: "bold",
  },
  loginText: {
    fontSize: width * 0.04,
    color: "#666",
  },
  loginLink: {
    fontSize: width * 0.04,
    color: "#007bff",
    marginBottom: height * 0.1,
    textDecorationLine: "underline",
  },
});

export default RegisterScreen;
