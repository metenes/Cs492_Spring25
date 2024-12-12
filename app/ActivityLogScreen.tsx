import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { fetchActivities } from "./services/ApiService";
import { useAuth } from "./auth/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ActivityLogScreen = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const getActivities = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const data = await fetchActivities(token);
        setActivities(data.activities);
      } catch (error) {
        console.error("Error fetching activities:", error);
      }
    };
    getActivities();
  }, []);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.activityItem}>
      <Text style={styles.activityText}>{item.activity}</Text>
      <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Activity Log</Text>
      <FlatList
        data={activities}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  activityItem: { marginBottom: 15, padding: 10, backgroundColor: "#f9f9f9", borderRadius: 8 },
  activityText: { fontSize: 16 },
  timestamp: { fontSize: 12, color: "#888" },
});

export default ActivityLogScreen;
