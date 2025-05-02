import Constants from "expo-constants";
import { Platform } from "react-native";

//  Constants.expoConfig.hostUri dynamically gives your local IP like 192.168.1.X.
let API_URL  = "http://192.168.1.104:5000"; // Default

if (__DEV__) {
  // Local dev mode
  const localIP = Constants?.expoConfig?.hostUri?.split(":")[0];
  if (Platform.OS === "android") {
    // Android emulator maps localhost differently
    API_URL = `http://${localIP}:5000`;
  } else {
    // iOS simulator or physical device
    API_URL = `http://${localIP}:5000`;
  }
}

export { API_URL };
