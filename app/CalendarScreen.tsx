import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import axios from 'axios';
import { useTheme } from './context/ThemeContext';

type Entry = {
  _id: string;
  date: Date;
  type: 'journal' | 'checkin';
};

const CalendarScreen = () => {
  const navigation = useNavigation();
  const { theme, darkMode } = useTheme();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch entries from MongoDB
  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const response = await axios.get('YOUR_API_ENDPOINT/entries', {
          params: {
            year: currentDate.getFullYear(),
            month: currentDate.getMonth() + 1,
            filter: selectedFilter,
            sort: sortOrder
          }
        });
        setEntries(response.data);
      } catch (error) {
        console.error('Error fetching entries:', error);
      }
    };

    fetchEntries();
  }, [currentDate, selectedFilter, sortOrder]);

  // Generate calendar days
  const generateCalendarDays = () => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const days = [];
    
    // Add empty days for start of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ date: null, hasEntry: false });
    }

    // Add days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
      const hasEntry = entries.some(entry => {
        const entryDate = new Date(entry.date);
        return entryDate.getDate() === i;
      });
      days.push({ date: i, hasEntry });
    }

    return days;
  };

  const formatMonthYear = () => {
    return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
        <TouchableOpacity>
          <Icon name="search" size={24} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity>
          <Icon name="link" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={[styles.filterContainer, { backgroundColor: darkMode ? '#1a1a1a' : '#fff' }]}>
        <TouchableOpacity style={[styles.filterButton, { backgroundColor: darkMode ? '#2d2d2d' : '#f0f0f0' }]}>
          <Text style={{ color: theme.text }}>Filter</Text>
          <Icon name="chevron-down" size={16} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterButton, { backgroundColor: darkMode ? '#2d2d2d' : '#f0f0f0' }]}>
          <Text style={{ color: theme.text }}>Sort</Text>
          <Icon name="chevron-down" size={16} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.resultCount, { color: theme.placeholder }]}>{entries.length} results</Text>
      </View>

      {/* Calendar Header */}
      <View style={[styles.calendarHeader, { backgroundColor: darkMode ? '#1a1a1a' : '#fff' }]}>
        <Text style={[styles.monthYear, { color: theme.text }]}>{formatMonthYear()}</Text>
        <View style={styles.monthControls}>
          <TouchableOpacity onPress={prevMonth}>
            <Icon name="chevron-left" size={24} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={nextMonth}>
            <Icon name="chevron-right" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Weekday Headers */}
      <View style={[styles.weekdayHeader, { 
        borderBottomColor: theme.border,
        backgroundColor: darkMode ? '#1a1a1a' : '#fff'
      }]}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <Text key={day} style={[styles.weekdayText, { color: theme.placeholder }]}>{day}</Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={[styles.calendarGrid, { backgroundColor: darkMode ? '#1a1a1a' : '#fff' }]}>
        {generateCalendarDays().map((day, index) => (
          <TouchableOpacity 
            key={index}
            style={[
              styles.dayCell,
              { backgroundColor: darkMode ? '#1a1a1a' : '#fff' },
              day.hasEntry && [styles.dayWithEntry, { backgroundColor: darkMode ? '#404040' : '#000' }]
            ]}
          >
            <Text style={[
              styles.dayText,
              { color: theme.text },
              day.hasEntry && styles.dayWithEntryText
            ]}>
              {day.date}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Streak Footer */}
      <View style={[styles.footer, { 
        borderTopColor: theme.border,
        backgroundColor: darkMode ? '#1a1a1a' : '#fff'
      }]}>
        <View style={styles.streakContainer}>
          <Icon name="clock" size={20} color={theme.text} />
          <Text style={[styles.streakText, { color: theme.text }]}>3</Text>
          <Icon name="droplet" size={20} color={theme.text} />
          <Text style={[styles.streakMessage, { color: theme.placeholder }]}>Keep going ...</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  resultCount: {
    marginLeft: 'auto',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  monthYear: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  monthControls: {
    flexDirection: 'row',
    gap: 16,
  },
  weekdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayWithEntry: {
    borderRadius: 20,
    margin: 2,
  },
  dayText: {
    fontSize: 16,
  },
  dayWithEntryText: {
    color: '#fff',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '500',
  },
  streakMessage: {
    fontSize: 14,
  },
});

export default CalendarScreen;