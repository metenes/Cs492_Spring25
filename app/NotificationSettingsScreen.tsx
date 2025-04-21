import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from './BottomNavigation';
import { Picker } from '@react-native-picker/picker';
import { updateNotificationFrequency } from './services/ApiService';

type RootStackParamList = {
  NotificationSettings: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'NotificationSettings'>;

export const NotificationSettingsScreen = () => {
  const [frequency, setFrequency] = useState("daily");
  const navigation = useNavigation<NavigationProp>();

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
      <View style={{ flex: 1, backgroundColor: '#F8F8F8' }}>
        <View style={{ backgroundColor: 'white', padding: 16, marginTop: 16 }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 2 }}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
          <View style={{ marginTop: 50 }}>
            <Text style={styles.label}>Journal Reminder Frequency</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={frequency}
                onValueChange={(itemValue) => handleSelection(itemValue)}
              >
                <Picker.Item label="Daily" value="daily" />
                <Picker.Item label="Weekly" value="weekly" />
                <Picker.Item label="Never" value="never" />
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
    borderColor: "#ccc",
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
  }
});
