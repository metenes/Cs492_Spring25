const API_URL = "http://10.0.2.2:5000"; // Android Emulator
// const API_URL = "http://192.168.x.x:5000"; // Use your machine's IP.

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
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error("Invalid email or password");
  }
  return await response.json();
};

export const registerUser = async (email: string, password: string) => {
  console.log("registerUser() ... ")
  const response = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    console.log("registerUser() failed DONE... ")
    throw new Error("Registration failed");
  }
  return await response.json();
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

  return await response.json();  
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