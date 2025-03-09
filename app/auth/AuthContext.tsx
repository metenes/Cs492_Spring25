import React, { createContext, useState, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Define the context properties
interface AuthContextProps {
  user: string | null;
  login: (email: string, token: string) => void;
  logout: () => void;
}

// Create the context
const AuthContext = createContext<AuthContextProps | undefined>(undefined);

// Define the props for the AuthProvider
interface AuthProviderProps {
  children: React.ReactNode; // This ensures the `children` prop is correctly typed
}

// AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<string | null>(null);

  const login = async (email: string, token: string) => {
    await AsyncStorage.setItem("token", token);
    setUser(email);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const storeToken = async (token: string) => {
  try {
      await AsyncStorage.setItem("userToken", token);
  } catch (error) {
      console.error("Error saving token:", error);
  }
};

export const getToken = async () => {
  try {
      const token = await AsyncStorage.getItem("userToken");
      console.log("🔹 Retrieved Token:", token);
      return token;
  } catch (error) {
      console.error("Error retrieving token:", error);
      return null;
  }
};

// Custom hook for accessing the auth context
export const useAuth = async () => {
  const context = useContext(AuthContext);
  const token = await getToken();
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  console.log("🔹 Token in AsyncStorage:", token);

  return context;
};
