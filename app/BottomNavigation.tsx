import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from './context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const BottomNavigation = ({ activeScreen }: { activeScreen: string }) => {
  const navigation = useNavigation();
  const { theme, darkMode } = useTheme();

  const tabs = [
    { name: 'Home', icon: 'home', screen: 'Home' },
    { name: 'Dashboard', icon: 'chart-bar', screen: 'Dashboard' },
    { name: 'Profile', icon: 'account', screen: 'Profile' },
    { name: 'Settings', icon: 'cog', screen: 'Settings' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.name}
          style={styles.tab}
          onPress={() => navigation.navigate(tab.screen)}
        >
          <Icon
            name={tab.icon}
            size={24}
            color={activeScreen === tab.screen ? theme.text : theme.placeholder}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeScreen === tab.screen ? theme.text : theme.placeholder,
              },
            ]}
          >
            {tab.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 60,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default BottomNavigation;