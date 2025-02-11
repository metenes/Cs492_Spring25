import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

export const AnalysisScreen = () => {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        <View style={styles.card}>
          <Text style={styles.title}>Mood Trends</Text>
          {/* Add charts/graphs here */}
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Insights</Text>
          <Text>Your mood has been improving over the last week...</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollView: {
    padding: 16,
  },
  card: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
});
