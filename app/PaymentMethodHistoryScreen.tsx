import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from "./types/types";
import BottomNavigation from "./BottomNavigation";

// Define the navigation prop type for the screen
type PaymentMethodHistoryScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PaymentMethodHistoryScreen'
>;
type PaymentMethodHistoryScreenProps = {
  navigation: PaymentMethodHistoryScreenNavigationProp;
};

const PaymentMethodHistoryScreen: React.FC<PaymentMethodHistoryScreenProps> = ({ navigation }) => {
  const payments = [
    { amount: "₺29,99", status: "Paid", date: "01.12.2024", type: "Subscription fee" },
    { amount: "₺29,99", status: "Paid", date: "01.11.2024", type: "Subscription fee" },
    { amount: "₺29,99", status: "Paid", date: "01.10.2024", type: "Subscription fee" },
  ];

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <TouchableOpacity onPress={() => navigation.navigate("PaymentMethodSettingScreen")} style={styles.backButton}>
          <ArrowLeft size={24} />
        </TouchableOpacity>
        <Text style={styles.headerText}>Payment History</Text>
        
        <ScrollView contentContainerStyle={styles.content}>
          {payments.map((payment, index) => (
            <View key={index} style={styles.paymentCard}>
              <Text style={styles.amount}>{payment.amount}</Text>
              <Text style={styles.status}><Text style={styles.greenDot}>●</Text> {payment.status}</Text>
              <Text style={styles.type}>{payment.type}</Text>
              <Text style={styles.feeDate}>Fee date</Text>
              <Text style={styles.date}>{payment.date}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <BottomNavigation activeScreen="PaymentMethodHistoryScreen" />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white", padding: 16, paddingTop: 8 },
  backButton: { position: "absolute", top: 16, left: 16, padding: 8 },
  headerText: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginTop: 40, marginBottom: 16 },
  content: { paddingBottom: 20 },
  paymentCard: {
    backgroundColor: "white",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  amount: { fontSize: 18, fontWeight: "bold" },
  status: { fontSize: 14, fontWeight: "bold", color: "#000", marginTop: 4 },
  greenDot: { color: "green" },
  type: { fontSize: 14, fontStyle: "italic", color: "#6B7280", marginTop: 2 },
  feeDate: { fontSize: 12, color: "#6B7280", marginTop: 8 },
  date: { fontSize: 14, color: "#000" },
});

export default PaymentMethodHistoryScreen;