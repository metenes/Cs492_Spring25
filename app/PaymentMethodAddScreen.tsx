import React, { useState } from "react";
import { StyleSheet, View, TextInput, TouchableOpacity, Text } from "react-native";
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ArrowLeft } from "lucide-react-native";
import BottomNavigation from "./BottomNavigation";
import { useTheme } from "./context/ThemeContext";

// Define navigation types
type RootStackParamList = {
  PaymentMethodAddScreen: undefined;
  PaymentMethodSettingScreen: undefined;
};
type NavigationProp = StackNavigationProp<RootStackParamList, 'PaymentMethodAddScreen'>;

export const PaymentMethodAddScreen = () => {
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const { theme, darkMode } = useTheme();

  const navigation = useNavigation<NavigationProp>();

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.headerText, { color: theme.text }]}>Add Payment</Text>

        {/* Cardholder Name */}
        <Text style={[styles.label, { color: theme.text }]}>Name on Card</Text>
        <TextInput
          style={[styles.input, { 
            backgroundColor: darkMode ? '#2d2d2d' : '#f0f0f0',
            borderColor: theme.border,
            color: theme.text
          }]}
          placeholder="Name on card"
          placeholderTextColor={theme.placeholder}
          value={cardholderName}
          onChangeText={setCardholderName}
        />

        {/* Card Number */}
        <Text style={[styles.label, { color: theme.text }]}>Card Number</Text>
        <TextInput
          style={[styles.input, { 
            backgroundColor: darkMode ? '#2d2d2d' : '#f0f0f0',
            borderColor: theme.border,
            color: theme.text
          }]}
          placeholder="Card Number"
          placeholderTextColor={theme.placeholder}
          value={cardNumber}
          onChangeText={setCardNumber}
          keyboardType="number-pad"
        />

        {/* Expiry Date & CVV */}
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={[styles.label, { color: theme.text }]}>Expiry Date</Text>
            <TextInput
              style={[styles.input, styles.marginRight, { 
                backgroundColor: darkMode ? '#2d2d2d' : '#f0f0f0',
                borderColor: theme.border,
                color: theme.text
              }]}
              placeholder="MM / YY"
              placeholderTextColor={theme.placeholder}
              value={expiry}
              onChangeText={setExpiry}
            />
          </View>
          <View>
            <Text style={[styles.label, { color: theme.text }]}>CVV</Text>
            <TextInput
              style={[styles.input, styles.cvvInput, { 
                backgroundColor: darkMode ? '#2d2d2d' : '#f0f0f0',
                borderColor: theme.border,
                color: theme.text
              }]}
              placeholder="***"
              placeholderTextColor={theme.placeholder}
              value={cvv}
              onChangeText={setCvv}
              keyboardType="number-pad"
              secureTextEntry
            />
          </View>
        </View>

        {/* Billing Address */}
        <Text style={[styles.label, { color: theme.text }]}>Billing Address</Text>
        <TextInput
          style={[styles.input, styles.textArea, { 
            backgroundColor: darkMode ? '#2d2d2d' : '#f0f0f0',
            borderColor: theme.border,
            color: theme.text
          }]}
          placeholder="Billing Address"
          placeholderTextColor={theme.placeholder}
          value={billingAddress}
          onChangeText={setBillingAddress}
          multiline
        />

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: darkMode ? '#2d2d2d' : '#1a1a1a' }]} 
          onPress={() => navigation.navigate("PaymentMethodSettingScreen")}
        >
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>
      </View>
      <BottomNavigation activeScreen="PaymentMethodAddScreen" />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 8,
  },
  backButton: {
    position: "absolute",
    top: 8,
    left: 16,
    padding: 8,
  },
  headerText: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 30,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  input: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    marginBottom: 12,
  },
  flex1: {
    flex: 1,
  },
  marginRight: {
    marginRight: 8,
  },
  cvvInput: {
    width: 80,
    textAlign: "center",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  button: {
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default PaymentMethodAddScreen;
