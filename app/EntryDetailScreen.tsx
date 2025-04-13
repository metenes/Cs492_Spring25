import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView, SafeAreaView } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Icon from "react-native-vector-icons/Feather";
import { RootStackParamList } from "./types/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { API_URL, deleteEntry } from "./services/ApiService";

import { Feather } from "@expo/vector-icons"; // for emotion and reason icons

const emotionIcons: { [key: string]: string } = {
  Admiration: "star", Amusement: "smile", Anger: "frown", Annoyance: "meh", Approval: "thumbs-up", Caring: "heart",
  Confusion: "help-circle", Curiosity: "search", Desire: "target", Disappointment: "frown", Disapproval: "thumbs-down",
  Disgust: "x-circle", Embarrassment: "alert-circle", Excitement: "zap", Fear: "alert-triangle", Gratitude: "gift",
  Grief: "cloud-drizzle", Joy: "sun", Love: "heart", Nervousness: "corner-up-right", Optimism: "trending-up",
  Pride: "award", Realization: "eye", Relief: "check-circle", Remorse: "corner-down-left", Sadness: "cloud-rain",
  Surprise: "send"
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
  
  // State for editing mode
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(entry.entryContent);
  
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
      
      const response = await fetch(`YOUR_API_ENDPOINT/journal/${entry._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ entryContent: editedContent })
      });
      
      if (response.ok) {
        Alert.alert("Success", "Journal entry updated successfully");
        setIsEditing(false);
        // Navigate back and refresh the home screen
        navigation.navigate("Home");
      } else {
        Alert.alert("Error", "Failed to update journal entry");
      }
    } catch (error) {
      console.error("Error updating entry:", error);
      Alert.alert("Error", "Something went wrong while updating the entry");
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
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{entry.category === "checkin" ? "Check-in Entry" : "Journal Entry"}</Text>
        <View style={styles.actionButtons}>
          {isEditing ? (
            <TouchableOpacity onPress={handleSaveEntry} style={styles.actionButton}>
              <Icon name="check" size={24} color="#000" />
            </TouchableOpacity>
          ) : (
            <>
              {entry.category !== "checkin" && (
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.actionButton}>
                  <Icon name="edit" size={24} color="#000" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleDeleteEntry} style={styles.actionButton}>
                <Icon name="trash-2" size={24} color="#FF0000" />
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
                      <Feather name={emotionIcons[emotion] || "help-circle"} size={20} color="#444" />
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

              {entry.journalSentiments && entry.journalSentiments.length > 0 && (
                <View style={styles.sentimentsContainer}>
                  <Text style={styles.sentimentsTitle}>Sentiment Analysis</Text>
                  {entry.journalSentiments.map((sentiment: { type: string; score: string }, index) => (
                    <Text key={index} style={styles.sentimentItem}>
                      {sentiment.type}: {sentiment.score}
                    </Text>
                  ))}
                </View>
              )}
            </>
          )}

      </ScrollView>
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
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
  },
  sentimentsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  sentimentItem: {
    fontSize: 14,
    marginBottom: 4,
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
  
  
});

export default EntryDetail;