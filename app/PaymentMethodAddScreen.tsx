import React, { useState } from "react";
import { StyleSheet, View, TextInput, TouchableOpacity, Text } from "react-native";
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { ArrowLeft } from "lucide-react-native";
import BottomNavigation from "./BottomNavigation";

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

  const navigation = useNavigation<NavigationProp>();

  return (
    <>
      <View style={styles.container}>
        {/* Header with Back Button */}
        <TouchableOpacity onPress={() => navigation.navigate("PaymentMethodSettingScreen")} style={styles.backButton}>
          <ArrowLeft size={24} />
        </TouchableOpacity>
        <Text style={styles.headerText}>Add Payment</Text>

        {/* Cardholder Name */}
        <Text style={styles.label}>Name on Card</Text>
        <TextInput
          style={styles.input}
          placeholder="Name on card"
          value={cardholderName}
          onChangeText={setCardholderName}
        />

        {/* Card Number */}
        <Text style={styles.label}>Card Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Card Number"
          value={cardNumber}
          onChangeText={setCardNumber}
          keyboardType="number-pad"
        />

        {/* Expiry Date & CVV */}
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Expiry Date</Text>
            <TextInput
              style={[styles.input, styles.marginRight]}
              placeholder="MM / YY"
              value={expiry}
              onChangeText={setExpiry}
            />
          </View>
          <View>
            <Text style={styles.label}>CVV</Text>
            <TextInput
              style={[styles.input, styles.cvvInput]}
              placeholder="***"
              value={cvv}
              onChangeText={setCvv}
              keyboardType="number-pad"
              secureTextEntry
            />
          </View>
        </View>

        {/* Billing Address */}
        <Text style={styles.label}>Billing Address</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Billing Address"
          value={billingAddress}
          onChangeText={setBillingAddress}
          multiline
        />

        {/* Save Button */}
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("PaymentMethodSettingScreen")}>
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
    backgroundColor: "white",
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
    backgroundColor: "white",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#000",
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
    backgroundColor: "black",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default PaymentMethodAddScreen;
