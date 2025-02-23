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
      { date: "2025-03-03", counts: { Joy: 3, Anger: 4, Sadness: 2 } },
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
const emotions = [
  "Amusement", "Admiration", "Approval", "Caring", "Excitement", "Gratitude", "Joy", "Love", "Optimism", "Pride", "Relief", 
  "Anger", "Annoyance", "Disappointment", "Disapproval", "Disgust", "Embarrassment", "Fear", "Grief", "Jealousy", "Sadness", "Confusion", 
  "Curiosity", "Desire", "Neutral", "Remorse", "Surprise", "Realization"
];
const SentimentChart: React.FC<SentimentChartProps> = ({ selectedEmotions }) => {
  if (selectedEmotions.length === 0) {
    return <></>; // Ensuring a JSX return, even if no emotions are selected
  }

  // Function to generate grayscale colors (from light grey to almost white)
  const generateLighterGrayscaleColors = (total: number): string[] => {
    const minShade = 150; // Start from a lighter grey (150 out of 255)
    const maxShade = 240; // Stop at almost white (240 out of 255)

    return Array.from({ length: total }, (_, i) => {
      const shade = Math.floor(minShade + (i / (total - 1)) * (maxShade - minShade)); // Spread shades evenly
      return `rgb(${shade}, ${shade}, ${shade})`;
    });
  };

  // Generate grayscale colors for only 4 emotions
  const grayscaleColors = generateLighterGrayscaleColors(4);

  // Map only the **selected emotions** to lighter grayscale colors
  const emotionColors: Record<string, string> = Object.fromEntries(
    selectedEmotions.map((emotion, index) => [emotion, grayscaleColors[index]])
  );

  const chartData = {
    labels: ["Feb 1", "Feb 2", "Feb 3"], // X-axis labels
    datasets: selectedEmotions.map((emotion) => ({
      data: Array(3).fill(0).map(() => Math.random() * 10), // Placeholder random Y-values
      color: (opacity = 1) => emotionColors[emotion] || `rgba(200, 200, 200, ${opacity})`, // Default light grey
      strokeWidth: 2, // Line thickness
    })),
    legend: selectedEmotions.length > 0 ? selectedEmotions : ["No Data"], // Display selected emotions
  };

  return (
    <LineChart
      data={chartData}
      width={Dimensions.get("window").width }
      height={Dimensions.get("window").height / 3} 
      chartConfig={{
        backgroundColor: "#FFFFFF", // White background
        backgroundGradientFrom: "#FFFFFF",
        backgroundGradientTo: "#FFFFFF",
        decimalPlaces: 1,
        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // Black labels
        labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // Black label text
        style: { borderRadius: 12 },
        propsForDots: {
          r: 5, 
          strokeWidth: 1,
          stroke: "#000000", // Dots in black
        },
        propsForBackgroundLines: {
          stroke: "#CCCCCC", // Light grey grid lines
          strokeDasharray: "5 5", 
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
