import React from "react";
import AppNavigation from "./AppNavigation";
import { AuthProvider } from "./auth/AuthContext"; // Optional: If you're using an authentication context

const App = () => {
  return (
    
    <AuthProvider>
      <AppNavigation />
    </AuthProvider>
  );
};

export default App;
