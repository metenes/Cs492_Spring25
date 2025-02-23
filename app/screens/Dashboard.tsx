import React, { useState } from "react";
import {
  ScrollView,
  Text,
  StyleSheet,
  View,
  Pressable,
  Alert,
  Modal,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import DropDownPicker from "react-native-dropdown-picker";
import { SentimentChart } from "../utils/SentimentChart"; // Adjust path if needed
import BottomNavigation from "@/BottomNavigation";

const SentimentAnalysisPage: React.FC = () => {
const emotions = [
  "Amusement", "Admiration", "Approval", "Amusement", "Caring", "Excitement", "Gratitude", "Joy", "Love", "Optimism", "Pride", "Relief", 
  "Anger", "Annoyance", "Disappointment", "Disapproval", "Disgust", "Embarrassment", "Fear", "Grief", "Jealousy", "Sadness", "Confusion", 
  "Curiosity", "Desire", "Neutral", "Remorse", "Surprise", "Realization"
];
const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
const toggleEmotion =  (emotion: string) => {
  setSelectedEmotions((prevSelected) =>
    prevSelected.includes(emotion)
      ? prevSelected.filter((e) => e !== emotion) // Remove if already selected
      : [...prevSelected, emotion] // Add if not selected
  );
};

const [open, setOpen] = useState(false);
const [selectedTimeRange, setSelectedTimeRange] = useState("Year");
const [items, setItems] = useState([
  { label: "Week", value: "Week" },
  { label: "Month", value: "Month" },
  { label: "Year", value: "Year" },
  ]);
  const [sentimentEntries, setSentimentEntries] = useState([
    { date: "Today", emotion: "Happiness", details: "Excitement, Joy, and more" },
    { date: "Yesterday", emotion: "Joy", details: "Gratitude, Love" },
    { date: "19.12.2024", emotion: "Anger", details: "Frustration, Disappointment" },
    { date: "18.12.2024", emotion: "Sadness", details: "Anxiety, Loneliness" },
    { date: "17.12.2024", emotion: "Pride", details: "Accomplishment, Satisfaction" },
    { date: "16.12.2024", emotion: "Anxiety", details: "Anticipation, Fear" },
  ]);

  const [selectedStartDate, setSelectedStartDate] = useState(new Date());
  const [selectedEndDate, setSelectedEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  // Handles selecting a start date
  const handleStartDateChange = (event: any, date?: Date) => {
    if (!date) return;
  
    // Get today's date without time for accurate comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    if (date > today) {
      // If start date is in the future, set both start and end date to today
      setSelectedStartDate(today);
      setSelectedEndDate(today);
    } else {
      setSelectedStartDate(date);
  
      // Calculate new end date
      const newEndDate = new Date(date);
      newEndDate.setDate(newEndDate.getDate() + 7);
  
      // If the end date goes beyond today, limit it to today
      if (newEndDate > today) {
        setSelectedEndDate(today);
      } else {
        setSelectedEndDate(newEndDate);
      }
    }
    setShowStartPicker(false); // Close modal after selection
  };
  
  // Handles selecting an end date
  const handleEndDateChange = (event: any, date?: Date) => {
    if (!date) return;
  
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date for accurate comparison
  
    if (date > today) {
      // If the end date is in the future, set both start and end dates to today
      setSelectedStartDate(today);
      setSelectedEndDate(today);
    } else {
      // Set end date to the selected date
      setSelectedEndDate(date);
  
      // Adjust start date to be exactly 7 days before the end date
      const newStartDate = new Date(date);
      newStartDate.setDate(newStartDate.getDate() - 7);
      setSelectedStartDate(newStartDate);
    }
  
    setShowEndPicker(false); // Close modal after selection
  };
  
  return (
    <>
    <View style={styles.container}>
      
      <View style={styles.dateRangeContainer}>
        <DateTimePicker 
                      value={selectedStartDate} 
                      mode="date" 
                      display="default" 
                      onChange={handleStartDateChange} 
          />
        <DateTimePicker 
            value={selectedEndDate} 
            mode="date" 
            display="default" 
            onChange={handleEndDateChange} 
        />
      </View>

      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.entriesScroll}
          contentContainerStyle={{ flexGrow: 0 }} // Prevents it from expanding too much
        >

            {sentimentEntries.map((entry, index) => (
              <Pressable key={index} style={styles.entryCard}>
                <Text style={styles.entryDate}>{entry.date}</Text>
                <Text style={styles.entryEmotion}>{entry.emotion}</Text>
                <Text style={styles.entryDetails}>{entry.details}</Text>
              </Pressable>
            ))}
        </ScrollView>
      </View>
      <DropDownPicker
        open={open}
        value={selectedTimeRange}
        items={items}
        setOpen={setOpen}
        setValue={setSelectedTimeRange}
        setItems={setItems}
        style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "ccc", width: Dimensions.get('window').width / 3 }}
      />
      <View style={styles.container2}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
        {emotions.map((emotion, index) => {
        const isSelected = selectedEmotions.includes(emotion);
        return (
          <Pressable
            key={index}
            style={[
              styles.chip,
              isSelected ? styles.chipSelected : styles.chipUnselected,
            ]}
            onPress={() => toggleEmotion(emotion)}
          >
            <Text style={[styles.chipText, !isSelected && styles.chipTextUnselected]}>
              {emotion}
            </Text>
          </Pressable>
        );
        })}
        </ScrollView>
      </View>
      <View style={{ marginVertical: 20 }}>
        <SentimentChart selectedEmotions={selectedEmotions} />
      </View>
    </View>
    <BottomNavigation activeScreen="Dashboard" />
    </>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  dropdownContainer: {
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginTop: 10,  // Adds spacing from above elements
  },
  picker: {
    height: 50, // Reduced height for better UI
    width: "100%",
    color: "#000000", // Ensures text is visible
    flex: 1,  // Makes it expand properly inside its container
  },
  dateRangeContainer: {
    flexDirection: "row",
    marginBottom: 12,
  },
  dateButton: {
    padding: 10,
    backgroundColor: "#000000",
    borderRadius: 8,
    marginHorizontal: 5,
    flex:1,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  entriesScroll: {
    height: 140, // Ensure it doesn't push elements below
    marginBottom: 12, // Reduce excess spacing below
  },
  entryCard: {
    width: 200,
    height: 120,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginRight: 12,
  },
  entryDate: {
    fontSize: 14,
    fontWeight: "600",
  },
  entryEmotion: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000",
  },
  entryDetails: {
    fontSize: 12,
    color: "#828282",
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
    backgroundColor: "#e0e0e0", // Lighter and more modern grey
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  chipTextUnselected: {
    color: "black",
  },
  chipTextSelected: {
    color: "white",
  },
});

export default SentimentAnalysisPage;
