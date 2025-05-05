// PromptSelectionScreen.tsx
import React, { useState, useEffect,  useRef,  useCallback  } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  NativeSyntheticEvent, 
  NativeScrollEvent,  
  Animated
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "./types/types";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTheme } from './context/ThemeContext';

type PromptSelectionScreenNavigationProp = StackNavigationProp<RootStackParamList, "GuidedJournaling">;

const promptList = [
  // Anxiety
  { id: 1, text: "What is currently making you feel anxious?", category: "Anxiety" },
  { id: 2, text: "Describe a time you overcame anxiety. What helped?", category: "Anxiety" },
  { id: 3, text: "What is one worry you can let go of today?", category: "Anxiety" },
  { id: 4, text: "What does your anxiety feel like physically?", category: "Anxiety" },
  { id: 5, text: "Write a letter to your anxious self.", category: "Anxiety" },
  { id: 6, text: "What's a fear that turned out better than expected?", category: "Anxiety" },
  { id: 7, text: "What’s one grounding activity that helps you?", category: "Anxiety" },
  { id: 8, text: "Describe a safe space in detail.", category: "Anxiety" },
  { id: 9, text: "What would you say to a friend with the same worry?", category: "Anxiety" },
  { id: 10, text: "List three small things you can control today.", category: "Anxiety" },

  // Gratitude
  { id: 11, text: "What made you smile today?", category: "Gratitude" },
  { id: 12, text: "Who are you thankful for, and why?", category: "Gratitude" },
  { id: 13, text: "Describe a happy memory you're grateful for.", category: "Gratitude" },
  { id: 14, text: "List 5 things you often take for granted.", category: "Gratitude" },
  { id: 15, text: "What's one thing about your body you're grateful for?", category: "Gratitude" },
  { id: 16, text: "Write a thank-you note to yourself.", category: "Gratitude" },
  { id: 17, text: "What’s a difficult experience that taught you something?", category: "Gratitude" },
  { id: 18, text: "What’s your favorite part of your daily routine?", category: "Gratitude" },
  { id: 19, text: "What are you grateful for this season?", category: "Gratitude" },
  { id: 20, text: "Who inspires you and why?", category: "Gratitude" },

  // Productivity
  { id: 21, text: "What was your biggest win this week?", category: "Productivity" },
  { id: 22, text: "What task are you avoiding and why?", category: "Productivity" },
  { id: 23, text: "What’s one small step you can take toward a goal?", category: "Productivity" },
  { id: 24, text: "What distracts you the most, and how can you manage it?", category: "Productivity" },
  { id: 25, text: "When do you feel most productive?", category: "Productivity" },
  { id: 26, text: "What is your biggest goal for the month?", category: "Productivity" },
  { id: 27, text: "Describe your ideal work environment.", category: "Productivity" },
  { id: 28, text: "How do you reward yourself for completing tasks?", category: "Productivity" },
  { id: 29, text: "What motivates you to keep going?", category: "Productivity" },
  { id: 30, text: "What’s one thing you could delegate or postpone?", category: "Productivity" },

  // Personal Growth
  { id: 31, text: "What’s a recent lesson you’ve learned?", category: "Personal Growth" },
  { id: 32, text: "What old habit are you trying to change?", category: "Personal Growth" },
  { id: 33, text: "What are you proud of about yourself?", category: "Personal Growth" },
  { id: 34, text: "Who were you 5 years ago? Who are you now?", category: "Personal Growth" },
  { id: 35, text: "What does growth mean to you?", category: "Personal Growth" },
  { id: 36, text: "Describe a challenge that changed you.", category: "Personal Growth" },
  { id: 37, text: "What’s one thing you’re working on internally?", category: "Personal Growth" },
  { id: 38, text: "What would your future self thank you for today?", category: "Personal Growth" },
  { id: 39, text: "What’s something you’ve recently accepted?", category: "Personal Growth" },
  { id: 40, text: "What limiting belief do you want to let go of?", category: "Personal Growth" },

  // Reflection
  { id: 41, text: "What’s something you wish you handled differently?", category: "Reflection" },
  { id: 42, text: "How did you feel this morning?", category: "Reflection" },
  { id: 43, text: "What’s something that surprised you recently?", category: "Reflection" },
  { id: 44, text: "Describe a recent emotional reaction you had.", category: "Reflection" },
  { id: 45, text: "When did you last feel truly at peace?", category: "Reflection" },
  { id: 46, text: "What does success mean to you?", category: "Reflection" },
  { id: 47, text: "What’s something you want to remember forever?", category: "Reflection" },
  { id: 48, text: "What would you tell your past self?", category: "Reflection" },
  { id: 49, text: "What’s been on your mind a lot lately?", category: "Reflection" },
  { id: 50, text: "What do you need more of in your life?", category: "Reflection" },

  // Stress Relief
  { id: 51, text: "What soothes your mind when you’re overwhelmed?", category: "Stress Relief" },
  { id: 52, text: "Describe your ideal relaxing day.", category: "Stress Relief" },
  { id: 53, text: "What’s your go-to self-care activity?", category: "Stress Relief" },
  { id: 54, text: "What small ritual helps you decompress?", category: "Stress Relief" },
  { id: 55, text: "Write a stress relief plan for a tough day.", category: "Stress Relief" },
  { id: 56, text: "What music, scent, or space helps you feel calm?", category: "Stress Relief" },
  { id: 57, text: "How do you know when you're stressed?", category: "Stress Relief" },
  { id: 58, text: "What would it feel like to fully unwind?", category: "Stress Relief" },
  { id: 59, text: "What helps you sleep better when you're tense?", category: "Stress Relief" },
  { id: 60, text: "What do you need less of today?", category: "Stress Relief" },
];


const categories = ["All", "Anxiety", "Gratitude", "Productivity", "Personal Growth", "Reflection", "Stress Relief"];

const PromptSelectionScreen = () => {
  const navigation = useNavigation<PromptSelectionScreenNavigationProp>();
  const { theme, darkMode } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedPromptId, setExpandedPromptId] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);


  const shuffle = (arr: typeof promptList) => [...arr].sort(() => Math.random() - 0.5);
  const [shuffledPrompts, setShuffledPrompts] = useState(() => shuffle(promptList));
  const scrollOffsetY = useRef(0);

  useEffect(() => {
    const promptsToShuffle = selectedCategory === "All"
      ? promptList
      : promptList.filter(p => p.category === selectedCategory);
    setShuffledPrompts(shuffle(promptsToShuffle));
    setExpandedPromptId(null); // optional: collapse prompt on category change
  }, [selectedCategory]);

  const toggleExpand = (id: number) => {
    setExpandedPromptId(prev => (prev === id ? null : id));
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetY.current = event.nativeEvent.contentOffset.y;
  };

  const handleScrollEndDrag = () => {
    if (scrollOffsetY.current <= 0) {
      const promptsToShuffle = selectedCategory === "All"
        ? promptList
        : promptList.filter(p => p.category === selectedCategory);
      setShuffledPrompts(shuffle(promptsToShuffle));
    }
  };
  
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleRandomPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.05,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const candidates = selectedCategory === "All"
        ? promptList
        : promptList.filter(p => p.category === selectedCategory);
      const random = candidates[Math.floor(Math.random() * candidates.length)];
      navigation.navigate("GuidedJournaling", { prompt: random.text });
    });
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
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
  <TouchableOpacity
    style={{
      marginBottom: 12,
      padding: 12,
      backgroundColor: darkMode ? '#404040' : '#DDD',
      borderRadius: 10,
      alignItems: 'center'
    }}
    onPress={handleRandomPress}
    activeOpacity={0.8}
  >
    <Text style={{ color: darkMode ? theme.text : '#000', fontWeight: "600" }}>
      🎲 Select Random Prompt
    </Text>
  </TouchableOpacity>
</Animated.View>


<FlatList
  ref={flatListRef}
  data={shuffledPrompts}
  keyExtractor={(item) => item.id.toString()}
  renderItem={renderPrompt}
  onScroll={handleScroll}
  onScrollEndDrag={handleScrollEndDrag}
  scrollEventThrottle={16}
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
