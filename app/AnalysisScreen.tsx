import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
// import { LineChart } from "react-native-chart-kit";

export const AnalysisScreen = () => {
  const [moodTrends, setMoodTrends] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMoodData = async () => {
      try {
        const response = await fetch("https://your-backend-api.com/api/mood-analysis");
        const data = await response.json();

        setMoodTrends(data.moodTrends);
        setWeeklyData(data.weeklyData);
        setMonthlyData(data.monthlyData);
      } catch (error) {
        console.error("Error fetching mood data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMoodData();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        {loading ? <ActivityIndicator size="large" color="#0000ff" /> : (
          <>
            <View style={styles.card}>
              <Text style={styles.title}>Mood Trends</Text>
              <LineChart
                data={{
                  labels: ["Jan", "Feb", "Mar", "Apr"],
                  datasets: [{ data: moodTrends }],
                }}
                width={300}
                height={200}
                chartConfig={chartConfig}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Weekly Analysis</Text>
              
              <LineChart
                data={{
                  labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
                  datasets: [{ data: weeklyData }],
                }}
                width={300}
                height={200}
                chartConfig={chartConfig}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Monthly Analysis</Text>
              <LineChart
              
                data={{
                  labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
                  datasets: [{ data: monthlyData }],
                }}
                width={300}
                height={200}
                chartConfig={chartConfig}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const chartConfig = {
  backgroundColor: "#fff",
  backgroundGradientFrom: "#f3f3f3",
  backgroundGradientTo: "#fff",
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
  style: { borderRadius: 10 },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollView: { padding: 16 },
  card: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
});

export default AnalysisScreen;

