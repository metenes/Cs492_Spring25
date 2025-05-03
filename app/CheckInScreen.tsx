import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator,
  Alert, 
  TextInput
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Feather";
import { ScrollView } from "react-native";
// import {setToken } from "./auth/AuthContext"
import { RootStackParamList } from "./types/types";
import { awardBadge } from "./services/ApiService";
import BadgeCongratsModal from "./BadgeCongratsModal";

import { StackNavigationProp } from "@react-navigation/stack";
import { saveCheckIn, getCheckInDraft, saveCheckInDraft, clearCheckInDraft } from "./services/ApiService"; // Import the API functions
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from './context/ThemeContext';

type CheckInNavigationProp = StackNavigationProp<RootStackParamList, 'FreeJournaling'>;

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

const CheckInScreen = () => {
  const navigation = useNavigation<CheckInNavigationProp>();
  const { theme, darkMode } = useTheme();
  const [step, setStep] = useState(1);
  const [selectedEmotions, setSelectedEmotions] = useState([]);
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [awardedBadgeKey, setAwardedBadgeKey] = useState<string | null>(null);
  
  const [userId, setUserId] = useState(""); 
  const [token, setToken] = useState("");
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);

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
  
  const toggleSelection = (item : any, state: any, setState: any) => {
    setState((prev : any) =>
      prev.includes(item)
        ? prev.filter((i : any) => i !== item)
        : [...prev, item]
    );
  };

  const renderItem = ({ item } : any, state : any, setState : any) => (
    <TouchableOpacity
      style={[
        styles.option,
        { backgroundColor: 'transparent' },
        state.includes(item.name) && [
          styles.selectedOption,
          { backgroundColor: darkMode ? '#404040' : 'lavender' }
        ],
      ]}
      onPress={() => toggleSelection(item.name, state, setState)}
    >
      <Icon name={item.icon} size={24} color={darkMode ? theme.text : '#000'} />
      <Text style={{ color: darkMode ? theme.text : '#000' }}>{item.name}</Text>
    </TouchableOpacity>
  );

  // Load saved check-in data when component mounts or screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const loadSavedData = async () => {
        try {
          setIsLoading(true);
          const savedData = await getCheckInDraft();
          
          if (savedData) {
            console.log("Loaded saved check-in data:", savedData);
            if (savedData.step) setStep(savedData.step);
            if (savedData.emotions) setSelectedEmotions(savedData.emotions);
            if (savedData.reasons) setSelectedReasons(savedData.reasons);
            if (savedData.comment) setComment(savedData.comment);
          }
        } catch (error) {
          console.error("Error loading saved check-in:", error);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadSavedData();
      
      // Cleanup function not needed here
      return () => {};
    }, [])
  );
  
  // Auto-save when any relevant state changes
  useEffect(() => {
    if (isLoading) return; // Don't save during initial load
    
    const saveData = async () => {
      const checkInData = {
        step,
        emotions: selectedEmotions,
        reasons: selectedReasons,
        comment
      };
      
      console.log("Auto-saving check-in data:", checkInData);
      await saveCheckInDraft(checkInData);
    };
    
    saveData();
  }, [step, selectedEmotions, selectedReasons, comment, isLoading]);

  // Function to handle the check-in submission
  const handlesaveCheckIn = async () => {
    const token = await AsyncStorage.getItem('userToken');
    const storedUserId = await AsyncStorage.getItem('userId');
  
    if (!token || !storedUserId) {
      console.error("🔴 Token or userId missing");
      Alert.alert("Error", "User not authenticated.");
      return;
    }
  
    setToken(token);
    setUserId(storedUserId);
  
    if (selectedEmotions.length === 0 || selectedReasons.length === 0) {
      Alert.alert("Missing Information", "Please select at least one emotion and one reason.");
      return;
    }
  
    setIsSubmitting(true);
    try {
      const comments = comment.trim() ? [comment] : [];
      const result = await saveCheckIn(token, selectedEmotions, selectedReasons, comments);
  
      await clearCheckInDraft();
      navigation.navigate("Home")
  
      // Award badge correctly
      if (!earnedBadges.includes("quick")) {
        const success = await awardBadge(token, storedUserId, "quick");
        if (success) {
          const updated = [...earnedBadges, "quick"];
          setEarnedBadges(updated);
          await AsyncStorage.setItem("earnedBadges", JSON.stringify(updated));
          setAwardedBadgeKey("quick");
          setShowBadgeModal(true);
          console.log("🎉 Quick check-in badge awarded.");
        }
      }
    } catch (error) {
      console.error("Failed to submit check-in:", error);
      Alert.alert("Submission Failed", "There was a problem submitting your check-in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="black" />
        <Text style={{marginTop: 20}}>Loading your check-in...</Text>
      </View>
    );
  }

  return (

    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
         
         <BadgeCongratsModal
      visible={showBadgeModal}
      badgeKey={awardedBadgeKey}
      onClose={() => setShowBadgeModal(false)}
    />
      {(selectedEmotions.length > 0 || selectedReasons.length > 0 || comment.trim()) && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            zIndex: 10,
            padding: 8,
          }}
          onPress={() => {
            Alert.alert(
              "Clear Check-in",
              "Are you sure you want to clear your current check-in?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Clear",
                  style: "destructive",
                  onPress: async () => {
                    await clearCheckInDraft();
                    setSelectedEmotions([]);
                    setSelectedReasons([]);
                    setComment("");
                    setStep(1);
                  }
                }
              ]
            );
          }}
        >
          <Text style={{ fontSize: 18, color: theme.text }}>❌</Text>
        </TouchableOpacity>
      )}

      {/* Emotions Screen (Step 1) */}
      {step === 1 && (
        <>
          <Text style={[styles.title, { color: theme.text }]}>How do you feel?</Text>
          <FlatList
            data={emotions}
            renderItem={(item) => renderItem(item, selectedEmotions, setSelectedEmotions)}
            keyExtractor={(item) => item.name}
            numColumns={3}
          />
          <TouchableOpacity 
            style={[
              styles.nextButton, 
              selectedEmotions.length === 0 && styles.disabledButton,
              { backgroundColor: darkMode ? '#404040' : '#E0E0E0' }
            ]}
            onPress={() => setStep(2)}
            disabled={selectedEmotions.length === 0}
          >
            <Text style={[styles.buttonText, { color: darkMode ? theme.text : '#000' }]}>Next</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Reasons Screen (Step 2) */}
      {step === 2 && (
        <>
          {/* Back Button to Step 1 */}
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
            <Icon name="arrow-left" size={24} color={theme.text} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: theme.text }]}>Why do you feel this way?</Text>
          <FlatList
            data={reasons}
            renderItem={(item) => renderItem(item, selectedReasons, setSelectedReasons)}
            keyExtractor={(item) => item.name}
            numColumns={3}
          />
          <TouchableOpacity 
            style={[
              styles.nextButton, 
              selectedReasons.length === 0 && styles.disabledButton,
              { backgroundColor: darkMode ? '#404040' : '#E0E0E0' }
            ]}
            onPress={() => setStep(3)}
            disabled={selectedReasons.length === 0}
          >
            <Text style={[styles.buttonText, { color: darkMode ? theme.text : '#000' }]}>Next</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Summary Screen (Step 3) */}
      {step === 3 && (
        <>
          {/* Back Button to Step 2 */}
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(2)}>
            <Icon name="arrow-left" size={24} color={theme.text} />
          </TouchableOpacity>

          {/* Summary Container */}
          <View style={[styles.summaryContainer, { backgroundColor: darkMode ? theme.cardBackground : '#f8f8f8' }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <Text style={[styles.summaryTitle, { color: theme.text }]}>Check-in Summary</Text>

              {/* Emotions Section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Emotions</Text>
                <View style={styles.tagsContainer}>
                  {selectedEmotions.map((emotion, index) => (
                    <View key={index} style={[styles.tag, { backgroundColor: darkMode ? '#404040' : 'lavender' }]}>
                      <Text style={[styles.tagText, { color: theme.text }]}>{emotion}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              {/* Reasons Section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Reasons</Text>
                <View style={styles.tagsContainer}>
                  {selectedReasons.map((reason, index) => (
                    <View key={index} style={[styles.tag, { backgroundColor: darkMode ? '#404040' : 'lavender' }]}>
                      <Text style={[styles.tagText, { color: theme.text }]}>{reason}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Optional Comment */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Additional Thoughts (Optional)</Text>
                <TextInput
                  style={[
                    styles.commentInput,
                    { 
                      backgroundColor: darkMode ? theme.inputBackground : 'white',
                      color: theme.text,
                      borderColor: theme.border
                    }
                  ]}
                  placeholder="Add any additional thoughts here..."
                  placeholderTextColor={theme.placeholder}
                  multiline={true}
                  numberOfLines={4}
                  value={comment}
                  onChangeText={setComment}
                />
              </View>

              {/* Button Container */}
              <View style={styles.buttonContainer}>
                {/* Complete Check-in Button */}
                <TouchableOpacity 
                  style={[
                    styles.completeButton,
                    { backgroundColor: darkMode ? '#404040' : '#E0E0E0' }
                  ]} 
                  onPress={handlesaveCheckIn}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={darkMode ? theme.text : '#000'} />
                  ) : (
                    <Text style={[styles.completeButtonText, { color: darkMode ? theme.text : '#000' }]}>Complete Check-in</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 5,
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedOption: {
    borderColor: '#000',
  },
  nextButton: {
    marginTop: 20,
    padding: 15,
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
  backButton: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  summaryContainer: {
    flex: 1,
    width: "100%",
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  scrollContent: {
    alignItems: "center",
    paddingBottom: 20,
  },
  summaryTitle: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
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
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 16,
    fontWeight: "500",
  },
  commentInput: {
    width: "100%",
    height: 100,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    textAlignVertical: "top",
  },
  completeButton: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    width: "80%",
    alignSelf: "center",
  },
  completeButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: "Poppins",
  },
  buttonContainer: {
    width: "100%",
    marginTop: 30,
  },
});

export default CheckInScreen;