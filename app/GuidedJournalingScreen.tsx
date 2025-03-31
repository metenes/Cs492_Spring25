import React, { useState } from "react";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRoute, useNavigation } from "@react-navigation/native";
import { saveJournalEntry } from "./services/ApiService";
import BottomNavigation from "./BottomNavigation";

const MAX_CHAR_COUNT = 10000;

const GuidedJournalingScreen = () => {
  const [content, setContent] = useState("");
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { prompt } = route.params;

  const handleSaveEntry = async () => {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) {
      alert("Authentication error. Please log in again.");
      return;
    }

    const response = await saveJournalEntry(token, content, imageUris, prompt);

    if (response.error) {
      alert("Failed to save journal entry.");
    } else {
      alert("Journal entry saved successfully!");
      navigation.navigate("Home");
    }
  };

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
              “{prompt}”
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
