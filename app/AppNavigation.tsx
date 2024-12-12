import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import { RootStackParamList } from "./types/types"; // Import the route types

// Import your screens
import LoginScreen from "./LoginScreen";
import ProfileScreen from "./ProfileScreen";
import ActivityScreen from "./ActivityScreen";
import SettingsScreen from "./SettingsScreen";
import HomeScreen from "./HomeScreen";
import RegisterScreen from "./RegisterScreen";

// Create the stack navigator
const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigation = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Activity" component={ActivityScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigation;
