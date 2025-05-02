// __tests__/saveJournalEntry.performance.test.ts

import { saveJournalEntry } from "../../services/ApiService";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mock out any external dependencies (if needed)
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve("fake-token")),
}));

// A minimal “dummy” payload for speed testing
const DUMMY_CONTENT = "This is a performance test entry.";
const DUMMY_IMAGES = [];
const DUMMY_CATEGORY = "test";
const DUMMY_PROMPT = "automated performance check";

describe("saveJournalEntry performance", () => {
  it("should complete in under 2 seconds", async () => {
    const start = Date.now();
    await saveJournalEntry(
      DUMMY_CONTENT,
      DUMMY_IMAGES,
      DUMMY_CATEGORY,
      DUMMY_PROMPT,
      new Date().toISOString()
    );
    const duration = Date.now() - start;

    console.log(`⚡️ saveJournalEntry took ${duration}ms`);
    expect(duration).toBeLessThan(2000);
  });
});
