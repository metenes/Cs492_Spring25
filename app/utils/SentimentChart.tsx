import React from "react";
import { Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";

// Define the structure for API response
interface SentimentData {
  date: string;
  counts: Record<string, number>; // Emotion name as key, count as value
}

// Function to fetch sentiment data (Replace with actual API call)
const fetchSentimentData = async (
  startDate: Date,
  endDate: Date,
  selectedEmotions: string[]
): Promise<SentimentData[]> => {
  try {
    console.log("Fetching data for:", { startDate, endDate, selectedEmotions });

    // Simulated API response (Replace with real API response)
    return [
      { date: "2025-02-01", counts: { Joy: 5, Anger: 2, Sadness: 3 } },
      { date: "2025-02-02", counts: { Joy: 7, Anger: 1, Sadness: 4 } },
      { date: "2025-02-03", counts: { Joy: 3, Anger: 4, Sadness: 2 } },
    ];
  } catch (error) {
    console.error("Error fetching sentiment data:", error);
    return [];
  }
};

// Props for SentimentChart component
interface SentimentChartProps {
  selectedEmotions: string[];
}

const SentimentChart: React.FC<SentimentChartProps> = ({ selectedEmotions }) => {
  if (selectedEmotions.length === 0) {
    return <></>; // ✅ Ensuring a JSX return, even if no emotions are selected
  }

  const chartData = {
    labels: selectedEmotions.length > 0 ? ["Feb 1", "Feb 2", "Feb 3"] : [], // X-axis labels based on selected emotions
    datasets: selectedEmotions.map((emotion) => ({
      data: Array(3).fill(0).map(() => Math.random() * 10), // Placeholder random Y-values
      color: (opacity = 1) =>
        `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${opacity})`, // Random color
      strokeWidth: 2,
    })),
    legend: selectedEmotions.length > 0 ? selectedEmotions : ["No Data"], // Display selected emotions
  };

  return (
    <LineChart
      data={chartData}
      width={Dimensions.get("window").width - 32}
      height={250} 
      chartConfig={{
        backgroundColor: "#FFFFFF", // White background
        backgroundGradientFrom: "#FFFFFF",
        backgroundGradientTo: "#FFFFFF",
        decimalPlaces: 1,
        color: (opacity = 1, index = 0) => {
          const colors = ["#7C2020FF", "#1E88E5", "#43A047", "#FDD835", "#8E24AA"]; // Example colors per emotion
          return colors[index % colors.length]; // Assign each line a unique color
        },
        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // Black labels
        style: { borderRadius: 12 },
        propsForDots: {
          r: 5, 
          strokeWidth: 2,
          stroke: "#84505000", // Example fixed color for dots
        },
        propsForBackgroundLines: {
          stroke: "#BB5757FF", // Light grey grid lines
          strokeDasharray: "4 4", 
        },
      }}
      bezier
      withShadow
      withInnerLines
      withOuterLines
      style={{
        borderRadius: 12,
        elevation: 2, 
      }}
    />
  );
  
  
  
};

export { SentimentChart, fetchSentimentData };
