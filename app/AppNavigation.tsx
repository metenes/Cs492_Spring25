import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import { RootStackParamList } from "./types/types"; // Import the route types

// Bottom Navigator
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text } from "react-native";
import { RouteProp } from "@react-navigation/native";

// Import Icons (Using react-native-vector-icons)
// import Ionicons from "react-native-vector-icons/Ionicons";

// Import  screens
import LoginScreen from "./LoginScreen";
import ProfileScreen from "./ProfileScreen";
import ActivityScreen from "./ActivityScreen";
import SettingsScreen from "./SettingsScreen";
import HomeScreen from "./HomeScreen";
import RegisterScreen from "./RegisterScreen";

import ChatbotScreen from "./ChatbotScreen";
import DiaryMainScreen from "./DiaryMainScreen";

import FreeJournalingScreen from "./FreeJournalingScreen";
import JournalScreen from "./JournalScreen";
// import  AnalysisScreen from "./AnalysisScreen";
import ActivityLogScreen from "./ActivityLogScreen";

// Bottom Menu
import BottomNavigation from "./BottomNavigation";

// Payment Method Navigations 
import { PaymentMethodsScreen } from "./PaymentMethodsScreen";
import PaymentMethodAddScreen from "./PaymentMethodAddScreen";
import PaymentMethodHistory from  "./PaymentMethodHistoryScreen"
import PaymentMethodSettingScreen from "./PaymentMethodSettingScreen";
import Dashboard from "./screens/Dashboard";
// Create the stack navigator
const Stack = createNativeStackNavigator<RootStackParamList>();

// Create Bottom Tab Navigator
const Tab = createBottomTabNavigator();

//  Define Type for Route Names
type RootTabParamList = {
  Diary: undefined;
  Analysis: undefined;
  Profile: undefined;
  Settings: undefined;
};

/* 
// Screens that will have bottom navigation
const BottomTabs = () => {
  return (
    <Tab.Navigator
    screenOptions={({ route }: { route: RouteProp<RootTabParamList, keyof RootTabParamList> }) => ({
      tabBarIcon: ({ color, size }: { color: string; size: number }) => {
        let iconName: string = "help-circle-outline";

          if (route.name === "Diary") iconName = "book-outline";
          else if (route.name === "Analysis") iconName = "bar-chart-outline";
          else if (route.name === "Profile") iconName = "person-outline";
          else if (route.name === "Settings") iconName = "settings-outline";

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#3B82F6",
        tabBarInactiveTintColor: "gray",
        headerShown: false, // Hide header for bottom tab screens
      })}
    >
      <Tab.Screen name="Diary" component={DiaryMainScreen} />
      <Tab.Screen name="Analysis" component={AnalysisScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

*/ 

/*
<Stack.Screen
          name="Main"
          component={BottomTabs}
          options={{ headerShown: false }} // Hide header for bottom tabs
        />

*/
//  <Stack.Screen name="PaymentMethodHistory" component={PaymentMethodHistory} />
//  <Stack.Screen name="Analysis" component={AnalysisScreen} /> // Grafikde hata var
const AppNavigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Dashboard" >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        {/* <Stack.Screen name="Home" component={HomeScreen} /> */}
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ headerShown: false }} // Removes the back button from Home
        />

        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Activity" component={ActivityScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Chatbot" component={ChatbotScreen} />
        {/* <Stack.Screen name="DiaryMain" component={DiaryMainScreen} /> */}
        {/* Fix the Header Title for DiaryMain */}
        <Stack.Screen 
          name="DiaryMain" 
          component={DiaryMainScreen} 
          options={{ headerTitle: 'Calendar', headerShown: false }} 
        />
        
        <Stack.Screen name="Dashboard" component={Dashboard} />
        <Stack.Screen name="FreeJournaling" component={FreeJournalingScreen} />
        <Stack.Screen name="Journal" component={JournalScreen} />
       
        <Stack.Screen name="ActivityLog" component={ActivityLogScreen} />
        <Stack.Screen name="BottomNavigation" component={BottomNavigation} />
       
        <Stack.Screen name="PaymentMethodAddScreen" component={PaymentMethodAddScreen} />
        <Stack.Screen name="PaymentMethodsScreen" component={PaymentMethodsScreen} />
        <Stack.Screen name="PaymentMethodHistory" component={PaymentMethodHistory} />
        <Stack.Screen name="PaymentMethodSettingScreen" component={PaymentMethodSettingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigation;
