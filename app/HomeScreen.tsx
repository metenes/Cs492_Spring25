import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView, Animated, Easing, Modal, Alert, TextInput } from "react-native";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchJournalEntries, fetchJournalDates, calculateStreak, fetchCheckIn, updateJournalPin } from "./services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";

type Entry = {
  _id: string;
  entryContent: string;
  entryDate: string;
  createdAt?: string;
  images?: string[];
  journalSentiments?: any[];
  category: string;
  prompt: string;
  lockCode?: string;
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, "Home">;

const HomeScreen = ({ navigation }: { navigation: HomeScreenNavigationProp }) => {
  const { theme, darkMode } = useTheme();
  const insets = useSafeAreaInsets();
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

  // PIN Modal state
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [verifyPinModalVisible, setVerifyPinModalVisible] = useState(false);
  const [removePinModalVisible, setRemovePinModalVisible] = useState(false);

  // Pick a random quote
  const [randomQuote] = useState(() => {
    const quotes = [
      '“The unexamined life is not worth living.”\n— Socrates',
      '“Thoughts disentangle themselves when they pass through the lips and fingertips.”\n— Dawson Trotman',
      '“You don’t write because you want to say something, you write because you have something to say.”\n— F. Scott Fitzgerald'
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  });

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

  console.log("STARTING FROM HERE");

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
          //console.log("JOUNRAL ENTRIES: " ,fetchedEntries )

          // const checkInResponse = await getCheckInHistory(token);
          const checkInResponse = await fetchCheckIn(token);
          //console.log("CHECK ENTRIES: " ,checkInResponse )

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
            lockCode: String;
            sentiments: any;
          }) => ({

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
            lockCode: checkIn.lockCode || null,
          }));

          let allEntries = [...fetchedEntries, ...formattedCheckIns];
          allEntries.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
          allEntries = allEntries.slice(0, 30);

          //console.log("ALL ENTRIES: " ,allEntries )
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

  const handleLockPress = (entry: Entry) => {
    setSelectedEntry(entry);
    debugger;
    // If entry already has a PIN, ask if they want to remove it
    if (entry.lockCode) {
      Alert.alert(
        "PIN Options",
        "What would you like to do with this journal's PIN?",
        [
          {
            text: "Remove PIN",
            onPress: () => {
              setCurrentPin('');
              setRemovePinModalVisible(true);
            }
          },
          {
            text: "Change PIN",
            onPress: () => {
              setPin('');
              setConfirmPin('');
              setPinModalVisible(true);
            }
          },
          {
            text: "Cancel",
            style: "cancel"
          }
        ]
      );
    } else {
      // No existing PIN, open modal to create one
      setPin('');
      setConfirmPin('');
      setPinModalVisible(true);
    }
  };

  // Handle PIN removal
  const handleRemovePin = async (entry: Entry) => {
    try {

      if (!selectedEntry) return;

      // Verify current PIN matches
      if (currentPin !== selectedEntry.lockCode) {
        Alert.alert("Incorrect PIN", "The PIN you entered is incorrect. Please try again.");
        setCurrentPin('');
        return;
      }

      const token = await AsyncStorage.getItem("userToken");
      if (!token) return;

      await updateJournalPin(entry._id, "", token, "journal");

      const updatedEntries = entries.map(e =>
        e._id === selectedEntry._id ? { ...e, lockCode: undefined } : e
      );

      setEntries(updatedEntries);

      if (activeFilter === "all") {
        setFilteredEntries(updatedEntries);
      } else {
        const filtered = updatedEntries.filter(e => e.category === filterMap[activeFilter]);
        setFilteredEntries(filtered);
      }

      setRemovePinModalVisible(false);
      setCurrentPin('');
      setSelectedEntry(null);

      Alert.alert("Success", "PIN has been removed from this journal.");
    } catch (error) {
      console.error("Error removing PIN:", error);
      Alert.alert("Error", "Failed to remove PIN. Please try again.");
    }
  };

  // Handle PIN creation/update
  const handleSavePin = async () => {
    debugger;
    if (!selectedEntry) return;

    if (selectedEntry.lockCode && (!currentPin || currentPin.length === 0)) {
      Alert.alert("Invalid PIN", "Current PIN is required.");
      return;
    }

    if (pin.length !== 4 || confirmPin?.length !== 4) {
      Alert.alert("Invalid PIN", "PINs must be 4 digits.");
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert("PIN Mismatch", "PINs do not match. Please try again.");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) return;

      await updateJournalPin(selectedEntry._id, pin, token, "journal");

      const updatedEntries = entries.map(entry =>
        entry._id === selectedEntry._id ? { ...entry, lockCode: pin } : entry
      );

      setEntries(updatedEntries);

      if (activeFilter === "all") {
        setFilteredEntries(updatedEntries);
      } else {
        const filtered = updatedEntries.filter(entry => entry.category === filterMap[activeFilter]);
        setFilteredEntries(filtered);
      }

      // Close modal and reset state
      setPinModalVisible(false);
      setPin('');
      setConfirmPin('');
      setSelectedEntry(null);

      Alert.alert("Success", "Journal is now PIN protected.");
    } catch (error) {
      console.error("Error setting PIN:", error);
      Alert.alert("Error", "Failed to set PIN. Please try again.");
    }
  };

  // verify PIN
  const handleVerifyPin = () => {
    if (!selectedEntry) return;

    // Check if entered PIN matches the entry's PIN
    if (currentPin === selectedEntry.lockCode) {
      // PIN is correct, navigate to entry detail
      setVerifyPinModalVisible(false);
      setCurrentPin('');
      navigation.navigate("EntryDetail", { entry: selectedEntry });
      setSelectedEntry(null);
    } else {
      // PIN is incorrect
      Alert.alert("Incorrect PIN", "The PIN you entered is incorrect. Please try again.");
      setCurrentPin('');
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
        onPress={() => {
          if (item.lockCode) {
            // Show PIN verification modal
            setSelectedEntry(item);
            setCurrentPin('');
            setVerifyPinModalVisible(true);
          } else {
            // No PIN, navigate directly
            navigation.navigate("EntryDetail", { entry: item });
          }
        }}
      >
        <View style={[styles.entryIcon, { backgroundColor: theme.inputBackground }]}>
          <Text>
            <Icon name={iconName} size={20} color={theme.icon} />
          </Text>
        </View>
        <View style={styles.entryContent}>
          <Text style={[styles.entryDate, { color: theme.text, fontWeight: 'bold' }]}>{formattedDate}</Text>
          <Text style={[styles.entrySubtitle, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.entryContent ? (item.lockCode ? "****** ***** *****" : item.entryContent) : "No content"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.lockContainer}
          onPress={() => handleLockPress(item)}
        >
          <Text>
            <Icon
              name={item.lockCode ? "lock" : "unlock"}
              size={18}
              color={item.lockCode ? theme.icon : theme.textSecondary}
            />
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };
  //console.log("🔹 Entries state:", entries);


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
                  navigation.navigate("FreeJournaling", {selectedDate : new Date().toISOString()});
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

      <Modal
        animationType="slide"
        transparent={true}
        visible={pinModalVisible}
        onRequestClose={() => {
          setPinModalVisible(false);
          setPin('');
          setConfirmPin('');
          setSelectedEntry(null);
        }}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {selectedEntry?.lockCode ? "Change PIN" : "Create PIN"}
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Set a PIN to protect your journal entry.
            </Text>

            {selectedEntry?.lockCode &&
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
                placeholder="Enter Current PIN"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                secureTextEntry
                value={currentPin}
                onChangeText={setCurrentPin}
                maxLength={6}
              />}
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
              placeholder="Enter PIN (4 digits)"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              secureTextEntry
              value={pin}
              onChangeText={setPin}
              maxLength={4}
            />

            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
              placeholder="Confirm PIN"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              secureTextEntry
              value={confirmPin}
              onChangeText={setConfirmPin}
              maxLength={6}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel, { borderColor: theme.border }]}
                onPress={() => {
                  setPinModalVisible(false);
                  setPin('');
                  setConfirmPin('');
                  setCurrentPin('');
                  setSelectedEntry(null);
                }}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonSave, { backgroundColor: theme.primary }]}
                onPress={handleSavePin}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={verifyPinModalVisible}
        onRequestClose={() => {
          setVerifyPinModalVisible(false);
          setCurrentPin('');
          setSelectedEntry(null);
        }}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Enter PIN
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              This journal entry is protected. Please enter the PIN to view it.
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
              placeholder="Enter PIN"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              secureTextEntry
              value={currentPin}
              onChangeText={setCurrentPin}
              maxLength={4}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel, { borderColor: theme.border }]}
                onPress={() => {
                  setVerifyPinModalVisible(false);
                  setCurrentPin('');
                  setSelectedEntry(null);
                }}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonSave, { backgroundColor: theme.primary }]}
                onPress={handleVerifyPin}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={removePinModalVisible}
        onRequestClose={() => {
          setRemovePinModalVisible(false);
          setCurrentPin('');
          setSelectedEntry(null);
        }}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Verify PIN
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Please enter your current PIN to remove protection from this journal entry.
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
              placeholder="Enter Current PIN"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              secureTextEntry
              value={currentPin}
              onChangeText={setCurrentPin}
              maxLength={4}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel, { borderColor: theme.border }]}
                onPress={() => {
                  setRemovePinModalVisible(false);
                  setCurrentPin('');
                  setSelectedEntry(null);
                }}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonSave, { backgroundColor: theme.primary }]}
                onPress={() => handleRemovePin(selectedEntry!)}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Remove PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  lockContainer: {
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
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
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  modalView: {
    margin: 20,
    borderRadius: 20,
    padding: 24,
    width: '85%',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 16
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10
  },
  button: {
    borderRadius: 8,
    padding: 12,
    width: '48%',
    alignItems: 'center'
  },
  buttonCancel: {
    borderWidth: 1,
  },
  buttonSave: {
    elevation: 2
  },
  buttonText: {
    fontWeight: "600",
    fontSize: 16
  }
});

export default HomeScreen;