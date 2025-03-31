import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';

import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList } from './types/types';

interface BottomNavigationProps {
  activeScreen: keyof RootStackParamList;
  darkMode?: boolean;
}

type BottomNavigationProp = BottomTabNavigationProp<RootStackParamList, 'Home'>;

const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeScreen, darkMode = false }) => {
  const navigation = useNavigation<BottomNavigationProp>();
  const theme = darkMode ? darkTheme : lightTheme;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => navigation.navigate('Home')}
      >
        <Icon
          name="book"
          size={24}
          color={activeScreen === 'Home' ? theme.active : theme.inactive}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: activeScreen === 'Home' ? theme.active : theme.inactive,
              fontWeight: activeScreen === 'Home' ? 'bold' : 'normal',
            },
          ]}
        >
          Home
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => navigation.navigate('Dashboard')}
      >
        <Icon
          name="bar-chart-2"
          size={24}
          color={activeScreen === 'Dashboard' ? theme.active : theme.inactive}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: activeScreen === 'Dashboard' ? theme.active : theme.inactive,
              fontWeight: activeScreen === 'Dashboard' ? 'bold' : 'normal',
            },
          ]}
        >
          Dashboard
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => navigation.navigate('Profile')}
      >
        <Icon
          name="user"
          size={24}
          color={activeScreen === 'Profile' ? theme.active : theme.inactive}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: activeScreen === 'Profile' ? theme.active : theme.inactive,
              fontWeight: activeScreen === 'Profile' ? 'bold' : 'normal',
            },
          ]}
        >
          Profile
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => navigation.navigate('Settings')}
      >
        <Icon
          name="settings"
          size={24}
          color={activeScreen === 'Settings' ? theme.active : theme.inactive}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: activeScreen === 'Settings' ? theme.active : theme.inactive,
              fontWeight: activeScreen === 'Settings' ? 'bold' : 'normal',
            },
          ]}
        >
          Settings
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// Theme settings
const lightTheme = {
  backgroundColor: '#ffffff',
  active: '#2196F3',
  inactive: '#B0B0B0'
};

const darkTheme = {
  backgroundColor: '#1E1E1E',
  active: '#2196F3',
  inactive: '#95a5a6'
};

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    height: isSmallDevice ? 55 : 60,
    paddingBottom: isSmallDevice ? 5 : 8,
    marginTop: 'auto',
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: isSmallDevice ? 10 : 12,
    marginTop: 2,
  },
});

export default BottomNavigation;