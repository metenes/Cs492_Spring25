import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ArrowLeft } from "lucide-react-native";

import { StackNavigationProp } from '@react-navigation/stack'; // Binding element 'navigation' implicitly has an 'any' type. 
import { RootStackParamList } from "./types/types";
/**
 * NAVIGATION ERROR 
 * "Binding element 'navigation' implicitly has an 'any' type",
 * happens because TypeScript doesn't know the 
 * type of the navigation prop being passed into your component.
 */

// Define the navigation prop type for the screen
type PaymentMethodSettingScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PaymentMethodSettingScreen'
>;
type PaymentMethodSettingScreenProp = {
  navigation: PaymentMethodSettingScreenNavigationProp;
};

export const PaymentMethodSettingScreen : React.FC<PaymentMethodSettingScreenProp>= ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} />
        </TouchableOpacity>
        <Text style={styles.headerText}>Payment Options</Text>
      </View>

      <TouchableOpacity style={styles.addButton}>
        <Text style={styles.addButtonText}>Add Payment Option</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your Subscription</Text>
        <Text style={styles.description}>
          Your subscription will automatically renew on 01.01.2025. A fee of 29.99 TL will be charged.
        </Text>

        <Text style={styles.sectionTitle}>Method of Payment</Text>
        <View style={styles.paymentMethod}>
          <Text style={styles.paymentText}>MASTERCARD - 1234</Text>
          <TouchableOpacity>
            <Text style={styles.changeText}>Change it</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.viewHistoryButton} onPress={() => navigation.navigate("PaymentMethodSettingScreen")}>
          <Text style={styles.viewHistoryText}>View Payment History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel Subscription</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", padding: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backButton: { padding: 8 },
  headerText: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "bold" },
  addButton: { backgroundColor: "black", padding: 14, borderRadius: 10, alignItems: "center", marginBottom: 16 },
  addButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
  card: { backgroundColor: "white", padding: 16, borderRadius: 10, shadowOpacity: 0.1, shadowRadius: 3 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  description: { fontSize: 14, color: "#6B7280", marginBottom: 16 },
  paymentMethod: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  paymentText: { fontSize: 14 },
  changeText: { fontSize: 14, color: "#3B82F6" },
  viewHistoryButton: { backgroundColor: "black", padding: 14, borderRadius: 10, alignItems: "center", marginBottom: 8 },
  viewHistoryText: { color: "white", fontSize: 16, fontWeight: "bold" },
  cancelButton: { borderWidth: 1, borderColor: "black", padding: 14, borderRadius: 10, alignItems: "center" },
  cancelText: { fontSize: 16, fontWeight: "bold" },
});

export default PaymentMethodSettingScreen;
