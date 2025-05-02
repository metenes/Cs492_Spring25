import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Dimensions } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { verifyResetCode } from "./services/ApiService";
import { RootStackParamList } from "./types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type RouteProps = RouteProp<RootStackParamList, "VerifyResetCode">;
type NavigationProps = NativeStackNavigationProp<RootStackParamList, "VerifyResetCode">;

const { width, height } = Dimensions.get("window");
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
        Alert.alert("Error", "Verification code invalid or expired.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to verify code.");
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <View style={styles.container}>
        <Text style={styles.appTitle}>Sentio</Text>
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
    container: { 
        flex: 1, 
        justifyContent: "center", 
        padding: 20, 
        alignItems: "center",
        backgroundColor: "#fff" },
    header: 
    { fontSize: 24, 
        marginBottom: 20, 
        textAlign: "center" }, 
    appTitle: {
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 30,
        color: "#000"
    },
    input: { 
        borderWidth: 1, 
        width: width * 0.85,
        padding: 10, fontSize: 18, 
        borderRadius: 6, 
        marginBottom: height * 0.02 },
    button: { 
        backgroundColor: "#000", 
        padding: 15, 
        borderRadius: 6, 
        alignItems: "center",
        marginBottom: height * 0.2,
        width: width * 0.40, 
    },
    buttonText: { 
        color: "#fff", 
        fontSize: 18 }
});

export default VerifyResetCodeScreen;
