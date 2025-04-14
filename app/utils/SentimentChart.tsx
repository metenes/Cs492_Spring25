import React, { useEffect, useState, useRef } from "react";
import { Dimensions, Text, View, StyleSheet, Animated } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { fetchSentimentAnalysis } from "../services/ApiService";

// Replace the styles object with static styles
const styles = StyleSheet.create({
  skeletonContainer: {
    width: Dimensions.get("window").width - 32,
    borderRadius: 12,
    marginVertical: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    height: 350,
  },
  skeletonShimmer: {
    position: "absolute",
    width: "100%",
    height: 350,
  },
  skeletonText: {
    fontSize: 16,
  },
  placeholderContainer: {
    padding: 16,
    height: 370,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 18,
    textAlign: "center",
  },
  emptyTableHeader: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 4,
  },
  table: {
    width: "100%",
    borderRadius: 8,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 4,
    borderTopWidth: 1,
  },
  tableCell: {
    fontSize: 14,
    flex: 1,
    textAlign: "center",
  },
  tableHeaderCell: {
    fontWeight: "bold",
  },
});

// Props for SentimentChart component
interface SentimentChartProps {
  selectedEmotions: string[];
  interval: string;    // "daily", "weekly", "monthly", or "yearly"
  startDate: string;   // Format: "YYYY-MM-DD"
  endDate: string;     // Format: "YYYY-MM-DD"
  darkMode?: boolean;
}

// Structure for raw sentiment data from API.
interface RawSentiment {
  time_period: string;
  emotion: number;
  total_percentage: number;
  percentage: number;
  entry_count: number;
  count: number;
}

// Structure for our processed chart data.
interface ProcessedChartData {
  labels: string[];
  datasets: {
    data: number[];
    color: (opacity?: number) => string;
    strokeWidth: number;
    emotion: string;
  }[];
}

// Emotions array and mapping (code → emotion name)
const emotions = [
  "Amusement", "Admiration", "Approval", "Caring", "Excitement", "Gratitude",
  "Joy", "Love", "Optimism", "Pride", "Relief", "Anger", "Annoyance",
  "Disappointment", "Disapproval", "Disgust", "Embarrassment", "Fear", "Grief",
  "Jealousy", "Sadness", "Confusion", "Curiosity", "Desire", "Neutral",
  "Remorse", "Surprise", "Realization"
];

export const emotionMap: Record<number, string> = emotions.reduce(
  (acc, emotion, index) => {
    acc[index] = emotion;
    return acc;
  },
  {} as Record<number, string>
);

// Reverse mapping: emotion name → code
const reverseEmotionMap: Record<string, number> = Object.fromEntries(
  Object.entries(emotionMap).map(([code, name]) => [name, parseInt(code)])
);

// Define a pastel color palette for the chart lines.
const pastelColors = [
  "#FFB6C1", "#ADD8E6", "#FFDAB9", "#98FB98", "#DDA0DD", "#87CEFA", "#90EE90", "#FFB347"
];

// Increase chart height to 300 so it's more prominent.
const CHART_HEIGHT = 300;

/**
 * Returns a group key based on entryDate and selected interval.
 */
const getGroupKey = (entryDate: string, interval: string): string => {
  const date = new Date(entryDate);
  switch (interval) {
    case "daily":
      return date.toISOString().split("T")[0];
    case "weekly":
      const year = date.getFullYear();
      const firstJan = new Date(year, 0, 1);
      const pastDays = (date.getTime() - firstJan.getTime()) / 86400000;
      const weekNumber = Math.ceil((pastDays + firstJan.getDay() + 1) / 7);
      return `${year}-W${weekNumber}`;
    case "yearly":
      return date.getFullYear().toString();
    case "monthly":
    default:
      return date.toISOString().slice(0, 7);
  }
};

/**
 * Aggregates raw journal entries into an array of RawSentiment objects.
 */
const aggregateJournalEntries = (entries: any[], interval: string): RawSentiment[] => {
  const aggregation: Record<string, Record<number, { total_percentage: number; entry_count: number }>> = {};
  entries.forEach(entry => {
    const groupKey = getGroupKey(entry.entryDate, interval);
    if (!aggregation[groupKey]) {
      aggregation[groupKey] = {};
    }
    (entry.journalSentiments || []).forEach((sentiment: any) => {
      const emotion = sentiment.emotion;
      if (!aggregation[groupKey][emotion]) {
        aggregation[groupKey][emotion] = { total_percentage: 0, entry_count: 0 };
      }
      aggregation[groupKey][emotion].total_percentage += sentiment.percentage;
      aggregation[groupKey][emotion].entry_count += 1;
    });
  });
  const result: RawSentiment[] = [];
  for (const groupKey in aggregation) {
    for (const emotion in aggregation[groupKey]) {
      result.push({
        time_period: groupKey,
        emotion: parseInt(emotion),
        total_percentage: aggregation[groupKey][emotion].total_percentage,
        percentage: aggregation[groupKey][emotion].total_percentage,
        entry_count: aggregation[groupKey][emotion].entry_count,
        count: 0,
      });
    }
  }
  console.log("Aggregated journal entries:", result);
  return result;
};

/**
 * Processes raw aggregated data into a structure for the chart.
 */
const processData = (rawData: RawSentiment[], selectedEmotions: string[]): ProcessedChartData => {
  console.log("Raw sentiment data for chart:", rawData);
  console.log("Selected emotions:", selectedEmotions);
  
  // First, aggregate counts by date and emotion
  const aggregatedData = rawData.reduce((acc: { [key: string]: { [key: number]: number } }, item) => {
    if (!acc[item.time_period]) {
      acc[item.time_period] = {};
    }
    // Use count from the API response
    const count = item.count || 0;  // Changed from entry_count to count
    acc[item.time_period][item.emotion] = (acc[item.time_period][item.emotion] || 0) + count;
    
    console.log(`Aggregating - Date: ${item.time_period}, Emotion: ${item.emotion}, Count: ${count}, Total: ${acc[item.time_period][item.emotion]}`);
    return acc;
  }, {});

  console.log("Aggregated data:", aggregatedData);

  // Get unique sorted dates for labels
  let labels = Object.keys(aggregatedData).sort();
  console.log("Time periods (labels):", labels);

  const datasets = selectedEmotions.map(emotionName => {
    const emotionCode = reverseEmotionMap[emotionName];
    console.log(`Processing emotion: ${emotionName}, code: ${emotionCode}`);
    
    const dataArray = labels.map(label => {
      const count = aggregatedData[label]?.[emotionCode] || 0;
      console.log(`Date: ${label}, Emotion: ${emotionName} (code: ${emotionCode}), Count: ${count}`);
      return count;
    });
    
    return { 
      data: dataArray, 
      emotion: emotionName 
    };
  });

  // Don't filter out empty datasets - show them with zeros
  const filteredDatasets = datasets;
  console.log("Datasets with counts:", filteredDatasets);

  // Handle single data point differently
  if (labels.length === 1) {
    const date = new Date(labels[0]);
    const prevDate = new Date(date);
    prevDate.setDate(date.getDate() - 1);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);

    labels = [
      prevDate.toISOString().split('T')[0],
      labels[0],
      nextDate.toISOString().split('T')[0]
    ];

    filteredDatasets.forEach(ds => {
      ds.data = [0, ds.data[0], 0];
    });
  }

  const chartDatasets = filteredDatasets.map(ds => ({
    data: ds.data,
    color: (opacity = 1) =>
      pastelColors[selectedEmotions.indexOf(ds.emotion) % pastelColors.length] ||
      `rgba(200,200,200,${opacity})`,
    strokeWidth: 2,
    emotion: ds.emotion,
  }));

  const processedData: ProcessedChartData = { labels, datasets: chartDatasets };
  console.log("Final processed chart data:", processedData);
  return processedData;
};

/**
 * A modern Skeleton Loader with a shimmer effect.
 */
const ModernSkeletonLoader: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-Dimensions.get("window").width, Dimensions.get("window").width]
  });

  return (
    <View style={[styles.skeletonContainer, { backgroundColor: darkMode ? '#2C2C2C' : '#f0f0f0' }]}>
      <Animated.View style={[
        styles.skeletonShimmer, 
        { 
          transform: [{ translateX }],
          backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.3)'
        }
      ]} />
      <Text style={[styles.skeletonText, { color: darkMode ? '#B0B0B0' : '#666' }]}>
        Loading chart...
      </Text>
    </View>
  );
};

/**
 * Renders a fallback table when no sentiment data is available.
 * This table displays headers (Date + selected emotions) and rows with zeros.
 */
const renderEmptyTable = (
  selectedEmotions: string[], 
  startDate: string, 
  endDate: string, 
  labels: string[],
  darkMode: boolean
): JSX.Element => {
  return (
    <View style={[styles.placeholderContainer, { backgroundColor: darkMode ? '#121212' : '#fff' }]}>
      <Text style={[styles.emptyTableHeader, { color: darkMode ? '#B0B0B0' : '#666' }]}>
        Looks like this emotion hasn't appeared in your entries yet! Keep journaling, and we'll track it for you! ✨
      </Text>
      <View style={[styles.table, { backgroundColor: darkMode ? '#2C2C2C' : '#fff' }]}>
        <View style={styles.tableRow}>
          <Text style={[styles.tableCell, styles.tableHeaderCell]}>Date</Text>
          {selectedEmotions.map((emotion, index) => (
            <Text key={`header-${emotion}-${index}`} style={[styles.tableCell, styles.tableHeaderCell]}>
              {emotion}
            </Text>
          ))}
        </View>
        {labels.map((label, labelIndex) => (
          <View key={`row-${label}-${labelIndex}`} style={styles.tableRow}>
            <Text style={styles.tableCell}>{label}</Text>
            {selectedEmotions.map((emotion, emotionIndex) => (
              <Text key={`cell-${emotion}-${labelIndex}-${emotionIndex}`} style={styles.tableCell}>
                0
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

export const SentimentChart: React.FC<SentimentChartProps> = ({ 
  selectedEmotions, 
  interval, 
  startDate, 
  endDate,
  darkMode = false // Default to light mode
}) => {
  const [chartData, setChartData] = useState<ProcessedChartData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);

  // Fix: Only create emotionColors if selectedEmotions is not empty
  const emotionColors: Record<string, string> = selectedEmotions.length > 0 
    ? Object.fromEntries(
        selectedEmotions.map((emotion, index) => [
          emotion, 
          pastelColors[index % pastelColors.length]
        ])
      )
    : {};

  useEffect(() => {
    const fetchData = async () => {
      // Skip fetching if no emotions are selected
      if (selectedEmotions.length === 0) {
        setChartData(null);
        setError("empty");
        setLabels([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetchSentimentAnalysis(startDate, endDate, interval);
        console.log("API response in SentimentChart:", response);
        
        const rawData: RawSentiment[] = response.emotion_analysis || [];
        
        if (!rawData || rawData.length === 0) {
          setError("empty");
          setChartData(null);
          setLabels([]);
          return;
        }

        let processed = processData(rawData, selectedEmotions);
        setLabels(processed.labels);
        
        if (processed.datasets.length === 0) {
          setError("empty");
          setChartData(null);
        } else {
          setChartData(processed);
        }
      } catch (err: any) {
        console.error("Error in SentimentChart fetch:", err);
        setError(err.message);
        setChartData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, interval, selectedEmotions]);

  // If no emotion is selected, show a placeholder with fixed height.
  if (selectedEmotions.length === 0) {
    return (
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>
  Pick an emotion to track your journey! Your feelings shape your story ✨
</Text>

      </View>
    );
  }

  if (loading) {
    return <ModernSkeletonLoader darkMode={darkMode} />;
  }
  if (error && error !== "empty") {
    return (
      <View style={[styles.placeholderContainer, { backgroundColor: darkMode ? '#121212' : '#fff' }]}>
        <Text style={[styles.placeholderText, { color: darkMode ? '#B0B0B0' : '#888' }]}>
          Error: {error}
        </Text>
      </View>
    );
  }
  if (error === "empty" || !chartData) {
    return (
      <View style={[styles.placeholderContainer, { backgroundColor: darkMode ? '#121212' : '#fff' }]}>
        {renderEmptyTable(selectedEmotions, startDate, endDate, labels, darkMode)}
      </View>
    );
  }

  const chartConfig = {
    backgroundColor: darkMode ? "#121212" : "#FFFFFF",
    backgroundGradientFrom: darkMode ? "#121212" : "#FFFFFF",
    backgroundGradientTo: darkMode ? "#121212" : "#FFFFFF",
    decimalPlaces: 1,
    color: (opacity = 1) => darkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => darkMode ? `rgba(255, 255, 255, ${opacity})` : `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForLabels: {
      fontSize: 12,
      fill: darkMode ? "#FFFFFF" : "#000000",
    },
    propsForDots: {
      r: "4",
      stroke: darkMode ? "#FFFFFF" : "#000000",
      strokeWidth: "2",
    },
    yAxisLabel: "%",
    yAxisSuffix: "%",
    yAxisInterval: 20,
  };

  return (
    <View style={{ position: "relative" }}>
     <LineChart
  data={{
    labels: chartData.labels,
    datasets: chartData.datasets.map((dataset, index) => ({
      ...dataset,
      color: (opacity = 1) => pastelColors[index % pastelColors.length], // ✅ Ensures each line has a unique color
    })),
    legend: chartData.datasets.map(ds => ds.emotion),
  }}
  width={Dimensions.get("window").width - 32}
  height={CHART_HEIGHT}
  chartConfig={chartConfig}
  bezier
  withShadow
  withInnerLines
  withOuterLines
  style={{
    borderRadius: 12,
    marginVertical: 8,
  }}
/>






    </View>
  );
};
