import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendSupportMail, fetchFAQ } from "./services/ApiService";
import BottomNavigation from "./BottomNavigation";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./types/types";
import { useTheme } from './context/ThemeContext';

import { useNavigation } from "@react-navigation/native";

type ContactSupportNavigationProp = StackNavigationProp<RootStackParamList, 'ContactSupport'>;


export default function ContactSupportScreen() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [faqs, setFaqs] = useState([]);
  const navigation = useNavigation<ContactSupportNavigationProp>();
  const { theme, darkMode } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        console.log("🔹 Retrieved token to fetch FAQ:", token);

        if (token) {
          const data = await fetchFAQ(token);
          if (data && data.faqs) {
            setFaqs(data.faqs);
          }
        }
      } catch (error) {
        console.error("❌ Error fetching FAQ:", error);
      }
    };
    loadData();
  }, []);

  const handleSend = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      console.log("🔹 Retrieved token to send support mail:", token);

      await sendSupportMail(email, subject, message, token);

      Alert.alert("Success", "Your message has been sent to support.");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (error) {
      console.error("❌ Error sending support message:", error);
      Alert.alert("Error", "Failed to send your message.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
    <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.backgroundColor }]}>
      <Text style={[styles.title, { color: theme.text }]}>Contact Support</Text>
  
      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: "#555" }]}
        placeholder="Your email"
        placeholderTextColor={darkMode ? "#888" : "#aaa"}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
  
      <TextInput
        style={[styles.input, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: "#555" }]}
        placeholder="Subject"
        placeholderTextColor={darkMode ? "#888" : "#aaa"}
        value={subject}
        onChangeText={setSubject}
      />
  
      <TextInput
        style={[styles.input, styles.textArea, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: "#555" }]}
        placeholder="Message"
        placeholderTextColor={darkMode ? "#888" : "#aaa"}
        value={message}
        onChangeText={setMessage}
        multiline
      />
  
      <TouchableOpacity style={styles.button} onPress={handleSend}>
        <Text style={styles.buttonText}>Send to Support</Text>
      </TouchableOpacity>
  
      <Text style={[styles.header, { color: theme.text }]}>Frequently Asked Questions</Text>
  
      {faqs.length === 0 && <Text style={{ color: theme.text }}>Loading FAQs...</Text>}
      {faqs.map((faq, index) => (
      <TouchableOpacity
        key={index}
        onPress={() => setExpandedIndex(( expandedIndex === index) ? null : index)}
        style={[styles.faqCard, { backgroundColor: theme.cardBackground, padding: 12, borderRadius: 8 }]}
      >
        <Text style={[styles.question, { color: theme.text }]}>
          {faq.question}
        </Text>

        {expandedIndex === index && (
          <Text style={[styles.answer, { color: darkMode ? "#ccc" : "#555", marginTop: 6 }]}>
            {faq.answer}
      </Text>
    )}
  </TouchableOpacity>
))}

    </ScrollView>
  
    <BottomNavigation activeScreen="Home" darkMode={darkMode} />
  </View>
  
  );
  
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Make space for BottomNavigation
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginVertical: 10,
  },
  faqCard: {
    marginBottom: 12,
  },
  question: {
    fontSize: 16,
    fontWeight: "600",
  },
  answer: {
    fontSize: 14,
    color: "#555",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#000",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
