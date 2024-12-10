import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./HomeScreen";
import JournalScreen from "./JournalScreen";
import ChatbotScreen from "./ChatbotScreen";
import SettingsScreen from "./SettingsScreen";

const Stack = createNativeStackNavigator();

const AppNavigation = () => (
  <Stack.Navigator initialRouteName="Home">
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="Journal" component={JournalScreen} />
    <Stack.Screen name="Chatbot" component={ChatbotScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
  </Stack.Navigator>
);

export default AppNavigation;
