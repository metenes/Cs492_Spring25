import React, { useState } from "react";
import { StyleSheet, View, TextInput, TouchableOpacity, Text } from "react-native";
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';;
import { CreditCard, Calendar, Lock, Building } from 'lucide-react';

type RootStackParamList = {
  AddPaymentMethod: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'AddPaymentMethod'>;

export const PaymentMethodAddScreen = () => {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Card Number"
        value={cardNumber}
        onChangeText={setCardNumber}
        keyboardType="number-pad"
      />
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex1, styles.marginRight]}
          placeholder="MM/YY"
          value={expiry}
          onChangeText={setExpiry}
        />
        <TextInput
          style={[styles.input, styles.cvvInput]}
          placeholder="CVV"
          value={cvv}
          onChangeText={setCvv}
          keyboardType="number-pad"
          secureTextEntry
        />
      </View>
      <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Add Card</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    padding: 16,
  },
  input: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
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
  },
  button: {
    backgroundColor: "#3B82F6",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default PaymentMethodAddScreen