import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import SentimentCard from "./components/SentimentCard";
import { analyzeSentiment } from "./services/ApiService";

const JournalScreen = () => {
  const [entry, setEntry] = useState("");
  const [sentiment, setSentiment] = useState(null);

  const handleAnalyze = async () => {
    const response = await analyzeSentiment(entry);
    setSentiment(response);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Journal Your Day</Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder="Write your thoughts..."
        value={entry}
        onChangeText={setEntry}
      />
      <Button title="Analyze Sentiment" onPress={handleAnalyze} />
      {sentiment && <SentimentCard sentiment={sentiment} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  input: {
    borderColor: "#ccc",
    borderWidth: 1,
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    height: 100,
    textAlignVertical: "top",
  },
});

export default JournalScreen;
