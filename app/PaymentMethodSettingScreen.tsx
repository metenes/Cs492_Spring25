import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from "./types/types";
import BottomNavigation from "./BottomNavigation";
import { useTheme } from "./context/ThemeContext";

// Define the navigation prop type for the screen
type PaymentMethodSettingScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PaymentMethodSettingScreen'
>;

type PaymentMethodSettingScreenProps = {
  navigation: PaymentMethodSettingScreenNavigationProp;
};

export const PaymentMethodSettingScreen: React.FC<PaymentMethodSettingScreenProps> = ({ navigation }) => {
  const { theme, darkMode } = useTheme();

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.headerText, { color: theme.text }]}>Payment Options</Text>
        
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: darkMode ? '#2d2d2d' : '#1a1a1a' }]} 
          onPress={() => navigation.navigate("PaymentMethodAddScreen")}
        >
          <Text style={styles.addButtonText}>Add Payment Option</Text>
          <ArrowRight size={20} color="#fff" />
        </TouchableOpacity>

        <View style={[styles.card, { 
          backgroundColor: darkMode ? '#1a1a1a' : theme.backgroundColor,
          shadowColor: darkMode ? '#000' : '#000',
          shadowOpacity: darkMode ? 0.3 : 0.1,
          shadowRadius: darkMode ? 5 : 3
        }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Subscription</Text>
          <Text style={[styles.description, { color: theme.placeholder }]}>
            Your subscription will automatically renew on 01.01.2025. A fee of 29,99 TL will be charged.
          </Text>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>Method of Payment</Text>
          <View style={styles.paymentMethod}>
            <Text style={[styles.paymentText, { color: theme.text }]}>MASTERCARD - 1234</Text>
            <TouchableOpacity>
              <Text style={[styles.changeText, { color: theme.primary }]}>Change it</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.viewHistoryButton, { backgroundColor: darkMode ? '#2d2d2d' : '#1a1a1a' }]} 
            onPress={() => navigation.navigate("PaymentMethodHistoryScreen")}
          >
            <Text style={styles.viewHistoryText}>View Payment History</Text>
          </TouchableOpacity>
          
          {/* Cancel Subscription */}
          <TouchableOpacity 
            style={[styles.cancelButton, { 
              borderColor: darkMode ? '#2d2d2d' : '#1a1a1a',
              backgroundColor: darkMode ? '#1a1a1a' : theme.backgroundColor
            }]}
          >
            <Text style={[styles.cancelText, { color: theme.text }]}>Cancel Subscription</Text>
          </TouchableOpacity>
        </View>
      </View>
      <BottomNavigation activeScreen="PaymentMethodSettingScreen" />
    </>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16, 
    alignItems: "center" 
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
    marginTop: 50, 
    marginBottom: 20 
  },
  addButton: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    padding: 14, 
    borderRadius: 10, 
    width: "100%", 
    marginBottom: 16 
  },
  addButtonText: { 
    color: "white", 
    fontSize: 16, 
    fontWeight: "bold", 
    flex: 1, 
    textAlign: "center" 
  },
  card: { 
    padding: 16, 
    borderRadius: 10, 
    width: "100%",
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: "bold", 
    marginBottom: 8 
  },
  description: { 
    fontSize: 14, 
    marginBottom: 16, 
    textAlign: "left" 
  },
  paymentMethod: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 16 
  },
  paymentText: { 
    fontSize: 14, 
    fontWeight: "bold" 
  },
  changeText: { 
    fontSize: 14 
  },
  viewHistoryButton: { 
    padding: 14, 
    borderRadius: 10, 
    alignItems: "center", 
    marginBottom: 8, 
    width: "100%" 
  },
  viewHistoryText: { 
    color: "white", 
    fontSize: 16, 
    fontWeight: "bold" 
  },
  cancelButton: { 
    borderWidth: 1, 
    padding: 14, 
    borderRadius: 10, 
    alignItems: "center", 
    width: "100%" 
  },
  cancelText: { 
    fontSize: 16, 
    fontWeight: "bold" 
  },
});

export default PaymentMethodSettingScreen;
