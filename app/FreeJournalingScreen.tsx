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
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, RouteProp, useRoute } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import BadgeCongratsModal from './BadgeCongratsModal';

import * as ImagePicker from "expo-image-picker";
import { MediaType } from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Audio } from "expo-av"; // 👈 For microphone permission
import BottomNavigation from "./BottomNavigation"; // ✅ Import BottomNavigation
import { useTheme } from './context/ThemeContext';

import { saveJournalEntry, saveDraft, getDraft, clearDraft, uploadJournalImage, deleteJournalImage } from "./services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { awardBadge } from "./services/ApiService";
type RootStackParamList = {
  FreeJournaling: { selectedDate?: string };  //undefined;
  Home: undefined;
};

type RouteProps = RouteProp<RootStackParamList, "FreeJournaling">;

type NavigationProp = StackNavigationProp<RootStackParamList, "FreeJournaling">;

const MAX_CHAR_COUNT = 10000; // ✅ Hard limit enforced

const FreeJournalingScreen = () => {
  const { theme, darkMode } = useTheme();
  const [content, setContent] = useState("");
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [localImageUris, setLocalImageUris] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePickerWarning, setImagePickerWarning] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [awardedBadgeKey, setAwardedBadgeKey] = useState<string | null>(null);
  
  const navigation = useNavigation<NavigationProp>();

  const route = useRoute<RouteProps>();
  const [entryDate, setEntryDate] = useState(new Date().toISOString());

  useEffect(() => {
    if (route.params?.selectedDate) {
      setEntryDate(route.params.selectedDate);
      //console.log("🗓️ Custom entry date from calendar:", route.params.selectedDate);
    }
  }, [route.params]);

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
    try {
      if (imageUris.length >= 5) {
        setImagePickerWarning("You can only upload up to 5 images");
        return;
      }
      const remaining = 5 - imageUris.length;
      console.log('📸 Picking images. Remaining slots:', remaining);
      
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        console.log('📸 Images selected:', result.assets);
        const newLocalUris = result.assets.map(asset => asset.uri);
        
        // Initialize progress for new uploads
        const newProgress = {...uploadProgress};
        newLocalUris.forEach(uri => {
          newProgress[uri] = 0;
        });
        setUploadProgress(newProgress);
        
        // Upload each image immediately and get signed URLs
        const uploadedImages = await Promise.all(
          newLocalUris.map(async (uri) => {
            console.log('📤 Uploading image:', uri);
            try {
              const signedUrl = await uploadJournalImage(uri);
              console.log('✅ Image uploaded. Signed URL:', signedUrl);
              return {
                uri: uri,
                signedUrl: signedUrl
              };
            } catch (error) {
              console.error('❌ Error uploading image:', uri, error);
              throw error;
            }
          })
        );
        
        console.log('📦 All images uploaded successfully:', uploadedImages);
        
        // Update both local and remote image states
        setLocalImageUris([...localImageUris, ...uploadedImages.map(img => img.uri)]);
        setImageUris([...imageUris, ...uploadedImages.map(img => img.signedUrl)]);
        setImagePickerWarning("");
        
        // Clear progress after successful upload
        setUploadProgress({});
      }
    } catch (error) {
      console.error('❌ Error in pickImage:', error);
      alert('Failed to upload images. Please try again.');
      setUploadProgress({});
    }
  };

  // Remove an image from the selection and S3
  const removeImage = async (uri: string) => {
    try {
      console.log('🗑️ Removing image:', uri);
      
      // Find the corresponding signed URL
      const index = localImageUris.indexOf(uri);
      if (index !== -1) {
        const signedUrl = imageUris[index];
        console.log('🗑️ Deleting from S3:', signedUrl);
        
        // Delete from S3
        await deleteJournalImage(signedUrl);
        console.log('✅ Image deleted from S3');
        
        // Remove from both local and remote states
        setLocalImageUris(localImageUris.filter(image => image !== uri));
        setImageUris(imageUris.filter(image => image !== signedUrl));
        setSelectedImage(null); // Close modal after deletion
      }
    } catch (error) {
      console.error('❌ Error deleting image:', error);
      alert('Failed to delete image. Please try again.');
    }
  };

  // Load draft when screen mounts
  useEffect(() => {
    const loadDraft = async () => {
      const draft = await getDraft();
      if (draft) {
        setContent(draft.content);
        setImageUris(draft.images);
      }
    };
    loadDraft();
  }, []);

  // Save draft when content or images change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveDraft(content, imageUris);
    }, 1000); // Save draft 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [content, imageUris]);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);

  // Load earned badges when screen mounts
  useEffect(() => {
    const loadBadges = async () => {
      const stored = await AsyncStorage.getItem("earnedBadges");
      if (stored) {
        try {
          setEarnedBadges(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse earnedBadges", e);
        }
      }
    };
    loadBadges();
  }, []);
  
  const handleSaveEntry = async () => {
    // Step 1: Prevent saving if entry content is empty
    if (!content.trim()) {
      Alert.alert("Empty Entry", "Please write something before saving.");
      return;
    }
  
    try {
      console.log('🔄 Starting handleSaveEntry...');
      setIsSaving(true);
      
      const imageData = localImageUris.map((uri, index) => ({
        fileName: `uploads/${uri.split('/').pop()}`,
        signedUrl: imageUris[index]
      }));
  
      //console.log('📦 Prepared image data:', imageData);
  
      const response = await saveJournalEntry(content, imageData, "freeform", undefined, entryDate);
      if (response.error) {
        console.error('❌ Failed to save journal entry:', response.error);
        Alert.alert("Error", "Failed to save journal entry.");
        return;
      }
  
      console.log('✅ Journal entry saved successfully');
      const token = await AsyncStorage.getItem("userToken");
      const userId = await AsyncStorage.getItem("userId");

      if (token && userId && !earnedBadges.includes("freeform")) {
        const success = await awardBadge(token, userId, "freeform");
      
        if (success) {
          const updated = [...earnedBadges, "freeform"];
          setEarnedBadges(updated);
          await AsyncStorage.setItem("earnedBadges", JSON.stringify(updated));
          console.log("🎉 Freeform badge awarded and saved.");
          setAwardedBadgeKey("freeform");
          setShowBadgeModal(true); // 🟢 Show the congrats modal
        }
      }
      const entryHour = new Date(entryDate).getHours();

      // Early Bird: Between 4 AM and 8 AM
      if (!earnedBadges.includes("early_bird") && entryHour >= 4 && entryHour < 8 && token && userId) {
        const success = await awardBadge(token, userId, "early_bird");
        if (success) {
          const updated = [...earnedBadges, "early_bird"];
          setEarnedBadges(updated);
          await AsyncStorage.setItem("earnedBadges", JSON.stringify(updated));
          console.log("🌅 Early Bird badge awarded!");
          setAwardedBadgeKey("early_bird");
          setShowBadgeModal(true);
        }
      }

      // Night Owl: Between 11 PM and 2 AM
      if (!earnedBadges.includes("night_owl") && (entryHour >= 23 || entryHour < 2) && token && userId) {
        const success = await awardBadge(token, userId, "night_owl");
        if (success) {
          const updated = [...earnedBadges, "night_owl"];
          setEarnedBadges(updated);
          await AsyncStorage.setItem("earnedBadges", JSON.stringify(updated));
          console.log("🌙 Night Owl badge awarded!");
          setAwardedBadgeKey("night_owl");
          setShowBadgeModal(true);
        }
      }
      if (
        imageUris.length > 0 && 
        !earnedBadges.includes("image_storyteller") &&
        token && userId
      ) {
        const success = await awardBadge(token, userId, "image_storyteller");
        if (success) {
          const updated = [...earnedBadges, "image_storyteller"];
          setEarnedBadges(updated);
          await AsyncStorage.setItem("earnedBadges", JSON.stringify(updated));
          console.log("📷 Image Storyteller badge awarded!");
          setAwardedBadgeKey("image_storyteller");
          setShowBadgeModal(true);
        }
      }

      // Let It Out: Check if analysis contains strong emotions
      if (!earnedBadges.includes("let_it_out") && token && userId) {
        if(response.entry.journalSentiments){
          for (const sentiment of response.entry.journalSentiments) {
            // 2 = Anger, 10 = disapproval, 11 = disgust, 16 = grief, 25 = sadness
            if ([2, 10, 11, 16, 25].includes(sentiment.emotion)) {

              const success = await awardBadge(token, userId, "let_it_out");
              if (success) {
                const updated = [...earnedBadges, "let_it_out"];
                setEarnedBadges(updated);
                await AsyncStorage.setItem("earnedBadges", JSON.stringify(updated));
                console.log("😡 Let it out badge awarded!");
                setAwardedBadgeKey("let_it_out");
                setShowBadgeModal(true);
              }

              break;
            }
          }
        }
      }
      
      
      await clearDraft();
      navigation.navigate("Home");
    } catch (error) {
      console.error("❌ Error in handleSaveEntry:", error);
      Alert.alert("Error", "An error occurred while saving the journal entry.");
    } finally {
      setIsSaving(false);
    }
  };
  

  if (isSaving) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: darkMode ? theme.backgroundColor : 'rgba(255,255,255,0.8)', 
        justifyContent: 'center', 
        alignItems: 'center',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999
      }}>
        <ActivityIndicator size="large" color={darkMode ? theme.text : '#000'} />
        <Text style={{ marginTop: 20, fontSize: 16, color: theme.text }}>Saving your entry...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <BadgeCongratsModal
        visible={showBadgeModal}
        badgeKey={awardedBadgeKey}
        onClose={() => setShowBadgeModal(false)}
      />

    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1, backgroundColor: theme.backgroundColor}}>
         <View style={{ flex: 1, padding: 20 }}>
        <View
          style={{
            flex: 2,
            backgroundColor: darkMode ? theme.cardBackground : "#F5F5F5",
            padding: 20,
            borderRadius: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.1,
            shadowRadius: 5,
            borderWidth: 1,
            borderColor: darkMode ? theme.border : "#DDD",
            position: 'relative', // Important so that absolute ❌ button stays inside
          }}
        >

          {(content.trim() || imageUris.length > 0) && (
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                backgroundColor: darkMode ? '#404040' : '#e0e0e0',
                borderRadius: 20,
                padding: 6,
                elevation: 4, // Android shadow
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
              }}
              onPress={() => {
                Alert.alert(
                  "Clear Entry",
                  "Are you sure you want to clear your current entry?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Clear",
                      style: "destructive",
                      onPress: async () => {
                        await clearDraft();
                        setContent("");
                        setImageUris([]);
                        setLocalImageUris([]);
                      }
                    }
                  ]
                );
              }}
              activeOpacity={0.8}
            >
              <Text style={{ 
                fontSize: 18, 
                color: darkMode ? "#fff" : "#333",
                opacity: 0.8,
              }}>
                ✕
              </Text>
            </TouchableOpacity>
          )}

          <TextInput
            style={{
              flex: 1,
              color: theme.text,
              fontSize: 16,
              fontFamily: "serif",
              textAlignVertical: "top",
              paddingTop: 30, // Extra space at top so typing does not collide with ✕
            }}
            multiline
            placeholder="Write your thoughts... (or tap the mic button on your keyboard)"
            placeholderTextColor={theme.placeholder}
            value={content}
            onChangeText={(text) => {
              if (text.length <= MAX_CHAR_COUNT) {
                setContent(text);
              }
            }}
            keyboardType="default"
            returnKeyType="done"
          />          
          <Text
            style={{
              textAlign: "right",
              fontSize: 14,
              color: content.length >= MAX_CHAR_COUNT - 500 ? "red" : theme.text,
              marginTop: 5,
            }}
          >
            {content.length} / {MAX_CHAR_COUNT}
          </Text>
         
          {content.length >= MAX_CHAR_COUNT - 500 && content.length < MAX_CHAR_COUNT && (
            <Text style={{ color: "red", textAlign: "center", marginTop: 5 }}>
              ⚠️ You're writing a wonderful entry! Just a heads-up, you're nearing the character limit.
            </Text>
          )}
         
          {content.length >= MAX_CHAR_COUNT && (
            <Text style={{ color: "red", textAlign: "center", marginTop: 5, fontWeight: "bold" }}>
              🚫 That's an amazing entry! You've reached the limit, but you can always start a new one.
            </Text>
          )}
        </View>        
        {localImageUris.length > 0 && (
          <ScrollView horizontal style={{ marginTop: 10 }}>
            {localImageUris.map((uri, index) => (
              <View key={index} style={{ marginRight: 10 }}>
                <TouchableOpacity onPress={() => setSelectedImage(uri)}>
                  <Image
                    source={{ uri }}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 10,
                    }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                {uploadProgress[uri] !== undefined && uploadProgress[uri] < 100 && (
                  <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 10,
                  }}>
                    <ActivityIndicator color="white" />
                    <Text style={{ color: 'white', marginTop: 5 }}>
                      {Math.round(uploadProgress[uri])}%
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}         
         {imagePickerWarning ? (
  <Text style={{ color: "red", textAlign: "center", marginTop: 10 }}>
    {imagePickerWarning}
  </Text>
) : null}
        
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 20, marginBottom: 40, }}>         
          <TouchableOpacity
            style={{
              backgroundColor: darkMode ? '#404040' : '#E0E0E0',
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
              flex: 1,
              marginRight: 10,
            }}
            onPress={pickImage}
          >
            <Text style={{ color: darkMode ? theme.text : '#000', fontSize: 14 }}>
  📸 Upload Images
</Text>

          </TouchableOpacity>
          
          <TouchableOpacity
            style={{
              backgroundColor: darkMode ? '#404040' : '#E0E0E0',
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
              flex: 1,
            }}
            onPress={handleSaveEntry}
          >
            <Text style={{ color: darkMode ? theme.text : '#000', fontSize: 14 }}>
  💾 Save Entry
</Text>

          </TouchableOpacity>
        </View>

       
        
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
              <TouchableOpacity
                style={{
                  backgroundColor: darkMode ? '#404040' : '#E0E0E0',
                  padding: 12,
                  borderRadius: 8,
                  marginRight: 10,
                }}
                onPress={() => setSelectedImage(null)}
              >
                <Text style={{ fontSize: 16, color: darkMode ? theme.text : '#000' }}>Close</Text>
              </TouchableOpacity>
              
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

        </View> 
          <View>
            <BottomNavigation activeScreen="FreeJournaling" />
          </View>
        </View>
        
  </TouchableWithoutFeedback>
  </View>
  );
};

export default FreeJournalingScreen;
