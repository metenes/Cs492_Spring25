import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { View, Text } from "react-native";
import { Home, BarChart, User, Settings } from "lucide-react-native";

// Import your screen components
import  DiaryMainScreen from "./DiaryMainScreen";
import AnalysisScreen from "./AnalysisScreen"
import  ProfileScreen from "./ProfileScreen";
import SettingsScreen  from "./SettingsScreen";

const Tab = createBottomTabNavigator();

const BottomNavigation = () => {
    return (
     
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: { backgroundColor: "white", height: 60 },
              tabBarActiveTintColor: "#3B82F6",
              tabBarInactiveTintColor: "gray",
            }}
          >
            <Tab.Screen
              name="Diary"
              component={DiaryMainScreen}
              options={{
                tabBarIcon: ({ focused, size, color }) => (
                  <Home size={size}  />
                ),
              }}
            />
            <Tab.Screen
              name="Analysis"
              component={AnalysisScreen}
              options={{
                tabBarIcon: ({ focused, size, color }) => (
                  <BarChart size={size}  />
                ),
              }}
            />
            <Tab.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                tabBarIcon: ({ focused, size, color }) => (
                  <User size={size}  />
                ),
              }}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                tabBarIcon: ({ focused, size, color }) => (
                  <Settings size={size} />
                ),
              }}
            />
          </Tab.Navigator>
       
      );
    };

export default BottomNavigation;




