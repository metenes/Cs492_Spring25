import React, { useState, useEffect } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  TextInput, ScrollView, SafeAreaView, Image, Modal, FlatList 
} from "react-native";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { Feather } from "@expo/vector-icons";
import { RootStackParamList } from "./types/types";
import { deleteJournalEntry, editJournalEntry, editCheckIn, deleteCheckIn } from "./services/ApiService"; // ✅ Import both delete & update functions
import { format } from "date-fns";
import { deleteEntry, uploadJournalImage, deleteJournalImage, updateCheckIn, getCheckInHistory, updateJournalEntry} from "./services/ApiService";
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from './context/ThemeContext';
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
const emotionMap: Record<number, string> = {
  0: "admiration",
  1: "amusement",
  2: "anger",
  3: "annoyance",
  4: "approval",
  5: "caring",
  6: "confusion",
  7: "curiosity",
  8: "desire",
  9: "disappointment",
  10: "disapproval",
  11: "disgust",
  12: "embarrassment",
  13: "excitement",
  14: "fear",
  15: "gratitude",
  16: "grief",
  17: "joy",
  18: "love",
  19: "nervousness",
  20: "optimism",
  21: "pride",
  22: "realization",
  23: "relief",
  24: "remorse",
  25: "sadness",
  26: "surprise",
  27: "neutral"
};

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
const getCheckInEmotionIcon = (emotion: string): keyof typeof Feather.glyphMap => {
  const lowerEmotion = emotion.toLowerCase();
  return (emotionIcons[lowerEmotion] as keyof typeof Feather.glyphMap) || "help-circle";
};

// Helper function to get the correct icon name for sentiment emotions
const getSentimentEmotionIcon = (emotionCode: number): keyof typeof Feather.glyphMap => {
  const emotionName = emotionMap[emotionCode];
  return (emotionIcons[emotionName] as keyof typeof Feather.glyphMap) || "help-circle";
};

const reasonIcons: { [key: string]: string } = {
  Work: "briefcase", School: "book", Friends: "users", Family: "home", Travel: "map", Relationship: "heart",
  Health: "activity", Exercise: "barbell", Food: "coffee", Hobbies: "music", News: "tv", Weather: "cloud",
  Sleep: "moon", Music: "headphones", Technology: "cpu"
};

export type Entry = {
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

// Define emotions and reasons arrays (same as CheckInScreen)
const emotions = [
  { name: "Admiration", icon: "star" }, { name: "Amusement", icon: "smile" }, { name: "Anger", icon: "frown" },
  { name: "Annoyance", icon: "meh" }, { name: "Approval", icon: "thumbs-up" }, { name: "Caring", icon: "heart" },
  { name: "Confusion", icon: "help-circle" }, { name: "Curiosity", icon: "search" }, { name: "Desire", icon: "target" },
  { name: "Disappointment", icon: "frown" }, { name: "Disapproval", icon: "thumbs-down" }, { name: "Disgust", icon: "x-circle" },
  { name: "Embarrassment", icon: "alert-circle" }, { name: "Excitement", icon: "zap" }, { name: "Fear", icon: "alert-triangle" },
  { name: "Gratitude", icon: "gift" }, { name: "Grief", icon: "cloud-drizzle" }, { name: "Joy", icon: "sun" },
  { name: "Love", icon: "heart" }, { name: "Nervousness", icon: "corner-up-right" }, { name: "Optimism", icon: "trending-up" },
  { name: "Pride", icon: "award" }, { name: "Realization", icon: "eye" }, { name: "Relief", icon: "check-circle" },
  { name: "Remorse", icon: "corner-down-left" }, { name: "Sadness", icon: "cloud-rain" }, { name: "Surprise", icon: "send" }
];

const reasons = [
  { name: "Work", icon: "briefcase" }, { name: "School", icon: "book" }, { name: "Friends", icon: "users" },
  { name: "Family", icon: "home" }, { name: "Travel", icon: "map" }, { name: "Relationship", icon: "heart" },
  { name: "Health", icon: "activity" }, { name: "Exercise", icon: "barbell" }, { name: "Food", icon: "coffee" },
  { name: "Hobbies", icon: "music" }, { name: "News", icon: "tv" }, { name: "Weather", icon: "cloud" },
  { name: "Sleep", icon: "moon" }, { name: "Music", icon: "headphones" }, { name: "Technology", icon: "cpu" }
];

const EntryDetail = () => {
  const { theme, darkMode } = useTheme();
  const navigation = useNavigation<EntryDetailNavigationProp>();
  const route = useRoute<EntryDetailRouteProp>();
  const [entry, setEntry] = useState(route.params.entry);
  
  // Add useFocusEffect to refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const fetchUpdatedEntry = async () => {
        try {
          const token = await AsyncStorage.getItem("userToken");
          if (!token) {
            Alert.alert("Error", "Authentication token not found");
            return;
          }

          const data = await getCheckInHistory(token);
          const updatedEntry = data.history.find((e: any) => e.entry_id === entry.entry_id);
          
          if (updatedEntry) {
            setEntry({
              ...entry,
              sentiments: updatedEntry.sentiments,
              causes: updatedEntry.causes,
              comments: updatedEntry.comments,
            });
          }
        } catch (error) {
          console.error("Error fetching updated entry:", error);
        }
      };

      fetchUpdatedEntry();
    }, [entry.entry_id])
  );
  
  // State for editing mode and image selection
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(entry.entryContent);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [images, setImages] = useState(entry.images || []);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  
  // State for check-in editing
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(entry.sentiments || []);
  const [selectedReasons, setSelectedReasons] = useState<string[]>(entry.causes || []);
  const [comment, setComment] = useState(entry.comments?.[0] || "");

  const toggleSelection = (item: any, state: string[], setState: React.Dispatch<React.SetStateAction<string[]>>) => {
    setState((prev) =>
      prev.includes(item.name)
        ? prev.filter((i) => i !== item.name)
        : [...prev, item.name]
    );
  };

  const renderItem = ({ item }: any, state: string[], setState: React.Dispatch<React.SetStateAction<string[]>>) => (
    <TouchableOpacity
      style={[
        styles.option,
        state.includes(item.name) && styles.selectedOption,
      ]}
      onPress={() => toggleSelection(item, state, setState)}
    >
      <Feather name={item.icon} size={24} color="#000" />
      <Text>{item.name}</Text>
    </TouchableOpacity>
  );

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

/*
      if (entry.category === "Check-in") {
        await editCheckIn(entry._id, entry.journalSentiments, [], [editedContent]);
      } else {
        await editJournalEntry(entry._id, editedContent, entry.images, entry.category, entry.prompt);
      }

*/ 


  const handleSaveEntry = async () => {
    try {
      if (entry.category === "checkin") {
        // Validate check-in data
        if (selectedEmotions.length === 0 || selectedReasons.length === 0) {
          Alert.alert("Missing Information", "Please select at least one emotion and one reason.");
          return;
        }

        // Update check-in with new data
        const updatedCheckIn = await updateCheckIn(
          entry._id,
          selectedEmotions,
          selectedReasons,
          [comment]
        );

        if (updatedCheckIn) {
          // Update local state with new data
          setEntry({
            ...entry,
            sentiments: selectedEmotions,
            causes: selectedReasons,
            comments: [comment]
          });
          
          Alert.alert("Success", "Check-in updated successfully");
          setIsEditing(false);
        }
      } else {
        // Use updateJournalEntry for guided and freeform entries
        const updatedEntry = await updateJournalEntry(
          entry._id,
          editedContent,
          entry.entryDate,
          images
        );
        
        // Update the local entry state with the new data including sentiment analysis
        if (updatedEntry && updatedEntry.entry) {
          // Format the sentiment data to match the expected format
          const formattedSentiments = updatedEntry.entry.journalSentiments.map((sentiment: any) => ({
            emotion: sentiment.emotion,
            percentage: sentiment.percentage
          }));
          
          setEntry({
            ...entry,
            entryContent: editedContent,
            journalSentiments: formattedSentiments,
            images: images
          });
        }
        
        Alert.alert("Success", "Journal entry updated successfully");
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Error updating entry:", error);
      Alert.alert("Error", "Failed to update entry. Please try again.");
    }
  };
  
  const handleDeleteEntry = async () => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this entry? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if(entry.type == "Check-In") {
                  deleteCheckIn(entry)
              }
              else{
                  deleteJournalEntry(entry._id)
              }
              Alert.alert("Deleted", "Entry deleted successfully");
              navigation.navigate("Home");
            } catch (error) {
              Alert.alert("Error", "Failed to delete the entry.");
              console.error("❌ Deletion failed:", error);
            }
          },
        },
      ]
    );
  };
  
  
  /* const handleDeleteEntry = async () => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this entry? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              if (entry.category === "Check-in") {
                await deleteCheckIn(entry._id);
              } else {
                await deleteJournalEntry(entry._id);
              }
              navigation.goBack(); // Navigate back after deletion
            } catch (error) {
              Alert.alert("Error", "Failed to delete entry.");
            }
          }
        }
      ]
    );
  }; */

  // Handle editing check-in
  const handleEditCheckIn = () => {
    setIsEditing(true);
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

  // Add useEffect to handle image loading state
  useEffect(() => {
    if (entry.images && entry.images.length > 0) {
      setIsLoadingImages(true);
      // Simulate loading time (you can adjust this or remove if not needed)
      const timer = setTimeout(() => {
        setIsLoadingImages(false);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setIsLoadingImages(false);
    }
  }, [entry.images]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{entry.category === "checkin" ? "Check-in Entry" : "Journal Entry"}</Text>
        <View style={styles.actionButtons}>
          {isEditing ? (
            <TouchableOpacity onPress={handleSaveEntry} style={styles.actionButton}>
              <Feather name="check" size={24} color={theme.text} />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity 
                onPress={entry.category === "checkin" ? handleEditCheckIn : () => setIsEditing(true)} 
                style={styles.actionButton}
              >
                <Feather name="edit" size={24} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteEntry} style={styles.actionButton}>
                <Feather name="trash-2" size={24} color={theme.danger} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.entryDetails}>
          <Text style={[styles.date, { color: theme.text }]}>{formattedDate}</Text>
          {/* {entry.category && <Text style={styles.category}>{entry.category}</Text>} */}
          {entry.prompt && <Text style={[styles.prompt, { color: theme.textSecondary }]}>Prompt: {entry.prompt}</Text>}
        </View>
        
        {entry.category === "checkin" ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Check-in Summary</Text>

            {isEditing ? (
              <>
                <View style={[styles.detailBlock, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.detailLabel, { color: theme.text }]}>Emotions:</Text>
                  <View style={styles.gridContainer}>
                    {emotions.map((emotion: any, index: number) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.gridItem,
                          { backgroundColor: 'transparent' },
                          selectedEmotions.includes(emotion.name) && styles.selectedItem
                        ]}
                        onPress={() => {
                          if (selectedEmotions.includes(emotion.name)) {
                            setSelectedEmotions(selectedEmotions.filter(e => e !== emotion.name));
                          } else {
                            setSelectedEmotions([...selectedEmotions, emotion.name]);
                          }
                        }}
                      >
                        <Feather name={emotion.icon} size={20} color={theme.icon} />
                        <Text style={[styles.gridLabel, { color: theme.text }]}>{emotion.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.detailBlock, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.detailLabel, { color: theme.text }]}>Causes:</Text>
                  <View style={styles.gridContainer}>
                    {reasons.map((reason: any, index: number) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.gridItem,
                          { backgroundColor: 'transparent' },
                          selectedReasons.includes(reason.name) && styles.selectedItem
                        ]}
                        onPress={() => {
                          if (selectedReasons.includes(reason.name)) {
                            setSelectedReasons(selectedReasons.filter(r => r !== reason.name));
                          } else {
                            setSelectedReasons([...selectedReasons, reason.name]);
                          }
                        }}
                      >
                        <Feather name={reason.icon} size={20} color={theme.icon} />
                        <Text style={[styles.gridLabel, { color: theme.text }]}>{reason.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.detailBlock, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.detailLabel, { color: theme.text }]}>Comments:</Text>
                  <TextInput
                    style={[styles.commentInput, { 
                      backgroundColor: theme.inputBackground,
                      borderColor: theme.border,
                      color: theme.text
                    }]}
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Add a comment (optional)"
                    placeholderTextColor={theme.placeholder}
                    multiline
                  />
                </View>
              </>
            ) : (
              <>
                {entry.sentiments && entry.sentiments.length > 0 && (
                  <View style={[styles.detailBlock, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.detailLabel, { color: theme.text }]}>Emotions:</Text>
                    <View style={styles.gridContainer}>
                      {entry.sentiments.map((emotion: string, index: number) => (
                        <View key={index} style={[styles.gridItem, { backgroundColor: 'transparent' }]}>
                          <Feather name={getCheckInEmotionIcon(emotion)} size={20} color={theme.icon} />
                          <Text style={[styles.gridLabel, { color: theme.text }]}>{emotion}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {entry.causes && entry.causes.length > 0 && (
                  <View style={[styles.detailBlock, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.detailLabel, { color: theme.text }]}>Causes:</Text>
                    <View style={styles.gridContainer}>
                      {entry.causes.map((cause: string, index: number) => (
                        <View key={index} style={[styles.gridItem, { backgroundColor: 'transparent' }]}>
                          <Feather name={(reasonIcons[cause] as keyof typeof Feather.glyphMap) || "help-circle"} size={20} color={theme.icon} />
                          <Text style={[styles.gridLabel, { color: theme.text }]}>{cause}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {entry.comments && entry.comments.length > 0 && (
                  <View style={[styles.detailBlock, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.detailLabel, { color: theme.text }]}>Comments:</Text>
                    {entry.comments.map((comment: string, index: number) => (
                      <Text key={index} style={[styles.detailItem, { color: theme.textSecondary }]}>{comment}</Text>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Content Section */}
            <View style={styles.contentSection}>
              {isEditing ? (
                <TextInput
                  style={[styles.editor, { 
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.border,
                    color: theme.text
                  }]}
                  multiline
                  value={editedContent}
                  onChangeText={setEditedContent}
                  autoFocus
                  placeholderTextColor={theme.placeholder}
                />
              ) : (
                <Text style={[styles.entryContent, { color: theme.text }]}>{entry.entryContent}</Text>
              )}
            </View>

            {/* Sentiment Analysis Section - For both guided and freeform */}
            {entry.journalSentiments && entry.journalSentiments.length > 0 && (
              <View style={[styles.sentimentsContainer, { backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.sentimentsTitle, { color: theme.text }]}>Sentiment Analysis</Text>
                <View style={styles.gridContainer}>
                  {entry.journalSentiments.map((sentiment: { emotion: number; percentage: number }, index: number) => {
                    const emotionName = emotionMap[sentiment.emotion] || "unknown";
                    const percentage = Math.round(sentiment.percentage * 100);
                    return (
                      <View key={index} style={[styles.sentimentItem, { backgroundColor: theme.backgroundColor }]}>
                        <Feather name={getSentimentEmotionIcon(sentiment.emotion)} size={20} color={theme.icon} />
                        <Text style={[styles.sentimentText, { color: theme.text }]}>
                          {emotionName}: {percentage}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Images Section - Only for freeform */}
            {entry.category === "freeform" && (
              <View style={styles.imagesContainer}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Images</Text>
                {isEditing ? (
                  <View style={styles.imagesHeader}>
                    <TouchableOpacity 
                      style={[styles.addImageButton, { backgroundColor: theme.cardBackground }]}
                      onPress={handleAddImage}
                      disabled={isUploading}
                    >
                      <Feather name="plus" size={24} color={theme.text} />
                      <Text style={[styles.addImageText, { color: theme.text }]}>Add Image</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                
                <ScrollView horizontal style={styles.imagesScrollView}>
                  {isLoadingImages ? (
                    // Skeleton loader for images
                    <View style={styles.skeletonContainer}>
                      {[1, 2, 3].map((_, index) => (
                        <View 
                          key={index} 
                          style={[
                            styles.skeletonImage, 
                            { backgroundColor: darkMode ? '#2C2C2C' : '#E0E0E0' }
                          ]} 
                        />
                      ))}
                    </View>
                  ) : (
                    images.map((image: { signedUrl: string }, index: number) => (
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
                            style={[styles.deleteImageButton, { backgroundColor: theme.cardBackground }]}
                            onPress={() => handleDeleteImage(image)}
                          >
                            <Feather name="x" size={24} color={theme.text} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            )}
          </>
        )}

      </ScrollView>

      {/* Image Preview Modal */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={[styles.modalContainer, { backgroundColor: 'rgba(0, 0, 0, 0.9)' }]}>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.cardBackground }]}
            onPress={() => setSelectedImage(null)}
          >
            <Text style={[styles.closeButtonText, { color: theme.text }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Styles remain unchanged
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
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
    padding: 16,
    borderRadius: 12,
  },
  
  detailLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  
  detailItem: {
    fontSize: 14,
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
    padding: 8,
    borderRadius: 8,
  },
  gridLabel: {
    marginLeft: 6,
    fontSize: 14,
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#000",
    textAlign: "center",
    fontFamily: "Poppins",
  },
  nextButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "black",
    borderRadius: 10,
    width: "50%",
    alignSelf: "center",
  },
  disabledButton: {
    backgroundColor: "#CCCCCC",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
  },
  summaryContainer: {
    flex: 1,
    width: "100%",
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#f8f8f8",
  },
  summaryTitle: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#000",
    textAlign: "center",
    fontFamily: "Poppins",
  },
  section: {
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  tag: {
    backgroundColor: "lavender",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 16,
    fontWeight: "500",
    color: "black",
  },
  commentInput: {
    width: "100%",
    height: 100,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    textAlignVertical: "top",
    backgroundColor: "white",
  },
  option: {
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
  },
  selectedOption: {
    backgroundColor: '#e0e0e0',
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
  },
  selectedItem: {
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    minHeight: 100,
  },
  skeletonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
  },
  skeletonImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginRight: 10,
  },
});

export default EntryDetail;
