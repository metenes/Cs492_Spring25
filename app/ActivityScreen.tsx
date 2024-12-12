import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { fetchActivities } from "./services/ApiService";
import { useAuth } from "./auth/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Define the type for Activity
interface Activity {
  activity: string;
  timestamp: Date; 
}

const ActivityScreen = () => {
  const [activities, setActivities] = useState<Activity[]>([]); // Set state type explicitly

  useEffect(() => {
    const getActivities = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          console.error("No token found");
          return;
        }
        const data = await fetchActivities(token); // Fetch activities from the API
        setActivities(data.activities); // Update state with fetched activities
      } catch (error) {
        console.error("Error fetching activities:", error);
      }
    };
    getActivities();
  }, []);

  const renderItem = ({ item }: { item: Activity }) => (
    <View style={styles.activityItem}>
      <Text style={styles.activityText}>{item.activity}</Text>
      <Text style={styles.timestamp}>
        {new Date(item.timestamp).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Activity Log</Text>
      <FlatList
        data={activities}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  activityItem: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
  },
  activityText: { fontSize: 16 },
  timestamp: { fontSize: 12, color: "#888" },
});

export default ActivityScreen;