import React, { useEffect, useState, useRef } from "react";
import { Dimensions, Text, View, StyleSheet, Animated } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { fetchJournalEntriesWithDate } from "../services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// Define the emotions array to match the backend
const emotions = [
  // Free Journaling Emotions (28)
  "admiration", "amusement", "anger", "annoyance", "approval", "caring",
  "confusion", "curiosity", "desire", "disappointment", "disapproval", "disgust",
  "embarrassment", "excitement", "fear", "gratitude", "grief", "joy", "love",
  "nervousness", "optimism", "pride", "realization", "relief", "remorse",
  "sadness", "surprise", "neutral",
  
  // Guided Journaling Emotions (5)


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

// Add debug logging for emotion mapping
console.log("Emotion mapping:", emotionMap);
console.log("Reverse emotion mapping:", reverseEmotionMap);

// Define a pastel color palette for the chart lines.
const pastelColors = [
  "#FFB6C1", "#ADD8E6", "#FFDAB9", "#98FB98", "#DDA0DD", "#87CEFA", "#90EE90", "#FFB347"
];

// Increase chart height to 300 so it's more prominent.
const CHART_HEIGHT = 300;

// Helper to normalize date for API calls
const normalizeDateForAPI = (date: Date): string => {
  // Set time to start of day in local timezone
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return toLocalDateString(normalized);
};

// Helper to get end of day for API calls
const getEndOfDay = (date: Date): string => {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return toLocalDateString(endOfDay);
};

// Helper to get local date string in "YYYY-MM-DD" format
const toLocalDateString = (date: Date) => {
  // Get the date in local timezone without time component
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to format date for display
const formatDateForDisplay = (dateString: string) => {
  try {
    // Handle both ISO date strings and YYYY-MM-DD format
    let date;
    if (dateString.includes('T')) {
      // If it's an ISO string, parse it directly
      date = new Date(dateString);
    } else {
      // If it's YYYY-MM-DD format, parse components
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', dateString);
      return 'Invalid Date';
    }

    // Format using Turkish locale
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

/**
 * Returns a group key based on entryDate and selected interval.
 */
const getGroupKey = (entryDate: string, interval: string): string => {
  try {
    // Handle both ISO date strings and YYYY-MM-DD format
    let date;
    if (entryDate.includes('T')) {
      // If it's an ISO string, parse it directly
      date = new Date(entryDate);
    } else {
      // If it's YYYY-MM-DD format, parse components
      const [year, month, day] = entryDate.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date:', entryDate);
      return entryDate;
    }

    // Normalize the date to start of day
    date.setHours(0, 0, 0, 0);

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    switch (interval) {
      case "daily":
        return toLocalDateString(date);
      case "weekly":
        const firstJan = new Date(year, 0, 1);
        const pastDays = (date.getTime() - firstJan.getTime()) / 86400000;
        const weekNumber = Math.ceil((pastDays + firstJan.getDay() + 1) / 7);
        return `${year}-W${weekNumber}`;
      case "yearly":
        return year.toString();
      case "monthly":
      default:
        return `${year}-${String(month).padStart(2, '0')}`;
    }
  } catch (error) {
    console.error('Error in getGroupKey:', error);
    return entryDate;
  }
};

// Add debug logging helper
const debugLog = (section: string, message: string, data?: any) => {
  console.log(`[SENTIMENT CHART] ${section}: ${message}`, data ? data : '');
};

/**
 * Aggregates raw journal entries into an array of RawSentiment objects.
 */
const aggregateJournalEntries = (entries: any[], interval: string): RawSentiment[] => {
  debugLog('AGGREGATION', 'Starting aggregation process');
  debugLog('AGGREGATION', 'Entry summary:', {
    totalEntries: entries.length,
    entryTypes: entries.reduce((acc: any, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {}),
    entriesWithSentiments: entries.filter(e => e.journalSentiments?.length > 0).length
  });

  const aggregation: Record<string, Record<number, { total_percentage: number; entry_count: number }>> = {};

  entries.forEach((entry, index) => {
    // Skip entries without sentiments
    if (!entry.journalSentiments || entry.journalSentiments.length === 0) {
      debugLog('AGGREGATION', `Skipping entry ${index} (no sentiments)`, {
        type: entry.type,
        date: entry.entryDate
      });
      return;
    }

    const groupKey = getGroupKey(entry.entryDate, interval);
    if (!aggregation[groupKey]) {
      aggregation[groupKey] = {};
    }

    debugLog('AGGREGATION', `Processing ${entry.type} entry ${index}`, {
      originalDate: entry.entryDate,
      normalizedDate: groupKey,
      sentimentCount: entry.journalSentiments.length,
      sentiments: entry.journalSentiments
    });

    entry.journalSentiments.forEach((sentiment: any) => {
      let code: number | undefined;
      
      // Handle different emotion formats
      if (typeof sentiment.emotion === 'number') {
        code = sentiment.emotion;
        debugLog('AGGREGATION', `Found numeric emotion code: ${code}`);
      } else if (typeof sentiment.emotion === 'string') {
        const emotionLower = sentiment.emotion.toLowerCase();
        code = reverseEmotionMap[emotionLower];
        debugLog('AGGREGATION', `Mapped string emotion: ${emotionLower} -> ${code}`);
        if (code === undefined) {
          debugLog('AGGREGATION', `WARNING: Could not map emotion string: ${emotionLower}`);
          return;
        }
      } else {
        debugLog('AGGREGATION', `WARNING: Invalid emotion format:`, sentiment.emotion);
        return;
      }

      // Initialize bucket if needed
      if (!aggregation[groupKey][code]) {
        aggregation[groupKey][code] = { total_percentage: 0, entry_count: 0 };
      }

      // Accumulate with proper percentage handling
      const percentage = typeof sentiment.percentage === 'number' ? sentiment.percentage : 1.0;
      aggregation[groupKey][code].total_percentage += percentage;
      aggregation[groupKey][code].entry_count += 1;

      debugLog('AGGREGATION', `Added emotion data`, {
        emotion: emotionMap[code],
        code: code,
        percentage: percentage,
        groupKey: groupKey,
        entryType: entry.type
      });
    });
  });

  debugLog('AGGREGATION', 'Final aggregation result:', aggregation);

  // Flatten into RawSentiment[]
  const result: RawSentiment[] = [];
  Object.entries(aggregation).forEach(([time_period, emotionsMap]) => {
    Object.entries(emotionsMap).forEach(([emotionKey, { total_percentage, entry_count }]) => {
      result.push({
        time_period,
        emotion: Number(emotionKey),
        total_percentage,
        percentage: total_percentage,
        entry_count,
        count: entry_count,
      });
    });
  });

  debugLog('AGGREGATION', 'Final processed data:', result);
  return result;
};

// Helper to format date for display in chart
const formatChartDate = (dateStr: string, interval: string): string => {
  try {
    if (interval === 'weekly' && dateStr.includes('W')) {
      // For weekly format (YYYY-WXX)
      const [year, week] = dateStr.split('-W');
      return `Week ${week}`;
    }

    if (interval === 'monthly') {
      // For monthly format (YYYY-MM)
      const [year, month] = dateStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('tr-TR', { month: 'short' });
    }

    if (interval === 'yearly') {
      // For yearly format (YYYY)
      return dateStr;
    }

    // For daily format (YYYY-MM-DD)
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('tr-TR', { 
      day: '2-digit',
      month: 'short'
    });
  } catch (error) {
    console.error('Error formatting chart date:', error);
    return dateStr;
  }
};

// Helper to get all dates in range
const getDatesInRange = (startDate: string, endDate: string, interval: string): string[] => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates: string[] = [];

  let current = new Date(start);
  while (current <= end) {
    dates.push(toLocalDateString(current));
    
    // Increment based on interval
    switch (interval) {
      case 'daily':
        current.setDate(current.getDate() + 1);
        break;
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'yearly':
        current.setFullYear(current.getFullYear() + 1);
        break;
    }
  }
  return dates;
};

/**
 * Processes raw aggregated data into a structure for the chart.
 */
const processData = (
  rawData: RawSentiment[], 
  selectedEmotions: string[],
  interval: string,
  startDate: string,
  endDate: string
): ProcessedChartData => {
  debugLog('PROCESS', 'Starting data processing', {
    rawDataLength: rawData.length,
    selectedEmotions,
    interval,
    dateRange: { startDate, endDate }
  });

  // Get all dates in the range
  const allDates = getDatesInRange(startDate, endDate, interval);
  debugLog('PROCESS', 'Generated date range', allDates);

  // First, aggregate counts by date and emotion
  const aggregatedData = rawData.reduce((acc: { [key: string]: { [key: number]: number } }, item) => {
    if (!acc[item.time_period]) {
      acc[item.time_period] = {};
    }
    const count = item.count || 0;
    acc[item.time_period][item.emotion] = count;
    debugLog('PROCESS', `Aggregated data point`, {
      timePeriod: item.time_period,
      emotion: item.emotion,
      count: count
    });
    return acc;
  }, {});

  debugLog('PROCESS', 'Aggregated data structure', aggregatedData);

  // Use all dates in range for labels
  const labels = allDates;
  debugLog('PROCESS', 'Time periods before formatting', labels);

  // Format labels based on interval
  const formattedLabels = labels.map(label => formatChartDate(label, interval));
  debugLog('PROCESS', 'Formatted labels', formattedLabels);

  const datasets = selectedEmotions.map(emotionName => {
    const emotionCode = reverseEmotionMap[emotionName.toLowerCase()];
    debugLog('PROCESS', `Processing emotion dataset`, {
      emotion: emotionName,
      code: emotionCode
    });

    const dataArray = labels.map(label => {
      const count = emotionCode !== undefined ? (aggregatedData[label]?.[emotionCode] || 0) : 0;
      debugLog('PROCESS', `Data point for ${emotionName}`, {
        date: label,
        count: count,
        hasData: !!aggregatedData[label]?.[emotionCode]
      });
      return count;
    });
    
    return { 
      data: dataArray, 
      emotion: emotionName 
    };
  });

  // Handle single data point differently
  if (labels.length === 1) {
    debugLog('PROCESS', 'Single data point detected, adding padding');
    const date = new Date(labels[0]);
    const prevDate = new Date(date);
    prevDate.setDate(date.getDate() - 1);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);

    const prevDateStr = toLocalDateString(prevDate);
    const nextDateStr = toLocalDateString(nextDate);

    labels.unshift(prevDateStr);
    labels.push(nextDateStr);
    formattedLabels.unshift(formatChartDate(prevDateStr, interval));
    formattedLabels.push(formatChartDate(nextDateStr, interval));

    datasets.forEach(ds => {
      ds.data.unshift(0);
      ds.data.push(0);
    });
  }

  const chartDatasets = datasets.map(ds => ({
    data: ds.data,
    color: (opacity = 1) =>
      pastelColors[selectedEmotions.indexOf(ds.emotion) % pastelColors.length] ||
      `rgba(200,200,200,${opacity})`,
    strokeWidth: 2,
    emotion: ds.emotion,
  }));

  const processedData: ProcessedChartData = { 
    labels: formattedLabels, 
    datasets: chartDatasets 
  };
  
  debugLog('PROCESS', 'Final processed chart data', {
    labels: processedData.labels,
    datasets: processedData.datasets.map(ds => ({
      emotion: ds.emotion,
      dataPoints: ds.data,
      nonZeroPoints: ds.data.filter(d => d > 0).length
    }))
  });

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
    <View style={[styles.placeholderContainer, { backgroundColor: darkMode ? '#1E1E1E' : '#fff' }]}>
      <Text style={[
        styles.emptyTableHeader, 
        { 
          color: darkMode ? '#FFB347' : '#666',
          fontWeight: '600',
          marginBottom: 16
        }
      ]}>
        Looks like this emotion hasn't appeared in your entries yet! Keep journaling, and we'll track it for you! ✨
      </Text>
      <View style={[
        styles.table, 
        { 
          backgroundColor: darkMode ? '#2C2C2C' : '#fff',
          borderWidth: 1,
          borderColor: darkMode ? '#1e1e1e' : '#FFF'
        }
      ]}>
        <View style={[
          styles.tableRow,
          {
            backgroundColor: darkMode ? '#363636' : '#f5f5f5',
            borderColor: darkMode ? '#404040' : '#e0e0e0'
          }
        ]}>
          <Text style={[
            styles.tableCell, 
            styles.tableHeaderCell,
            { color: darkMode ? '#FFFFFF' : '#000000' }
          ]}>
            Date
          </Text>
          {selectedEmotions.map((emotion, index) => (
            <Text 
              key={`header-${emotion}-${index}`} 
              style={[
                styles.tableCell, 
                styles.tableHeaderCell,
                { color: darkMode ? '#FFFFFF' : '#000000' }
              ]}
            >
              {emotion}
            </Text>
          ))}
        </View>
        {labels.map((label, labelIndex) => (
          <View 
            key={`row-${label}-${labelIndex}`} 
            style={[
              styles.tableRow,
              { borderColor: darkMode ? '#404040' : '#e0e0e0' }
            ]}
          >
            <Text style={[
              styles.tableCell,
              { color: darkMode ? '#B0B0B0' : '#666666' }
            ]}>
              {label}
            </Text>
            {selectedEmotions.map((emotion, emotionIndex) => (
              <Text 
                key={`cell-${emotion}-${labelIndex}-${emotionIndex}`} 
                style={[
                  styles.tableCell,
                  { color: darkMode ? '#B0B0B0' : '#666666' }
                ]}
              >
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
  darkMode = false
}) => {
  const [chartData, setChartData] = useState<ProcessedChartData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);


  useEffect(() => {
    // If no emotion selected, skip
    if (!selectedEmotions.length) {
      setChartData(null);
      setError("empty");
      setLabels([]);
      return;
    }
  
    const loadAndAggregate = async () => {
      setLoading(true);
      setError(null);
      try {
        debugLog('LOAD', 'Starting data load process');
        const token = await AsyncStorage.getItem("userToken");
        if (!token) throw new Error("Missing auth token");

        debugLog('LOAD', 'Fetching entries for date range', {
          startDate,
          endDate,
          interval,
          selectedEmotions
        });

        const { entries } = await fetchJournalEntriesWithDate(
          token,
          startDate,
          endDate
        );

        // Log detailed entry information
        debugLog('LOAD', 'Fetched entries summary', {
          total: entries.length,
          byType: entries.reduce((acc: any, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
          }, {}),
          entriesWithSentiments: entries.filter(e => e.journalSentiments?.length > 0).length,
          sampleEntries: entries.slice(0, 3).map(e => ({
            type: e.type,
            date: e.entryDate,
            sentiments: e.journalSentiments?.length || 0,
            sentimentDetails: e.journalSentiments?.map((s: any) => ({
              emotion: s.emotion,
              percentage: s.percentage
            }))
          }))
        });

        const raw: RawSentiment[] = aggregateJournalEntries(entries, interval);
        debugLog('LOAD', 'Aggregated raw data:', raw);

        if (!raw.length) {
          debugLog('LOAD', 'No data found after aggregation');
          setError("empty");
          setChartData(null);
          setLabels([]);
        } else {
          const processed = processData(raw, selectedEmotions, interval, startDate, endDate);
          debugLog('LOAD', 'Final processed chart data', {
            labels: processed.labels,
            datasets: processed.datasets.map(ds => ({
              emotion: ds.emotion,
              dataPoints: ds.data,
              nonZeroPoints: ds.data.filter(d => d > 0).length
            }))
          });
          setLabels(processed.labels);
          setChartData(processed);
        }
      } catch (err: any) {
        debugLog('ERROR', 'Chart load error:', err);
        setError(err.message);
        setChartData(null);
      } finally {
        setLoading(false);
      }
    };
  
    loadAndAggregate();
  }, [startDate, endDate, interval, selectedEmotions]);
  
  // If no emotion is selected, show a placeholder with fixed height.
  if (selectedEmotions.length === 0) {
    return (
      <View style={[
        styles.placeholderContainer,
        { 
          backgroundColor: darkMode ? '#1E1E1E' : '#fff',
          borderWidth: darkMode ? 1 : 0,
          borderColor: darkMode ? '#404040' : 'transparent',
          borderRadius: 8
        }
      ]}>
        <Text style={[
          styles.placeholderText,
          { 
            color: darkMode ? '#E0E0E0' : '#666',
            fontWeight: '500',
            fontSize: 20,
            textAlign: 'center',
            lineHeight: 28
          }
        ]}>
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
      <View style={[
        styles.placeholderContainer, 
        { 
          backgroundColor: darkMode ? '#1E1E1E' : '#fff',
          borderWidth: darkMode ? 1 : 0,
          borderColor: darkMode ? '#FF6B6B' : 'transparent',
          borderRadius: 8
        }
      ]}>
        <Text style={[
          styles.placeholderText, 
          { 
            color: darkMode ? '#FF6B6B' : '#FF4444',
            fontWeight: '600'
          }
        ]}>
          Error: {error}
        </Text>
      </View>
    );
  }
  if (error === "empty" || !chartData) {
    return (
      <View style={[
        styles.placeholderContainer, 
        { 
          backgroundColor: darkMode ? '#1E1E1E' : '#fff',
          borderWidth: darkMode ? 1 : 0,
          borderColor: darkMode ? '#FFB347' : 'transparent',
          borderRadius: 8
        }
      ]}>
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
