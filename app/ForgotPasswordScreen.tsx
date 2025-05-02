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
import { requestVerificationCode  } from "./services/ApiService";
import { RootStackParamList } from "./types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
      /* const token = await AsyncStorage.getItem("userToken");
      if(!token){
        throw new Error("Token error ");
      }
      const response = await requestPasswordReset(token, email); */
      const response = await requestVerificationCode(email);
      //navigation.navigate("ResetPassword", { email });

      if (response.message) {
        Alert.alert("Success", "A verification code has been sent to your email.");
        //navigation.navigate("ResetPassword", { token: response.token });
        navigation.navigate("VerifyResetCode", { email, token: response.reset_token  });

      } else {
        Alert.alert("Error", "Something went wrong. Please try again.");
        throw new Error("Something went wrong. Please try again");
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
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff"
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 30,
    color: "#4A90E2"
  },
  subtitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333"
  },
  instructions: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#666",
    width: "90%"
  },
  input: {
    width: width * 0.85,
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 20,
    paddingHorizontal: 15,
    fontSize: 16
  },
  resetButton: {
    width: width * 0.85,
    height: 50,
    backgroundColor: "#4A90E2",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20
  },
  disabledButton: {
    backgroundColor: "#A9CBEE"
  },
  resetButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
  backToLoginText: {
    color: "#4A90E2",
    fontSize: 16,
    marginTop: 20
  }
});

export default ForgotPasswordScreen;