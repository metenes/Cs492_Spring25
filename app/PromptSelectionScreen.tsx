// PromptSelectionScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

const promptList = [
  { id: 1, text: "What's something you’re anxious about today?", category: "Anxiety" },
  { id: 2, text: "List three things you're grateful for today.", category: "Gratitude" },
  { id: 3, text: "What’s a small goal you accomplished this week?", category: "Productivity" },
  { id: 4, text: "How have you grown over the past month?", category: "Personal Growth" },
  { id: 5, text: "Describe a recent experience that made you reflect deeply.", category: "Reflection" },
  { id: 6, text: "What helps you feel calm during stressful times?", category: "Stress Relief" },
];

const categories = ["All", "Anxiety", "Gratitude", "Productivity", "Personal Growth", "Reflection", "Stress Relief"];

const PromptSelectionScreen = () => {
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredPrompts =
    selectedCategory === "All"
      ? promptList
      : promptList.filter((p) => p.category === selectedCategory);

  const renderPrompt = ({ item }: { item: typeof promptList[0] }) => (
    <TouchableOpacity
      style={styles.promptCard}
      onPress={() => navigation.navigate("GuidedJournaling", { prompt: item.text })}
    >
      <Text style={styles.promptTitle}>Prompt {item.id}</Text>{/* : {item.text} */}
      <Text style={styles.promptCategory}>{item.category}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.filterButton,
              selectedCategory === cat && styles.activeFilter,
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filteredPrompts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPrompt}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#FFF" },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
    gap: 8,
  },
  filterButton: {
    backgroundColor: "#EEE",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  activeFilter: { backgroundColor: "#CCC" },
  promptCard: {
    backgroundColor: "#F9F9F9",
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderColor: "#DDD",
    borderWidth: 1,
  },
  promptTitle: { fontWeight: "bold", fontSize: 16 },
  promptCategory: { color: "#666", marginTop: 4 },
});

export default PromptSelectionScreen;
