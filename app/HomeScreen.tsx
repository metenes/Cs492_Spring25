import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView, Animated, Easing } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import Icon from "react-native-vector-icons/Feather";
import { RootStackParamList } from "./types/types";
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {storeToken} from './auth/AuthContext'
import BottomNavigation from './BottomNavigation';
import { ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useEffect } from "react";
import { useTheme } from './context/ThemeContext';

import { fetchJournalEntries,fetchJournalDates, calculateStreak, fetchCheckIn} from "./services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";

type Entry = {
  _id: string;
  entryContent: string;
  entryDate: string;
  createdAt?: string;
  images?: string[];
  journalSentiments?: any[];
  category :string,
  prompt: string; 
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, "Home">;

const HomeScreen = ({ navigation }: { navigation: HomeScreenNavigationProp }) => {
  const { theme, darkMode } = useTheme();
  // const navigation = useNavigation<HomeScreenNavigationProp>();

  // Animation state for the floating menu
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuPosition = useState(new Animated.Value(0))[0];
  const rotation = useState(new Animated.Value(0))[0];
  const [streak, setStreak] = useState(0);
  // Paging 
  const [limit] = useState(30); // entries per page
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true); // disable loading when all loaded
  
  // quotes for no entries empty screen
  const quotes = [
    '“The unexamined life is not worth living.”\n— Socrates',
    '“Thoughts disentangle themselves when they pass through the lips and fingertips.”\n— Dawson Trotman',
    '“You don’t write because you want to say something, you write because you have something to say.”\n— F. Scott Fitzgerald'
  ];

  // Pick a random quote
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

  // const { storeToken } = useAuth(); // ✅ Get logout function from AuthContext

  // Filtering state
  const [activeFilter, setActiveFilter] = useState("all");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<Entry[]>([]);

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

  useFocusEffect(
    useCallback(() => {
      // Reset everything as soon as the screen is focused
      setMenuOpen(false);
      menuPosition.setValue(0);
      rotation.setValue(0);
    }, [])
  );  

  const checkStoredToken = async () => {
    const token = await AsyncStorage.getItem("userToken");
    console.log("🔹 Token in AsyncStorage:", token);
  };
  checkStoredToken();

  console.log("STARTING FROM HERE")

/* 
  useEffect(() => {
    const checkStoredToken = async () => {
        const token = await AsyncStorage.getItem("userToken");
        if (token) {
            console.log("🔹 Found Token:", token);
            storeToken(token); // ✅ Save token in state
        }
        else{
          return; 
        }
    };
    checkStoredToken();

    const loadEntries = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        if (!token) return;
    
        console.log("🔹 Fetching journal entries and check-ins using token:", token);
    
        // Fetch journal entries
        const fetchedEntries = await fetchJournalEntries(token);
        console.log("📖 Journal entries:", fetchedEntries);
    
        // Fetch check-ins
        const checkInResponse = await fetchCheckIn(token);
    
        let fetchedCheckIns = [];
        if (Array.isArray(checkInResponse.history)) {
          fetchedCheckIns = checkInResponse.history;
          console.log("✅ Check-in entries:", fetchedCheckIns);
        } else {
          console.warn("⚠️ No check-ins found.");
}
    
        //const fetchedCheckIns = checkInResponse.history;
        //console.log("✅ Check-in entries:", fetchedCheckIns);
    
        // Convert check-ins to match journal entry structure
        const formattedCheckIns = fetchedCheckIns.map((checkIn: {
          date: string;
          causes: never[]; entry_id: any; comments: string | any[]; created_at: any; sentiments: any; 
}) => ({
          _id: checkIn.entry_id, // Match ID structure
          entryContent: checkIn.comments.length > 0 ? checkIn.comments[0] : "No comments", // Use first comment as content
          entryDate: checkIn.date || new Date().toISOString(), // Ensure valid date
          createdAt: checkIn.created_at,
          category: "checkin", // Mark as check-in
          images: [], // Check-ins likely have no images
          sentiments: checkIn.sentiments || [], // Keep sentiments
          causes: checkIn.causes || [],
          comments: checkIn.comments || [],
          prompt: "", // No prompt for check-ins
        }));

        console.log("HERE ARE THE CHECKIN ENTRIESSSSSS")
        console.log("✅ Fetched raw check-ins:", fetchedCheckIns);
        console.log("✅ Formatted check-ins:", formattedCheckIns);
    
        // Merge journals and check-ins
        let allEntries = [...fetchedEntries, ...formattedCheckIns];
    
        // Sort all entries by date (newest first)
        allEntries.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
        // Limit to last 30 entries
        allEntries = allEntries.slice(0, 30);

        //console.log("📝 Merged Entries (Journals + Check-ins):", allEntries);
    
        setEntries(allEntries);
        setFilteredEntries(allEntries); // Initially show all entries
      } catch (error) {
        console.error("❌ Error loading journal entries and check-ins:", error);
      }
    };
    
  
    loadEntries();
  }, []);
  
*/

  // Load entries and streak data when screen is focused
  useFocusEffect(
    useCallback(() => {
      const checkStoredToken = async () => {
        const token = await AsyncStorage.getItem("userToken");
        if (token) {
            console.log("🔹 Found Token:", token);
            storeToken(token); // ✅ Save token in state
        }
        else{
          return; 
        }
    };
    checkStoredToken();
    
      const loadData = async () => {
        try {
          const token = await AsyncStorage.getItem("userToken");
          if (!token) return;

          // Load entries
          const fetchedEntries = await fetchJournalEntries(token, limit, skip);
          console.log("JOUNRAL ENTRIES: " ,fetchedEntries )

          // const checkInResponse = await getCheckInHistory(token);
          const checkInResponse = await fetchCheckIn(token);
          console.log("CHECK ENTRIES: " ,checkInResponse )

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
          allEntries = allEntries.slice(0, 30);

          console.log("ALL ENTRIES: " ,allEntries )
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
        } catch (error) {
          console.error("❌ Error loading data:", error);
        }
      };

      loadData();
    }, [activeFilter, skip]) // Add activeFilter as a dependency
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
      onPress={() => applyFilter(filterValue)}
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
  console.log("🔹 Entries state:", entries);


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
          
          {hasMore && (
            <TouchableOpacity onPress={() => setSkip(prev => prev + limit)}>
              <Text style={{ textAlign: 'center', color: 'blue' }}>Load More</Text>
            </TouchableOpacity>
          )}
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

      <FlatList data={filteredEntries} renderItem={renderEntry} keyExtractor={(item) => item._id || Math.random().toString()} style={styles.list} 
        ListEmptyComponent={
          <Text style={styles.emptyText}>{randomQuote}</Text>
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
    paddingHorizontal: 20,},

  /* entryDate : {
    
  },

  entrySubtitle :{

  } */
});

export default HomeScreen;
