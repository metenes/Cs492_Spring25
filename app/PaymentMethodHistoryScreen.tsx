import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from "./types/types";
import BottomNavigation from "./BottomNavigation";
import { useTheme } from './context/ThemeContext';
import { ArrowLeft } from "lucide-react-native";

// Define the navigation prop type for the screen
type PaymentMethodHistoryScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PaymentMethodHistoryScreen'
>;
type PaymentMethodHistoryScreenProps = {
  navigation: PaymentMethodHistoryScreenNavigationProp;
};

const PaymentMethodHistoryScreen: React.FC<PaymentMethodHistoryScreenProps> = ({ navigation }) => {
  const { theme, darkMode } = useTheme();
  
  const payments = [
    { amount: "₺29,99", status: "Paid", date: "01.12.2024", type: "Subscription fee" },
    { amount: "₺29,99", status: "Paid", date: "01.11.2024", type: "Subscription fee" },
    { amount: "₺29,99", status: "Paid", date: "01.10.2024", type: "Subscription fee" },
  ];

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.headerText, { color: theme.text }]}>Payment History</Text>
        
        <ScrollView contentContainerStyle={styles.content}>
          {payments.map((payment, index) => (
            <View key={index} style={[
              styles.paymentCard,
              { 
                backgroundColor: darkMode ? '#1a1a1a' : theme.backgroundColor,
                borderBottomColor: theme.border
              }
            ]}>
              <Text style={[styles.amount, { color: theme.text }]}>{payment.amount}</Text>
              <Text style={[styles.status, { color: theme.text }]}>
                <Text style={[styles.greenDot, { color: darkMode ? '#4CAF50' : 'green' }]}>●</Text> {payment.status}
              </Text>
              <Text style={[styles.type, { color: theme.placeholder }]}>{payment.type}</Text>
              <Text style={[styles.feeDate, { color: theme.placeholder }]}>Fee date</Text>
              <Text style={[styles.date, { color: theme.text }]}>{payment.date}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <BottomNavigation activeScreen="PaymentMethodHistoryScreen" />
    </>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16, 
    paddingTop: 8 
  },
  backButton: { 
    position: "absolute", 
    top: 16, 
    left: 16, 
    padding: 8 
  },
  headerText: { 
    fontSize: 22, 
    fontWeight: "bold", 
    textAlign: "center", 
    marginTop: 40, 
    marginBottom: 16 
  },
  content: { 
    paddingBottom: 20 
  },
  paymentCard: {
    padding: 16,
    borderBottomWidth: 1,
  },
  amount: { 
    fontSize: 18, 
    fontWeight: "bold" 
  },
  status: { 
    fontSize: 14, 
    fontWeight: "bold", 
    marginTop: 4 
  },
  greenDot: { 
    marginRight: 4 
  },
  type: { 
    fontSize: 14, 
    fontStyle: "italic", 
    marginTop: 2 
  },
  feeDate: { 
    fontSize: 12, 
    marginTop: 8 
  },
  date: { 
    fontSize: 14 
  },
});

export default PaymentMethodHistoryScreen;