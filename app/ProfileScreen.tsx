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
import { fetchProfile, uploadProfileImage, updateProfile, deleteAccount, API_URL } from "./services/ApiService";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./types/types";
import { useTheme } from './context/ThemeContext';

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;

const ProfileScreen = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [isLoading, setIsLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  
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
      const currentToken = await AsyncStorage.getItem('userToken');
      console.log('Checking token for upload:', currentToken ? 'Token exists' : 'No token');

      if (!currentToken) {
        console.log('No token found for upload');
        Alert.alert('Error', 'Not authenticated. Please log in again.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
        return;
      }

      try {
        // Split and decode token
        const parts = currentToken.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid token format - token should have 3 parts');
        }

        const payload = parts[1];
        // Add padding if needed
        const paddedPayload = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
        const base64 = paddedPayload.replace(/-/g, '+').replace(/_/g, '/');
        const decodedPayload = JSON.parse(atob(base64));

        console.log("Upload token payload:", decodedPayload);
        
        const currentUserId = decodedPayload.userId || decodedPayload.sub || decodedPayload.id;
        if (!currentUserId) {
          throw new Error('No user ID found in token');
        }

        console.log('Using user ID for upload:', currentUserId);
        setIsLoading(true);
        
        // Get file size for logging
        const fileSize = await getFileSize(imageUri);
        console.log('File size before upload:', fileSize, 'bytes');
        
        // Create FormData and append the image
        const formData = new FormData();
        formData.append('profileImage', {
          uri: imageUri, // Do not strip 'file://' prefix
          type: 'image/jpeg',
          name: 'profile-image.jpg',
        } as any);

        // Log FormData contents for debugging
        console.log('FormData structure:', {
          profileImage: {
            uri: imageUri,
            type: 'image/jpeg',
            name: 'profile-image.jpg',
            size: fileSize
          }
        });

        // Updated endpoint to include user ID
        const uploadEndpoint = `${API_URL}/user/${currentUserId}/profile-image`;
        console.log('Making upload request to:', uploadEndpoint);

        try {
          const response = await fetch(uploadEndpoint, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${currentToken}`
            },
            body: formData
          });

          console.log('Response status:', response.status);
          const responseData = await response.json();
          console.log('Response data:', responseData);

          if (!response.ok) {
            throw new Error(responseData.error || 'Upload failed');
          }

          if (responseData && responseData.profileImageUrl) {
            setProfileImage(responseData.profileImageUrl);
            Alert.alert('Success', 'Profile picture updated successfully');
          } else {
            throw new Error('No profile image URL received in response');
          }
        } catch (error: any) {
          console.error('Error processing upload:', error.message);
          if (error.response?.status === 400) {
            Alert.alert(
              'Error',
              'The image could not be uploaded. Please make sure you\'ve selected a valid image file.'
            );
          } else if (error.response?.status === 500) {
            Alert.alert(
              'Error',
              'There was a problem uploading your image. Please try again later.'
            );
          } else {
            Alert.alert(
              'Error',
              error.message || 'Failed to upload profile picture'
            );
          }
          throw error;
        }
      } catch (error: any) {
        console.error('Error processing upload:', error.response?.data || error.message);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        
        if (error.response?.status === 500) {
          console.error('Server error details:', error.response?.data);
          console.error('Server error headers:', error.response?.headers);
          Alert.alert(
            'Error',
            'There was a problem uploading your image. Please try again with a different image or contact support if the problem persists.'
          );
        } else if (error.response?.status === 404) {
          Alert.alert(
            'Error',
            'The upload endpoint was not found. Please contact support.'
          );
        } else if (error.response?.status === 405) {
          Alert.alert(
            'Error',
            'The server does not accept this type of request. Please try again later.'
          );
        } else {
          Alert.alert(
            'Error',
            'Failed to upload profile picture. Please try again later.'
          );
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      if (!error.message.includes('endpoint was not found')) {
        Alert.alert(
          'Error',
          error.response?.data?.error || error.message || 'Failed to upload profile picture. Please try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get file size
  const getFileSize = async (uri: string): Promise<number> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size;
    } catch (error) {
      console.error('Error getting file size:', error);
      return 0;
    }
  };

  // Save profile changes
  const saveProfileChanges = async () => {
    if (!token) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    try {
      setIsLoading(true);
      
      const profileData = {
        name,
        bio,
        phone,
        location
      };

      await updateProfile(token, profileData); 

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
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
        <Text style={[styles.username, { color: theme.text }]}>{name}</Text>
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

      {/* Editable Section */}
      <View style={[styles.editContainer, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Edit Profile</Text>
        
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
          placeholder="Your name"
          placeholderTextColor={theme.placeholder}
          value={name}
          onChangeText={setName}
        />
        
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Bio</Text>
        <TextInput
          style={[styles.textarea, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
          placeholder="Tell us about yourself"
          placeholderTextColor={theme.placeholder}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
        />
        
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Phone</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
          placeholder="Your phone number"
          placeholderTextColor={theme.placeholder}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Location</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
          placeholder="Your location"
          placeholderTextColor={theme.placeholder}
          value={location}
          onChangeText={setLocation}
        />
        
        <TouchableOpacity style={styles.saveButton} onPress={saveProfileChanges}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => setDeleteModalVisible(true)}
        >
          <Text style={styles.deleteButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>

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
    </ScrollView>
    <BottomNavigation activeScreen="Profile" darkMode={darkMode} />
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
});

export default ProfileScreen;