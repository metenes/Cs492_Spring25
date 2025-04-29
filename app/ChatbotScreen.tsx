import React, { useState, useRef, useEffect } from "react";
import { View, TextInput, TouchableOpacity, Button, FlatList, Text, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, Alert, Modal } from "react-native";
import { sendMessageChat, deleteHistoryChat, getHistoryChat, getHistoryAllChat, getChatList, startNewChat, renameChat, saveChat } from "./services/ApiService"; // API service for chatbot
import BottomNavigation from "./BottomNavigation";
import { AlignJustify, ArrowUp, Bot, Download, Edit2, Plus, Trash2, User, X, Zap } from "lucide-react-native";
import { useTheme } from './context/ThemeContext';

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingchat_id, setEditingchat_id] = useState<string | null>(null);
  const [savingChat, setSavingChat] = useState(false);
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
  const { theme, darkMode } = useTheme();

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
        handleRenameChat(activeConversation, newTitle);
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
  
  const handleRenameChat = async (id: string, newTitle: string) => {
    try {
      await renameChat(id, newTitle);
      
      setConversations(prevConversations => 
        prevConversations.map(conv => 
          conv.id === id ? { ...conv, title: newTitle } : conv
        )
      );
    } catch (error) {
      console.error("Failed to rename chat:", error);
      Alert.alert("Error", "Failed to rename chat. Please try again.");
    }
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
      console.log("history chat: ", data); 
      if (data && data.message && Array.isArray(data.message) && data.message.length > 0) {
        const loadedMessages: Message[] = data.message.map((m: any, i: number) => ({
          id: String(i + 1),
          sender: m.sender,
          text: m.text,  // ✅ Use `text`, not `title`
          timestamp: new Date(m.timestamp || Date.now())
        }));
      
        setMessages(loadedMessages);
      } else {
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

  const handleDeleteConversation = async (id: string) => {
    Alert.alert(
      "Delete Conversation",
      "Are you sure you want to delete this conversation? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteHistoryChat(id);
              
              // Remove from local state
              setConversations(prev => prev.filter(c => c.id !== id));
              
              // If active conversation is deleted, set a new active one
              if (id === activeConversation) {
                const remainingConversations = conversations.filter(c => c.id !== id);
                if (remainingConversations.length > 0) {
                  selectConversation(remainingConversations[0].id);
                } else {
                  setActiveConversation(null);
                  setMessages([]);
                }
              }
            } catch (error) {
              console.error("Failed to delete conversation:", error);
              Alert.alert("Error", "Failed to delete conversation. Please try again.");
            }
          }
        }
      ]
    );
  };

  const openEditModal = (id: string, currentTitle: string) => {
    setEditingchat_id(id);
    setEditingTitle(currentTitle);
    setShowEditModal(true);
  };

  const handleSaveChat = async () => {
    if (!activeConversation) return;
    
    try {
      setSavingChat(true);
      await saveChat(activeConversation);
      Alert.alert("Success", "Chat saved successfully");
    } catch (error) {
      console.error("Failed to save chat:", error);
      Alert.alert("Error", "Failed to save chat. Please try again.");
    } finally {
      setSavingChat(false);
    }
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  /*style={[
      [styles.messageRow, item.sender === "user" ? styles.userRow : styles.botRow]}>
      <View style={item.sender === "user" ? styles.userAvatar : styles.botAvatar}>
        {item.sender === "user" ? (
          <User size={16} color="#fff" />
        ) : (
          <Bot size={16} color="#fff" />
        )}*/ 


  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageRow, item.sender === "user" ? styles.userRow : styles.botRow]}>
      <View style={item.sender === "user" ? styles.userAvatar : styles.botAvatar}>
          {item.sender === "user" ? (
            <User size={16} color="#fff" />
            ) : (
            <Bot size={16} color="#fff" />
            )}
      </View>
    <View style={[
                styles.messageBubble,
                item.sender === "user" ? styles.userMessage : styles.botMessage,
                {
                  backgroundColor: item.sender === "user" 
                    ? (darkMode ? '#404040' : '#d1f5d3')
                    : (darkMode ? theme.cardBackground : '#f5f5f5')
                }
              ]}>
                <Text style={[
                  styles.messageText, 
                  item.sender === "user" ? styles.userMessageText : styles.botMessageText,
                  { color: theme.text }
                ]}>
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
            <View style={styles.conversationItemWrapper}>
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
              
              <View style={styles.conversationActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => openEditModal(item.id, item.title)}
                >
                  <Edit2 size={16} color="#aaa" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleDeleteConversation(item.id)}
                >
                  <Trash2 size={16} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
            </View>
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

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowEditModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Chat Name</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <X size={20} color="#333" />
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.modalInput}
            value={editingTitle}
            onChangeText={setEditingTitle}
            placeholder="Enter chat name"
            autoFocus
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={() => setShowEditModal(false)}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.modalSaveButton]}
              onPress={() => {
                if (editingchat_id && editingTitle.trim()) {
                  handleRenameChat(editingchat_id, editingTitle);
                  setShowEditModal(false);
                }
              }}
              disabled={!editingTitle.trim()}
            >
              <Text style={styles.modalButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
            "Sentio ChatBot"}
        </Text>
        
        {activeConversation && (
          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={handleSaveChat}
            disabled={savingChat || messages.length <= 1}
          >
            {savingChat ? (
              <ActivityIndicator size="small" color="#10a37f" />
            ) : (
              <Download size={20} color="#10a37f" />
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {renderSidebar()}
        {renderEditModal()}
        
        <View style={styles.chatContainer}>
          {!activeConversation && conversations.length === 0 ? (
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>Welcome to Sentio ChatBot</Text>
              <Text style={styles.welcomeText}>Start a new chat to begin conversation</Text>
              <TouchableOpacity style={styles.welcomeButton} onPress={handleStartNewChat}>
                <Plus size={20} color="#fff" />
                <Text style={styles.welcomeButtonText}>New chat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              ListEmptyComponent={
                activeConversation ? (
                  <View style={styles.emptyChat}>
                    <Text style={styles.emptyChatText}>No messages yet</Text>
                  </View>
                ) : null
              }
            />
          )}
          
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007BFF" />
              <Text style={styles.loadingText}>Sentio ChatBot is thinking...</Text>
            </View>
          )}
          
          {activeConversation && (
            <KeyboardAvoidingView 
              behavior={Platform.OS === "ios" ? "padding" : "height"} 
              style={styles.inputWrapper}
            >
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Message Sentio ChatBot..."
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
              <Text style={styles.disclaimer}>Sentio ChatBot may display inaccurate info, including about people.</Text>
            </KeyboardAvoidingView>
          )}
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
    padding: 20,
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
    flex: 1,
  },
  saveButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
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
  conversationItemWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    marginVertical: 4,
  },
  conversationItem: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
  },
  activeConversation: {
    backgroundColor: "#343541",
  },
  conversationTitle: {
    color: "#fff",
    fontSize: 14,
  },
  conversationActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  actionButton: {
    padding: 6,
    marginLeft: 2,
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginLeft: 10,
  },
  modalCancelButton: {
    backgroundColor: "#f0f0f0",
  },
  modalSaveButton: {
    backgroundColor: "#10a37f",
  },
  modalButtonText: {
    fontWeight: "500",
    color: "#fff",
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  welcomeText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  welcomeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10a37f",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  welcomeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  emptyChat: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyChatText: {
    fontSize: 16,
    color: "#888",
  }
});

export default ChatbotScreen;