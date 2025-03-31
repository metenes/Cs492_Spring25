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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MediaType } from 'expo-image-picker';

import { Ionicons } from "@expo/vector-icons";
import BottomNavigation from './BottomNavigation';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { fetchProfile , uploadProfileImage, updateProfile, deleteAccount} from "./services/ApiService";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./types/types";

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;


const ProfileScreen = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const systemColorScheme = useColorScheme();
  const [isLoading, setIsLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  
  // Profile data
  const [userId, setUserId] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // App preferences
  const [darkMode, setDarkMode] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [token, setToken] = useState("");
  
  // Determine current theme
  const theme = darkMode ? darkTheme : lightTheme;

  useEffect(() => {
    requestPermissions();
    loadUserData();
    loadAppPreferences();
  }, []);

  // Load user data from API
  const loadUserData = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      console.log("🔹 retrive token to fetch profile:", token);
      if (token ) {
        console.log("🔹 Using token to fetch profile:", token);
        setToken(token);
        const response = fetchProfile(token); 
        
        setEmail((await response).email || '');
        setName((await response).name || '');
        setBio((await response).bio || '');
        setPhone((await response).phone || '');
        setLocation((await response).location || '');
        setProfileImage((await response).profileImageUrl || null);
      } else {
        // Redirect to login if no token found
        navigation.navigate('Login');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load app preferences from AsyncStorage
  const loadAppPreferences = async () => {
    try {
      const storedDarkMode = await AsyncStorage.getItem('darkMode');
      if (storedDarkMode !== null) {
        setDarkMode(storedDarkMode === 'true');
      } else {
        // Use system default if no preference saved
        setDarkMode(systemColorScheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading app preferences:', error);
    }
  };

  // Save app preferences to AsyncStorage
  const saveAppPreferences = async (isDarkMode: boolean | ((prevState: boolean) => boolean)) => {
    try {
      await AsyncStorage.setItem('darkMode', isDarkMode.toString());
      setDarkMode(isDarkMode);
    } catch (error) {
      console.error('Error saving app preferences:', error);
    }
  };

  // Request permissions for Camera & Media Library
  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || mediaStatus !== "granted") {
      Alert.alert("Permissions Required", "Please enable camera and gallery permissions in settings.");
    }
  };

  // Pick an image from the gallery (only one image)
  const pickImage = async () => {
    setModalVisible(false);

    // Option 1: Using the enum without array
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      await uploadImage(result.assets[0].uri);
    }
  };

  // Take a photo using the camera
  const takePhoto = async () => {
    setModalVisible(false);

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1], // Crop to square
      quality: 0.8,
    });

    if (!result.canceled) {
      await uploadImage(result.assets[0].uri);
    }
  };

  // Upload image to server (S3 via backend)
  const uploadImage = async (imageUri : any) => {
    try {
      setIsLoading(true);
      
      // Create form data for image upload
      const formData = new FormData();
      const filename = imageUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : 'image';
      formData.append('profileImage', {
        uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
        name: filename,
        type,
      } as any);

      // Send to server
      const response = await axios.post(`/api/users/${userId}/profile-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data && response.data.profileImageUrl) {
        setProfileImage(response.data.profileImageUrl);
        Alert.alert('Success', 'Profile picture updated successfully');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload profile picture');
    } finally {
      setIsLoading(false);
    }
  };

  // Save profile changes
  const saveProfileChanges = async () => {
    // Validate inputs
    if (newPassword && newPassword !== confirmPassword) {
      return Alert.alert('Error', 'Passwords do not match');
    }

    try {
      setIsLoading(true);
      
      const profileData = {
        name,
        bio,
        phone,
        location,
        ...(newPassword ? { password: newPassword } : {})
      };

      updateProfile(token, profileData); 

      Alert.alert('Success', 'Profile updated successfully');
      // Reset tje password field
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete account
  const handledeleteAccount = async () => {
    try {
      setIsLoading(true);
      setDeleteModalVisible(false);
      // Delete the account 
      deleteAccount(token); 
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
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <View style={styles.avatarWrapper}>
            <Image
              source={
                profileImage
                  ? { uri: profileImage }
                  : require("../assets/default-avatar.jpeg")
              }
              style={styles.avatar}
            />
            <View style={[styles.editIcon, { backgroundColor: theme.backgroundColor, borderColor: theme.border }]}>
              <Ionicons name="camera-outline" size={18} color={theme.text} />
            </View>
          </View>
        </TouchableOpacity>
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
            onValueChange={(value) => saveAppPreferences(value)} 
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
        
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 16 }]}>Change Password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
          placeholder="Enter new password"
          placeholderTextColor={theme.placeholder}
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
          placeholder="Retype new password"
          placeholderTextColor={theme.placeholder}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
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

// Theme configurations
const lightTheme = {
  backgroundColor: '#FFFFFF',
  cardBackground: '#F9F9F9',
  inputBackground: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  border: '#CCCCCC',
  primary: '#3498DB',
  danger: '#E74C3C',
  icon: '#555555',
  placeholder: '#AAAAAA'
};

const darkTheme = {
  backgroundColor: '#121212',
  cardBackground: '#1E1E1E',
  inputBackground: '#2C2C2C',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  border: '#444444',
  primary: '#3498DB',
  danger: '#E74C3C',
  icon: '#BBBBBB',
  placeholder: '#777777'
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
  avatar: { 
    width: isSmallDevice ? 100 : 120, 
    height: isSmallDevice ? 100 : 120, 
    borderRadius: isSmallDevice ? 50 : 60 
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
  }
});

export default ProfileScreen;