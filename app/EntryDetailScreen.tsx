import React, { useState } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  TextInput, ScrollView, SafeAreaView 
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Icon from "react-native-vector-icons/Feather";
import { RootStackParamList } from "./types/types";
import { deleteJournalEntry, editJournalEntry, editCheckIn, deleteCheckIn } from "./services/ApiService"; // ✅ Import both delete & update functions
import { format } from "date-fns";

type Entry = {
  _id: string;
  entryContent: string;
  entryDate: string;
  createdAt?: string;
  images?: string[];
  journalSentiments?: any[];
  category: string;
  prompt: string;
};

type EntryDetailRouteProp = RouteProp<RootStackParamList, "EntryDetail">;
type EntryDetailNavigationProp = StackNavigationProp<RootStackParamList, "Home">;

const EntryDetail = () => {
  const navigation = useNavigation<EntryDetailNavigationProp>();
  const route = useRoute<EntryDetailRouteProp>();
  const { entry } = route.params;

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(entry.entryContent);

  let formattedDate = "Invalid date";
  try {
    const dateString = entry.entryDate || entry.createdAt;
    if (dateString) {
      formattedDate = format(new Date(dateString), "EEEE, MMMM d, yyyy");
    }
  } catch (error) {
    console.log("Error formatting date:", error);
  }

  const handleSaveEntry = async () => {
    try {
      if (entry.category === "Check-in") {
        await editCheckIn(entry._id, entry.journalSentiments, [], [editedContent]);
      } else {
        await editJournalEntry(entry._id, editedContent, entry.images, entry.category, entry.prompt);
      }
      setIsEditing(false);
    } catch (error) {
      Alert.alert("Error", "Failed to save changes.");
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Journal Entry</Text>
        <View style={styles.actionButtons}>
          {isEditing ? (
            <TouchableOpacity onPress={handleSaveEntry} style={styles.actionButton}>
              <Icon name="check" size={24} color="#000" />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.actionButton}>
                <Icon name="edit" size={24} color="#000" />
              </TouchableOpacity>
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
          {entry.category && <Text style={styles.category}>{entry.category}</Text>}
          {entry.prompt && <Text style={styles.prompt}>Prompt: {entry.prompt}</Text>}
        </View>

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
            {entry.journalSentiments.map((sentiment: { type: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined; score: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined; }, index: React.Key | null | undefined) => (
              <Text key={index} style={styles.sentimentItem}>
                {sentiment.type}: {sentiment.score}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Styles remain unchanged
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#EFEFEF" },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  actionButtons: { flexDirection: "row" },
  actionButton: { padding: 8, marginLeft: 10 },
  content: { flex: 1, padding: 16 },
  entryDetails: { marginBottom: 20 },
  date: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  category: { fontSize: 16, color: "#666", marginBottom: 4 },
  prompt: { fontSize: 16, fontStyle: "italic", color: "#666", marginBottom: 16 },
  entryContent: { fontSize: 16, lineHeight: 24 },
  editor: { fontSize: 16, lineHeight: 24, padding: 12, borderWidth: 1, borderColor: "#CCCCCC", borderRadius: 8, backgroundColor: "#F9F9F9", minHeight: 200 },
  sentimentsContainer: { marginTop: 20, padding: 16, backgroundColor: "#F0F0F0", borderRadius: 8 },
  sentimentsTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  sentimentItem: { fontSize: 14, marginBottom: 4 },
});

export default EntryDetail;
