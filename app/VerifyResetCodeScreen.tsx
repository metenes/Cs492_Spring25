import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { verifyResetCode } from "./services/ApiService";
import { RootStackParamList } from "./types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type RouteProps = RouteProp<RootStackParamList, "VerifyResetCode">;
type NavigationProps = NativeStackNavigationProp<RootStackParamList, "VerifyResetCode">;

const VerifyResetCodeScreen = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { email, token } = route.params;

  const handleVerify = async () => {
    if (!code.trim()) {
      Alert.alert("Error", "Please enter the verification code.");
      return;
    }
  
    setLoading(true);
    try {
      const backendToken = await verifyResetCode(email, code, token);
      if (token) {
        // Pass both email and code for the next step
        navigation.navigate("ResetPassword", { email, code, token: backendToken });
      } else {
        Alert.alert("Error", "Invalid code or expired.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to verify code.");
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Enter Verification Code</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        maxLength={6}
        placeholder="6-digit code"
        value={code}
        onChangeText={setCode}
      />
      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#fff" },
  header: { fontSize: 24, marginBottom: 20, textAlign: "center" },
  input: { borderWidth: 1, padding: 10, fontSize: 18, borderRadius: 6, marginBottom: 20 },
  button: { backgroundColor: "#000", padding: 15, borderRadius: 6, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 18 }
});

export default VerifyResetCodeScreen;
