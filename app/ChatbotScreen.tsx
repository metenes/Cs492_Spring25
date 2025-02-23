import React, { useState } from "react";
import { View, TextInput, Button, FlatList, Text, StyleSheet } from "react-native";
import { sendMessage } from "./services/ApiService";
import BottomNavigation from './BottomNavigation';

// Define the type for each message
interface Message {
  sender: string;
  text: string;
}

const ChatbotScreen = () => {
  // Explicitly type the `messages` state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const handleSend = async () => {
    const userMessage: Message = { sender: "user", text: input }; // Explicitly type the user message
    const botReply = await sendMessage(input); // Fetch bot response
    const botMessage: Message = { sender: "bot", text: botReply }; // Explicitly type the bot message

    // Add both user and bot messages to the `messages` array
    setMessages([...messages, userMessage, botMessage]);
    setInput(""); // Clear the input field
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <Text style={item.sender === "user" ? styles.userMessage : styles.botMessage}>
      {item.text}
    </Text>
  );

  return (
    <>
      <View style={styles.container}>
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(_, index) => index.toString()}
        />
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type your message..."
        />
        <Button title="Send" onPress={handleSend} />
      </View>
      <BottomNavigation activeScreen="Chatbot" />
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#d1f5d3",
    padding: 10,
    borderRadius: 10,
    marginBottom: 5,
  },
  botMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 10,
    marginBottom: 5,
  },
});

export default ChatbotScreen;
