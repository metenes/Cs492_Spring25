import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from './BottomNavigation';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from './context/ThemeContext';
import { updateNotificationFrequency, fetchNotificationPreferences } from './services/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  NotificationSettings: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'NotificationSettings'>;

export const NotificationSettingsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [frequency, setFrequency] = useState("daily");
  const navigation = useNavigation<NavigationProp>();
  const { theme, darkMode } = useTheme();
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchPushToken = async () => {
      const token = await AsyncStorage.getItem("expoPushToken");
      setPushToken(token);
    };
    fetchPushToken();
  }, []);


  useEffect(() => {
    fetchData();
  }, []);

  const handleSelection = async (value: string) => {
    setLoading(true);
    setFrequency(value);
    try {
      const response = await updateNotificationFrequency(value);
      if (response.status === 200) {
        alert("Notification frequency updated successfully.");
      } else {
        alert("Failed to update notification frequency.");
      }
    } catch (error) {
      console.error("Error updating notification frequency:", error);
      alert("An error occurred while updating notification frequency.");
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const response = await fetchNotificationPreferences();
      console.log("Notification preferences fetched:", response);
      if (response.status === 200) {
        console.log("Notification preferences fetched successfully.");
        setFrequency(response.preference);
      } else {
        console.error("Failed to fetch notification preferences.");
      }
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!loading ? (
        <View style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
          <View style={{ 
            backgroundColor: darkMode ? '#1a1a1a' : theme.backgroundColor, 
            padding: 16, 
            marginTop: 16 
          }}>
            <View style={{ marginTop: 50 }}>
              <Text style={[styles.label, { color: theme.text }]}>Journal Reminder Frequency</Text>
              <View style={[
                styles.pickerContainer,
                { 
                  borderColor: theme.border,
                  backgroundColor: darkMode ? '#2d2d2d' : '#f0f0f0'
                }
              ]}>
                <Picker
                  selectedValue={frequency}
                  onValueChange={(itemValue) => handleSelection(itemValue)}
                  style={{ color: theme.text }}
                  aria-disabled={!pushToken}
                >
                  <Picker.Item label="Daily" value="daily" color={theme.text} />
                  <Picker.Item label="Weekly" value="weekly" color={theme.text} />
                  <Picker.Item label="Never" value="never" color={theme.text} />
                </Picker>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.backgroundColor }}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      )}
      <BottomNavigation activeScreen="Settings" />
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 6,
  }
});
