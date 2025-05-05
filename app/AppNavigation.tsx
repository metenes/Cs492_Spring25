import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar, Platform } from "react-native";
import { RootStackParamList } from "./types/types"; // Import the route types
//import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";

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
import ForgotPasswordScreen from "./ForgotPasswordScreen";
import ChatbotScreen from "./ChatbotScreen";
import ResetPasswordScreen from "./ResetPasswordScreen";
import VerifyResetCodeScreen from "./VerifyResetCodeScreen";
import DiaryMainScreen from "./DiaryMainScreen";
import CheckInScreen from "./CheckInScreen";
import FaceEmotionScreen from "./FaceEmotionScreen";
import FreeJournalingScreen from "./FreeJournalingScreen";
import PromptSelectionScreen from "./PromptSelectionScreen";
import GuidedJournalingScreen from "./GuidedJournalingScreen";
import JournalScreen from "./JournalScreen";
// import  AnalysisScreen from "./AnalysisScreen";
import ActivityLogScreen from "./ActivityLogScreen";
import EntryDetailScreen from "./EntryDetailScreen";
import EditCheckInScreen from "./EditCheckInScreen";
// Bottom Menu
import BottomNavigation from "./BottomNavigation";

// Payment Method Navigations 
import PaymentMethodAddScreen from "./PaymentMethodAddScreen";
import PaymentMethodHistory from  "./PaymentMethodHistoryScreen"
import PaymentMethodSettingScreen from "./PaymentMethodSettingScreen";
import Dashboard from "./screens/Dashboard";

import CommunityInsightsScreen from "./CommunityInsightsScreen";
import ContactSupportScreen from "./ContactSupportScreen";

import {NotificationSettingsScreen} from "./NotificationSettingsScreen"
import { useTheme } from './context/ThemeContext';

// Helper assistant 
import HelperAssistant from './components/HelperAssistant';

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

const AppNavigation = () => {
  const { theme, darkMode } = useTheme();

  return (
    <>
      <StatusBar 
        barStyle={darkMode ? "light-content" : "dark-content"}
        backgroundColor={Platform.OS === 'android' ? theme.backgroundColor : 'transparent'}
        translucent={true}
      />
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="Login"
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.backgroundColor,
            },
            headerTintColor: theme.text,
            headerTitleStyle: {
              color: theme.text,
            },
            contentStyle: {
              backgroundColor: theme.backgroundColor,
            },
            // Android specific
            ...(Platform.OS === 'android' && {
              headerTransparent: true,
              headerBlurEffect: 'dark',
            }),
          }}
        >
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_left',  }}
          />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Activity" component={ActivityScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Chatbot" component={ChatbotScreen} />
          <Stack.Screen name="FaceEmotion" component={FaceEmotionScreen} />
          <Stack.Screen name="EntryDetail" component={EntryDetailScreen} options={{ headerShown: false }}/>
          <Stack.Screen name="EditCheckIn" component={EditCheckInScreen} options={{ headerShown: false }}/>

          {/* <Stack.Screen 
            name="DiaryMain" 
            component={DiaryMainScreen} 
            options={{ headerTitle: 'Calendar', headerShown: false, }} 
          /> */}

          <Stack.Screen 
            name="DiaryMain" 
            component={DiaryMainScreen} 
            options={{
              headerTitle: 'Calendar',
              headerShown: false,
              /* gestureEnabled: true,
              animation: 'slide_from_left',  */
            }} 
          />

          
          <Stack.Screen name="Dashboard" component={Dashboard} />
          <Stack.Screen name="FreeJournaling" component={FreeJournalingScreen} />
          <Stack.Screen name="PromptSelection" component={PromptSelectionScreen} />
          <Stack.Screen name="GuidedJournaling" component={GuidedJournalingScreen} />
          <Stack.Screen name="Journal" component={JournalScreen} />
          <Stack.Screen name="CheckIn" component={CheckInScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          <Stack.Screen name="VerifyResetCode" component={VerifyResetCodeScreen} />

          <Stack.Screen name="ActivityLog" component={ActivityLogScreen} />
          <Stack.Screen name="BottomNavigation" component={BottomNavigation} />
         
          <Stack.Screen name="PaymentMethodAddScreen" component={PaymentMethodAddScreen} />
          <Stack.Screen name="PaymentMethodHistoryScreen" component={PaymentMethodHistory} />
          <Stack.Screen name="PaymentMethodSettingScreen" component={PaymentMethodSettingScreen} />

          <Stack.Screen name="NotificationSettingsScreen" component={NotificationSettingsScreen} />
          <Stack.Screen name="CommunityInsight" component={CommunityInsightsScreen} />
          <Stack.Screen name="ContactSupport" component={ContactSupportScreen} />

        </Stack.Navigator>
        <HelperAssistant />

      </NavigationContainer>
    </>
  );
};

export default AppNavigation;
