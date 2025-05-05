import React, { useState, useRef, useEffect } from "react";
import { 
  View, 
  Modal, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  useColorScheme,
  Animated,
  PanResponder,
  Dimensions,
  Easing,
} from "react-native";
import { HelpCircle, SendHorizonal, X, MessageCircle } from "lucide-react-native";
import { askHelperAI } from "../services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "@react-native-community/blur";

type Message = {
  id: string;
  text: string;
  isUser: boolean;
};

const { width, height } = Dimensions.get("window");
const PRESS_DURATION_THRESHOLD = 200; // milliseconds
const TOUCH_AREA_SIZE = 70; // Larger than the visible button for better touch detection

const HelperAssistant = () => {
  const [visible, setVisible] = useState(false);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);

  const [loading, setLoading] = useState(false);
  const darkMode = useColorScheme() === "dark";
  // Refs for tracking press time
  const pressStartTime = useRef(0);
  const isDragging = useRef(false);
  const scrollViewRef = useRef(null);

  // Animated values
  const position = useRef(new Animated.ValueXY({ x: 20, y: height - 100 })).current; // Positioned at bottom left
  const scale = useRef(new Animated.Value(1)).current;
  const modalScale = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Create the draggable behavior
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: ()  => {
        pressStartTime.current = Date.now();
        scale.setValue(0.9); // slight shrink on press
        position.setOffset({
          x: position.x._value,
          y: position.y._value,
        });
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        // If moved less than 5 pixels in any direction, don't trigger move
        // This helps distinguish between taps and drags
        if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
          return;
        }
        
        Animated.event(
          [null, { dx: position.x, dy: position.y }],
          { useNativeDriver: false }
        )(evt, gestureState);
      },
      onPanResponderRelease: (evt, gestureState) => {
        scale.setValue(1);
        position.flattenOffset();

        // If moved less than 10 pixels total, treat as a tap
        const distance = Math.sqrt(Math.pow(gestureState.dx, 2) + Math.pow(gestureState.dy, 2));
        if (distance < 10) {
          openModal();
          return;
        }

        // Clamp final position within screen bounds
        let finalX = position.x._value;
        let finalY = position.y._value;

        finalX = Math.max(0, Math.min(width - 70, finalX));
        finalY = Math.max(50, Math.min(height - 120, finalY));

        // Snap to edges
        if (finalX < width / 2) {
          finalX = 20;
        } else {
          finalX = width - 80;
        }

        Animated.spring(position, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
          friction: 5,
        }).start();
      },
    })
  ).current;


  const askHelper = async () => {
    setLoading(true);
    if (!question.trim()) {
      setLoading(false);
      return;
    }
    // Add user question to messages
    const newMessages = [...messages, { 
      id: Date.now().toString(),
      text: question, 
      isUser: true 
    }];
    setMessages(newMessages);
    setQuestion(""); // Clear input immediately

    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        setReply("Please log in to use the assistant.");
        setLoading(false);
        return;
      }

      const data = await askHelperAI(token, question);
      const assistantReply = data;
      console.log("response: helper " , data )
      const updatedMessages = [...newMessages, {
        id: Date.now().toString(),
        text: assistantReply,
        isUser: false,
      }];
      setMessages(updatedMessages);
      
      setReply(assistantReply); // Optional: if still using reply outside
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      setReply("Sorry, I couldn't process your request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /*
  const addAssistantMessage = (text: any) => {
    const updatedMessages = [...messages, { 
      id: Date.now().toString(),
      text: text, 
      isUser: false 
    }];
    setMessages(updatedMessages);
    
    // Scroll to bottom after message added
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };
  */

  const openModal = () => {
    setVisible(true);
    Animated.spring(modalScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
    
    // Only show welcome message if no other messages exist
    if (messages.length === 0) {
      setMessages([{ 
        id: 'welcome',
        text: "How can I help you today?", 
        isUser: false 
      }]);
    }
  };

  const closeModal = () => {
    Animated.timing(modalScale, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setQuestion("");
      setReply("");
    });
  };

  return (
    <>
      {/* Draggable floating button with blur background */}
      <Animated.View
        style={[
          styles.floatingButtonContainer,
          {
            transform: [
              ...position.getTranslateTransform(),
              { scale: scale }
            ],
          }
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.blurBackground}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={openModal}
            style={[
              styles.floatingButton,
              darkMode && styles.floatingButtonDark,
            ]}
            activeOpacity={0.7}
          >
            <MessageCircle size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
  
      {/* Modal */}
      <Modal visible={visible} animationType="none" transparent>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              darkMode && styles.modalContentDark,
              {
                transform: [{ scale: modalScale }],
                opacity: modalScale,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, darkMode && styles.textDark]}>
                Ask Sentio Assistant
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <X size={22} color={darkMode ? "#ccc" : "#555"} />
              </TouchableOpacity>
            </View>
  
            {/* Wrap ScrollView + Input in KeyboardAvoidingView */}
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
            >
              <ScrollView
                style={styles.replyBox}
                ref={scrollViewRef}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                contentContainerStyle={{ paddingBottom: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                {messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={{
                      alignSelf: msg.isUser ? "flex-end" : "flex-start",
                      backgroundColor: msg.isUser ? "#5564eb" : darkMode ? "#333" : "#e0e0e0",
                      padding: 10,
                      borderRadius: 12,
                      marginVertical: 4,
                      maxWidth: "80%",
                    }}
                  >
                    <Text style={{ color: msg.isUser ? "#fff" : darkMode ? "#eee" : "#000" }}>
                      {msg.text}
                    </Text>
                  </View>
                ))}
                {loading && (
                  <View style={styles.loadingContainer}>
                    <Text style={[styles.loadingText, darkMode && styles.textDark]}>Thinking...</Text>
                    <View style={styles.loadingDot} />
                  </View>
                )}
              </ScrollView>
  
              <View style={styles.inputArea}>
                <TextInput
                  style={[styles.input, darkMode && styles.inputDark]}
                  placeholder="Ask anything about using the app..."
                  placeholderTextColor={darkMode ? "#888" : "#aaa"}
                  value={question}
                  onChangeText={setQuestion}
                  onSubmitEditing={askHelper}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                  onPress={askHelper}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <SendHorizonal size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
  
};

/**      <BlurView
        style={styles.absolute}
        blurType="light"
        blurAmount={10}
        reducedTransparencyFallbackColor="white"
      /> */

const styles = StyleSheet.create({
  floatingButtonContainer: {
    position: "absolute",
    zIndex: 1000,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8, // For Android
  },
  blurBackground: {
    backgroundColor: 'rgba(0,0,0,0.3)', // Semi-transparent background for blur effect
    borderRadius: 30,
    overflow: 'hidden',
    padding: 2, // Small padding to make the blur visible around the button
  },
  floatingButton: {
    backgroundColor: "#5564eb",
    padding: 15,
    borderRadius: 30,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  floatingButtonDark: {
    backgroundColor: "#4352d6",
    shadowColor: "#222",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  modalContentDark: {
    backgroundColor: "#1a1a1a",
    borderTopColor: "#333",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  textDark: {
    color: "#eee",
  },
  replyBox: {
    flex: 1,
    marginTop: 10,
    marginBottom: 15,
  },
  replyText: {
    fontSize: 16,
    color: "#444",
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#444",
    marginRight: 8,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#5564eb",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    borderTopColor: "#eee",
    borderTopWidth: 1,
    paddingTop: 15,
  },
  input: {
    flex: 1,
    height: 45,
    backgroundColor: "#f5f5f5",
    borderRadius: 22,
    paddingHorizontal: 16,
    color: "#000",
    fontSize: 16,
  },
  inputDark: {
    backgroundColor: "#333",
    color: "#fff",
    borderColor: "#444",
  },
  sendButton: {
    backgroundColor: "#5564eb",
    marginLeft: 10,
    padding: 12,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  absolute: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0
  },
  sendButtonDisabled: {
    backgroundColor: "#a0a6d8",
  },
});

export default HelperAssistant;

