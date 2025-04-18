import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView, SafeAreaView, Image, Modal } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Feather } from "@expo/vector-icons";
import { RootStackParamList } from "./types/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { API_URL, deleteEntry, uploadJournalImage, deleteJournalImage } from "./services/ApiService";
import * as ImagePicker from 'expo-image-picker';

import { Feather as FeatherIcon } from "@expo/vector-icons"; // for emotion and reason icons

// Define types for emotions and reasons
type EmotionIconType = "star" | "smile" | "frown" | "meh" | "thumbs-up" | "heart" | "help-circle" | "search" | "target" | "thumbs-down" | "x-circle" | "alert-circle" | "zap" | "alert-triangle" | "gift";

const EMOTIONS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
    "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
    "nervousness", "optimism", "pride", "realization", "relief", "remorse",
    "sadness", "surprise", "neutral"
]

// Map emotion codes to emotion names
const emotionMap: Record<number, string> = EMOTIONS.reduce(
  (acc, emotion, index) => {
    acc[index] = emotion;
    return acc;
  },
  {} as Record<number, string>
);

const emotionIcons: { [key: string]: string } = {
  admiration: "star",
  amusement: "smile",
  anger: "frown",
  annoyance: "meh",
  approval: "thumbs-up",
  caring: "heart",
  confusion: "help-circle",
  curiosity: "search",
  desire: "target",
  disappointment: "frown",
  disapproval: "thumbs-down",
  disgust: "x-circle",
  embarrassment: "alert-circle",
  excitement: "zap",
  fear: "alert-triangle",
  gratitude: "gift",
  grief: "cloud-drizzle",
  joy: "sun",
  love: "heart",
  nervousness: "corner-up-right",
  optimism: "trending-up",
  pride: "award",
  realization: "eye",
  relief: "check-circle",
  remorse: "corner-down-left",
  sadness: "cloud-rain",
  surprise: "send",
  neutral: "meh"
};

// Helper function to get the correct icon name for check-in emotions
const getCheckInEmotionIcon = (emotion: string): string => {
  const lowerEmotion = emotion.toLowerCase();
  return emotionIcons[lowerEmotion] || "help-circle";
};

const reasonIcons: { [key: string]: string } = {
  Work: "briefcase", School: "book", Friends: "users", Family: "home", Travel: "map", Relationship: "heart",
  Health: "activity", Exercise: "barbell", Food: "coffee", Hobbies: "music", News: "tv", Weather: "cloud",
  Sleep: "moon", Music: "headphones", Technology: "cpu"
};


type Entry = {
  _id: string;
  entryContent: string;
  entryDate: string;
  createdAt?: string;
  images?: string[];
  journalSentiments?: any[];
  sentiments?: string[];
  causes?: string[];
  comments?: string[];
  category: string;
  prompt: string;
};

type EntryDetailRouteProp = RouteProp<RootStackParamList, "EntryDetail">;
type EntryDetailNavigationProp = StackNavigationProp<RootStackParamList, "Home">;

const EntryDetail = () => {
  const navigation = useNavigation<EntryDetailNavigationProp>();
  const route = useRoute<EntryDetailRouteProp>();
  const { entry } = route.params;
  
  // State for editing mode and image selection
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(entry.entryContent);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [images, setImages] = useState(entry.images || []);
  const [isUploading, setIsUploading] = useState(false);
  
  // Format the date
  let formattedDate = "Invalid date";
  try {
    const dateString = entry.entryDate || entry.createdAt;
    if (dateString) {
      formattedDate = format(new Date(dateString), "EEEE, MMMM d, yyyy");
    }
  } catch (error) {
    console.log("Error formatting date:", error);
  }
  
  // Handle saving edited entry
  const handleSaveEntry = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Error", "Authentication token not found");
        return;
      }
      
      const response = await fetch(`${API_URL}/journal/${entry._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          entryContent: editedContent,
          images: images // Include the updated images array
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update journal entry");
      }
      
      Alert.alert("Success", "Journal entry updated successfully");
      setIsEditing(false);
      // Navigate back and refresh the home screen
      navigation.navigate("Home");
    } catch (error) {
      console.error("Error updating entry:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to update journal entry");
    }
  };
  
  // Handle deleting entry
  const handleDeleteEntry = () => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this journal entry? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              console.log("Attempting to delete entry with ID:", entry._id);
              
              // Use the deleteEntry function from ApiService
              await deleteEntry(entry);
              
              // If successful, show success message and navigate back
              Alert.alert("Success", "Entry deleted successfully");
              navigation.navigate("Home"); // Remove the refresh param to fix type error
            } catch (error) {
              console.error("Delete error:", error);
              Alert.alert("Error", error.message || "Failed to delete entry");
            }
          }
        }
      ]
    );
  };

  // Handle adding new image
  const handleAddImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please grant camera roll permissions to add images.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!pickerResult.canceled && pickerResult.assets[0]) {
        setIsUploading(true);
        try {
          const signedUrl = await uploadJournalImage(pickerResult.assets[0].uri);
          const newImage = {
            fileName: `uploads/${pickerResult.assets[0].uri.split('/').pop()}`,
            signedUrl: signedUrl
          };
          setImages([...images, newImage]);
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('Error', 'Failed to upload image. Please try again.');
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Handle deleting image
  const handleDeleteImage = async (image: { signedUrl: string }) => {
    try {
      await deleteJournalImage(image.signedUrl);
      setImages(images.filter((img: { signedUrl: string }) => img.signedUrl !== image.signedUrl));
      if (selectedImage === image.signedUrl) {
        setSelectedImage(null);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      Alert.alert('Error', 'Failed to delete image. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{entry.category === "checkin" ? "Check-in Entry" : "Journal Entry"}</Text>
        <View style={styles.actionButtons}>
          {isEditing ? (
            <TouchableOpacity onPress={handleSaveEntry} style={styles.actionButton}>
              <Feather name="check" size={24} color="#000" />
            </TouchableOpacity>
          ) : (
            <>
              {entry.category !== "checkin" && (
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.actionButton}>
                  <Feather name="edit" size={24} color="#000" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleDeleteEntry} style={styles.actionButton}>
                <Feather name="trash-2" size={24} color="#FF0000" />
              </TouchableOpacity>
            </>
          )}
        </View>

      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.entryDetails}>
          <Text style={styles.date}>{formattedDate}</Text>
          {/* {entry.category && <Text style={styles.category}>{entry.category}</Text>} */}
          {entry.prompt && <Text style={styles.prompt}>Prompt: {entry.prompt}</Text>}
        </View>
        
        {entry.category === "checkin" ? (
          <>
            <Text style={styles.sectionTitle}>Check-in Summary</Text>

            {entry.sentiments && entry.sentiments.length > 0 && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Emotions:</Text>
                <View style={styles.gridContainer}>
                  {entry.sentiments.map((emotion: string, index: number) => (
                    <View key={index} style={styles.gridItem}>
                      <Feather name={getCheckInEmotionIcon(emotion)} size={20} color="#444" />
                      <Text style={styles.gridLabel}>{emotion}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {entry.causes && entry.causes.length > 0 && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Causes:</Text>
                <View style={styles.gridContainer}>
                  {entry.causes.map((cause: string, index: number) => (
                    <View key={index} style={styles.gridItem}>
                      <Feather name={reasonIcons[cause] || "help-circle"} size={20} color="#444" />
                      <Text style={styles.gridLabel}>{cause}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {entry.comments && entry.comments.length > 0 && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Comments:</Text>
                {entry.comments.map((comment: string, index: number) => (
                  <Text key={index} style={styles.detailItem}>{comment}</Text>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Content Section */}
            <View style={styles.contentSection}>
              {isEditing ? (
                <TextInput
                  style={styles.editor}
                  multiline
                  value={editedContent}
                  onChangeText={setEditedContent}
                  autoFocus
                />
              ) : (
                <Text style={styles.entryContent}>{entry.entryContent}</Text>
              )}
            </View>

            {/* Sentiment Analysis Section - For both guided and freeform */}
            {entry.journalSentiments && entry.journalSentiments.length > 0 && (
              <View style={styles.sentimentsContainer}>
                <Text style={styles.sentimentsTitle}>Sentiment Analysis</Text>
                <View style={styles.gridContainer}>
                  {entry.journalSentiments.map((sentiment: { emotion: number; percentage: number }, index: number) => (
                    <View key={index} style={styles.sentimentItem}>
                      <Feather name={emotionIcons[emotionMap[sentiment.emotion]] || "help-circle"} size={20} color="#444" />
                      <Text style={styles.sentimentText}>
                        {emotionMap[sentiment.emotion]}: {Math.round(sentiment.percentage * 100)}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Images Section - Only for freeform */}
            {entry.category === "freeform" && (
              <View style={styles.imagesContainer}>
                <Text style={styles.sectionTitle}>Images</Text>
                {isEditing ? (
                  <View style={styles.imagesHeader}>
                    <TouchableOpacity 
                      style={styles.addImageButton}
                      onPress={handleAddImage}
                      disabled={isUploading}
                    >
                      <Feather name="plus" size={24} color="#000" />
                      <Text style={styles.addImageText}>Add Image</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                
                <ScrollView horizontal style={styles.imagesScrollView}>
                  {images.map((image: { signedUrl: string }, index: number) => (
                    <View key={index} style={styles.imageWrapper}>
                      <TouchableOpacity onPress={() => setSelectedImage(image.signedUrl)}>
                        <Image
                          source={{ uri: image.signedUrl }}
                          style={styles.entryImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                      {isEditing && (
                        <TouchableOpacity 
                          style={styles.deleteImageButton}
                          onPress={() => handleDeleteImage(image)}
                        >
                          <Feather name="trash-2" size={20} color="#FF0000" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}

      </ScrollView>

      {/* Image Preview Modal */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedImage(null)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 8,
    marginLeft: 10,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  entryDetails: {
    marginBottom: 20,
  },
  date: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  category: {
    fontSize: 16,
    color: "#666",
    marginBottom: 4,
  },
  prompt: {
    fontSize: 16,
    fontStyle: "italic",
    color: "#666",
    marginBottom: 16,
  },
  entryContent: {
    fontSize: 16,
    lineHeight: 24,
  },
  editor: {
    fontSize: 16,
    lineHeight: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderRadius: 8,
    backgroundColor: "#F9F9F9",
    minHeight: 200,
  },
  sentimentsContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
    marginBottom: 20,
  },
  sentimentsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  sentimentItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sentimentText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#333",
  },
  addImageText: {
    marginLeft: 8,
    color: "#000",
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  
  detailBlock: {
    marginBottom: 16,
  },
  
  detailLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  
  detailItem: {
    fontSize: 14,
    color: "#444",
    marginLeft: 10,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  gridItem: {
    width: "30%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    marginRight: "3.33%",
  },
  gridLabel: {
    marginLeft: 6,
    fontSize: 14,
    color: "#444",
  },
  
  imagesContainer: {
    marginTop: 20,
  },
  imagesScrollView: {
    marginTop: 10,
  },
  imageWrapper: {
    marginRight: 10,
    position: 'relative',
  },
  entryImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '90%',
    height: '70%',
    borderRadius: 10,
  },
  closeButton: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 5,
  },
  closeButtonText: {
    color: '#000',
    fontSize: 16,
  },
  imagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addImageButton: {
    padding: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
  },
  deleteImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 5,
    borderRadius: 15,
  },
  contentSection: {
    marginBottom: 20,
  },
});

export default EntryDetail;