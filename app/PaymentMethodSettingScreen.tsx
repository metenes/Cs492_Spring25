import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from "./types/types";
import BottomNavigation from "./BottomNavigation";

// Define the navigation prop type for the screen
type PaymentMethodSettingScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PaymentMethodSettingScreen'
>;

type PaymentMethodSettingScreenProps = {
  navigation: PaymentMethodSettingScreenNavigationProp;
};

export const PaymentMethodSettingScreen: React.FC<PaymentMethodSettingScreenProps> = ({ navigation }) => {
  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} />
        </TouchableOpacity>
        <Text style={styles.headerText}>Payment Options</Text>
        
        {/* Add Payment Button */}
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate("PaymentMethodAddScreen")}>
          <Text style={styles.addButtonText}>Add Payment Option</Text>
          <ArrowRight size={20} color="white" />
        </TouchableOpacity>

        {/* Subscription Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Subscription</Text>
          <Text style={styles.description}>
            Your subscription will automatically renew on 01.01.2025. A fee of 29,99 TL will be charged.
          </Text>

          {/* Payment Method */}
          <Text style={styles.sectionTitle}>Method of Payment</Text>
          <View style={styles.paymentMethod}>
            <Text style={styles.paymentText}>MASTERCARD - 1234</Text>
            <TouchableOpacity>
              <Text style={styles.changeText}>Change it</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation to Payment History */}
          <TouchableOpacity style={styles.viewHistoryButton} onPress={() => navigation.navigate("PaymentMethodHistory")}>
            <Text style={styles.viewHistoryText}>View Payment History</Text>
          </TouchableOpacity>
          
          {/* Cancel Subscription */}
          <TouchableOpacity style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel Subscription</Text>
          </TouchableOpacity>
        </View>
      </View>
      <BottomNavigation activeScreen="PaymentMethodSettingScreen" />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white", padding: 16, alignItems: "center" },
  backButton: { position: "absolute", top: 16, left: 16, padding: 8 },
  headerText: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginTop: 50, marginBottom: 20 },
  addButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "black", padding: 14, borderRadius: 10, width: "100%", marginBottom: 16 },
  addButtonText: { color: "white", fontSize: 16, fontWeight: "bold", flex: 1, textAlign: "center" },
  card: { backgroundColor: "white", padding: 16, borderRadius: 10, shadowOpacity: 0.1, shadowRadius: 3, width: "100%" },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  description: { fontSize: 14, color: "#6B7280", marginBottom: 16, textAlign: "left" },
  paymentMethod: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  paymentText: { fontSize: 14, fontWeight: "bold" },
  changeText: { fontSize: 14, color: "#3B82F6" },
  viewHistoryButton: { backgroundColor: "black", padding: 14, borderRadius: 10, alignItems: "center", marginBottom: 8, width: "100%" },
  viewHistoryText: { color: "white", fontSize: 16, fontWeight: "bold" },
  cancelButton: { borderWidth: 1, borderColor: "black", padding: 14, borderRadius: 10, alignItems: "center", width: "100%" },
  cancelText: { fontSize: 16, fontWeight: "bold" },
});

export default PaymentMethodSettingScreen;
