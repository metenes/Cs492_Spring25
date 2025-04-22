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

import { fetchJournalEntries,fetchJournalDates, calculateStreak, getCheckInHistory } from "./services/ApiService";
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
  // const navigation = useNavigation<HomeScreenNavigationProp>();

  // Animation state for the floating menu
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuPosition = useState(new Animated.Value(0))[0];
  const rotation = useState(new Animated.Value(0))[0];
  const [streak, setStreak] = useState(0);

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

  // Load entries and streak data when screen is focused
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const token = await AsyncStorage.getItem("userToken");
          if (!token) return;

          // Load entries
          const fetchedEntries = await fetchJournalEntries(token);
          const checkInResponse = await getCheckInHistory(token);
          
          let fetchedCheckIns = [];
          if (Array.isArray(checkInResponse.history)) {
            fetchedCheckIns = checkInResponse.history;
          }

          const formattedCheckIns = fetchedCheckIns.map((checkIn: { entry_id: any; comments: string | any[]; created_at: any; sentiments: any; }) => ({
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

          setEntries(allEntries);
          
          // Reapply the current filter
          if (activeFilter === "all") {
            setFilteredEntries(allEntries);
          } else {
            const filtered = allEntries.filter(entry => entry.category === filterMap[activeFilter]);
            setFilteredEntries(filtered);
          }

          // Load streak
          const dates = await fetchJournalDates(token);
          const calculatedStreak = calculateStreak(dates);
          setStreak(calculatedStreak);
        } catch (error) {
          console.error("❌ Error loading data:", error);
        }
      };

      loadData();
    }, [activeFilter]) // Add activeFilter as a dependency
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
    <TouchableOpacity style={[styles.tab, isActive && styles.activeTab ]}
    onPress={() => applyFilter(filterValue)}>
      <Text style={[styles.tabText, isActive && styles.activeTabText]}>{title}</Text>
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
        style={styles.entryItem}
        onPress={() => navigation.navigate("EntryDetail", { entry: item })}
      >
        <View style={styles.entryIcon}>
          <Text>
            <Icon name={iconName} size={20} color="#000" />
          </Text>
        </View>
        <View style={styles.entryContent}>
          <Text style={[styles.entryDate, { fontWeight: 'bold' }]}>{formattedDate}</Text>
          <Text style={styles.entrySubtitle} numberOfLines={2}>
            {item.entryContent || "No content"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };
  console.log("🔹 Entries state:", entries);


  return (
    <>
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Entries</Text>
        <TouchableOpacity style={styles.streakContainer} onPress={() => navigation.navigate("DiaryMain")}>
          <Text style={styles.streakText}>{streak}</Text>
          <Text>
            <MaterialCommunityIcons name="fire" size={20} color="black" />
          </Text>
        </TouchableOpacity>
      </View>

      <View>
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
          <Animated.View style={[styles.menu, { transform: [{ translateY: menuTranslateY }] }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate("Chatbot");
              }}
            >
              <Text>
                <Icon name="message-circle" size={20} color="black" />
              </Text>
              <Text style={styles.menuText}>Chatbot</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate("CheckIn");
              }}
            >
              <Text>
                <Icon name="smile" size={20} color="black" />
              </Text>
              <Text style={styles.menuText}>Check-in</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate("FreeJournaling", {selectedDate : "TODO"});
              }}
            >
              <Text>
                <Icon name="edit-2" size={20} color="black" />
              </Text>
              <Text style={styles.menuText}>New Journal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate("PromptSelection");
              }}
            >
              <Text>
                <Icon name="book-open" size={20} color="black" />
              </Text>
              <Text style={styles.menuText}>Prompts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate("FaceEmotion");
              }}
            >
              <Text>
                <Icon name="smile" size={20} color="black" />
              </Text>
              <Text style={styles.menuText}>Face Analysis</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* FAB Toggle Button */}
        <Animated.View style={[styles.fab, { transform: [{ rotate: rotationInterpolate }] }]}>
          <TouchableOpacity onPress={toggleMenu}>
            <Text>
              <Icon name="plus" size={24} color="#FFF" />
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
    <BottomNavigation activeScreen="Home" />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  streakText: {
    fontSize: 16,
    fontWeight: "500",
  },
  tabContainer: {
    /* flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 8, */
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
    backgroundColor: "#000",
  },
  tabText: {
    color: "#666",
  },
  activeTabText: {
    color: "#fff",
  },
  list: {
    flex: 1,
  },
  entryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  entryContent: {
    flex: 1,
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
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  menu: {
    position: "absolute",
    bottom: 70,
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 10,
    width: 160,
    elevation: 5,
    shadowColor: "#000",
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
/**/
  menuText: {
    marginLeft: 10,
    fontSize: 16,
  },
  entryDate : {
    
  },

  entrySubtitle :{

  },
  emptyText: {
    textAlign: 'center',
    color: '#666',           // soft gray
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
  }
});

export default HomeScreen;
