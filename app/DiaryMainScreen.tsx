import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { Calendar } from 'react-native-calendars';
import Icon from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// Define navigation types
type RootStackParamList = {
  Home: undefined;
  FreeJournaling: { selectedDate: string };
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'FreeJournaling'>;

const DiaryMainScreen = () => {

  const navigation = useNavigation<NavigationProp>();

  const today = new Date().toISOString().split('T')[0];

  // Hardcoded dates where the user has journaled
  const journaledDates = {
    '2025-02-12': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-02-13': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-02-14': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-02-15': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-02-16': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-01-02': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-01-03': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-01-04': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-01-08': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-01-14': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-01-15': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-01-17': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-01-18': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-01-19': { selected: true, marked: true, selectedColor: '#3D3D3D' },
    '2025-01-20': { selected: true, marked: true, selectedColor: '#000' }, // Highlighted as the latest journaled day
  };

  const streakCount = 5; // Hardcoded streak count

  // Function to handle day press
  const onDayPress = (day: { dateString: string }) => {
    if (day.dateString <= today) {
      // Navigate to FreeJournaling screen with selectedDate as a parameter
      navigation.navigate('FreeJournaling', { selectedDate: day.dateString });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white', paddingHorizontal: 16 }}>
      
      {/* Search Bar */}
      {/* <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F2', padding: 10, borderRadius: 8, marginTop: 10 }}>
        <Icon name="search" size={20} color="gray" style={{ marginRight: 8 }} />
        <TextInput placeholder="Search" style={{ flex: 1, fontSize: 16 }} />
        <TouchableOpacity>
          <Icon name="paperclip" size={20} color="gray" />
        </TouchableOpacity>
      </View> */}

      {/* Filter & Sort Buttons */}
      {/* <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 }}>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity style={{ backgroundColor: '#E0E0E0', padding: 8, borderRadius: 6, marginRight: 10, marginLeft: 10}}>
            <Text style={{ fontSize: 14 }}>Filter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ backgroundColor: '#E0E0E0', padding: 8, borderRadius: 6 }}>
            <Text style={{ fontSize: 14 }}>Sort</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 14, color: 'gray' }}></Text>
      </View> */}


      {/* Back Button */}
      {/* <TouchableOpacity
        onPress={() => navigation.navigate('Home')}
        style={{ position: 'absolute', left: 10, zIndex: 10}}
      >
        <Icon name="arrow-left" size={24} color="black" />
      </TouchableOpacity> */}

      {/* Header with Back Button and Calendar Label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        {/* Back Button */}
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ padding: 10 }}>
          <Icon name="arrow-left" size={24} color="black" />
        </TouchableOpacity>
        
        {/* Title */}
        <Text style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center', flex: 1, marginRight: 40 }}>
          Calendar
        </Text>
      </View>

      {/* Calendar */}
      <View style={{ marginTop: 50 }}>
        <Calendar
          current={'2025-02-17'}
          theme={{
            todayTextColor: '#000',
            todayBackgroundColor: '#E8E8E8',
            selectedDayBackgroundColor: '#3D3D3D',
            selectedDayTextColor: '#ffffff',
          }}
          markedDates={journaledDates}
          onDayPress={onDayPress} // Handle date selection
        />
      </View>

      {/* Streak Section */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginLeft: 10 }}>
        {/* <Icon name="smile" size={20} color="black" /> */}
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginLeft: 5 }}>{streakCount}</Text>
        <MaterialCommunityIcons name="fire" size={20} color="black" /* style={{ marginLeft: 5 }}  *//>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 2 }}>Keep going!</Text>
      </View>

      {/* Bottom Navigation */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E0E0E0', marginTop: 'auto' }}>
        <TouchableOpacity style={{ alignItems: 'center' }}>
          <Icon name="book" size={24} color="#2196F3" />
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }}>
          <Icon name="bar-chart-2" size={24} color="#B0B0B0" />
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }}>
          <Icon name="user" size={24} color="#B0B0B0" />
        </TouchableOpacity>
        <TouchableOpacity style={{ alignItems: 'center' }}>
          <Icon name="settings" size={24} color="#B0B0B0" />
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
};

export default DiaryMainScreen;
