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
import { RootStackParamList } from "./types/types";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTheme } from './context/ThemeContext';

type PromptSelectionScreenNavigationProp = StackNavigationProp<RootStackParamList, "GuidedJournaling">;

const promptList = [
  { id: 1, text: "What's something you're anxious about today?", category: "Anxiety" },
  { id: 2, text: "List three things you're grateful for today.", category: "Gratitude" },
  { id: 3, text: "What's a small goal you accomplished this week?", category: "Productivity" },
  { id: 4, text: "How have you grown over the past month?", category: "Personal Growth" },
  { id: 5, text: "Describe a recent experience that made you reflect deeply.", category: "Reflection" },
  { id: 6, text: "What helps you feel calm during stressful times?", category: "Stress Relief" },
];

const categories = ["All", "Anxiety", "Gratitude", "Productivity", "Personal Growth", "Reflection", "Stress Relief"];

const PromptSelectionScreen = () => {
  const navigation = useNavigation<PromptSelectionScreenNavigationProp>();
  const { theme, darkMode } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedPromptId, setExpandedPromptId] = useState<number | null>(null);

  const filteredPrompts =
    selectedCategory === "All"
      ? promptList
      : promptList.filter((p) => p.category === selectedCategory);

  const toggleExpand = (id: number) => {
    setExpandedPromptId(prev => (prev === id ? null : id));
  };

  const renderPrompt = ({ item }: { item: typeof promptList[0] }) => {
    const isExpanded = expandedPromptId === item.id;

    return (
      <TouchableOpacity 
        onPress={() => toggleExpand(item.id)} 
        style={[
          styles.promptCard,
          { 
            backgroundColor: darkMode ? theme.cardBackground : "#F9F9F9",
            borderColor: darkMode ? theme.border : "#DDD"
          }
        ]}
      >
        <Text style={[styles.promptTitle, { color: theme.text }]}>Prompt {item.id}</Text>
        <Text style={[styles.promptCategory, { color: theme.placeholder }]}>{item.category}</Text>

        {isExpanded && (
          <>
            <Text style={[styles.promptText, { color: theme.text }]}>{item.text}</Text>
            <TouchableOpacity
              style={[
                styles.startButton,
                { backgroundColor: darkMode ? '#404040' : '#E0E0E0' }
              ]}
              onPress={() => navigation.navigate("GuidedJournaling", { prompt: item.text })}
            >
              <Text style={[styles.startButtonText, { color: darkMode ? theme.text : '#000' }]}>Start Writing</Text>
            </TouchableOpacity>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.filterRow}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.filterButton,
              { backgroundColor: darkMode ? theme.cardBackground : "#EEE" },
              selectedCategory === cat && [
                styles.activeFilter,
                { backgroundColor: darkMode ? '#404040' : "#CCC" }
              ],
            ]}
            onPress={() => {
              setExpandedPromptId(null);
              setSelectedCategory(cat);
            }}
          >
            <Text style={{ color: selectedCategory === cat ? theme.text : theme.placeholder }}>{cat}</Text>
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
  container: { 
    flex: 1, 
    padding: 16,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  activeFilter: {},
  promptCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  promptTitle: { 
    fontWeight: "bold", 
    fontSize: 16,
  },
  promptCategory: { 
    marginTop: 4,
  },
  promptText: {
    marginTop: 10,
    fontSize: 15,
  },
  startButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  startButtonText: {
    fontWeight: "600",
  },
});

export default PromptSelectionScreen;
