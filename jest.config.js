/** @type {import('@jest/types').Config.ProjectConfig} */
module.exports = {
  // Use the Expo preset (it already includes TS support)
  preset: "jest-expo",

  // Automatically run this file before your tests
  setupFiles: ["<rootDir>/test/setup.ts"],

  // Don’t transform these modules (except a few React Native/Expo ones)
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))"
  ],

  // File extensions Jest will look for
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  // Where Jest looks for tests
  testMatch: [
    "**/__tests__/**/*.ts?(x)",
    "**/?(*.)+(spec|test).ts?(x)",
    "**/app/**/_test_/**/*.ts?(x)"
  ],

  // Simulate a browser environment (so you can test React components)
  testEnvironment: "jsdom",

  // Mock out static assets
  moduleNameMapper: {
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
      "<rootDir>/__mocks__/fileMock.js"
  },

  // If you need a custom TS transformer instead of babel,
  // you can uncomment this block and install ts-jest:
  //
  // transform: {
  //   "^.+\\.(ts|tsx)$": "ts-jest"
  // },
};
