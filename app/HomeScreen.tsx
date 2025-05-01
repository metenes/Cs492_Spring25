import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView, Animated, Easing, ActivityIndicator } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import Icon from "react-native-vector-icons/Feather";
import { RootStackParamList } from "./types/types";
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {storeToken} from './auth/AuthContext'
import BottomNavigation from './BottomNavigation';
import { ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from './context/ThemeContext';

import { fetchJournalEntries, fetchJournalDates, calculateStreak, fetchCheckIn } from "./services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";

type Entry = {
  _id: string;
  entryContent: string;
  entryDate: string;
  createdAt?: string;
  images?: string[];
  journalSentiments?: any[];
  category: string,
  prompt: string; 
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, "Home">;

const HomeScreen = ({ navigation }: { navigation: HomeScreenNavigationProp }) => {
  const { theme, darkMode } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [skip, setSkip] = useState(0); // for pagination
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Animation state for the floating menu
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuPosition = useState(new Animated.Value(0))[0];
  const rotation = useState(new Animated.Value(0))[0];
  const [streak, setStreak] = useState(0);
  
  // Paging 
  const [limit] = useState(30); // entries per page
  const [hasMore, setHasMore] = useState(true); // disable loading when all loaded
  
  // quotes for no entries empty screen
  const quotes = [
    '"The unexamined life is not worth living."\n— Socrates',
    '"Thoughts disentangle themselves when they pass through the lips and fingertips."\n— Dawson Trotman',
    '"You don\'t write because you want to say something, you write because you have something to say."\n— F. Scott Fitzgerald',
    '"We write to taste life twice, in the moment and in retrospect."\n— Anaïs Nin',
    '"Fill your paper with the breathings of your heart."\n— William Wordsworth',
    '"There is no greater agony than bearing an untold story inside you."\n— Maya Angelou',
    '"Write what should not be forgotten."\n— Isabel Allende',
    '"The purpose of a writer is to keep civilization from destroying itself."\n— Albert Camus',
    '"I write to discover what I know."\n— Flannery O\'Connor',
    '"Writing is the painting of the voice."\n— Voltaire',
    '"Either write something worth reading or do something worth writing."\n— Benjamin Franklin',
    '"A word after a word after a word is power."\n— Margaret Atwood',
    '"The scariest moment is always just before you start."\n— Stephen King',
    '"Start writing, no matter what. The water does not flow until the faucet is turned on."\n— Louis L\'Amour',
    '"You can make anything by writing."\n— C.S. Lewis',
    '"Write what disturbs you, what you fear, what you have not been willing to speak about."\n— Natalie Goldberg',
    '"The first draft is just you telling yourself the story."\n— Terry Pratchett',
    '"A writer is someone for whom writing is more difficult than it is for other people."\n— Thomas Mann',
    '"One day I will find the right words, and they will be simple."\n— Jack Kerouac',
    '"Writing is an exploration. You start from nothing and learn as you go."\n— E.L. Doctorow',
    '"The role of a writer is not to say what we all can say, but what we are unable to say."\n— Anaïs Nin',
    '"Words are a lens to focus one\'s mind."\n— Ayn Rand',
    '"Writing is the only way I have to explain my own life to myself."\n— Pat Conroy',
    '"To survive, you must tell stories."\n— Umberto Eco',
    '"A writer is a world trapped in a person."\n— Victor Hugo'
  ];
  // Pick a random quote
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

  // Filtering state
  const [activeFilter, setActiveFilter] = useState("all");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<Entry[]>([]);
  const [shouldLoadData, setShouldLoadData] = useState(true);

  // Map UI filter names to your backend category values
  const filterMap: { [key: string]: string } = {
    "checkin": "checkin",
    "freeform": "freeform",
    "guided": "guided"
  };
      
  // Apply filter function
  const applyFilter = (filter: string) => {
    setActiveFilter(filter);
    
    if (filter === "all") {
      setFilteredEntries(entries);
      return;
    }
    
    const filtered = entries.filter(entry => entry.category === filterMap[filter]);
    setFilteredEntries(filtered);
  };

  const loadData = useCallback(async () => {
    if (!shouldLoadData) return;
    
    try {
      setIsLoadingMore(skip > 0);
      const token = await AsyncStorage.getItem("userToken");
      if (!token) return;

      // Load entries
      const fetchedEntries = await fetchJournalEntries(token, limit, skip);
      
      const checkInResponse = await fetchCheckIn(token);

      let fetchedCheckIns = [];
      if (Array.isArray(checkInResponse.history)) {
        fetchedCheckIns = checkInResponse.history;
      }

      const formattedCheckIns = fetchedCheckIns.map((checkIn: {
        date: string;
        causes: never[]; 
        entry_id: any; 
        comments: string | any[]; 
        created_at: any; 
        sentiments: any; }) => ({

        _id: checkIn.entry_id,
        entryContent: checkIn.comments.length > 0 ? checkIn.comments[0] : "No comments",
        entryDate: checkIn.date || new Date().toISOString(),
        createdAt: checkIn.created_at,
        category: "checkin",
        images: [],
        sentiments: checkIn.sentiments || [],
        causes: checkIn.causes || [],
        comments: checkIn.comments || [],
        prompt: "",
      }));

      let allEntries = [...fetchedEntries, ...formattedCheckIns];
      allEntries.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
      
      // Apply pagination
      allEntries = allEntries.slice(0, skip + limit);  

      // Check if we've reached the end of available data
      setHasMore(allEntries.length >= skip + limit);
      
      setEntries(allEntries);
      
      // Reapply the current filter
      if (activeFilter === "all") {
        setFilteredEntries(allEntries);
      } else {
        const filtered = allEntries.filter(entry => entry.category === filterMap[activeFilter]);
        setFilteredEntries(filtered);
      }

      // Load streak
      const dates = await fetchJournalDates(token, limit, skip);
      const calculatedStreak = calculateStreak(dates);
      setStreak(calculatedStreak);
      
      // Reset loading flags
      setIsLoadingMore(false);
      setShouldLoadData(false);
    } catch (error) {
      console.error("❌ Error loading data:", error);
      setIsLoadingMore(false);
      setShouldLoadData(false);
    }
  }, [activeFilter, skip, limit, shouldLoadData]);

  // Check for token on component mount
  useEffect(() => {
    const checkStoredToken = async () => {
      const token = await AsyncStorage.getItem("userToken");
      if (token) {
        console.log("🔹 Found Token:", token);
        storeToken(token);
      }
    };
    checkStoredToken();
  }, []);

  // Load data when needed
  useEffect(() => {
    if (shouldLoadData) {
      loadData();
    }
  }, [loadData, shouldLoadData]);

  // Reset and load data when screen gets focus
  useFocusEffect(
    useCallback(() => {
      // Reset menu animation state
      setMenuOpen(false);
      menuPosition.setValue(0);
      rotation.setValue(0);
      
      // Trigger data reload on screen focus
      setShouldLoadData(true);
      
      return () => {
        // Clean up any pending operations if needed
      };
    }, [])
  );

  const toggleMenu = () => {
    if (isMenuOpen) {
      // Close animation
      Animated.parallel([
        Animated.timing(menuPosition, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotation, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => setMenuOpen(false));
    } else {
      setMenuOpen(true);
      // Open animation
      Animated.parallel([
        Animated.timing(menuPosition, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotation, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const menuTranslateY = menuPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0], // Menu slides up (not down!)
  });

  const rotationInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"], // Smooth 45° rotation (plus → cross)
  });

  const renderTab = (title: string, filterValue: string, isActive: boolean) => (
    <TouchableOpacity 
      style={[
        styles.tab, 
        isActive && styles.activeTab,
        { 
          backgroundColor: isActive ? (darkMode ? '#2C2C2C' : '#E0E0E0') : 'transparent',
          borderColor: darkMode ? '#404040' : '#D0D0D0',
          borderWidth: 1
        }
      ]}
      onPress={() => {
        if (activeFilter !== filterValue) {
          setActiveFilter(filterValue);
          // Refilter existing data rather than triggering a reload
          if (filterValue === "all") {
            setFilteredEntries(entries);
          } else {
            const filtered = entries.filter(entry => entry.category === filterMap[filterValue]);
            setFilteredEntries(filtered);
          }
        }
      }}
    >
      <Text style={[
        styles.tabText, 
        { 
          color: isActive 
            ? (darkMode ? '#FFFFFF' : '#333333')
            : (darkMode ? '#A0A0A0' : '#666666')
        }
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderEntry = ({ item }: { item: Entry }) => {
    // Safely format the date
    let formattedDate = "Invalid date";
    try {
      const dateString = item.entryDate || item.createdAt;
      if (dateString) {
        formattedDate = format(new Date(dateString), "EEEE, MMM d yyyy");
      }
    } catch (error) {
      console.log("Error formatting date:", error);
    }
  
    // Choose icon based on entry category
    let iconName = "edit-2";
    if (item.category === "checkin") {
      iconName = "smile";
    } else if (item.category === "guided") {
      iconName = "book-open";
    }
  
    return (
      <TouchableOpacity 
        style={[styles.entryItem, { backgroundColor: theme.cardBackground }]}
        onPress={() => navigation.navigate("EntryDetail", { entry: item })}
      >
        <View style={[styles.entryIcon, { backgroundColor: theme.inputBackground }]}>
          <Text>
            <Icon name={iconName} size={20} color={theme.icon} />
          </Text>
        </View>
        <View style={styles.entryContent}>
          <Text style={[styles.entryDate, { color: theme.text, fontWeight: 'bold' }]}>{formattedDate}</Text>
          <Text style={[styles.entrySubtitle, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.entryContent || "No content"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setSkip(0); // Reset pagination to start
      setShouldLoadData(true); // Trigger a data reload
    } catch (err) {
      console.error("Refresh failed", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore) {
      setSkip(prevSkip => prevSkip + limit);
      setShouldLoadData(true);
    }
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
      <SafeAreaView 
        style={[
          styles.container, 
          { 
            backgroundColor: theme.backgroundColor,
            flex: 1,
            marginBottom: 0
          }
        ]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Your Entries</Text>
          <TouchableOpacity 
            style={[styles.streakContainer, { backgroundColor: 'transparent' }]} 
            onPress={() => navigation.navigate("DiaryMain")}
          >
            <Text style={[styles.streakText, { color: theme.text }]}>{streak}</Text>
            <Text>
              <MaterialCommunityIcons name="fire" size={20} color={theme.text} />
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.tabWrapper, { backgroundColor: theme.backgroundColor }]}>
          <ScrollView 
            horizontal
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.tabContainer}
          >
            {renderTab("All Entries", "all", activeFilter === "all")}
            {renderTab("Check-ins", "checkin", activeFilter === "checkin")}
            {renderTab("Freeform Journals", "freeform", activeFilter === "freeform")}
            {renderTab("Guided Journals", "guided", activeFilter === "guided")}
          </ScrollView>
        </View>

        <FlatList
          data={filteredEntries}
          renderItem={renderEntry}
          keyExtractor={(item) => item._id || Math.random().toString()}
          style={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{randomQuote}</Text>
          }
          // Pull-to-refresh (Scroll up)
          onRefresh={handleRefresh}
          refreshing={isRefreshing}

          // Infinite scroll (Scroll down)
          onEndReachedThreshold={0.3}
          onEndReached={handleLoadMore}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 16 }} />
            ) : null
          }
        />

        {/* Floating Action Button (FAB) + Dropdown Menu */}
        <View style={styles.fabContainer}>
          {/* Drop-up menu */}
          {isMenuOpen && (
            <Animated.View 
              style={[
                styles.menu, 
                { 
                  transform: [{ translateY: menuTranslateY }],
                  backgroundColor: theme.cardBackground,
                  shadowColor: theme.text
                }
              ]}
            >
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate("Chatbot");
                }}
              >
                <Text>
                  <Icon name="message-circle" size={20} color={theme.text} />
                </Text>
                <Text style={[styles.menuText, { color: theme.text }]}>Chatbot</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate("CheckIn");
                }}
              >
                <Text>
                  <Icon name="smile" size={20} color={theme.text} />
                </Text>
                <Text style={[styles.menuText, { color: theme.text }]}>Check-in</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate("FreeJournaling", {selectedDate : "TODO"});
                }}
              >
                <Text>
                  <Icon name="edit-2" size={20} color={theme.text} />
                </Text>
                <Text style={[styles.menuText, { color: theme.text }]}>New Journal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate("PromptSelection");
                }}
              >
                <Text>
                  <Icon name="book-open" size={20} color={theme.text} />
                </Text>
                <Text style={[styles.menuText, { color: theme.text }]}>Prompts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate("FaceEmotion");
                }}
              >
                <Text>
                  <Icon name="smile" size={20} color={theme.text} />
                </Text>
                <Text style={[styles.menuText, { color: theme.text }]}>Face Analysis</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* FAB Toggle Button */}
          <Animated.View 
            style={[
              styles.fab, 
              { 
                transform: [{ rotate: rotationInterpolate }],
                backgroundColor: theme.text
              }
            ]}
          >
            <TouchableOpacity onPress={toggleMenu}>
              <Text>
                <Icon name="plus" size={24} color={theme.backgroundColor} />
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
      <View style={{ backgroundColor: theme.backgroundColor }}>
        <BottomNavigation activeScreen="Home" darkMode={darkMode} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 0,
    paddingBottom: 0
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 8,
  },
  streakText: {
    fontSize: 16,
    fontWeight: "500",
  },
  tabWrapper: {
    borderBottomWidth: 1,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    alignItems: "center",
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 16,
  },
  activeTab: {
    // Removed the blue color
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  entryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  entryContent: {
    flex: 1,
  },
  entryDate: {
    fontSize: 16,
  },
  entrySubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  fabContainer: {
    position: "absolute",
    right: 16,
    bottom: 16,
    alignItems: "center",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  menu: {
    position: "absolute",
    bottom: 70,
    borderRadius: 12,
    paddingVertical: 10,
    width: 160,
    elevation: 5,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    right: 10
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuText: {
    marginLeft: 10,
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',           // soft gray
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
});

export default HomeScreen;