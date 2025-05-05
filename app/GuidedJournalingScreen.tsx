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
import { useTheme } from './context/ThemeContext';
//import { saveGuidedJournalEntry } from "./services/ApiService";
import { awardBadge } from "./services/ApiService"; // ✅
import BadgeCongratsModal from "./BadgeCongratsModal";
const MAX_CHAR_COUNT = 10000;

const GuidedJournalingScreen = () => {
  const [content, setContent] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString());
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { prompt } = route.params;
  const { theme, darkMode } = useTheme();
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [awardedBadgeKey, setAwardedBadgeKey] = useState<string | null>(null);
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
      const token = await AsyncStorage.getItem("userToken");
      const userId = await AsyncStorage.getItem("userId");
      if (!token || !userId) {
        Alert.alert("Error", "User not authenticated.");
        return;
      }
  
      const response = await saveJournalEntry(content, imageUris, "guided", prompt);
      if (response.error) {
        Alert.alert("Error", "Failed to save entry.");
        return;
      }
  
      // 🎉 Award Guided Badge if not earned
      if (!earnedBadges.includes("guided")) {
        const success = await awardBadge(token, userId, "guided");
        if (success) {
          const updated = [...earnedBadges, "guided"];
          setEarnedBadges(updated);
          await AsyncStorage.setItem("earnedBadges", JSON.stringify(updated));
          setAwardedBadgeKey("guided");
          setShowBadgeModal(true);
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
                setAwardedBadgeKey("let_it_out");
                setShowBadgeModal(true);
              }

              break;
            }
          }
        }
      }

      if (!earnedBadges.includes("emotion_explorer") && token && userId) {
        if(response.entry.journalSentiments && response.entry.journalSentiments.length >= 3){
          const success = await awardBadge(token, userId, "emotion_explorer");
          if (success) {
            const updated = [...earnedBadges, "emotion_explorer"];
            setEarnedBadges(updated);
            await AsyncStorage.setItem("earnedBadges", JSON.stringify(updated));
            setAwardedBadgeKey("emotion_explorer");
            setShowBadgeModal(true);
          }
        }
      }
      if (!earnedBadges.includes("mood_shifter")) {
        const sentiments = response.entry.journalSentiments as { emotion: number; percentage: number }[] | undefined;
        if (Array.isArray(sentiments)) {
          const codeToName = [
            "admiration","amusement","anger","annoyance","approval","caring",
            "confusion","curiosity","desire","disappointment","disapproval","disgust",
            "embarrassment","excitement","fear","gratitude","grief","joy","love",
            "nervousness","optimism","pride","realization","relief","remorse",
            "sadness","surprise","neutral"
          ];
          const positiveSet = new Set([
            "admiration","amusement","approval","caring","curiosity","desire",
            "excitement","gratitude","joy","love","optimism","pride","realization","relief"
          ]);
          const negativeSet = new Set([
            "anger","annoyance","confusion","disappointment","disapproval","disgust",
            "embarrassment","fear","grief","nervousness","remorse","sadness"
          ]);
  
          let hasPos = false, hasNeg = false;
          for (const s of sentiments) {
            const name = codeToName[s.emotion] ?? "";
            if (positiveSet.has(name)) hasPos = true;
            if (negativeSet.has(name)) hasNeg = true;
            if (hasPos && hasNeg) break;
          }
  
          if (hasPos && hasNeg) {
            const ok = await awardBadge(token, userId, "mood_shifter");
            if (ok) {
              const updated = [...earnedBadges, "mood_shifter"];
              setEarnedBadges(updated);
              await AsyncStorage.setItem("earnedBadges", JSON.stringify(updated));
              console.log("🔄 Mood Shifter badge awarded!");
              setAwardedBadgeKey("mood_shifter");
              setShowBadgeModal(true);
            }
          }
        }
      }
      await clearDraft();
      navigation.navigate("Home");
    } catch (error) {
      console.error("Error saving guided entry:", error);
      Alert.alert("Error", "Something went wrong.");
    }
  };
  

  if (isLoading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: theme.backgroundColor 
      }}>
        <ActivityIndicator size="large" color={theme.text} />
        <Text style={{ marginTop: 20, color: theme.text }}>Loading your journal...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1}}>
      <BadgeCongratsModal
  visible={showBadgeModal}
  badgeKey={awardedBadgeKey}
  onClose={() => setShowBadgeModal(false)}
/>

    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ 
        flex: 1, 
        backgroundColor: theme.backgroundColor, 
        padding: 20 
      }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Display Prompt */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{
              fontSize: 18,
              fontWeight: "500",
              fontStyle: "italic",
              textAlign: "center",
              color: theme.text,
              padding: 10,
              borderLeftWidth: 2,
              borderLeftColor: theme.border,
              borderRadius: 10,
            }}>
              "{prompt}"
            </Text>
          </View>

          {/* Entry Input */}
          <View style={{ 
            backgroundColor: darkMode ? theme.cardBackground : "#F5F5F5", 
            padding: 20, 
            borderRadius: 12, 
          }}>
            {/* Clear Draft Icon */}
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
                minHeight: 200,
                marginTop: 20,
                fontSize: 16,
                color: theme.text,
                textAlignVertical: "top",
              }}
              multiline
              placeholder="Start writing your response..."
              placeholderTextColor={theme.placeholder}
              value={content}
              onChangeText={(text) => {
                if (text.length <= MAX_CHAR_COUNT) setContent(text);
              }}
              keyboardType="default"
              returnKeyType="done"
            />
            <Text style={{ 
              textAlign: "right", 
              color: theme.placeholder 
            }}>
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

          {/* Button Container */}
          <View style={{ 
            flexDirection: "row", 
            justifyContent: "space-between", 
            marginTop: 20 
          }}>
            {/* Save Entry Button */}
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
              <Text style={{ 
                color: darkMode ? theme.text : '#000', 
                fontSize: 14 
              }}>
                💾 Save Entry
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNavigation activeScreen="GuidedJournaling" />
      </View>
    </TouchableWithoutFeedback>
    </View>
  );
};

export default GuidedJournalingScreen;
