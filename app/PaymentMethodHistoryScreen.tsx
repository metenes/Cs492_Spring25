import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { ArrowLeft, CreditCard } from "lucide-react-native";

import { StackNavigationProp } from '@react-navigation/stack'; // Binding element 'navigation' implicitly has an 'any' type. 
import { RootStackParamList } from "./types/types";
/**
 * NAVIGATION ERROR 
 * "Binding element 'navigation' implicitly has an 'any' type",
 * happens because TypeScript doesn't know the 
 * type of the navigation prop being passed into your component.
 */

// Define the navigation prop type for the screen
type PaymentMethodHistoryScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PaymentMethodHistoryScreen'
>;
type PaymentMethodHistoryScreenProps = {
  navigation: PaymentMethodHistoryScreenNavigationProp;
};

const PaymentMethodHistoryScreen : React.FC<PaymentMethodHistoryScreenProps>= ({ navigation }) => {
  const payments = [
    { amount: 29.99, status: "Paid", date: "01.12.2024", type: "Subscription fee" },
    { amount: 29.99, status: "Paid", date: "01.11.2024", type: "Subscription fee" },
    { amount: 29.99, status: "Paid", date: "01.10.2024", type: "Subscription fee" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} />
        </TouchableOpacity>
        <Text style={styles.headerText}>Payment History</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {payments.map((payment, index) => (
          <View key={index} style={styles.paymentCard}>
            <View>
              <Text style={styles.amount}>${payment.amount}</Text>
              <View style={styles.statusContainer}>
                <Text style={styles.statusDot}>●</Text>
                <Text style={styles.status}>{payment.status}</Text>
              </View>
              <Text style={styles.type}>{payment.type}</Text>
            </View>
            <Text style={styles.date}>{payment.date}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", padding: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backButton: { padding: 8 },
  headerText: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "bold" },
  content: { paddingBottom: 20 },
  paymentCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  amount: { fontSize: 18, fontWeight: "bold" },
  statusContainer: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  statusDot: { color: "green", fontSize: 14, marginRight: 4 },
  status: { fontSize: 14, color: "green" },
  type: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  date: { fontSize: 14, color: "#6B7280" },
});

export default PaymentMethodHistoryScreen;
