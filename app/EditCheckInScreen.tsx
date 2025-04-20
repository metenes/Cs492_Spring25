import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator,
  Alert, 
  TextInput,
  SafeAreaView
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./types/types";
import { updateCheckIn } from "./services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/Feather";

type EditCheckInRouteProp = RouteProp<RootStackParamList, "EditCheckIn">;
type EditCheckInNavigationProp = StackNavigationProp<RootStackParamList, "EditCheckIn">;

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

const EditCheckInScreen = () => {
  const navigation = useNavigation<EditCheckInNavigationProp>();
  const route = useRoute<EditCheckInRouteProp>();
  const { entry } = route.params;

  const [step, setStep] = useState(1);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(entry.sentiments || []);
  const [selectedReasons, setSelectedReasons] = useState<string[]>(entry.causes || []);
  const [comment, setComment] = useState(entry.comments?.[0] || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <Icon name={item.icon} size={24} color="#000" />
      <Text>{item.name}</Text>
    </TouchableOpacity>
  );

  const handleUpdateCheckIn = async () => {
    if (selectedEmotions.length === 0 || selectedReasons.length === 0) {
      Alert.alert("Missing Information", "Please select at least one emotion and one reason.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        throw new Error("No authentication token found");
      }

      const entryId = entry._id || entry.entry_id;
      if (!entryId) {
        throw new Error("Invalid entry ID");
      }

      await updateCheckIn(entryId, selectedEmotions, selectedReasons, [comment]);
      
      Alert.alert(
        "Check-in Updated", 
        "Your check-in has been successfully updated.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Failed to update check-in:", error);
      Alert.alert(
        "Update Failed", 
        "There was a problem updating your check-in. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel Editing",
      "Are you sure you want to cancel? Your changes will be lost.",
      [
        { text: "Continue Editing", style: "cancel" },
        { 
          text: "Cancel", 
          style: "destructive",
          onPress: () => navigation.goBack()
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back/cancel button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Icon name="x" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Check-in</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Rest of the content */}
      <View style={styles.content}>
        {/* Emotions Screen (Step 1) */}
        {step === 1 && (
          <>
            <Text style={styles.title}>How do you feel?</Text>
            <FlatList
              data={emotions}
              renderItem={(item) => renderItem(item, selectedEmotions, setSelectedEmotions)}
              keyExtractor={(item) => item.name}
              numColumns={3}
            />
            <TouchableOpacity 
              style={[styles.nextButton, selectedEmotions.length === 0 && styles.disabledButton]}
              onPress={() => setStep(2)}
              disabled={selectedEmotions.length === 0}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Reasons Screen (Step 2) */}
        {step === 2 && (
          <>
            <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
              <Icon name="arrow-left" size={24} color="black" />
            </TouchableOpacity>

            <Text style={styles.title}>Why do you feel this way?</Text>
            <FlatList
              data={reasons}
              renderItem={(item) => renderItem(item, selectedReasons, setSelectedReasons)}
              keyExtractor={(item) => item.name}
              numColumns={3}
            />
            <TouchableOpacity 
              style={[styles.nextButton, selectedReasons.length === 0 && styles.disabledButton]}
              onPress={() => setStep(3)}
              disabled={selectedReasons.length === 0}
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Summary Screen (Step 3) */}
        {step === 3 && (
          <>
            <TouchableOpacity style={styles.backButton} onPress={() => setStep(2)}>
              <Icon name="arrow-left" size={24} color="black" />
            </TouchableOpacity>

            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>Check-in Summary</Text>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Emotions</Text>
                <View style={styles.tagsContainer}>
                  {selectedEmotions.map((emotion, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{emotion}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Reasons</Text>
                <View style={styles.tagsContainer}>
                  {selectedReasons.map((reason, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{reason}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Additional Thoughts (Optional)</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add any additional thoughts here..."
                  multiline={true}
                  numberOfLines={4}
                  value={comment}
                  onChangeText={setComment}
                />
              </View>

              <TouchableOpacity 
                style={styles.completeButton} 
                onPress={handleUpdateCheckIn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.completeButtonText}>Update Check-in</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerRight: {
    width: 24,
  },
  backButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontFamily: "Poppins",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  option: {
    padding: 5,
    paddingBottom: 10,
    margin: 2,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    width: 123,
  },
  selectedOption: {
    backgroundColor: "lavender",
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
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
  completeButton: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    backgroundColor: "black",
    borderRadius: 30,
    width: "80%",
    alignSelf: "center",
    marginTop: 20,
  },
  completeButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: "Poppins",
  },
});

export default EditCheckInScreen; 