import React, { useState } from "react";
import { View, TextInput, Button, FlatList, Text, StyleSheet, ActivityIndicator } from "react-native";
import { sendMessage } from "./services/ApiService"; // API service for chatbot
import BottomNavigation from "./BottomNavigation";

// Define the type for each message
interface Message {
  sender: "user" | "bot";
  text: string;
}

const ChatbotScreen = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // Show loading while waiting for bot reply

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { sender: "user", text: input };
    setMessages((prevMessages) => [...prevMessages, userMessage]); // Add user message
    setInput("");
    setLoading(true); // Show loading indicator

    try {
      const response = await sendMessage(input);
      const botMessage: Message = { sender: "bot", text: response.message };

      setMessages((prevMessages) => [...prevMessages, botMessage]); // Add bot message
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: "bot", text: "Sorry, something went wrong. Try again!" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={item.sender === "user" ? styles.userMessage : styles.botMessage}>
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(_, index) => index.toString()}
        style={styles.messageList}
        inverted // Makes new messages appear at the bottom
      />
      {loading && <ActivityIndicator size="small" color="#007BFF" />} 
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          onSubmitEditing={handleSend}
        />
        <Button title="Send" onPress={handleSend} disabled={loading} />
      </View>
      <BottomNavigation activeScreen={"FreeJournaling"} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20,
    backgroundColor: "#fff"
  },
  messageList: {
    flex: 1
  },
  inputContainer: {
    flexDirection: "row",
    marginVertical: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#d1f5d3",
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    maxWidth: "80%"
  },
  botMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    maxWidth: "80%"
  },
  messageText: {
    fontSize: 16,
  }
});

export default ChatbotScreen;
