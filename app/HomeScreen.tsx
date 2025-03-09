import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView, Animated, Easing } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Feather";
import { RootStackParamList } from "./types/types";
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {storeToken} from './auth/AuthContext'
import BottomNavigation from './BottomNavigation';
import { ScrollView } from "react-native";

import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useEffect } from "react";

import { loginUser } from "./services/ApiService";

import { fetchJournalEntries } from "./services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";

/* type Entry = {
  id: string;
  date: string;
  type: "freeform journal" | "checkin" | "guided journal";
  subtitle: string;
}; */
type Entry = {
  _id: string;
  content: string;
  timestamp: string;
  images?: string[];
  category: string;
};




type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, "Home">;

const HomeScreen = ({ navigation }: { navigation: HomeScreenNavigationProp }) => {
  // const navigation = useNavigation<HomeScreenNavigationProp>();

  // Animation state for the floating menu
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuPosition = useState(new Animated.Value(0))[0];
  const rotation = useState(new Animated.Value(0))[0];

  useFocusEffect(
    useCallback(() => {
      // Reset everything as soon as the screen is focused
      setMenuOpen(false);
      menuPosition.setValue(0);
      rotation.setValue(0);
    }, [])
  );  

  /* const entries: Entry[] = [
    { id: "1", date: "December 18", type: "freeform journal", subtitle: "Freeform Journal Entry" },
    { id: "2", date: "December 18", type: "checkin", subtitle: "Check-in" },
    { id: "3", date: "December 14", type: "freeform journal", subtitle: "Freeform Journal Entry" },
    { id: "4", date: "December 2", type: "guided journal", subtitle: "Guided Journal Entry" },
    { id: "5", date: "November 30", type: "guided journal", subtitle: "Guided Journal Entry" },
    { id: "6", date: "November 27", type: "checkin", subtitle: "Check-in" },
    { id: "7", date: "November 25", type: "freeform journal", subtitle: "Freeform Journal Entry" },
  ]; */

  const [entries, setEntries] = useState<Entry[]>([]);

  const checkStoredToken = async () => {
    const token = await AsyncStorage.getItem("userToken");
    console.log("🔹 Token in AsyncStorage:", token);
  };
  
  checkStoredToken();

  const testLogin = async () => {
    const email = "irem.akel@ug.bilkent.edu.tr"; // Your test email
    const password = "password123"; // Your test password
  
    try {
      const response = await loginUser(email, password);
      console.log("✅ Received login response:", response);
  
      const storedToken = await AsyncStorage.getItem("userToken");
      console.log("🔹 Token in AsyncStorage after login:", storedToken);
    } catch (error) {
      console.error("❌ Login test failed:", error);
    }
  };
  testLogin();
  
  console.log("STARTING FROM HERE")

  useEffect(() => {
    const checkStoredToken = async () => {
        const token = await AsyncStorage.getItem("userToken");
        if (token) {
            console.log("🔹 Found Token:", token);
            storeToken(token); // ✅ Save token in state
        }
    };
    checkStoredToken();
    const loadEntries = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        if (token) {
          console.log("🔹 Using token to fetch journal entries:", token);
          const fetchedEntries = await fetchJournalEntries(token);
      
          console.log("Fetched entries:", fetchedEntries);
            
          if (fetchedEntries.length === 0) {
            console.warn("⚠️ No journal entries found for user.");
          }
        
          setEntries(fetchedEntries);
          // print(entries)
        }
      } catch (error) {
        console.error("❌ Error loading journal entries:", error);
      }
    };
  
    loadEntries();
  }, []);
  
  /* useEffect(() => {
    const loadEntries = async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        if (token) {
          const response = await fetchJournalEntries(token);
          if (!response.error) {
            setEntries(response.entries);
          }
        }
      } catch (error) {
        console.error("Error loading journal entries:", error);
      }
    };

    loadEntries();
  }, []); */



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

  const renderTab = (title: string, isActive: boolean) => (
    <TouchableOpacity style={[styles.tab, isActive && styles.activeTab]}>
      <Text style={[styles.tabText, isActive && styles.activeTabText]}>{title}</Text>
    </TouchableOpacity>
  );

  /* const renderEntry = ({ item }: { item: Entry }) => (
    <TouchableOpacity style={styles.entryItem}>
      <View style={styles.entryIcon}>
        {item.type === "checkin" ? (
          <Icon name="smile" size={20} color="#000" />
        ) : (
          <Icon name="edit-2" size={20} color="#000" />
        )}
      </View>
      <View style={styles.entryContent}>
        <Text style={styles.entryDate}>{item.date}</Text>
        <Text style={styles.entrySubtitle}>{item.subtitle}</Text>
      </View>
    </TouchableOpacity>
  ); */

  const renderEntry = ({ item }: { item: Entry }) => (
    <TouchableOpacity style={styles.entryItem}>
      <View style={styles.entryIcon}>
        <Icon name="edit-2" size={20} color="#000" />
      </View>
      <View style={styles.entryContent}>
        <Text style={styles.entryContent}>{format(new Date(item.timestamp), "EEEE, MMM d yyyy")}</Text>
        <Text style={styles.entryContent}>{item.category || "Freeform Journal"}</Text>
      </View>
    </TouchableOpacity>
  );
  console.log("🔹 Entries state:", entries);


  return (
    <>
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Entries</Text>
        <TouchableOpacity style={styles.streakContainer} onPress={() => navigation.navigate("DiaryMain")}>
          <Text style={styles.streakText}>5</Text>
          <MaterialCommunityIcons name="fire" size={20} color="black" /* style={{ marginLeft: 5 }}  *//>
        </TouchableOpacity>
      </View>

      <View>
      <ScrollView 
      horizontal
      showsHorizontalScrollIndicator={false} 
      contentContainerStyle={styles.tabContainer}
      >
        {renderTab("All Entries", true)}
        {renderTab("Check-ins", false)}
        {renderTab("Freeform Journals", false)}
        {renderTab("Guided Journals", false)}
      </ScrollView>
      </View>

      <FlatList data={entries} renderItem={renderEntry} keyExtractor={(item) => item._id} style={styles.list} 
        ListEmptyComponent={<Text>No journal entries found.</Text>}
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
                console.log("Check-in Selected");
              }}
            >
              <Icon name="message-circle" size={20} color="black" /> {/* message-square de kullanabiliriz */}
              <Text style={styles.menuText}>Chatbot</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate("CheckIn");
              }}
            >
              <Icon name="smile" size={20} color="black" />
              <Text style={styles.menuText}>Check-in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                console.log("Navigating to CheckIn...")
                navigation.navigate("CheckIn");
              }}
            >
              <Icon name="edit-2" size={20} color="black" />
              <Text style={styles.menuText}>New Journal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                console.log("Navigating to FreeJournaling...")

                navigation.navigate("FreeJournaling");
              }}
            >
              <Icon name="book-open" size={20} color="black" />
              <Text style={styles.menuText}>Prompts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                console.log("Navigating to FaceEmotion...")
                navigation.navigate("FaceEmotion");
              }}
            >
              <Icon name="smile" size={20} color="black" />
              <Text style={styles.menuText}>Face Analysis</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* FAB Toggle Button */}
        <Animated.View style={[styles.fab, { transform: [{ rotate: rotationInterpolate }] }]}>
          <TouchableOpacity onPress={toggleMenu}>
            <Icon name="plus" size={24} color="#FFF" />
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

  }
});

export default HomeScreen;
