import React, { useState, useRef, useEffect } from "react";
import { View, TextInput, TouchableOpacity, Button, FlatList, Text, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView } from "react-native";
import { sendMessageChat, deleteHistoryChat, getHistoryChat, getHistoryAllChat, getChatList, startNewChat } from "./services/ApiService"; // API service for chatbot
import BottomNavigation from "./BottomNavigation";
import { AlignJustify, ArrowUp, Bot, Plus, User, Zap } from "lucide-react-native";

// Define the type for each message
interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
}

const ChatbotScreen = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // Show loading 
  const [error, setError] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [fetchingConversations, setFetchingConversations] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Fetch conversations once when component mounts
  useEffect(() => {
    fetchConversationsList();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const fetchConversationsList = async () => {
    try {
      setFetchingConversations(true);
      const response = await getChatList();
      console.log("Fetched conversations:", response);
      
      if (Array.isArray(response)) {
        setConversations(response);
        
        // If no active conversation, set the first one as active
        if (!activeConversation && response.length > 0) {
          selectConversation(response[0].id);
        }
      } else {
        console.error("Invalid conversation list format:", response);
        setError("Failed to load conversations");
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setError('Failed to load conversations');
    } finally {
      setFetchingConversations(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeConversation) return;
  
    const userMessage: Message = { 
      id: Date.now().toString(),
      sender: "user", 
      text: input,
      timestamp: new Date()
    };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setLoading(true);
  
    try {
      console.log("sending message to chat server ...")
      const responseText = await sendMessageChat(input, activeConversation);
  
      const botMessage: Message = { 
        id: (Date.now() + 1).toString(),
        sender: "bot", 
        text: typeof responseText === "string" ? responseText : responseText.message,
        timestamp: new Date()
      };
  
      setMessages((prevMessages) => [...prevMessages, botMessage]);
      
      // Update conversation title with first user message for new chats
      const currentConversation = conversations.find(c => c.id === activeConversation);
      if (currentConversation && currentConversation.title === "New Chat") {
        // Create a truncated title from the user's first message
        const newTitle = input.length > 30 ? input.substring(0, 27) + "..." : input;
        updateConversationTitle(activeConversation, newTitle);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prevMessages => [
        ...prevMessages,
        { 
          id: (Date.now() + 1).toString(),
          sender: "bot", 
          text: "Sorry, something went wrong. Try again!",
          timestamp: new Date()
        },
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  const updateConversationTitle = (id: string, newTitle: string) => {
    setConversations(prevConversations => 
      prevConversations.map(conv => 
        conv.id === id ? { ...conv, title: newTitle } : conv
      )
    );
    // Here you would also make an API call to update the title on the backend
  };
  
  const handleStartNewChat = async () => {
    try {
      setLoading(true);
      const data = await startNewChat(); 
      console.log("New chat created:", data);
      
      if (!data || !data.chat_id) {
        throw new Error("Invalid response from new chat creation");
      }
      
      const newId = data.chat_id;
      const newChat = { id: newId, title: "New Chat" };
      
      setConversations(prevConversations => [newChat, ...prevConversations]);
      setActiveConversation(newId);
      setMessages([
        { id: '1', sender: "bot", text: "Hi there! How can I help you today?", timestamp: new Date() }
      ]);
      setShowSidebar(false);
    } catch (error) {
      console.error("Failed to start new chat", error);
      setError("Failed to create new chat");
    } finally {
      setLoading(false);
    }
  };
  
  const selectConversation = async (id: string) => {
    if (id === activeConversation) {
      setShowSidebar(false);
      return;
    }
    
    setActiveConversation(id);
    setShowSidebar(false);
    setLoading(true);
  
    try {
      const data = await getHistoryChat(id);
      
      // Check if data.messages exists and has items
      if (data && data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
        const loadedMessages: Message[] = data.messages.map((m: any, i: number) => ({
          id: String(i + 1),
          sender: m.sender,
          text: m.text,
          timestamp: new Date(m.timestamp || Date.now())
        }));
      
        setMessages(loadedMessages);
      } else {
        // Return an empty array if no messages exist yet
        console.log("No messages found for this conversation, starting fresh");
        setMessages([
          { id: '1', sender: "bot", text: "Hi there! How can I help you today?", timestamp: new Date() }
        ]);
      }
    } catch (error) {
      console.error("Failed to load chat history", error);
      setMessages([
        { id: '1', sender: "bot", text: "Could not load conversation. Please try again.", timestamp: new Date() }
      ]);
    } finally {
      setLoading(false);
    }
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageRow, item.sender === "user" ? styles.userRow : styles.botRow]}>
      <View style={item.sender === "user" ? styles.userAvatar : styles.botAvatar}>
        {item.sender === "user" ? (
          <User size={16} color="#fff" />
        ) : (
          <Bot size={16} color="#fff" />
        )}
      </View>
      <View style={[styles.messageBubble, item.sender === "user" ? styles.userMessage : styles.botMessage]}>
        <Text style={[styles.messageText, item.sender === "user" ? styles.userMessageText : styles.botMessageText]}>
          {item.text}
        </Text>
        <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
      </View>
    </View>
  );

  const renderSidebar = () => (
    <View style={[styles.sidebar, showSidebar ? styles.sidebarVisible : {}]}>
      <TouchableOpacity style={styles.newChatButton} onPress={handleStartNewChat}>
        <Plus size={20} color="#fff" />
        <Text style={styles.newChatText}>New chat</Text>
      </TouchableOpacity>
      
      {fetchingConversations ? (
        <View style={styles.loadingSidebar}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingSidebarText}>Loading chats...</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.conversationItem, 
                activeConversation === item.id ? styles.activeConversation : {}
              ]} 
              onPress={() => selectConversation(item.id)}
            >
              <Text style={styles.conversationTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
          style={styles.conversationsList}
          ListEmptyComponent={
            <Text style={styles.emptyListText}>No conversations yet</Text>
          }
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowSidebar(!showSidebar)} style={styles.menuButton}>
          <AlignJustify size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeConversation ? 
            (conversations.find(c => c.id === activeConversation)?.title || "Chat") : 
            "Claude"}
        </Text>
      </View>

      <View style={styles.content}>
        {renderSidebar()}
        
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
          />
          
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007BFF" />
              <Text style={styles.loadingText}>Claude is thinking...</Text>
            </View>
          )}
          
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"} 
            style={styles.inputWrapper}
          >
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Message Claude..."
                placeholderTextColor="#888"
                multiline
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity 
                style={[styles.sendButton, !input.trim() || !activeConversation ? styles.disabledButton : {}]} 
                onPress={handleSend}
                disabled={!input.trim() || loading || !activeConversation}
              >
                {input.trim() ? (
                  <ArrowUp size={20} color="#fff" />
                ) : (
                  <Zap size={20} color="#aaa" />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.disclaimer}>Claude may display inaccurate info, including about people.</Text>
          </KeyboardAvoidingView>
        </View>
      </View>
      
      <BottomNavigation activeScreen={"FreeJournaling"} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: "#f9f9fb",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eaecef",
    backgroundColor: "#fff",
  },
  menuButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  content: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    width: 0,
    backgroundColor: "#202123",
    overflow: "hidden",
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
  },
  sidebarVisible: {
    width: 250,
  },
  newChatButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    margin: 10,
    backgroundColor: "#343541",
    borderRadius: 6,
  },
  newChatText: {
    color: "#fff",
    marginLeft: 8,
    fontWeight: "500",
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    padding: 12,
    borderRadius: 6,
    marginHorizontal: 10,
    marginVertical: 4,
  },
  activeConversation: {
    backgroundColor: "#343541",
  },
  conversationTitle: {
    color: "#fff",
    fontSize: 14,
  },
  chatContainer: {
    flex: 1,
  },
  messageList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageListContent: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-start",
  },
  userRow: {
    justifyContent: "flex-end",
  },
  botRow: {
    justifyContent: "flex-start",
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#10a37f",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
  },
  userMessage: {
    backgroundColor: "#10a37f",
    borderBottomRightRadius: 4,
  },
  botMessage: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#eaecef",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: "#fff",
  },
  botMessageText: {
    color: "#000",
  },
  timestamp: {
    fontSize: 11,
    color: "#666",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  inputWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#eaecef",
    backgroundColor: "#fff",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 48,
    maxHeight: 120,
    fontSize: 16,
  },
  sendButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#10a37f",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    backgroundColor: "#f0f0f0",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: "#777",
    fontSize: 14,
  },
  disclaimer: {
    fontSize: 11,
    color: "#888",
    textAlign: "center",
    marginTop: 8,
  },
  loadingSidebar: {
    padding: 20,
    alignItems: "center",
  },
  loadingSidebarText: {
    color: "#fff",
    marginTop: 8,
  },
  emptyListText: {
    color: "#888",
    textAlign: "center",
    padding: 20,
  }
});

export default ChatbotScreen;