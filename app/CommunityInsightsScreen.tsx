import React, { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, Dimensions, StyleSheet, ActivityIndicator } from "react-native";
import { BarChart, PieChart, LineChart } from "react-native-chart-kit";
import { fetchGeneralEmotion, fetchByKeybordEmotion, fetchSentimentData, fetchEmotionalRecommendations, fetchActivities, logActivity, analyzeSentiment } from "./services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from './context/ThemeContext';
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./types/types";

const screenWidth = Dimensions.get("window").width;

const chartConfig = {
  backgroundGradientFrom: "#ffffff",
  backgroundGradientTo: "#ffffff",
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  propsForDots: { r: "4", strokeWidth: "1", stroke: "#000" },
};

type CommunityInsightScreenNavigationProp = StackNavigationProp<RootStackParamList, "Home">;

const CommunityInsightsScreen = () => {
  const [generalData, setGeneralData] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [keywordData, setKeywordData] = useState([]);
  const [weeklyTrends, setWeeklyTrends] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [activities, setActivities] = useState([]);
  const [sentimentSummary, setSentimentSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<CommunityInsightScreenNavigationProp>();
  const { theme, darkMode } = useTheme();

  const chartColors = [
    "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40",
    "#C9CBCF", "#F7464A", "#46BFBD", "#FDB45C", "#949FB1", "#4D5360",
  ];

  const preparePieData = (data: any[]) =>
    data.slice(0, 6).map((d, index) => ({
      name: d.emotion,
      population: d.percentage,
      color: chartColors[index % chartColors.length],
      legendFontColor: "#333",
      legendFontSize: 12,
    }));

  const prepareBarData = (data: any[]) => ({
    labels: data.map((d) => d.emotion),
    datasets: [{ data: data.map((d) => d.percentage) }],
  });

  const prepareLineData = (data: any[]) => ({
    labels: data.map((d) => d.day),
    datasets: [{ data: data.map((d) => d.percentage) }],
  });

  const handleInitialLoad = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("userToken");
      if (!token) throw new Error("No token found");

      const [general, weekly, recs, acts] = await Promise.all([
        fetchGeneralEmotion(token),
        fetchSentimentData(token, 'week'),
        fetchEmotionalRecommendations(),
        fetchActivities(token),
      ]);

      setGeneralData(general);
      setWeeklyTrends(weekly);
      setRecommendations(recs.recommendations || []);
      setActivities(acts || []);
      await logActivity(token, "Viewed Community Insights");
    } catch (err) {
      console.error("Initialization Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchByKeyword = async () => {
    if (!keyword.trim()) return;

    setLoading(true);
    const token = await AsyncStorage.getItem('userToken');
    if (!token) return;

    try {
      const [emotionData, sentimentResult] = await Promise.all([
        fetchByKeybordEmotion(token, keyword),
        analyzeSentiment(keyword),
      ]);

      setKeywordData(emotionData);
      setSentimentSummary(sentimentResult?.summary || "No sentiment summary found.");
    } catch (err) {
      console.error("Keyword fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleInitialLoad();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Community Emotion Insights</Text>

      <Text style={styles.subtitle}>Top Emotions Overall</Text>
      <PieChart
        data={preparePieData(generalData)}
        width={screenWidth - 32}
        height={220}
        chartConfig={chartConfig}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute
      />

      <Text style={styles.subtitle}>Emotion Distribution</Text>
      <BarChart
        data={prepareBarData(generalData)}
        width={screenWidth - 32}
        height={220}
        yAxisSuffix="%"
        fromZero
        chartConfig={chartConfig}
        style={styles.chart}
      />

      <Text style={styles.subtitle}>Search Emotions by Topic</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. love, stress, school"
        value={keyword}
        onChangeText={setKeyword}
        onSubmitEditing={handleFetchByKeyword}
        returnKeyType="search"
      />

      {loading && <ActivityIndicator size="small" color="#000" style={{ marginVertical: 10 }} />}

      {keywordData.length > 0 && (
        <>
          <Text style={styles.subtitle}>Results for: {keyword}</Text>
          <PieChart
            data={preparePieData(keywordData)}
            width={screenWidth - 32}
            height={200}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />

          <BarChart
            data={prepareBarData(keywordData)}
            width={screenWidth - 32}
            height={220}
            yAxisSuffix="%"
            chartConfig={chartConfig}
            fromZero
            style={styles.chart}
          />

          <Text style={styles.subtitle}>Sentiment Summary</Text>
          <Text style={{ padding: 10, backgroundColor: '#f4f4f4', borderRadius: 6 }}>
            {sentimentSummary}
          </Text>
        </>
      )}

      <Text style={styles.subtitle}>Weekly Emotional Trends</Text>
      <LineChart
        data={prepareLineData(weeklyTrends)}
        width={screenWidth - 32}
        height={220}
        yAxisSuffix="%"
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
      />

      <Text style={styles.subtitle}>Recommendations</Text>
      {recommendations.map((rec, idx) => (
        <Text key={idx} style={styles.recommendation}>• {rec}</Text>
      ))}

      <Text style={styles.subtitle}>Recent Community Activities</Text>
      {activities.map((act, idx) => (
        <Text key={idx} style={styles.activity}>• {act.description || JSON.stringify(act)}</Text>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  subtitle: { fontSize: 16, fontWeight: "600", marginVertical: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 10,
  },
  chart: { marginVertical: 8, borderRadius: 10 },
  recommendation: { paddingVertical: 4, paddingHorizontal: 8, fontSize: 14 },
  activity: { paddingVertical: 3, fontSize: 13, color: '#555' },
});

export default CommunityInsightsScreen;
