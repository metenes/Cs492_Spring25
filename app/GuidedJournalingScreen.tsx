import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRoute, useNavigation } from "@react-navigation/native";
import { saveJournalEntry, saveDraft, getDraft, clearDraft } from "./services/ApiService";
import BottomNavigation from "./BottomNavigation";
//import { saveGuidedJournalEntry } from "./services/ApiService";

const MAX_CHAR_COUNT = 10000;

const GuidedJournalingScreen = () => {
  const [content, setContent] = useState("");
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { prompt } = route.params;

  // Load draft when component mounts
  useEffect(() => {
    const loadDraft = async () => {
      try {
        setIsLoading(true);
        const draft = await getDraft();
        if (draft) {
          console.log("Loaded guided journaling draft:", draft);
          setContent(draft.content || "");
          setImageUris(draft.images || []);
        }
      } catch (error) {
        console.error("Error loading guided journaling draft:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadDraft();
  }, []);

  // Save draft when content or images change
  useEffect(() => {
    if (isLoading) return; // Skip saving during initial load
    
    const timeoutId = setTimeout(() => {
      console.log("Auto-saving guided journaling draft");
      saveDraft(content, imageUris);
    }, 1000); // Save draft 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [content, imageUris, isLoading]);

  // Also save when leaving the screen
  useEffect(() => {
    return () => {
      if (content || imageUris.length > 0) {
        console.log("Saving draft on exit");
        saveDraft(content, imageUris);
      }
    };
  }, [content, imageUris]);

  const handleSaveEntry = async () => {
    if (!content.trim()) {
      Alert.alert("Empty Entry", "Please write something before saving.");
      return;
    }
  
    try {
      // Check if user is authenticated
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Error", "User not authenticated.");
        return;
      }
  
      // Save the journal entry, including images
      const response = await saveJournalEntry(content, imageUris, "guided", prompt);
  
      if (response.error) {
        Alert.alert("Error", "Failed to save entry.");
        return;
      }
  
      // Clear the draft if everything is successful
      await clearDraft();
  
      Alert.alert("Saved", "Your guided entry has been saved.");
      navigation.navigate("Home");
      
    } catch (error) {
      console.error("Error saving guided entry:", error);
      Alert.alert("Error", "Something went wrong.");
    }
  };
  
  

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#FFF" }}>
        <ActivityIndicator size="large" color="black" />
        <Text style={{ marginTop: 20 }}>Loading your journal...</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1, backgroundColor: "#FFF", padding: 20 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Display Prompt */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{
              fontSize: 18,
              fontWeight: "500",
              fontStyle: "italic",
              textAlign: "center",
              color: "#333",
              padding: 10,
              borderLeftWidth: 2,
              borderLeftColor: "#888",
              backgroundColor: "#f9f9f9",
              borderRadius: 10,
            }}>
              "{prompt}"
            </Text>
          </View>

          {/* Entry Input */}
          <View style={{ backgroundColor: "#F5F5F5", padding: 20, borderRadius: 12 }}>
            <TextInput
              style={{
                minHeight: 200,
                fontSize: 16,
                color: "#222",
                textAlignVertical: "top",
              }}
              multiline
              placeholder="Start writing your response..."
              value={content}
              onChangeText={(text) => {
                if (text.length <= MAX_CHAR_COUNT) setContent(text);
              }}
              keyboardType="default"
              returnKeyType="done"
            />
            <Text style={{ textAlign: "right", color: "#999" }}>{content.length} / {MAX_CHAR_COUNT}</Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={{
              backgroundColor: "#111",
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
              marginTop: 20,
            }}
            onPress={handleSaveEntry}
          >
            <Text style={{ color: "#FFF", fontSize: 14 }}>💾 Save Entry</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNavigation activeScreen="GuidedJournaling" />
      </View>
    </TouchableWithoutFeedback>
  );
};

export default GuidedJournalingScreen;
