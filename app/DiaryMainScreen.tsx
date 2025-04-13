import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Calendar } from 'react-native-calendars';
import Icon from 'react-native-vector-icons/Feather';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigation from './BottomNavigation';
import { fetchJournalDates } from './services/ApiService';

type RootStackParamList = {
  Home: undefined;
  FreeJournaling: { selectedDate: string };
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'FreeJournaling'>;

const DiaryMainScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const today = new Date().toISOString().split('T')[0];
  const [markedDates, setMarkedDates] = useState<{ [date: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [hasJournaledToday, setHasJournaledToday] = useState(false);

  useEffect(() => {
    const getJournalDates = async () => {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      try {
        const dates = await fetchJournalDates(token);

        const marked = dates.reduce((acc: any, date: string) => {
          acc[date] = { selected: true, marked: true, selectedColor: '#3D3D3D' };
          return acc;
        }, {});
        setMarkedDates(marked);

        const dateSet = new Set(dates);
        setHasJournaledToday(dateSet.has(today));

        let streakCount = 0;
        let currentDate = new Date();

        const formatDate = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const todayFormatted = formatDate(new Date());
        if (dateSet.has(todayFormatted)) {
          streakCount++;
        }
        currentDate.setDate(currentDate.getDate() - 1);
        while (dateSet.has(formatDate(currentDate))) {
          streakCount++;
          currentDate.setDate(currentDate.getDate() - 1);
        }

        setStreak(streakCount);
      } catch (err) {
        console.error('Error fetching journal dates:', err);
      } finally {
        setLoading(false);
      }
    };

    getJournalDates();
  }, []);

  const onDayPress = (day: { dateString: string }) => {
    if (day.dateString <= today) {
      navigation.navigate('FreeJournaling', { selectedDate: day.dateString });
    }
  };

  const flameColor = hasJournaledToday ? 'orange' : 'black';
  const quote = streak>0 ? "Keep going!" : "Start today!"

  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white', paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ padding: 10 }}>
            <Icon name="arrow-left" size={24} color="black" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center', flex: 1, marginRight: 40 }}>
            Calendar
          </Text>
        </View>

        <View style={{ marginTop: 50 }}>
          {loading ? (
            <ActivityIndicator size="large" color="#000" />
          ) : (
            <Calendar
              current={today}
              theme={{
                todayTextColor: '#000',
                todayBackgroundColor: '#E8E8E8',
                selectedDayBackgroundColor: '#3D3D3D',
                selectedDayTextColor: '#ffffff',
              }}
              markedDates={markedDates}
              onDayPress={onDayPress}
            />
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginLeft: 10 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginLeft: 5 }}>{streak}</Text>
          <MaterialCommunityIcons name="fire" size={20} color={flameColor} />
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 2 }}>{quote}</Text>
        </View>
      </SafeAreaView>

      <BottomNavigation activeScreen="DiaryMain" />
    </>
  );
};

export default DiaryMainScreen;
