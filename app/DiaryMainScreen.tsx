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
import { useTheme } from './context/ThemeContext';

type RootStackParamList = {
  Home: undefined;
  FreeJournaling: { selectedDate: string };
};

type NavigationProp = StackNavigationProp<RootStackParamList, 'FreeJournaling'>;

const DiaryMainScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { theme, darkMode } = useTheme();
  const today = new Date().toISOString().split('T')[0];
  const [markedDates, setMarkedDates] = useState<{ [date: string]: any }>({});
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [hasJournaledToday, setHasJournaledToday] = useState(false);
  // For paging and limit 
  const [limit] = useState(30); // entries per page
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true); // disable loading when all loaded

  useEffect(() => {
    const getJournalDates = async () => {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      try {
        const dates = await fetchJournalDates(token, limit, skip);
        if (dates.length < limit) setHasMore(false); // no more data
        
        /* 
        const marked = dates.reduce((acc: any, date: string) => {
          acc[date] = { selected: true, marked: true, selectedColor: '#3D3D3D' };
          return acc;
        }, {});
        setMarkedDates(marked);
        */ 
        setMarkedDates(prev => ({
          ...prev,
          ...dates.reduce((acc: any, date: string) => {
            acc[date] = { selected: true, marked: true, selectedColor: '#3D3D3D' };
            return acc;
          }, {})
        }));
  
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
  }, [skip]);

  const onDayPress = (day: { dateString: string }) => {
    if (day.dateString <= today) {
      navigation.navigate('FreeJournaling', { selectedDate: day.dateString });
    }
  };

  const flameColor = hasJournaledToday ? 'orange' : darkMode ? theme.placeholder : 'black';
  const quote = streak > 0 ? "Keep going!" : "Start today!";

  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundColor, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ padding: 10 }}>
            <Icon name="arrow-left" size={24} color={theme.text} />
            </TouchableOpacity>
            {hasMore && (
                <TouchableOpacity onPress={() => setSkip(prev => prev + limit)}>
                  <Text style={{ textAlign: 'center', color: 'blue' }}>Load More</Text>
                </TouchableOpacity>
            )}
          <Text style={{ 
            fontSize: 20, 
            fontWeight: 'bold', 
            textAlign: 'center', 
            flex: 1, 
            marginRight: 40,
            color: theme.text 
          }}>
            Calendar
          </Text>
        </View>

        <View style={{ marginTop: 50 }}>
          {loading ? (
            <ActivityIndicator size="large" color={theme.text} />
          ) : (
            <Calendar
              current={today}
              theme={{
                backgroundColor: theme.backgroundColor,
                calendarBackground: theme.backgroundColor,
                textSectionTitleColor: theme.text,
                selectedDayBackgroundColor: darkMode ? '#404040' : '#3D3D3D',
                selectedDayTextColor: '#ffffff',
                todayTextColor: theme.text,
                dayTextColor: theme.text,
                textDisabledColor: theme.placeholder,
                dotColor: theme.text,
                selectedDotColor: '#ffffff',
                arrowColor: theme.text,
                monthTextColor: theme.text,
                indicatorColor: theme.text,
                textDayFontWeight: '300',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '300',
                textDayFontSize: 16,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 16
              }}
              markedDates={markedDates}
              onDayPress={onDayPress}
            />
          )}
        </View>

        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          marginTop: 20, 
          marginLeft: 10 
        }}>
          <Text style={{ 
            fontSize: 20, 
            fontWeight: 'bold', 
            marginLeft: 5,
            color: theme.text 
          }}>
            {streak}
          </Text>
          <MaterialCommunityIcons name="fire" size={20} color={flameColor} />
          <Text style={{ 
            fontSize: 18, 
            fontWeight: 'bold', 
            marginLeft: 2,
            color: theme.text 
          }}>
            {quote}
          </Text>
        </View>
      </SafeAreaView>

      <BottomNavigation activeScreen="DiaryMain" />
    </>
  );
};

export default DiaryMainScreen;
