import "@expo/metro-runtime"
import * as SplashScreen from "expo-splash-screen"
import App from "@/app";
import { ThemeProvider } from './app/context/ThemeContext';
import EditCheckInScreen from './app/EditCheckInScreen';

SplashScreen.preventAutoHideAsync()

function IgniteApp() {
  return (
    <ThemeProvider>
      <App hideSplashScreen={SplashScreen.hideAsync} />
    </ThemeProvider>
  )
}

export default IgniteApp
