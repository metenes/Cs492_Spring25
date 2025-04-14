import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

// Define theme types
export const lightTheme = {
  backgroundColor: '#FFFFFF',
  cardBackground: '#F9F9F9',
  inputBackground: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  border: '#CCCCCC',
  primary: '#3498DB',
  danger: '#E74C3C',
  icon: '#555555',
  placeholder: '#AAAAAA'
};

export const darkTheme = {
  backgroundColor: '#121212',
  cardBackground: '#1E1E1E',
  inputBackground: '#2C2C2C',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  border: '#444444',
  primary: '#3498DB',
  danger: '#E74C3C',
  icon: '#BBBBBB',
  placeholder: '#777777'
};

type Theme = typeof lightTheme;

interface ThemeContextType {
  darkMode: boolean;
  theme: Theme;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [darkMode, setDarkMode] = useState(systemColorScheme === 'dark');

  useEffect(() => {
    // Load saved theme preference
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('darkMode');
      if (savedTheme !== null) {
        setDarkMode(savedTheme === 'true');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleDarkMode = async () => {
    try {
      const newDarkMode = !darkMode;
      setDarkMode(newDarkMode);
      await AsyncStorage.setItem('darkMode', newDarkMode.toString());
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const theme = darkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ darkMode, theme, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 