import React, { createContext, useState, useContext, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Define the context properties
interface AuthContextProps {
  token: string | null;
  login: (token: string, email?: string) => void; // Update the type signature
  logout: () => void;
}

// Create the context
const AuthContext = createContext<AuthContextProps | undefined>(undefined);

// Define the props for the AuthProvider
interface AuthProviderProps {
  children: React.ReactNode;
}

export const storeToken = async (token: string) => {
  try {
    await AsyncStorage.setItem("userToken", token);
    console.log("✅ Token successfully stored:", token);
    return true; // Indicate success
  } catch (error) {
    console.error("❌ Error storing token:", error);
    return false; // Indicate failure
  }
};


// Retrieve the token from AsyncStorage
export const getToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem("userToken");
    console.log("🔹 Retrieved Token:", token);
    return token;
  } catch (error) {
    console.error("❌ Error retrieving token:", error);
    return null;
  }
};

// Custom hook for accessing the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
  
// AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  
  // Load token on component mount
  useEffect(() => {
    const loadToken = async () => {
      const storedToken = await getToken();
      if (storedToken) {
        console.log("✅ Token Loaded:", storedToken);
        setToken(storedToken);
      }
    };
    loadToken();
  }, []);
  
  // Login: Store token and update state - make email optional
  const login = async (token: string, email?: string) => {
    try {
      await AsyncStorage.setItem("userToken", token);
      setToken(token);
      console.log("✅ Token Stored:", token);
      if (email) {
        console.log("✅ For email:", email);
      }
    } catch (error) {
      console.error("❌ Error storing token:", error);
    }
  };
  
  // Logout: Remove token and reset state
  const logout = async () => {
    try {
      await AsyncStorage.removeItem("userToken"); 
    }
    catch (error) {
      console.error("❌ Error removing token:", error);
    }
  };
  
  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

