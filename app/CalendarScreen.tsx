import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import axios from 'axios';

type Entry = {
  _id: string;
  date: Date;
  type: 'journal' | 'checkin';
};

const CalendarScreen = () => {
  const navigation = useNavigation();
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Icon name="search" size={24} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity>
          <Icon name="link" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <TouchableOpacity style={styles.filterButton}>
          <Text>Filter</Text>
          <Icon name="chevron-down" size={16} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Text>Sort</Text>
          <Icon name="chevron-down" size={16} color="#000" />
        </TouchableOpacity>
        <Text style={styles.resultCount}>{entries.length} results</Text>
      </View>

      {/* Calendar Header */}
      <View style={styles.calendarHeader}>
        <Text style={styles.monthYear}>{formatMonthYear()}</Text>
        <View style={styles.monthControls}>
          <TouchableOpacity onPress={prevMonth}>
            <Icon name="chevron-left" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={nextMonth}>
            <Icon name="chevron-right" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekdayHeader}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <Text key={day} style={styles.weekdayText}>{day}</Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {generateCalendarDays().map((day, index) => (
          <TouchableOpacity 
            key={index}
            style={[
              styles.dayCell,
              day.hasEntry && styles.dayWithEntry
            ]}
          >
            <Text style={[
              styles.dayText,
              day.hasEntry && styles.dayWithEntryText
            ]}>
              {day.date}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Streak Footer */}
      <View style={styles.footer}>
        <View style={styles.streakContainer}>
          <Icon name="clock" size={20} color="#000" />
          <Text style={styles.streakText}>3</Text>
          <Icon name="droplet" size={20} color="#000" />
          <Text style={styles.streakMessage}>Keep going ...</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    backgroundColor: '#f0f0f0',
  },
  resultCount: {
    marginLeft: 'auto',
    color: '#666',
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
    borderBottomColor: '#eee',
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    color: '#666',
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
    backgroundColor: '#000',
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
    borderTopColor: '#eee',
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
    color: '#666',
  },
});

export default CalendarScreen;