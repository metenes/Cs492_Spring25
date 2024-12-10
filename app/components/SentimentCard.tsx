import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface Sentiment {
  label: string;
  confidence: number;
}

interface SentimentCardProps {
  sentiment: Sentiment;
}

const SentimentCard: React.FC<SentimentCardProps> = ({ sentiment }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Sentiment Analysis</Text>
      <Text style={styles.sentiment}>Sentiment: {sentiment.label}</Text>
      <Text>Confidence: {Math.round(sentiment.confidence * 100)}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    marginTop: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  sentiment: {
    fontSize: 16,
    color: "#333",
  },
});

export default SentimentCard;
