import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Edit2, MessageCircle } from 'lucide-react';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  DiaryMain: undefined;
  FreeJournaling: undefined;
  Chatbot: undefined;
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'DiaryMain'>;

export const DiaryMainScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: '600' }}>April</Text>
          <TouchableOpacity>
            <Text style={{ color: '#2196F3', fontSize: 18 }}>+</Text>
          </TouchableOpacity>
        </View>

        <Calendar
          theme={{
            todayTextColor: '#000',
            todayBackgroundColor: '#E8E8E8',
            selectedDayBackgroundColor: '#2196F3',
            selectedDayTextColor: '#ffffff',
          }}
          markedDates={{
            '2024-04-13': { selected: true }
          }}
        />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 32 }}>
        <TouchableOpacity 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#E0E0E0'
          }}
          onPress={() => navigation.navigate('FreeJournaling')}
        >
          <Edit2 size={24} style={{ marginRight: 12 }} />
          <Text style={{ fontSize: 18 }}>Start Journaling</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#E0E0E0'
          }}
          onPress={() => navigation.navigate('Chatbot')}
        >
          <MessageCircle size={24} style={{ marginRight: 12 }} />
          <Text style={{ fontSize: 18 }}>Talk to Sentio</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E0E0E0' }}>
        <TouchableOpacity style={{ alignItems: 'center' }}>
          <Text style={{ color: '#2196F3' }}>Diary</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }}>
          <Text style={{ color: '#B0B0B0' }}>Analysis</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }}>
          <Text style={{ color: '#B0B0B0' }}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }}>
          <Text style={{ color: '#B0B0B0' }}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
