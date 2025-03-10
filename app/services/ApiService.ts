import AsyncStorage from "@react-native-async-storage/async-storage";
import mongoose from "mongoose" // for schema in MongoDB similar to table 

// const API_URL = "http://10.0.2.2:5000"; // Mete's API - LAN
 //const API_URL = "http://192.168.1.103:5000"; // Bilkent Dorms - LAN 
// const API_URL = "http://192.168.x.x:5000"; // Use your machine's IP.
// const API_URL = "http://10.203.122.69:5000";
const API_URL = "http://139.179.206.4:5000"; // Melisa's API - LAN

export const analyzeSentiment = async (text: string) => {
  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return { error: "Failed to analyze sentiment." };
  }
};
// for dashboard
export const fetchSentimentAnalysis = async (token: string, startDate: string, endDate: string, interval: string = "monthly", emotions: string[] = []) => {
  try {
    const emotionsQuery = emotions.length > 0 ? `&emotions=${emotions.join(",")}` : "";
    const response = await fetch(`${API_URL}/api/sentiment-analysis?start_date=${startDate}&end_date=${endDate}&interval=${interval}${emotionsQuery}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching sentiment analysis:", error);
    return { error: "Failed to fetch sentiment analysis." };
  }
};
export const sendMessage = async (message: string) => {
  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.reply; 
  } catch (error) {
    console.error("Error sending message:", error);
    return "Sorry, something went wrong.";
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    console.log("loginUser() response.ok: ", response.ok);
    console.log("loginUser() response.status: ", response.status);
    console.log("loginUser() response.headers: ", response.headers);

    const responseData = await response.json(); // Await JSON parsing
    console.log("loginUser() response data: ", responseData);

    if (!response.ok) {
      throw new Error(responseData.message || "Invalid email or password");
    }

    if (!responseData.access_token) {
      console.error("❌ Login successful but no token received!");
      throw new Error("No access token received.");
    }

    console.log("✅ Login successful. Token received:", responseData.access_token);

    await AsyncStorage.setItem("userToken", responseData.access_token);
    console.log("🔹 Token successfully saved to AsyncStorage!");

    return responseData; 
  } catch (error) {
    console.error("Login error:", error);
    throw error; 
  }
};

export const registerUser = async (email: string, password: string, dob: string) => {
  console.log("registerUser() email, password, dob:", email, password, dob);
  console.log(`Attempting to connect to: ${API_URL}/register`);

  try {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, dob }),
    });

    console.log("Register response status:", response.status);
    console.log("Register response headers:", response.headers);

    // Get the raw text first to debug
    const responseText = await response.text();
    console.log("Raw response:", responseText.substring(0, 200) + "..."); // Log first 200 chars

    // If it's not valid JSON, don't try to parse it
    if (!response.ok) {
      if (responseText.includes("<html") || responseText.includes("<!DOCTYPE")) {
        console.error("Received HTML instead of JSON");
        throw new Error(`Registration failed: Server returned HTML instead of JSON. Status: ${response.status}`);
      } else {
        // Try to parse JSON if it looks like JSON
        try {
          const errorData = JSON.parse(responseText);
          console.log("registerUser() failed response:", errorData);
          throw new Error(`Registration failed: ${errorData.error || "Unknown error"}`);
        } catch (parseError) {
          console.error("Could not parse error response:", parseError);
          throw new Error(`Registration failed with status ${response.status}. Response could not be parsed.`);
        }
      }
    }

    // If response was ok, try to parse the JSON
    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      console.error("Could not parse successful response:", parseError);
      throw new Error("Registration succeeded but response was not valid JSON");
    }
  } catch (error) {
    console.error("registerUser() error:", error);
    throw error;
  }
};


// Fetch the user's profile information
export const fetchProfile = async (token: string) => {
  const response = await fetch(`${API_URL}/profile`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`, 
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.statusText}`);
  }

  const responseData = await response.json();

  // Make sure the profile data includes the new context information
  return {
    email: responseData.email,
    profile_picture: responseData.profile_picture,
    preferences: responseData.preferences,
    last_login: responseData.last_login,
    role: responseData.role,
    account_status: responseData.account_status,
  };
};

// Update the user's password
export const updatePassword = async (token: string, newPassword: string) => {
  const response = await fetch(`${API_URL}/update-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`, // Include the JWT token in the Authorization header
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }), // Send the new password in the request body
  });

  if (!response.ok) {
    throw new Error(`Failed to update password: ${response.statusText}`);
  }

  return await response.json(); // Return success message
};

export const logActivity = async (token: string, activity: string) => {
  const response = await fetch(`${API_URL}/activity`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ activity }),
  });
  return response.json();
};

export const fetchActivities = async (token: string) => {
  const response = await fetch(`${API_URL}/activity`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` },
  });
  return response.json();
};

export const resetPassword = async (email: string) => {
  const response = await fetch(`${API_URL}/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send reset link: ${response.statusText}`);
  }

  return await response.json(); // Return success message
};

export const saveJournalEntry = async (token: string, content: string, images?: string[], category?: string) => {
  try {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) {
      console.error("❌ No token found in AsyncStorage!");
      throw new Error("Authentication error: No token found.");
    }
    console.log("✅ Using token for request:", token);

    const response = await fetch(`${API_URL}/save-journal-entry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ content, images, category }),
    });

    return await response.json();
  } catch (error) {
    console.error("Error saving journal entry:", error);
    return { error: "Network error" };
  }
};

export const fetchJournalEntries = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/get-journal-entries`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const responseData = await response.json();
    console.log("API Response Status:", response.status);

    if (!response.ok) {
      console.error("❌ Failed to fetch journal entries:", responseData.error);
      return { error: responseData.error };
    }

    
    console.log("✅ Received Journal Entries:", responseData);

    return responseData.entries; // Return journal entries for frontend
    //return await response.json();
  } catch (error) {
    console.error("Error fetching journal entries:", error);
    return { error: "Network error" };
  }
};

export const updatePreferences = async (token: string, preferences: object) => {
  const response = await fetch(`${API_URL}/update-preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ preferences }), // Send updated preferences in the body
  });

  if (!response.ok) {
    throw new Error(`Failed to update preferences: ${response.statusText}`);
  }

  return await response.json(); // Return updated preferences
};
