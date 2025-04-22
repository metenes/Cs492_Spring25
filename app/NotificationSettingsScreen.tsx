import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from './BottomNavigation';
import { Picker } from '@react-native-picker/picker';
import { updateNotificationFrequency } from './services/ApiService';
import { useTheme } from './context/ThemeContext';

type RootStackParamList = {
  NotificationSettings: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'NotificationSettings'>;

export const NotificationSettingsScreen = () => {
  const [frequency, setFrequency] = useState("daily");
  const navigation = useNavigation<NavigationProp>();
  const { theme, darkMode } = useTheme();

  const handleSelection = async (value: string) => {
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
    }
  };

  return (
    <>
      <View style={{ flex: 1, backgroundColor: theme.backgroundColor }}>
        <View style={{ 
          backgroundColor: darkMode ? '#1a1a1a' : theme.backgroundColor, 
          padding: 16, 
          marginTop: 16 
        }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: 2 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
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
              >
                <Picker.Item label="Daily" value="daily" color={theme.text} />
                <Picker.Item label="Weekly" value="weekly" color={theme.text} />
                <Picker.Item label="Never" value="never" color={theme.text} />
              </Picker>
            </View>
          </View>
        </View>
      </View>
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
