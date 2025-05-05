import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  useColorScheme,
  Dimensions,
  Platform,
  Animated,
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from "expo-media-library";
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from './BottomNavigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { fetchProfile, uploadProfileImage, updateProfile, deleteAccount, API_URL, fetchEarnedBadges } from "./services/ApiService";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./types/types";
import { useTheme } from './context/ThemeContext';
import EditProfileModal from './EditProfileModal';
import LockedJournalBadge from './badges/locked_journal.png';
import FreeformBadge from './badges/freeform.png';
import GuidedBadge from './badges/guided.png';
import QuickBadge from './badges/quick.png';
import PromptWandererBadge from './badges/promptwanderer-Photoroom.png';
import EmotionExplorerBadge from './badges/emotion_explorer.png';
import MoodShifterBadge from './badges/mood_shifter.png';
import LetItOutBadge from './badges/Let_itout.png';
import ImageStorytellerBadge from './badges/image_stroyteller.png';
import NightOwl from './badges/night_owl.png';
import EarlyBird from './badges/early_bird.png';
import OneYear from './badges/one_year.png';
declare module '*.png';

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;

const ProfileScreen = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [isLoading, setIsLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [modal_Visible_edit, setModal_Visible_edit] = useState(false);

  // Profile data
  const [userId, setUserId] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  
  // App preferences
  const { darkMode, theme, toggleDarkMode } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  
  // New states for skeleton animation
  const [imageLoading, setImageLoading] = useState(true);
  const pulseAnim = new Animated.Value(0);

  const [selectedBadge, setSelectedBadge] = useState<null | number>(null);
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);

  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);

  const badgeData = [
    {
      key: "freeform",
      image: FreeformBadge,
      description: "Write your first freeform journal to unlock this badge.",
    },
    
    {
      key: "guided",
      image: GuidedBadge,
      description: "Complete your first guided journal to earn this badge.",
    },
    {
      key: "quick",
      image: QuickBadge,
      description: "Write a quick freeform journal entry to get this badge.",
    },
    {
      key: "locked_journal",
      image: LockedJournalBadge,
      description: "Lock any journal entry to earn this badge.",
    },
    {
      key: "prompt_wanderer",
      image: PromptWandererBadge,
      description: "Explore all prompt types in guided journaling to unlock this badge.",
    },
    {
      key: "emotion_explorer",
      image: EmotionExplorerBadge,
      description: "Trigger detection of 3 or more emotions in a single entry to earn this badge.",
    },
    {
      key: "mood_shifter",
      image: MoodShifterBadge,
      description: "Unlock this badge by expressing both positive and negative emotions in the same journal entry.",
    },    
    {
      key: "let_it_out",
      image: LetItOutBadge,
      description: "Express strong emotions like anger or frustration in your journal to earn this badge.",
    },
    {
      key: "image_storyteller",
      image: ImageStorytellerBadge,
      description: "Add an image and tell a story around it to unlock this badge.",
    },
    {
      key: "early_bird",
      image: EarlyBird,
      description: "Write a journal entry between 4:00 AM and 8:00 AM to earn this badge.",
    },
    {
      key: "night_owl",
      image: NightOwl,
      description: "Write a journal entry between 11:00 PM and 2:00 AM to unlock this badge.",
    },
    {
      key: "one_year",
      image: OneYear,
      description: "Keep journaling consistently for 365 days to earn this milestone badge.",
    }
  ];
  
  
  // Example from backend
  
  useEffect(() => {
    const initializeProfile = async () => {
      try {
        // First check if user is authenticated
        const userToken = await AsyncStorage.getItem('userToken');
        console.log("Checking token:", userToken ? "Found token" : "No token found");

        if (!userToken) {
          console.log("No token found, redirecting to login");
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
          return;
        }

        // Store token in state first
        setToken(userToken);

        // Get user ID from token payload
        try {
          // Split the token and get the payload
          const parts = userToken.split('.');
          console.log("Token parts length:", parts.length);
          
          if (parts.length !== 3) {
            throw new Error('Invalid token format - token should have 3 parts');
          }

          // Decode the payload
          const payload = parts[1];
          console.log("Raw payload:", payload);
          
          // Add padding if needed
          const paddedPayload = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
          
          // First try standard base64 decode
          let decodedPayload;
          try {
            const base64 = paddedPayload.replace(/-/g, '+').replace(/_/g, '/');
            const jsonStr = atob(base64);
            decodedPayload = JSON.parse(jsonStr);
          } catch (e) {
            console.log("Standard decode failed, trying URL decode:", e);
            // If that fails, try URL decode
            const jsonStr = decodeURIComponent(
              atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'))
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            decodedPayload = JSON.parse(jsonStr);
          }

          console.log("Decoded payload:", decodedPayload);
          
          const userId = decodedPayload.userId || decodedPayload.sub || decodedPayload.id;
          if (!userId) {
            console.log("Available fields in payload:", Object.keys(decodedPayload));
            throw new Error('No user ID found in token payload');
          }
          
          console.log("Extracted user ID:", userId);
          setUserId(userId);

          // Load user profile data
          const response = await fetchProfile(userToken);
          console.log("Profile data loaded successfully");
          
          setEmail(response.email || '');
          setName(response.name || '');
          setBio(response.bio || '');
          setPhone(response.phone || '');
          setLocation(response.location || '');
          setProfileImage(response.profileImageUrl || null);
        } catch (tokenError) {
          console.error("Error parsing token:", tokenError);
          Alert.alert(
            'Authentication Error',
            'Your session appears to be invalid. Please log in again.',
            [
              {
                text: 'OK',
                onPress: () => {
                  AsyncStorage.clear();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                }
              }
            ]
          );
        }
      } catch (error) {
        console.error('Error initializing profile:', error);
        Alert.alert(
          'Error',
          'Failed to load profile. Please try logging in again.',
          [
            {
              text: 'OK',
              onPress: () => {
                AsyncStorage.clear();
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }
            }
          ]
        );
      }
    };

    requestPermissions();
    initializeProfile();
    loadAppPreferences();
  }, []);

  // Load app preferences from AsyncStorage
  const loadAppPreferences = async () => {
    try {
      const storedDarkMode = await AsyncStorage.getItem('darkMode');
      if (storedDarkMode !== null) {
        // Only set dark mode if it's different from current state
        if (darkMode !== (storedDarkMode === 'true')) {
          toggleDarkMode();
        }
      }
    } catch (error) {
      console.error('Error loading app preferences:', error);
    }
  };

  // Request permissions for Media Library
  const requestPermissions = async () => {
    console.log('Requesting permissions...');
    const mediaLibrary = await MediaLibrary.requestPermissionsAsync();
    console.log('MediaLibrary permission result:', mediaLibrary);
  };

  // Pick an image from the gallery
  const pickImage = async () => {
    try {
      console.log('Starting image picker...');
      setModalVisible(false);
      
      // Wait for modal animation to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('Selected image:', result.assets[0].uri);
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image from gallery');
    }
  };

  // Take a photo using the camera
  const takePhoto = async () => {
    try {
      console.log('Starting camera...');
      setModalVisible(false);
      
      // Wait for modal animation to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('Camera result:', result);

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('Captured photo:', result.assets[0].uri);
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Upload image to server (S3 via backend)
  const uploadImage = async (imageUri: string) => {
    try {
      setIsLoading(true);
      console.log('Starting profile image upload for URI:', imageUri);
      
      const profileImageUrl = await uploadProfileImage(imageUri);
      console.log('Profile image upload successful:', profileImageUrl);
      
      setProfileImage(profileImageUrl);
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('Error uploading profile image:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to upload profile picture. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfileChanges = async () => {
    if (!token) {
      Alert.alert('Error', 'Not authenticated');
      throw new Error('No token');
    }
  
    setIsLoading(true);
  
    const profileData = {
      name,
      bio,
      phone,
      location,
    };
  
    try {
      await updateProfile(token, profileData);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  
  
  

  // Delete account
  const handledeleteAccount = async () => {
    if (!token) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    try {
      setIsLoading(true);
      setDeleteModalVisible(false);
      // Delete the account 
      await deleteAccount(token); 
      // Clear local storage
      await AsyncStorage.clear();
      
      // Navigate to login
      Alert.alert('Account Deleted', 'Your account has been deleted successfully');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Failed to delete account');
      setIsLoading(false);
    }
  };

  // Add this effect for the skeleton animation
  useEffect(() => {
    const pulsate = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => pulsate());
    };

    pulsate();
  }, []);

  // Replace saveAppPreferences with toggleDarkMode
  const handleThemeToggle = () => {
    toggleDarkMode();
  };

  useEffect(() => {
    
    const loadEarnedBadges = async () => {
      if (!token || !userId) {
        console.warn("Token or user ID not available");
        return;
      }
  
      try {
        const earnedBadges = await fetchEarnedBadges(token, userId);
        setEarnedBadges(earnedBadges);
      } catch (error) {
        console.error("Error fetching earned badges:", error);
        Alert.alert("Error", "Could not load earned badges.");
      }
    };
  
    loadEarnedBadges();
  }, [token, userId]);
  

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <>
    <ScrollView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Profile Display Section */}
      <View style={[styles.profileContainer, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarContainer}>
            {imageLoading && !profileImage && (
              <Animated.View
                style={[
                  styles.skeletonLoader,
                  {
                    opacity: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.7],
                    }),
                  },
                ]}
              />
            )}
            {profileImage ? (
              <TouchableOpacity
                onPress={() => setModalVisible(true)}
              >
                <Image
                  source={{ uri: profileImage }}
                  style={[styles.avatar, { backgroundColor: 'transparent' }]}
                  onLoadStart={() => setImageLoading(true)}
                  onLoadEnd={() => setImageLoading(false)}
                />
              </TouchableOpacity>
            ) : (
              <View style={[styles.skeletonAvatar, { backgroundColor: theme.cardBackground }]}>
                <Ionicons name="person" size={40} color={theme.textSecondary} />
              </View>
            )}
          </View>
          <View style={[styles.editIcon, { backgroundColor: theme.backgroundColor, borderColor: theme.border }]}>
            <Ionicons name="camera-outline" size={18} color={theme.text} />
          </View>
        </View>
        <View style={styles.usernameContainer}>
        <Text style={[styles.username, { color: theme.text }]}>{name}</Text>
         <TouchableOpacity onPress={() => setModal_Visible_edit(true)} style={styles.editButton}>
            <Ionicons name="pencil-outline" size={20} color={theme.icon} />
          </TouchableOpacity>
        </View>
        

        
        <Text style={[styles.bio, { color: theme.textSecondary }]}>{bio}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={18} color={theme.icon} />
          <Text style={[styles.infoText, { color: theme.text }]}>{email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={18} color={theme.icon} />
          <Text style={[styles.infoText, { color: theme.text }]}>{phone}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={18} color={theme.icon} />
          <Text style={[styles.infoText, { color: theme.text }]}>{location}</Text>
        </View>

        <View style={styles.toggleRow}>
          <Ionicons name="moon-outline" size={18} color={theme.icon} />
          <Text style={[styles.infoText, { color: theme.text }]}>Dark Mode</Text>
          <Switch 
            value={darkMode} 
            onValueChange={handleThemeToggle} 
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={darkMode ? "#f5dd4b" : "#f4f3f4"}
          />
        </View>
      </View>

      <View style={[styles.badgesSection, { borderBottomWidth: 1 }]}>
        <Text style={[styles.badgesTitle, { color: theme.text }]}>Badges</Text>
        <View style={styles.badgesRow}>
          {badgeData.map((badge, idx) => (
           <TouchableOpacity
           key={idx}
           style={styles.badgeItem}
           onPress={() => {
             setSelectedBadge(idx);
             setBadgeModalVisible(true);
           }}
         >
           <Image
             source={badge.image}
             style={[
               styles.badgeImage,
               !earnedBadges.includes(badge.key) && { opacity: 0.3 }
             ]}
           />
         </TouchableOpacity>
         
         
          ))}
        </View>
      </View>
        
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => setDeleteModalVisible(true)}
        >
          <Text style={styles.deleteButtonText}>Delete Account</Text>
        </TouchableOpacity>

      {/* Image Picker Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Update Profile Picture</Text>
            <TouchableOpacity
              onPress={takePhoto}
              style={styles.modalButton}
            >
              <Ionicons name="camera" size={20} color={theme.text} />
              <Text style={[styles.modalText, { color: theme.text }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickImage}
              style={styles.modalButton}
            >
              <Ionicons name="image" size={20} color={theme.text} />
              <Text style={[styles.modalText, { color: theme.text }]}>Photo Library</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalCancel}
            >
              <Text style={[styles.modalCancelText, { color: theme.danger }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Delete Account Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.danger }]}>Delete Account</Text>
            <Text style={[styles.modalMessage, { color: theme.text }]}>
              This action cannot be undone. All your data will be permanently deleted.
            </Text>
            <TouchableOpacity
              onPress={handledeleteAccount}
              style={[styles.modalDeleteButton, { backgroundColor: theme.danger }]}
            >
              <Text style={styles.modalDeleteText}>Delete My Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDeleteModalVisible(false)}
              style={styles.modalCancel}
            >
              <Text style={[styles.modalCancelText, { color: theme.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={badgeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBadgeModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.7)",
          justifyContent: "center",
          alignItems: "center"
        }}>
          <View style={{
            backgroundColor: theme.cardBackground,
            padding: 24,
            borderRadius: 16,
            alignItems: "center",
            maxWidth: "80%"
          }}>
            {selectedBadge !== null && (
              <>
                <Image source={badgeData[selectedBadge].image} style={{ width: 80, height: 80, marginBottom: 16 }} />
                <Text style={{ color: theme.text, fontSize: 16, textAlign: "center", marginBottom: 16 }}>
                  {badgeData[selectedBadge].description}
                </Text>
                <TouchableOpacity onPress={() => setBadgeModalVisible(false)}>
                  <Text style={{ color: theme.primary, fontWeight: "bold", fontSize: 16 }}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
    <BottomNavigation activeScreen="Profile" darkMode={darkMode} />
    <EditProfileModal
      modal_Visible_edit={modal_Visible_edit}
      setModal_Visible_edit={setModal_Visible_edit}
      onClose={() => setModal_Visible_edit(false)}
      name={name}
      setName={setName}
      bio={bio}
      setBio={setBio}
      phone={phone}
      setPhone={setPhone}
      location={location}
      setLocation={setLocation}
      saveProfileChanges={saveProfileChanges}
      theme={theme}
      token={token || ''}
    />
    </>
  );
};

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  profileContainer: {
    alignItems: "center",
    padding: 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 15,
  },
  avatarWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  avatarContainer: {
    position: 'relative',
    width: isSmallDevice ? 100 : 120,
    height: isSmallDevice ? 100 : 120,
    borderRadius: isSmallDevice ? 50 : 60,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  avatar: { 
    width: '100%',
    height: '100%',
    borderRadius: isSmallDevice ? 50 : 60,
    backgroundColor: 'transparent',
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
  },
  editIcon: {
    position: "absolute",
    bottom: 5,
    right: 5,
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
  },
  username: { 
    fontSize: isSmallDevice ? 18 : 20, 
    fontWeight: "bold", 
    marginTop: 5 
  },
  bio: { 
    marginBottom: 10, 
    textAlign: "center", 
    fontSize: isSmallDevice ? 13 : 14,
    paddingHorizontal: 20
  },
  infoRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginVertical: 4,
    width: '80%'
  },
  infoText: { 
    fontSize: isSmallDevice ? 14 : 15, 
    marginLeft: 10, 
    flex: 1
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 75, 
  },  
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "80%",
    marginTop: 15,
  },
  editContainer: { 
    padding: 15,
    paddingBottom: 40 
  },

  
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: "bold", 
    marginBottom: 12 
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    padding: isSmallDevice ? 8 : 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  textarea: {
    borderWidth: 1,
    padding: isSmallDevice ? 8 : 10,
    borderRadius: 5,
    marginBottom: 15,
    textAlignVertical: 'top',
    minHeight: 80
  },
  saveButton: {
    backgroundColor: "#3498DB",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10
  },
  saveButtonText: { 
    color: "white", 
    fontSize: 14, 
    fontWeight: "bold" 
  },
  deleteButton: {
    backgroundColor: "transparent",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20
  },
  deleteButtonText: { 
    color: "#E74C3C", 
    fontSize: 14, 
    fontWeight: "bold" 
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    padding: 20,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15
  },
  modalMessage: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20
  },
  modalButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    width: '100%'
  },
  modalText: { 
    fontSize: 16, 
    marginLeft: 10 
  },
  modalCancel: { 
    padding: 15, 
    alignItems: "center" 
  },
  modalCancelText: {
    fontSize: 16
  },
  modalDeleteButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    width: '100%'
  },
  modalDeleteText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold"
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 1000,
  },
  skeletonLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#E1E9EE',
    zIndex: 1,
  },
  skeletonAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: isSmallDevice ? 50 : 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E1E9EE',
  },
  editButton: {
    marginLeft: 10,
    padding: 5,
  },
  badgesSection: {
    padding: 15,
    borderBottomWidth: 1,
  },
  badgesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badgeLocked: {
    tintColor: 'gray',
  }
  
,  
  badgeItem: {
    width: 80,
    alignItems: 'center',
    marginVertical: 10,
    marginHorizontal: 5,
  },
  badgeImage: {
    width: 70,
    height: 70,
    margin: 10,
  },
  badgeLabel: {
    fontSize: 14,
  },
});

export default ProfileScreen;