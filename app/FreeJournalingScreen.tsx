import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  ScrollView,
  Modal,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Audio } from "expo-av"; // 👈 For microphone permission
import BottomNavigation from "./BottomNavigation"; // ✅ Import BottomNavigation

import { saveJournalEntry } from "./services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";

type RootStackParamList = {
  FreeJournaling: undefined;
  Home: undefined;
  // ... other routes
};

type NavigationProp = StackNavigationProp<RootStackParamList, "FreeJournaling">;

const MAX_CHAR_COUNT = 10000; // ✅ Hard limit enforced

const FreeJournalingScreen = () => {
  const [content, setContent] = useState("");
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  // New state variable for image picker warning
  const [imagePickerWarning, setImagePickerWarning] = useState("");

  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    requestPermissions();
  }, []);

  // Clear warning if image count drops below 5
  useEffect(() => {
    if (imageUris.length < 5 && imagePickerWarning) {
      setImagePickerWarning("");
    }
  }, [imageUris]);

  // Request permissions for Media Library & Microphone
  const requestPermissions = async () => {
    await MediaLibrary.requestPermissionsAsync();
    await Audio.requestPermissionsAsync();
  };

  // Pick multiple images from the gallery with a limit of 5 images in total
  const pickImage = async () => {
    if (imageUris.length >= 5) {
      setImagePickerWarning("You can only upload up to 5 images");
      return;
    }
    const remaining = 5 - imageUris.length;
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining, // Limit the number of images the user can select
      allowsEditing: false,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      const selectedUris = result.assets.map((asset) => asset.uri);
      setImageUris([...imageUris, ...selectedUris]); // Append new images
      setImagePickerWarning(""); // Clear warning if images are selected
    }
  };

  // Remove an image from the selection
  const removeImage = (uri: string) => {
    setImageUris(imageUris.filter((image) => image !== uri));
    setSelectedImage(null); // Close modal after deletion
  };

  const handleSaveEntry = async () => {
    try {
      // No need to get token here since ApiService handles it
      const response = await saveJournalEntry(content, imageUris);
      
      if (response.error) {
        alert("Failed to save journal entry.");
        console.error("Error saving entry:", response.error);
        return;
      }

      alert("Journal entry saved successfully!");
      navigation.navigate("FreeJournaling"); // Update this to match your navigation type
    } catch (error) {
      console.error("Error in handleSaveEntry:", error);
      alert("An error occurred while saving the journal entry.");
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1, backgroundColor: "#FFF", padding: 20 }}>
        {/* Journal Entry Section */}
        <View
          style={{
            flex: 2,
            backgroundColor: "#F5F5F5",
            padding: 20,
            borderRadius: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.1,
            shadowRadius: 5,
            borderWidth: 1,
            borderColor: "#DDD",
          }}
        >
          <TextInput
            style={{
              flex: 1,
              color: "#222",
              fontSize: 16,
              fontFamily: "serif",
              textAlignVertical: "top",
            }}
            multiline
            placeholder="Write your thoughts... (or tap the mic button on your keyboard) 🎤"
            placeholderTextColor="#666"
            value={content}
            onChangeText={(text) => {
              if (text.length <= MAX_CHAR_COUNT) {
                setContent(text);
              }
            }}
            keyboardType="default"
            returnKeyType="done"
          />
          {/* ✅ Character Counter */}
          <Text
            style={{
              textAlign: "right",
              fontSize: 14,
              color: content.length >= MAX_CHAR_COUNT - 500 ? "red" : "#666", // 🔴 Warn if close to 10k chars
              marginTop: 5,
            }}
          >
            {content.length} / {MAX_CHAR_COUNT}
          </Text>

          {/* Hard Limit Warning when close to max */}
          {content.length >= MAX_CHAR_COUNT - 500 && content.length < MAX_CHAR_COUNT && (
            <Text style={{ color: "red", textAlign: "center", marginTop: 5 }}>
              ⚠️ You're writing a wonderful entry! Just a heads-up, you're nearing the character limit.
            </Text>
          )}

          {/* Hard Limit Reached Message */}
          {content.length >= MAX_CHAR_COUNT && (
            <Text style={{ color: "red", textAlign: "center", marginTop: 5, fontWeight: "bold" }}>
              🚫 That's an amazing entry! You've reached the limit, but you can always start a new one.
            </Text>
          )}
        </View>
        {/* Display Selected Images */}
        {imageUris.length > 0 && (
          <ScrollView horizontal style={{ marginTop: 10 }}>
            {imageUris.map((uri, index) => (
              <TouchableOpacity key={index} onPress={() => setSelectedImage(uri)}>
                <Image
                  source={{ uri }}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 10,
                    marginRight: 10,
                  }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
         {/* Image Picker Warning Message */}
         {imagePickerWarning ? (
          <Text style={{ color: "red", textAlign: "center", marginTop: 10 }}>
            {imagePickerWarning}
          </Text>
        ) : null}
        {/* Button Container */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 20 }}>
          {/* Upload Image Button */}
          <TouchableOpacity
            style={{
              backgroundColor: "#222",
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
              flex: 1,
              marginRight: 10,
            }}
            onPress={pickImage}
          >
            <Text style={{ color: "#FFF", fontSize: 14 }}>📸 Upload Images</Text>
          </TouchableOpacity>

          {/* Save Entry Button */}
          <TouchableOpacity
            style={{
              backgroundColor: "#111",
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
              flex: 1,
            }}
            onPress={handleSaveEntry}
          >
            <Text style={{ color: "#FFF", fontSize: 14 }}>💾 Save Entry</Text>
          </TouchableOpacity>
        </View>

       

        {/* Image Fullscreen Modal */}
        <Modal visible={!!selectedImage} transparent={true} animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.9)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={{
                  width: "90%",
                  height: "70%",
                  borderRadius: 10,
                }}
                resizeMode="contain"
              />
            )}
            <View style={{ flexDirection: "row", marginTop: 20 }}>
              {/* Close Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: "#FFF",
                  padding: 12,
                  borderRadius: 8,
                  marginRight: 10,
                }}
                onPress={() => setSelectedImage(null)}
              >
                <Text style={{ fontSize: 16 }}>Close</Text>
              </TouchableOpacity>

              {/* Delete Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: "red",
                  padding: 12,
                  borderRadius: 8,
                }}
                onPress={() => removeImage(selectedImage!)}
              >
                <Text style={{ fontSize: 16, color: "white" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ✅ Bottom Navigation */}
        <BottomNavigation activeScreen="FreeJournaling" />
      </View>
    </TouchableWithoutFeedback>
  );
};

export default FreeJournalingScreen;
