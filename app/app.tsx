import React, { useEffect } from "react";
import AppNavigation from "./AppNavigation";
import { AuthProvider } from "./auth/AuthContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

interface AppProps {
  hideSplashScreen: () => Promise<void>;
}

const App: React.FC<AppProps> = ({ hideSplashScreen }: AppProps) => {
  useEffect(() => {
    const prepareApp = async () => {
      try {
        // Perform any async tasks like loading resources or checking auth state
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay
        await hideSplashScreen(); // Call the hideSplashScreen function
      } catch (e) {
        console.warn("Error hiding splash screen:", e);
      }
    };

    prepareApp();
  }, [hideSplashScreen]);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;
