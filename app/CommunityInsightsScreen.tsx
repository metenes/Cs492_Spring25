import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, ScrollView, Dimensions, StyleSheet,
  ActivityIndicator, TouchableOpacity
} from "react-native";
import { BarChart, PieChart, LineChart } from "react-native-chart-kit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "./context/ThemeContext";
import {
  fetchGeneralEmotion, fetchByKeybordEmotion, fetchSentimentData,
  fetchEmotionalRecommendations, fetchActivities, logActivity, analyzeSentiment
} from "./services/ApiService";

const screenWidth = Dimensions.get("window").width;

const chartConfig = {
  backgroundGradientFrom: "#fff",
  backgroundGradientTo: "#fff",
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(33, 33, 33, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(60, 60, 60, ${opacity})`,
  propsForDots: { r: "5", strokeWidth: "2", stroke: "#000" },
};

const CommunityInsightsScreen = () => {
  const [generalData, setGeneralData] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [keywordData, setKeywordData] = useState([]);
  const [weeklyTrends, setWeeklyTrends] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [activities, setActivities] = useState([]);
  const [sentimentSummary, setSentimentSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const { darkMode } = useTheme();

  const colors = [
    "#EF5350", "#AB47BC", "#5C6BC0", "#29B6F6", "#66BB6A", "#FFEE58",
    "#FFA726", "#8D6E63", "#78909C", "#D4E157", "#BA68C8", "#4DB6AC"
  ];

  // Validate and prepare data for pie chart
  const pieData = (data) => {
    if (!Array.isArray(data) || data.length === 0) {
      return [{ name: "No Data", population: 100, color: "#CCCCCC", legendFontColor: "#444", legendFontSize: 12 }];
    }
    
    return data
      .filter(d => d && typeof d.percentage === "number" && isFinite(d.percentage) && !isNaN(d.percentage))
      .slice(0, 6)
      .map((d, i) => ({
        name: d.emotion || "Unknown",
        population: d.percentage,
        color: colors[i % colors.length],
        legendFontColor: "#444",
        legendFontSize: 12,
      }));
  };
  
  // Validate and prepare data for bar chart
  const barData = (data) => {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        labels: ["No Data"],
        datasets: [{ data: [0] }]
      };
    }
    
    const cleaned = data.filter(d => d && typeof d.percentage === "number" && isFinite(d.percentage) && !isNaN(d.percentage));
    
    if (cleaned.length === 0) {
      return {
        labels: ["No Data"],
        datasets: [{ data: [0] }]
      };
    }
    
    return {
      labels: cleaned.map(d => d.emotion || "Unknown"),
      datasets: [{ data: cleaned.map(d => d.percentage) }]
    };
  };
  
  // Validate and prepare data for line chart
  const lineData = (data) => {
    if (!Array.isArray(data) || data.length === 0) {
      return {
        labels: [""],
        datasets: [{ data: [0] }]
      };
    }
    
    const cleaned = data.filter(d => 
      d && typeof d.percentage === "number" && isFinite(d.percentage) && !isNaN(d.percentage)
    );
    
    if (cleaned.length === 0) {
      return {
        labels: [""],
        datasets: [{ data: [0] }]
      };
    }

    return {
      labels: cleaned.map(d => d.day || "N/A"),
      datasets: [{ data: cleaned.map(d => d.percentage) }],
    };
  };
  
  const loadData = async () => {
    setLoading(true);
    
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        console.warn("No user token found");
        setLoading(false);
        return;
      }

      try {
        const [general, weekly, recs, acts] = await Promise.all([
          fetchGeneralEmotion(token).catch(e => {
            console.error("Error fetching general emotion data:", e);
            return [];
          }),
          fetchSentimentData(token, "week").catch(e => {
            console.error("Error fetching weekly sentiment data:", e);
            return [];
          }),
          fetchEmotionalRecommendations().catch(e => {
            console.error("Error fetching recommendations:", e);
            return { recommendations: [] };
          }),
          fetchActivities(token).catch(e => {
            console.error("Error fetching activities:", e);
            return [];
          }),
        ]);
        
        setGeneralData(Array.isArray(general) ? general : []);
        setWeeklyTrends(Array.isArray(weekly) ? weekly : []);
        setRecommendations(Array.isArray(recs.recommendations) ? recs.recommendations : []);
        setActivities(Array.isArray(acts) ? acts : []);
        
        try {
          await logActivity(token, "Viewed Community Insights");
        } catch (e) {
          console.error("Error logging activity:", e);
        }
      } catch (e) {
        console.error("Loading error in Promise.all:", e);
      }
    } catch (e) {
      console.error("Fatal loading error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeywordSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        console.warn("No user token found for keyword search");
        setLoading(false);
        return;
      }
      
      try {
        const [emotionData, sentimentResult] = await Promise.all([
          fetchByKeybordEmotion(token, keyword).catch(e => {
            console.error("Error fetching keyword emotion:", e);
            return [];
          }),
          analyzeSentiment(keyword).catch(e => {
            console.error("Error analyzing sentiment:", e);
            return { summary: "Error analyzing sentiment." };
          })
        ]);
        
        setKeywordData(Array.isArray(emotionData) ? emotionData : []);
        setSentimentSummary(sentimentResult?.summary || "No summary available.");
      } catch (e) {
        console.error("Keyword error in Promise.all:", e);
      }
    } catch (e) {
      console.error("Fatal keyword error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Safely render charts with error boundaries
  const renderPieChart = (data) => {
    try {
      const processedData = pieData(data);
      if (processedData.length === 0) {
        return <Text style={styles.noDataText}>No data available</Text>;
      }
      
      return (
        <PieChart
          data={processedData}
          width={screenWidth - 32}
          height={220}
          accessor="population"
          chartConfig={chartConfig}
          paddingLeft="15"
          backgroundColor="transparent"
          absolute
        />
      );
    } catch (error) {
      console.error("Error rendering pie chart:", error);
      return <Text style={styles.errorText}>Error rendering chart</Text>;
    }
  };

  const renderBarChart = (data) => {
    try {
      const processedData = barData(data);
      
      return (
        <BarChart
          data={processedData}
          width={screenWidth - 32}
          height={220}
          fromZero
          yAxisSuffix="%"
          chartConfig={chartConfig}
          style={styles.chart}
        />
      );
    } catch (error) {
      console.error("Error rendering bar chart:", error);
      return <Text style={styles.errorText}>Error rendering chart</Text>;
    }
  };

  const renderLineChart = (data) => {
    try {
      const processedData = lineData(data);
      
      return (
        <LineChart
          data={processedData}
          width={screenWidth - 32}
          height={220}
          yAxisSuffix="%"
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      );
    } catch (error) {
      console.error("Error rendering line chart:", error);
      return <Text style={styles.errorText}>Error rendering chart</Text>;
    }
  };

  return (
    <ScrollView style={[styles.container, darkMode && styles.darkContainer]}>
      <Text style={[styles.header, darkMode && styles.darkText]}>Community Emotional Overview</Text>

      <Text style={[styles.section, darkMode && styles.darkText]}>Top Community Emotions</Text>
      {loading ? (
        <ActivityIndicator size="large" style={{ marginVertical: 20 }} />
      ) : (
        renderPieChart(generalData)
      )}

      <Text style={[styles.section, darkMode && styles.darkText]}>Emotion Distribution (Bar)</Text>
      {loading ? (
        <ActivityIndicator size="large" style={{ marginVertical: 20 }} />
      ) : (
        renderBarChart(generalData)
      )}

      <Text style={[styles.section, darkMode && styles.darkText]}>Weekly Emotional Trends</Text>
      {loading ? (
        <ActivityIndicator size="large" style={{ marginVertical: 20 }} />
      ) : (
        renderLineChart(weeklyTrends)
      )}

      <Text style={[styles.section, darkMode && styles.darkText]}>Keyword-Based Emotion Search</Text>
      <TextInput
        style={[styles.input, darkMode && styles.darkInput]}
        placeholder="Try love, sadness, stress..."
        placeholderTextColor={darkMode ? "#999" : "#777"}
        value={keyword}
        onChangeText={setKeyword}
        onSubmitEditing={handleKeywordSearch}
      />

      <TouchableOpacity 
        style={styles.searchButton} 
        onPress={handleKeywordSearch}
        disabled={loading || !keyword.trim()}
      >
        <Text style={styles.searchButtonText}>Search</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator style={{ marginVertical: 10 }} />}

      {keywordData.length > 0 && (
        <>
          <Text style={[styles.sub, darkMode && styles.darkText]}>Emotions for: {keyword}</Text>
          {renderPieChart(keywordData)}
          {renderBarChart(keywordData)}
          
          <Text style={[styles.sub, darkMode && styles.darkText]}>Sentiment Summary</Text>
          <Text style={[styles.summaryBox, darkMode && styles.darkSummaryBox]}>
            {sentimentSummary || "No summary available."}
          </Text>
        </>
      )}

      <Text style={[styles.section, darkMode && styles.darkText]}>Emotionally-Aware Suggestions</Text>
      {recommendations.length > 0 ? (
        recommendations.map((rec, idx) => (
          <Text key={idx} style={[styles.recommendation, darkMode && styles.darkText]}>• {rec}</Text>
        ))
      ) : (
        <Text style={[styles.noDataText, darkMode && styles.darkText]}>No recommendations available</Text>
      )}

      <Text style={[styles.section, darkMode && styles.darkText]}>Recent Community Activity</Text>
      {activities.length > 0 ? (
        activities.map((act, idx) => (
          <Text key={idx} style={[styles.activity, darkMode && styles.darkText]}>
            • {act.description || "Activity"}
          </Text>
        ))
      ) : (
        <Text style={[styles.noDataText, darkMode && styles.darkText]}>No recent activities</Text>
      )}
      
      {/* Add some bottom padding for scrolling comfort */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fff", 
    padding: 16 
  },
  darkContainer: {
    backgroundColor: "#121212",
  },
  header: { 
    fontSize: 24, 
    fontWeight: "bold", 
    marginBottom: 12 
  },
  darkText: {
    color: "#fff",
  },
  section: { 
    fontSize: 18, 
    fontWeight: "600", 
    marginVertical: 10 
  },
  sub: { 
    fontSize: 16, 
    marginTop: 8, 
    fontWeight: "500" 
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    marginVertical: 10,
    color: "#000",
  },
  darkInput: {
    borderColor: "#444",
    color: "#fff",
    backgroundColor: "#333",
  },
  chart: { 
    borderRadius: 8, 
    marginBottom: 16 
  },
  summaryBox: {
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 8,
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
  },
  darkSummaryBox: {
    backgroundColor: "#333",
    color: "#eee",
  },
  recommendation: { 
    marginBottom: 4, 
    fontSize: 14 
  },
  activity: { 
    fontSize: 13, 
    color: "#555", 
    marginBottom: 3 
  },
  errorText: {
    color: "#D32F2F",
    textAlign: "center",
    padding: 20,
    fontSize: 14,
  },
  noDataText: {
    textAlign: "center",
    padding: 20,
    fontSize: 14,
    color: "#757575",
  },
  searchButton: {
    backgroundColor: "#5C6BC0",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  }
});

export default CommunityInsightsScreen;