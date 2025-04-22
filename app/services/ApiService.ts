import AsyncStorage from "@react-native-async-storage/async-storage";

// export API_URL = "http://10.0.2.2:5000"; // Mete's API - LAN
//export API_URL = "http://192.168.1.103:5000"; // Bilkent Dorms - LAN 
//export API_URL = "http://172.20.10.3:5000";
// export API_URL = "http://10.203.122.69:5000";
// export API_URL = "http://192.168.1.82:5000"; // Melisa's API - LAN
// export API_URL = "http://192.168.0.28:5000"; //kgn
export const API_URL = "http://192.168.1.29:5000";

// Define the emotions array to match the backend
const EMOTIONS = [
  // Free Journaling Emotions (28)
  "admiration", "amusement", "anger", "annoyance", "approval", "caring",
  "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
  "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
  "nervousness", "optimism", "pride", "realization", "relief", "remorse",
  "sadness", "surprise", "neutral",
  
  // Guided Journaling Emotions (5)
  "reflection", "insight", "clarity", "growth", "acceptance",
  
  // Check-in Emotions (5)
  "energy", "focus", "motivation", "stress", "balance"
];

export const analyzeSentiment = async (text: string) => {
  try {
    console.log("🚀 Starting analyzeSentiment with text:", text.substring(0, 50) + "...");

    const response = await fetch(`${API_URL}/sentiment/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const rawText = await response.text();
    console.log("📡 Raw response text:", rawText);

    const data = JSON.parse(rawText);
    console.log("🔍 Parsed sentiment data:", JSON.stringify(data, null, 2));

    // Verify emotions array
    if (!data.emotions || !Array.isArray(data.emotions)) {
      console.error("❌ Invalid emotions data:", data);
      throw new Error("Invalid emotions data received");
    }

    // Log each emotion object
    data.emotions.forEach((emotion: any, index: number) => {
      console.log(`Emotion ${index}:`, {
        code: emotion.code,
        type: typeof emotion.code,
        label: emotion.label,
        score: emotion.score
      });
    });

    return data;
  } catch (error) {
    console.error("❌ Error in analyzeSentiment:", error);
    throw error;
  }
};

export const logoutDB = async () => {
  try {
    const token = await AsyncStorage.getItem("userToken");

    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
    }
  } catch (error) {
    console.error("❌ Logout failed:", error);
  }
};

// **********************************************
// **Sentiment API** - 
// **********************************************

export const fetchSentimentAnalysis = async (
  start_date: string,
  end_date: string,
  interval: string = "monthly",
  emotions?: string
) => {
  try {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) {
      throw new Error("No token found. Please log in.");
    }

    const params = new URLSearchParams();
    params.append("start_date", start_date);
    params.append("end_date", end_date);
    params.append("interval", interval);
    if (emotions) {
      params.append("emotions", emotions);
    }

    const url = `${API_URL}/journal/api/sentiment-analysis?${params.toString()}`;
    console.log("Fetching sentiment analysis from URL:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error("API response not OK:", response.statusText);
      throw new Error(`Error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("API sentiment analysis data:", data);
    
    // The response now includes start_date, end_date, interval, and emotion_analysis
    return {
      start_date: data.start_date,
      end_date: data.end_date,
      interval: data.interval,
      emotion_analysis: data.emotion_analysis || []
    };
  } catch (error) {
    console.error("Error fetching sentiment analysis:", error);
    return { error: "Failed to fetch sentiment analysis." };
  }
};

export const fetchJournalEntriesWithDate = async (
  start_date: string,
  end_date: string
) => {
  try {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) {
      throw new Error("No token found. Please log in.");
    }
    const params = new URLSearchParams();
    params.append("start_date", start_date);
    params.append("end_date", end_date);

    const response = await fetch(`${API_URL}/journal/api/journal-entries?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const data = await response.json();
    // The response now includes start_date, end_date, and entries
    return {
      start_date: data.start_date,
      end_date: data.end_date,
      entries: data.entries || []
    };
  } catch (error) {
    console.error("Error fetching journal entries:", error);
    return { error: "Failed to fetch journal entries." };
  }
};

export const getEmotionalTrendInsight = async (token: string) => {
  const response = await fetch(`${API_URL}/sentiment/insights`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch emotional trend insight");
  }

  return response.json();
};

export const fetchEmotionalRecommendations = async () => {
  try {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) throw new Error("No token found");

    const response = await fetch(`${API_URL}/sentiment/insights`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch emotional recommendations");
    }

    console.log("📡 Raw response:", response);

    const data = await response.json();
    console.log("📦 Parsed emotional insights and recommendations:", data);

    return data;

    // return await response.json();
  } catch (error) {
    console.error("❌ Error fetching emotional recommendations:", error);
    throw error;
  }
};


// **********************************************
// ** Chat API** - Send message
// **********************************************
export const sendMessage = async (message: string) => {
  try {
    const response = await fetch(`${API_URL}/chat/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Data recived from test : ", data)
    if (!data.reply) {
      throw new Error("Invalid response format");
    }

    return data.reply; // return the chatbot response
  } catch (error) {
    console.error("Error sending message:", error);
    return "Sorry, something went wrong.";
  }
};


// **********************************************
// **Login&Register API** - Login
// **********************************************

export const loginUser = async (email: string, password: string) => {
  try {
    const response = await fetch(`${API_URL}/user/login`, {
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

    const expoPushToken = await AsyncStorage.getItem("expoPushToken");
    if (!expoPushToken) {
      console.warn("No Expo push token saved locally.");
    } else {
      const pushTokenResponse = await fetch(`${API_URL}/notification/update-push-token-user`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${responseData.access_token}`
        },
        body: JSON.stringify({ token: expoPushToken })
      });

      const pushResponseData = await pushTokenResponse.json();
      console.log("Push token update response:", pushResponseData);
    }

    return responseData;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

// **********************************************
// **Login&Register API** - Register
// **********************************************

export const registerUser = async (email: string, password: string, dob: string) => {
  console.log("registerUser() email, password, dob:", email, password, dob);
  console.log(`Attempting to connect to: ${API_URL}/register`);

  try {
    const response = await fetch(`${API_URL}/user/register`, {
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

// **********************************************
// **Profile API** - Profile Operations
// **********************************************

// Fetch the user's profile information
export const fetchProfile = async (token: string) => {
  // First get the user ID from the token (if not stored separately)
  const userResponse = await fetch(`${API_URL}/user/get-user-id`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error(`Failed to fetch user ID: ${userResponse.statusText}`);
  }

  const userData = await userResponse.json();
  const userId = userData._id;

  if (userId == -1) {
    throw new Error(`Failed to userId -1`);
  }

  // Then fetch the detailed profile with the user ID
  const profileResponse = await fetch(`${API_URL}/user/${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!profileResponse.ok) {
    throw new Error(`Failed to fetch profile: ${profileResponse.statusText}`);
  }

  const profileData = await profileResponse.json();

  // Return formatted profile data structure
  return {
    userId: profileData._id,
    email: profileData.email,
    name: profileData.name || '',
    bio: profileData.bio || '',
    phone: profileData.phone || '',
    location: profileData.location || '',
    profileImageUrl: profileData.profileImageUrl || null,

    // Including the previously existing fields for backward compatibility
    profile_picture: profileData.profileImageUrl || null,
    preferences: profileData.preferences || {},
    last_login: profileData.last_login || null,
    role: profileData.role || 'user',
    account_status: profileData.account_status || 'active',
  };
};

// Update user profile information
export const updateProfile = async (token: string, profileData: any) => {

  // First get the user ID from the token (if not stored separately)
  const userResponse = await fetch(`${API_URL}/user/get-user-id`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error(`Failed to fetch user ID: ${userResponse.statusText}`);
  }

  const userData = await userResponse.json();
  const userId = userData._id;

  if (userId == -1) {
    throw new Error(`Failed to userId -1`);
  }


  const response = await fetch(`${API_URL}/user/${userId}/update-user`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profileData),
  });

  if (!response.ok) {
    throw new Error(`Failed to update profile: ${response.statusText}`);
  }

  return await response.json();
};

export const changePassword = async (token: string, oldPassword: string, newPassword: string) => {
  const response = await fetch(`${API_URL}/user/change-password`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ oldPassword, newPassword }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Error response data:", data);
    return { message: data.error, status: response.status };
  }

  return { message: data.message, status: response.status }; // success

};

// Upload profile image
export const uploadProfileImage = async (token: string, imageFile: File) => {

  // First get the user ID from the token (if not stored separately)
  const userResponse = await fetch(`${API_URL}/user/get-user-id`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error(`Failed to fetch user ID: ${userResponse.statusText}`);
  }

  const userData = await userResponse.json();
  const userId = userData._id;

  if (userId == -1) {
    throw new Error(`Failed to userId -1`);
  }


  const formData = new FormData();
  formData.append('profileImage', imageFile);

  const response = await fetch(`${API_URL}/user/${userId}/profile-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload profile image: ${response.statusText}`);
  }

  return await response.json();
};

// **********************************************
// **Profile API** - Activity - TODO 
// **********************************************

export const fetchActivities = async (token: string) => {
  const response = await fetch(`${API_URL}/activity`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` },
  });
  return response.json();
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

// Delete user account
export const deleteAccount = async (token: string) => {

  // First get the user ID from the token (if not stored separately)
  const userResponse = await fetch(`${API_URL}/user/get-user-id`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error(`Failed to fetch user ID: ${userResponse.statusText}`);
  }

  const userData = await userResponse.json();
  const userId = userData._id;

  if (userId == -1) {
    throw new Error(`Failed to userId -1`);
  }

  const response = await fetch(`${API_URL}/user/${userId}/delete-user`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete account: ${response.statusText}`);
  }

  return await response.json();
};


// **********************************************
// ** Password Reset API ** 
// **********************************************

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


export const requestPasswordReset = async (email: string) => {
  const response = await fetch(`${API_URL}/user/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send reset link: ${response.statusText}`);
  }

  return await response.json(); // Expecting { token: "some-reset-token" }
};

export const resetPassword = async (token: string, newPassword: string) => {
  const response = await fetch(`${API_URL}/user/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, newPassword }),
  });

  if (!response.ok) {
    throw new Error(`Failed to reset password: ${response.statusText}`);
  }

  return await response.json(); // Expecting success message
};

// **********************************************
// ** Homepage API ** - FreeJournal & Guided Journal
// **********************************************

export const saveJournalEntry = async (content: string, images?: { fileName: string; signedUrl: string }[], category?: string, promt?: string) => {
  try {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) throw new Error("No token found");

    // Get sentiment analysis
    const sentimentResult = await analyzeSentiment(content);

    // Define Emotion type
    type Emotion = { code: string; score: number };

    // Sort emotions by score (highest first)
    const sortedEmotions = sentimentResult.emotions.sort(
      (a: Emotion, b: Emotion) => b.score - a.score
    );

    // Get dominant emotion (highest score)
    const dominantEmotion = sortedEmotions[0];

    // Filter additional high-scoring emotions (>= 0.65)
    const additionalEmotions = sortedEmotions
      .slice(1)
      .filter((emotion: Emotion) => emotion.score >= 0.65);

    // Combine dominant emotion with high-scoring ones
    const selectedEmotions: Emotion[] = [dominantEmotion, ...additionalEmotions];

    console.log("Dominant emotion:", dominantEmotion);
    console.log("Additional emotions meeting threshold:", additionalEmotions);

    // Map selected emotions
    const mappedSentiments = selectedEmotions.map((emotion: Emotion) => ({
      emotion: emotion.code,
      percentage: emotion.score,
    }));

    console.log("Final mapped sentiments:", mappedSentiments);
    console.log("CATEGORY : ", category)
    const entryData = {
      entryContent: content,
      entryDate: new Date().toISOString(),
      images: images || [],
      journalSentiments: mappedSentiments,
      category: category,
      prompt: promt
    };

    console.log("Final data being sent:", JSON.stringify(entryData, null, 2));

    const response = await fetch(`${API_URL}/journal/save-journal-entry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(entryData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Server response:", errorText);
      throw new Error(`Error: ${response.statusText}`);
    }

    return await response.json();

  } catch (error) {
    console.error("❌ Error in saveJournalEntry:", error);
    throw error;
  }
};

export const fetchJournalEntries = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/journal/get-journal-entries`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });

    console.log("API Response Status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Failed to fetch journal entries:", errorText);
      return { error: errorText };
    }

    const responseData = await response.json();

    if (!responseData.entries) {
      console.error("❌ API did not return expected 'entries' field:", responseData);
      return { error: "Invalid API response" };
    }

    console.log("✅ Received Journal Entries:", responseData.entries);
    return responseData.entries;

  } catch (error) {
    console.error("❌ Error fetching journal entries:", error);
    return { error: "Network error" };
  }
};

export const fetchJournalDates = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/journal/get-journal-dates`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) {
      console.error("Error fetching journal dates:", response.statusText);
      return [];
    }

    const data = await response.json();
    console.log("Journal dates response:", data);

    // Handle both array and object responses
    if (Array.isArray(data)) {
      return data;
    } else if (typeof data === 'object' && data !== null) {
      // If the response is an object, try to extract an array from it
      if (Array.isArray(data.dates)) {
        return data.dates;
      } else if (Array.isArray(data.entries)) {
        return data.entries.map((entry: any) => entry.entryDate);
      }
    }

    console.warn("Unexpected response format for journal dates:", data);
    return [];
  } catch (error) {
    console.error("Error fetching journal dates:", error);
    return [];
  }
};

export const calculateStreak = (dates: string[]): number => {
  const dateSet = new Set(dates);
  let streakCount = 0;

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let currentDate = new Date();
  const todayFormatted = formatDate(currentDate);

  // If the user journaled today, include today in the streak
  if (dateSet.has(todayFormatted)) {
    streakCount++;
  }

  // Keep counting streak backwards from the day before the last counted day
  currentDate.setDate(currentDate.getDate() - 1);
  while (dateSet.has(formatDate(currentDate))) {
    streakCount++;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  console.log("✅ Final Streak Count:", streakCount);
  return streakCount;
};




// **********************************************
// ** Homepage API ** - Entry Details 
// **********************************************
export const deleteEntry = async (entry: any) => {
  try {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) throw new Error("No token found");

    const entryId = entry._id;
    const category = entry.category;

    if (!entryId || !category) {
      throw new Error("Missing entry ID or category");
    }

    let endpoint = "";

    if (category === "checkin") {
      endpoint = `${API_URL}/check-in/delete/${entryId}`;
    } else {
      endpoint = `${API_URL}/journal/delete/${entryId}`;
    }

    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to delete entry");
    }

    console.log("✅ Entry deleted successfully");
    return await response.json();
  } catch (error) {
    console.error("❌ Error deleting entry:", error);
    throw error;
  }
};

/* export const deleteEntry = async (entry: any) => {
  try {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) throw new Error("No token found");

    console.log("Deleting entry:", entry);

    if (!entry._id) {
      throw new Error("Invalid entry: Missing entry ID");
    }

    // Try a much simpler endpoint - the server is likely expecting this format
    const response = await fetch(`${API_URL}/journal/delete`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      // Include both the ID and category in the body
      body: JSON.stringify({
        entry_id: entry._id,
        category: entry.category || "freeform"
      })
    });

    console.log("Delete response status:", response.status);
    const responseText = await response.text();
    console.log("Delete response body:", responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      throw new Error(responseData.error || "Failed to delete journal entry");
    }

    console.log("✅ Journal entry deleted successfully");
    return responseData;

  } catch (error) {
    console.error("❌ Error deleting entry:", error);
    throw error;
  }
};
 */
// **********************************************
// ** Homepage API ** - Entry 
// **********************************************

export const fetchAllEntries = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/journal/all`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch journal entries");
    }

    const data = await response.json();
    console.log("✅ All journal entries fetched:", data);
    return data.entries;
  } catch (error) {
    console.error("❌ Error fetching journal entries:", error);
    return [];
  }
};


// **********************************************
// ** User Setting Preferences API **
// **********************************************

// Modify app preferences (dark mode, etc.)
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


// Save app preferences (dark mode, etc.)
export const saveAppPreferences = async (preferences: any) => {
  try {
    // Store locally in AsyncStorage
    await AsyncStorage.setItem('appPreferences', JSON.stringify(preferences));
    return true;
  } catch (error) {
    console.error('Error saving preferences:', error);
    throw new Error('Failed to save preferences');
  }
};

// Load app preferences
export const loadAppPreferences = async () => {
  try {
    const storedPrefs = await AsyncStorage.getItem('appPreferences');
    return storedPrefs ? JSON.parse(storedPrefs) : null;
  } catch (error) {
    console.error('Error loading preferences:', error);
    return null;
  }
};


export const saveDraft = async (content: string, images: string[] = []) => {
  try {
    await AsyncStorage.setItem('journalDraft', JSON.stringify({ content, images }));
  } catch (error) {
    console.error('Error saving draft:', error);
  }
};

export const getDraft = async () => {
  try {
    const draft = await AsyncStorage.getItem('journalDraft');
    return draft ? JSON.parse(draft) : null;
  } catch (error) {
    console.error('Error getting draft:', error);
    return null;
  }
};

export const clearDraft = async () => {
  try {
    await AsyncStorage.removeItem('journalDraft');
  } catch (error) {
    console.error('Error clearing draft:', error);
  }
};


// **********************************************
// ** User CheckIn API **
// **********************************************

// Function to submit a check-in entry
export const submitCheckIn = async (token: string, sentiments: string[], causes: string[], comments: string[] = []) => {
  try {
    console.log("Submitting check-in:", { token, sentiments, causes, comments });

    // First get the user ID from the token (if not stored separately)
    const userResponse = await fetch(`${API_URL}/user/get-user-id`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user ID: ${userResponse.statusText}`);
    }

    const userData = await userResponse.json();
    const userId = userData._id;

    if (userId == -1) {
      throw new Error(`Failed to userId -1`);
    }

    const requestBody = {
      user_id: userId,
      sentiments: sentiments,
      causes: causes,
      comments: comments,
    }
    console.log("Request body:", JSON.stringify(requestBody));

    const response = await fetch(`${API_URL}/check-in/submit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Response status:", response.status);

    // Read response as text first to handle cases where it's not JSON
    const rawText = await response.text();
    console.log("Raw response:", rawText);

    // Try parsing JSON, but handle errors if response is not JSON
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (jsonError) {
      console.error("JSON Parse Error:", jsonError);
      throw new Error(`Unexpected server response: ${rawText}`);
    }

    // Handle non-OK responses
    if (!response.ok) {
      throw new Error(data.message || `Failed to submit check-in (HTTP ${response.status})`);
    }

    console.log("Parsed response data:", data);
    return data;

  } catch (error) {
    console.error("Error submitting check-in:", error);
    throw error;
  }
};

// Function to get user's check-in history
export const getCheckInHistory = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/check-in/fetch`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch check-in history');
    }

    console.log("YARDIM CIGLIKLARIIII")
    console.log(data);

    return data;
  } catch (error) {
    console.error('Error fetching check-in history:', error);
    throw error;
  }
};



// Function to delete a specific check-in
export const deleteCheckIn = async (checkInId: string) => {
  try {
    const token = await AsyncStorage.getItem('userToken');

    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/checkin/${checkInId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete check-in');
    }

    return await response.json();

  } catch (error) {
    console.error('Check-in deletion error:', error);
    throw error;
  }
};

// **********************************************
// ** CheckIn  API **
// **********************************************

const CHECK_IN_DRAFT_KEY = 'checkInDraft'; // Create a consistent key

// Check-in draft functions
export const saveCheckInDraft = async (checkInData: any) => {
  try {
    await AsyncStorage.setItem('checkInDraft', JSON.stringify(checkInData));
    console.log("Check-in draft saved successfully");
    return true;
  } catch (error) {
    console.error("Error saving check-in draft:", error);
    return false;
  }
};

export const getCheckInDraft = async () => {
  try {
    const savedData = await AsyncStorage.getItem('checkInDraft');
    return savedData ? JSON.parse(savedData) : null;
  } catch (error) {
    console.error("Error loading check-in draft:", error);
    return null;
  }
};

export const clearCheckInDraft = async () => {
  try {
    await AsyncStorage.removeItem('checkInDraft');
    console.log("Check-in draft cleared");
    return true;
  } catch (error) {
    console.error("Error clearing check-in draft:", error);
    return false;
  }
};

// **********************************************
// ** Notifications API **
// **********************************************

export const saveNotificationToken = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/notification/save-push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save notification token: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error saving notification token:", error);
    throw error;
  }
}

export const updateNotificationFrequency = async (frequency: string) => {
  try {
    const userToken = await AsyncStorage.getItem('userToken');
    if (!userToken) {
      throw new Error('No authentication token available');
    }

    const pushToken = await AsyncStorage.getItem('expoPushToken');

    const response = await fetch(`${API_URL}/notification/update-notification-preferences`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userToken}`,
      },
      body: JSON.stringify({ frequency, pushToken }),
    });


    const data = await response.json();
    if (!response.ok) {
      console.error("Error response data:", data);
      return { message: data.error, status: response.status };
    }
  
    return { message: data.message, status: response.status }; // success
  } catch (error) {
    console.error("Error updating notification frequency:", error);
    throw error;
  }
}

export const fetchNotificationPreferences = async () => {
  try {
    const userToken = await AsyncStorage.getItem('userToken');
    const pushToken = await AsyncStorage.getItem('expoPushToken');
    if (!userToken) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${API_URL}/notification/get-notification-preferences/${pushToken}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${userToken}`,
      },
    });
    console.log("Response status:", response);
    const data = await response.json();
    console.log("Response data:", data);
    if (!response.ok) {
      console.error("Error response data:", data);
      return { message: data.error, status: response.status };
    }

    return { message: data.message, status: response.status, preference: data.reminder_notification_frequency }; // success
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    throw error;
  }
};

// **********************************************
// ** Journal Image Upload API **
// **********************************************

export const uploadJournalImage = async (imageUri: string): Promise<string> => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      throw new Error('No authentication token available');
    }

    // Extract the original filename from the URI
    const originalFileName = imageUri.split('/').pop();
    if (!originalFileName) {
      throw new Error('Invalid image URI');
    }

    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: originalFileName
    } as any);

    console.log('Uploading image with FormData:', {
      uri: imageUri,
      type: 'image/jpeg',
      name: originalFileName
    });

    const uploadResponse = await fetch(`${API_URL}/journal/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      console.error('Upload failed:', errorData);
      throw new Error(errorData.error || 'Failed to upload image');
    }

    const data = await uploadResponse.json();
    console.log('Upload successful:', data);
    return data.signedUrl; // Return the signed URL from the response
  } catch (error) {
    console.error('Error uploading journal image:', error);
    throw error;
  }
};

export const deleteJournalImage = async (imageUrl: string): Promise<void> => {
  try {
    console.log('🗑️ Starting image deletion for URL:', imageUrl);
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      throw new Error('No authentication token available');
    }

    // Extract the S3 key from the signed URL
    const url = new URL(imageUrl);
    // Get the pathname and remove the leading slash
    const pathname = url.pathname;
    // Remove any query parameters and get the key
    const key = pathname.substring(1).split('?')[0];
    console.log('🗑️ Extracted S3 key:', key);

    const requestBody = { s3Key: key };
    console.log('🗑️ Request body:', JSON.stringify(requestBody));

    const response = await fetch(`${API_URL}/journal/delete-image`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('🗑️ Response status:', response.status);
    const responseText = await response.text();
    console.log('🗑️ Response body:', responseText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        errorData = { error: responseText };
      }
      console.error('❌ Delete failed:', errorData);
      throw new Error(errorData.error || 'Failed to delete image');
    }

    console.log('✅ Image deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting journal image:', error);
    throw error;
  }
};

// Function to update a check-in entry
export const updateCheckIn = async (entryId: string, sentiments: string[], causes: string[], comments: string[] = []) => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/check-in/${entryId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sentiments,
        causes,
        comments
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update check-in');
    }

    return await response.json();
  } catch (error) {
    console.error('Check-in update error:', error);
    throw error;
  }
};

export const updateJournalEntry = async (
  entryId: string,
  entryContent: string,
  entryDate?: string,
  images?: { fileName: string; signedUrl: string }[]
) => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      throw new Error('Authentication required');
    }

    console.log('Starting sentiment analysis for entry content:', entryContent);
    // Get sentiment analysis for the updated content
    const sentimentResult = await analyzeSentiment(entryContent);
    console.log('Raw sentiment analysis result:', JSON.stringify(sentimentResult, null, 2));

    if (!sentimentResult.emotions || !Array.isArray(sentimentResult.emotions)) {
      throw new Error('Invalid sentiment analysis result format');
    }

    // Define Emotion type
    type Emotion = { code: string; score: number };

    // Sort emotions by score (highest first)
    const sortedEmotions = sentimentResult.emotions.sort(
      (a: Emotion, b: Emotion) => b.score - a.score
    );

    // Get dominant emotion (highest score)
    const dominantEmotion = sortedEmotions[0];

    // Filter additional high-scoring emotions (>= 0.65)
    const additionalEmotions = sortedEmotions
      .slice(1)
      .filter((emotion: Emotion) => emotion.score >= 0.65);

    // Combine dominant emotion with high-scoring ones
    const selectedEmotions: Emotion[] = [dominantEmotion, ...additionalEmotions];

    // Map selected emotions
    const mappedSentiments = selectedEmotions.map((emotion: Emotion) => ({
      emotion: emotion.code,
      percentage: emotion.score,
    }));

    console.log('Mapped sentiments for server:', JSON.stringify(mappedSentiments, null, 2));

    const requestBody = {
      entryContent,
      entryDate: entryDate || new Date().toISOString(),
      images: images || [],
      journalSentiments: mappedSentiments
    };

    console.log('Sending update request with data:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${API_URL}/journal/${entryId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    // First get the raw response text
    const responseText = await response.text();
    console.log('Raw server response:', responseText);
    
    // Try to parse as JSON, but handle cases where it's not JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse server response:', responseText);
      throw new Error('Server returned an invalid response. Please try again.');
    }

    if (!response.ok) {
      throw new Error(responseData.error || 'Failed to update journal entry');
    }

    // Ensure the response includes the updated sentiment analysis
    if (!responseData.entry.journalSentiments) {
      responseData.entry.journalSentiments = mappedSentiments;
    }

    return responseData;
  } catch (error) {
    console.error('Journal entry update error:', error);
    throw error;
  }
};