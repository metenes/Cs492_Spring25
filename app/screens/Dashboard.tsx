import React, { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  StyleSheet,
  View,
  Pressable,
  Alert,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SentimentChart } from "../utils/SentimentChart"; // Adjust path if needed
import { fetchJournalEntriesWithDate, fetchSentimentAnalysis, getEmotionalTrendInsight } from "../services/ApiService"; // Our new function
import BottomNavigation from "@/BottomNavigation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';

// Emotions array and code→name map
const emotions = [
  "admiration", "amusement", "anger", "annoyance", "approval", "caring",
  "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
  "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
  "nervousness", "optimism", "pride", "realization", "relief", "remorse",
  "sadness", "surprise", "neutral"
];



export const emotionMap: Record<number, string> = emotions.reduce(
  (acc, emotion, index) => {
    acc[index] = emotion;
    return acc;
  },
  {} as Record<number, string>
);

console.log(emotionMap[3]); // "Caring"

// Helper to get local date string in "YYYY-MM-DD" format
const toLocalDateString = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
};

const SentimentAnalysisPage: React.FC = () => {
  // Add theme context near the top of the component
  const { theme, darkMode } = useTheme();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  // Default: start = today - 7, end = today.
  const today = new Date();
  const defaultStartDate = new Date(today);
  defaultStartDate.setDate(today.getDate() - 7);

  // Weekly date pickers state
  const [selectedStartDate, setSelectedStartDate] = useState(defaultStartDate);
  const [selectedEndDate, setSelectedEndDate] = useState(today);

  // Chart date pickers state (you can set these to the same defaults or choose differently)
  const [selectedStartDateForChart, setSelectedStartDateForChart] = useState(defaultStartDate);
  const [selectedEndDateForChart, setSelectedEndDateForChart] = useState(today);

  // Emotions selected for the chart
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);

  // Fetched journal entries state (each entry = one card)
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // emotional trends
  const [trendInsight, setTrendInsight] = useState<string | null>(null);


  // Toggle emotion chip
  const toggleEmotion = (emotion: string) => {
    setSelectedEmotions((prevSelected) => {
      if (prevSelected.includes(emotion)) {
        return prevSelected.filter((e) => e !== emotion);
      } else if (prevSelected.length < 4) {
        return [...prevSelected, emotion];
      } else {
        Alert.alert("Limit Reached", "You can only select up to 4 emotions at a time.");
        return prevSelected;
      }
    });
  };

  // Initial fetch for default date range (today-7 to today)
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const startDateStr = toLocalDateString(selectedStartDate);
        const endDateStr = toLocalDateString(selectedEndDate);
        const data = await fetchJournalEntriesWithDate(startDateStr, endDateStr);
        if (data.error) {
          throw new Error(data.error);
        }
        setJournalEntries(data.entries || []);
        console.log("Initial entries:", data.entries);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Weekly fetch when selectedStartDate or selectedEndDate changes
  const fetchWeeklyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const startDateStr = toLocalDateString(selectedStartDate);
      const endDateStr = toLocalDateString(selectedEndDate);
      const data = await fetchJournalEntriesWithDate(startDateStr, endDateStr);
      if (data.error) throw new Error(data.error);
      setJournalEntries(data.entries || []);
      console.log("Weekly entries:", data.entries);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeklyData();
  }, [selectedStartDate, selectedEndDate]);

  // Date picker handlers
  const handleStartDateChange = (event: any, isWeekly: boolean, date?: Date) => {
    if (!date) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
      if (isWeekly) {
        setSelectedStartDate(today);
        setSelectedEndDate(today);
      } else {
        setSelectedStartDateForChart(today);
      }
    } else {
      if (isWeekly) {
        setSelectedStartDate(date);
        const newEndDate = new Date(date);
        newEndDate.setDate(newEndDate.getDate() + 7);
        setSelectedEndDate(newEndDate > today ? today : newEndDate);
      } else {
        setSelectedStartDateForChart(date);
        if (selectedStartDateForChart > selectedEndDateForChart) {
          setSelectedEndDateForChart(date);
        }
      }
    }
  };

  // for emotion trends
  useEffect(() => {
    const fetchTrendInsight = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        if (!token) return;
        const res = await getEmotionalTrendInsight(token);
        setTrendInsight(res.insight);
      } catch (err) {
        console.error("❌ Error fetching trend insight:", err);
      }
    };
  
    fetchTrendInsight();
  }, []);
  

  const handleEndDateChange = (event: any, isWeekly: boolean, date?: Date) => {
    if (!date) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newEndDate = date > today ? today : date;
    if (isWeekly) {
      setSelectedEndDate(newEndDate);
      const newStartDate = new Date(newEndDate);
      newStartDate.setDate(newStartDate.getDate() - 7);
      setSelectedStartDate(newStartDate);
    } else {
      setSelectedEndDateForChart(newEndDate);
      if (selectedEndDateForChart < selectedStartDateForChart) {
        setSelectedStartDateForChart(newEndDate);
      }
    }
  };

  // Compute chart interval based on the chart date range
  const computeChartInterval = (): string => {
    const start = new Date(toLocalDateString(selectedStartDateForChart));
    const end = new Date(toLocalDateString(selectedEndDateForChart));
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
    if (diffDays <= 30) {
      return "daily";
    } else if (diffDays > 30 && diffDays <= 120) {
      return "weekly";
    } else if (diffDays > 120 && diffDays <= 1095) {
      return "monthly";
    } else {
      return "yearly";
    }
  };

  // Render horizontal list of journal entry cards
  const renderJournalCards = () => {
    return journalEntries.map((entry, index) => {
      const { entryDate, journalSentiments = [], category } = entry;
      const formattedDate = entryDate
        ? new Date(entryDate).toLocaleDateString("en-US", { timeZone: "UTC" })
        : "Unknown Date";

      // Handle entries with no sentiments
      if (!journalSentiments || journalSentiments.length === 0) {
        return (
          <Pressable 
            key={index} 
            style={[
              styles.entryCard,
              {
                backgroundColor: darkMode ? '#2C2C2C' : '#fff',
                borderColor: darkMode ? '#404040' : '#e0e0e0',
              }
            ]}
          >
            <Text style={[styles.entryDate, { color: darkMode ? '#B0B0B0' : '#828282' }]}>
              {formattedDate}
            </Text>
            <Text style={[styles.entryEmotion, { color: darkMode ? '#FFFFFF' : '#000' }]}>
              No sentiment data
            </Text>
            <Text style={[styles.entryDetails, { color: darkMode ? '#B0B0B0' : '#828282' }]}>
            </Text>
          </Pressable>
        );
      }

      // Sort sentiments by percentage descending
      const sorted = [...journalSentiments].sort((a: any, b: any) => b.percentage - a.percentage);
      const dominant = sorted[0];
      const others = sorted.slice(1);

      let subLabel = "";
      if (others.length === 0) {
        subLabel = "No other emotions";
      } else if (others.length === 1) {
        // For check-in entries, the emotion might be a string (lowercase)
        const emotion = typeof others[0].emotion === 'string' 
          ? others[0].emotion 
          : emotionMap[others[0].emotion];
        subLabel = emotion;
      } else {
        const firstTwo = others.slice(0, 2).map((s: any) => {
          // For check-in entries, the emotion might be a string (lowercase)
          return typeof s.emotion === 'string' ? s.emotion : emotionMap[s.emotion];
        }).join(", ");
        const remaining = others.length - 2;
        subLabel = remaining > 0 ? `${firstTwo} and ${remaining} more` : firstTwo;
      }

      return (
        <Pressable 
          key={index} 
          style={[
            styles.entryCard,
            {
              backgroundColor: darkMode ? '#2C2C2C' : '#fff',
              borderColor: darkMode ? '#404040' : '#e0e0e0',
            }
          ]}
        >
          <Text style={[styles.entryDate, { color: darkMode ? '#B0B0B0' : '#828282' }]}>
            {formattedDate}
          </Text>
          <Text 
            style={[styles.entryEmotion, { color: darkMode ? '#FFFFFF' : '#000' }]}
            numberOfLines={2}
          >
            {typeof dominant.emotion === 'string' ? dominant.emotion : emotionMap[dominant.emotion]}
          </Text>
          <Text 
            style={[styles.entryDetails, { color: darkMode ? '#B0B0B0' : '#828282' }]}
            numberOfLines={1}
          >
            {subLabel}
          </Text>
        </Pressable>
      );
    });
  };

  return (
    <>
      <ScrollView>
        <View style={[styles.container, { backgroundColor: darkMode ? '#121212' : '#fff' }]}>
          {/* Weekly Date Range */}
          <View style={styles.dateRangeContainer}>
            <DateTimePicker
              value={selectedStartDate}
              mode="date"
              display="default"
              onChange={(event, date) => handleStartDateChange(event, true, date)}
              themeVariant={darkMode ? "dark" : "light"}
            />
            <DateTimePicker
              value={selectedEndDate}
              mode="date"
              display="default"
              onChange={(event, date) => handleEndDateChange(event, true, date)}
              themeVariant={darkMode ? "dark" : "light"}
            />
          </View>

          {/* Horizontal Cards */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.entriesScroll}
            contentContainerStyle={{ flexGrow: 0 }}
          >
            {renderJournalCards()}
          </ScrollView>

          {/* Chart Date Range */}
          <View style={styles.dateRangeContainer2}>
            <DateTimePicker
              value={selectedStartDateForChart}
              mode="date"
              display="default"
              onChange={(event, date) => handleStartDateChange(event, false, date)}
            />
            <DateTimePicker
              value={selectedEndDateForChart}
              mode="date"
              display="default"
              onChange={(event, date) => handleEndDateChange(event, false, date)}
            />
          </View>

          {/* Emotion Chips */}
          <View style={styles.container2}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
              {emotions.map((emotion, index) => {
                const isSelected = selectedEmotions.includes(emotion);
                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.chip,
                      isSelected 
                        ? { 
                            backgroundColor: darkMode ? '#999999' : 'black',
                            borderColor: darkMode ? '#FFFFFF' : 'transparent',
                            borderWidth: darkMode ? 1 : 0
                          }
                        : { backgroundColor: darkMode ? '#404040' : '#e0e0e0' }
                    ]}
                    onPress={() => toggleEmotion(emotion)}
                  >
                    <Text style={[
                      styles.chipText,
                      !isSelected 
                        ? { color: darkMode ? '#FFFFFF' : 'black' }
                        : { color: 'white' }
                    ]}>
                      {emotion}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Chart */}
          <View style={{ alignItems: "center", justifyContent: "center", backgroundColor: "transparent" }}>
            <SentimentChart
              selectedEmotions={selectedEmotions}
              interval={computeChartInterval()}
              startDate={toLocalDateString(selectedStartDateForChart)}
              endDate={toLocalDateString(selectedEndDateForChart)}
              darkMode={darkMode}
            />
          </View>
          {trendInsight && (
            <View style={styles.trendInsightBox}>
              <Text style={styles.trendInsightText}>{trendInsight}</Text>
            </View>
          )}

        </View>
      </ScrollView>  

      <BottomNavigation activeScreen="Dashboard" darkMode={darkMode} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  dateRangeContainer: {
    flexDirection: "row",
    marginBottom: 15,
  },
  dateRangeContainer2: {
    flexDirection: "row",
    marginTop: 15,
    marginBottom: 5,
  },
  entriesScroll: {
    // Ensure it doesn't push elements below
  },
  entryCard: {
    width: 220,
    height: 120,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginRight: 12,
    justifyContent: 'space-between',
  },
  entryDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#828282",
    marginBottom: 8,
  },
  entryEmotion: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#000",
    lineHeight: 32,
    flexShrink: 1,
  },
  entryDetails: {
    fontSize: 16,
    color: "#828282",
    marginTop: 8,
  },
  container2: {
    paddingVertical: 10,
  },
  scrollView: {
    flexDirection: "row",
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 5,
  },
  chipSelected: {
    backgroundColor: "black",
  },
  chipUnselected: {
    backgroundColor: "#e0e0e0",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  chipTextUnselected: {
    color: "black",
  },
  trendInsightBox: {
    backgroundColor: "#FFF8EC",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderColor: "#FFE8B0",
    borderWidth: 1,
  },
  trendInsightText: {
    fontSize: 16,
    color: "#444",
    fontStyle: "italic",
  }
  
});

export default SentimentAnalysisPage;
