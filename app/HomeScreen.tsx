import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, SafeAreaView } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useNavigation } from "@react-navigation/native";
import Icon from 'react-native-vector-icons/Feather';
import { RootStackParamList } from "./types/types"; // Import the route types
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import BottomNavigation from './BottomNavigation';

/*
BottomNavigation Error Need to be fixed ...

Invariant Violation: View config getter callback for component `path`
 must be a function (received `undefined`). Make sure to 
 start component names with a capital letter.

This error is located at:
    in path
    in svg
    ... 
*/


type Entry = {
  id: string;
  date: string;
  type: 'journal' | 'checkin';
  subtitle: string;
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, "Home">;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  // Example, Need to get to DB for this adjust by yourself ...
  const entries: Entry[] = [
    { id: '1', date: 'December 18', type: 'journal', subtitle: 'Journal Entry' },
    { id: '2', date: 'December 18', type: 'checkin', subtitle: 'Check-in' },
    { id: '3', date: 'December 14', type: 'journal', subtitle: 'Journal Entry' },
    { id: '4', date: 'December 2', type: 'journal', subtitle: 'Journal Entry' },
    { id: '5', date: 'November 30', type: 'journal', subtitle: 'Journal Entry' },
    { id: '6', date: 'November 27', type: 'checkin', subtitle: 'Check-in' },
    { id: '7', date: 'November 25', type: 'journal', subtitle: 'Journal Entry' },
  ];

  const renderTab = (title: string, isActive: boolean) => (
    <TouchableOpacity style={[styles.tab, isActive && styles.activeTab]}>
      <Text style={[styles.tabText, isActive && styles.activeTabText]}>{title}</Text>
    </TouchableOpacity>
  );

  const renderEntry = ({ item }: { item: Entry }) => (
    <TouchableOpacity style={styles.entryItem}>
      <View style={styles.entryIcon}>
        {item.type === 'journal' ? (
          <Icon name="edit-2" size={20} color="#000" />
        ) : (
          <Icon name="smile" size={20} color="#000" />
        )}
      </View>
      <View style={styles.entryContent}>
        <Text style={styles.entryDate}>{item.date}</Text>
        <Text style={styles.entrySubtitle}>{item.subtitle}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Entries</Text>
          {/* Streak button navigates to the Calendar */}
          <TouchableOpacity style={styles.streakContainer} onPress={() => navigation.navigate('DiaryMain')}>
            <Text style={styles.streakText}>5</Text>
            <MaterialCommunityIcons name="fire" size={20} color="black" /* style={{ marginLeft: 5 }}  *//>
            {/* <Icon name="droplet" size={20} color="#000" /> */}
          </TouchableOpacity>
        </View>
        
        <View style={styles.tabContainer}>
          {renderTab('All Entries', true)}
          {renderTab('Journals', false)}
          {renderTab('Check-ins', false)}
          {renderTab('Categories', false)}
        </View>

        <FlatList
          data={entries}
          renderItem={renderEntry}
          keyExtractor={(item) => item.id}
          style={styles.list}
        />

        <TouchableOpacity style={styles.fab}>
          <Icon name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      
      </SafeAreaView>
      <BottomNavigation activeScreen="Home" />
    </>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakText: {
    fontSize: 16,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 16,
  },
  activeTab: {
    backgroundColor: '#000',
  },
  tabText: {
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  list: {
    flex: 1,
  },
  entryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  entryContent: {
    flex: 1,
  },
  entryDate: {
    fontSize: 16,
    fontWeight: '500',
  },
  entrySubtitle: {
    fontSize: 14,
    color: '#666',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default HomeScreen;