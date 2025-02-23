import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';

import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList } from './types/types';

type BottomNavigationProp = BottomTabNavigationProp<RootStackParamList, 'Home'>;

const BottomNavigation = ({ activeScreen }: { activeScreen: keyof RootStackParamList }) => {
  const navigation = useNavigation<BottomNavigationProp>();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => navigation.navigate('Home')}>
        <Icon name="book" size={24} color={activeScreen === 'Home' ? "#2196F3" : "#B0B0B0"} />
      </TouchableOpacity>
      <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => navigation.navigate('Dashboard')}>
        <Icon name="bar-chart-2" size={24} color={activeScreen === 'Dashboard' ? "#2196F3" : "#B0B0B0"} />
      </TouchableOpacity>
      <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => navigation.navigate('Profile')}>
        <Icon name="user" size={24} color={activeScreen === 'Profile' ? "#2196F3" : "#B0B0B0"} />
      </TouchableOpacity>
      <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => navigation.navigate('Settings')}>
        <Icon name="settings" size={24} color={activeScreen === 'Settings' ? "#2196F3" : "#B0B0B0"} />
      </TouchableOpacity>
    </View>
  );
};

import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderTopColor: '#E0E0E0',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 'auto',
    paddingVertical: 16,
  },
});

export default BottomNavigation;
