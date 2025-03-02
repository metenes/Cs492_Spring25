import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Feather";
import { ScrollView } from "react-native";

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
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [selectedEmotions, setSelectedEmotions] = useState([]);
  const [selectedReasons, setSelectedReasons] = useState([]);

  const toggleSelection = (item, state, setState) => {
    setState((prev) =>
      prev.includes(item)
        ? prev.filter((i) => i !== item)
        : [...prev, item]
    );
  };

  const renderItem = ({ item }, state, setState) => (
    <TouchableOpacity
      style={[
        styles.option,
        state.includes(item.name) && styles.selectedOption,
      ]}
      onPress={() => toggleSelection(item.name, state, setState)}
    >
      <Icon name={item.icon} size={24} color="#000" />
      <Text>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
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
          <TouchableOpacity style={styles.nextButton} onPress={() => setStep(2)}>
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Reasons Screen (Step 2) */}
      {step === 2 && (
        <>
          {/* Back Button to Step 1 */}
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
          <TouchableOpacity style={styles.nextButton} onPress={() => setStep(3)}>
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Summary Screen (Step 3) */}
      {step === 3 && (
        <>
          {/* Back Button to Step 2 */}
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(2)}>
            <Icon name="arrow-left" size={24} color="black" />
          </TouchableOpacity>

          {/* Summary Container */}
          <View style={styles.summaryContainer}>
            <ScrollView>
              <Text style={styles.summaryTitle}>Check-in Summary</Text>

              {/* Emotions Section */}
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
              {/* Reasons Section */}
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

              {/* Complete Check-in Button */}
              <TouchableOpacity style={styles.completeButton} onPress={() => navigation.navigate("Home")}>
                <Text style={styles.completeButtonText}>Complete Check-in</Text>
              </TouchableOpacity>
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
    backgroundColor: "#fff", //rgba(255, 252, 244, 1)
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
    //padding: 10,
    zIndex: 10, // Ensures it's above other elements
    backgroundColor: "rgba(255, 255, 255, 0.8)", // Optional subtle background
    borderRadius: 20,
    padding: 8,
  },
  
  summaryContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f8f8", // Soft tint to break the full-white monotony
    width: "100%",
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
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
  
  completeButton: {
    marginTop: 30,
    paddingVertical: 15,
    paddingHorizontal: 40,
    backgroundColor: "black",
    borderRadius: 30,
  },
  
  completeButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: "Poppins",
  },
  
});

export default CheckInScreen;
