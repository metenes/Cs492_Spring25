import React, { useEffect, useState } from "react";
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
import { SentimentChart } from "../utils/SentimentChart"; // Adjust path if needed
import { fetchSentimentAnalysis } from "../services/ApiService"; // Adjust path if needed
import BottomNavigation from "@/BottomNavigation";

const SentimentAnalysisPage: React.FC = () => {
const emotions = [
  "Amusement", "Admiration", "Approval", "Caring", "Excitement", "Gratitude", "Joy", "Love", "Optimism", "Pride", "Relief", 
  "Anger", "Annoyance", "Disappointment", "Disapproval", "Disgust", "Embarrassment", "Fear", "Grief", "Jealousy", "Sadness", "Confusion", 
  "Curiosity", "Desire", "Neutral", "Remorse", "Surprise", "Realization"
];
const [selectedEmotions, setSelectedEmotions] = useState<string[]>(["Amusement"]);

const toggleEmotion = (emotion: string) => {
  setSelectedEmotions((prevSelected) => {
    if (prevSelected.includes(emotion)) {
      return prevSelected.filter((e) => e !== emotion); // Remove if already selected
    } else if (prevSelected.length < 4) {
      return [...prevSelected, emotion]; // Add if not selected and under limit
    } else {
      Alert.alert("Limit Reached", "You can only select up to 4 emotions at a time.");
      return prevSelected;
    }
  });
};

const [sentimentData, setSentimentData] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const fetchWeeklySentimentData = async () => {
  setLoading(true);
  setError(null);

  try {
    const token = "your_jwt_token"; // Replace with actual token retrieval logic
    const endDate = selectedEndDate.toISOString().split("T")[0]; // Convert to "YYYY-MM-DD"
    const startDate = selectedStartDate.toISOString().split("T")[0]; 

    const data = await fetchSentimentAnalysis(token, startDate, endDate, "daily");

    if (data.error) throw new Error(data.error);
    setSentimentData(data.emotion_analysis);
  } catch (error) {
    setError((error as any).message);
  } finally {
    setLoading(false);
  }
};

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
  const [selectedStartDateForChart, setSelectedStartDateForChart] = useState(new Date());
  const [selectedEndDateForChart, setSelectedEndDateForChart] = useState(new Date());

  // Handles selecting a start date // for card part
  useEffect(() => {
    fetchWeeklySentimentData();
  }, [selectedStartDate, selectedEndDate]);
  
  const handleStartDateChange = (event: any, kind: boolean, date?: Date) => {
    if (!date) return;
  
    // Get today's date without time for accurate comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    if (date > today) {
      // If start date is in the future, set both start and end dates to today
      if (kind) {
        setSelectedStartDate(today);
        setSelectedEndDate(today);
      } else {
        setSelectedStartDateForChart(today);
      }
    } else {
      if (kind) {
        setSelectedStartDate(date);
  
        // Calculate new end date
        const newEndDate = new Date(date);
        newEndDate.setDate(newEndDate.getDate() + 7);
  
        // If the end date goes beyond today, limit it to today
        setSelectedEndDate(newEndDate > today ? today : newEndDate);
      } else {
        setSelectedStartDateForChart(date);
        if (selectedStartDateForChart > selectedEndDateForChart) {
          setSelectedEndDateForChart(date);
      }
    }
    }
  };
  
  
  const handleEndDateChange = (event: any, kind: boolean, date?: Date) => {
    if (!date) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date for accurate comparison

    let newEndDate = date > today ? today : date; // Prevent future selection

    if (kind) {
        setSelectedEndDate(newEndDate);

        // Ensure the start date is 7 days before the end date but does not go past today
        let newStartDate = new Date(newEndDate);
        newStartDate.setDate(newStartDate.getDate() - 7);
        setSelectedStartDate(newStartDate);
    } else {
        setSelectedEndDateForChart(newEndDate);
        if (selectedEndDateForChart < selectedStartDateForChart) {
            setSelectedStartDateForChart(newEndDate);
        }
    }
};


  return (
    <>
    <View style={styles.container}>
      
      <View style={styles.dateRangeContainer}>
      <DateTimePicker 
        value={selectedStartDate} 
        mode="date" 
        display="default" 
        onChange={(event, date) => handleStartDateChange(event, true, date)} 
      />

     <DateTimePicker 
        value={selectedEndDate} 
        mode="date" 
        display="default" 
        onChange={(event, date) => handleEndDateChange(event, true, date)} 
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
      <View style={{ marginVertical: 10,alignItems: "center" ,justifyContent: "center",backgroundColor: "#000000"}}>
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
    marginBottom: 15, // Adds spacing between date pickers
  },
  dateRangeContainer2: {
    flexDirection: "row",
    marginTop: 15,
    marginBottom: 5,
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
     // Ensure it doesn't push elements below
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
