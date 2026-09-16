import { describe, expect, it } from "vitest";
import { recentTailOffset, RECENT_MERGED_LIMIT, RECENT_PER_CATEGORY } from "@/components/explore/explore-view";

describe("recentTailOffset (category-index recency)", () => {
  it("computes the tail offset for populated categories", () => {
    expect(recentTailOffset(10)).toBe(7);
    expect(recentTailOffset(RECENT_PER_CATEGORY)).toBe(0);
  });

  it("never goes negative for small categories", () => {
    expect(recentTailOffset(0)).toBe(0);
    expect(recentTailOffset(1)).toBe(0);
    expect(recentTailOffset(2)).toBe(0);
  });

  it("keeps the bounded-read contract documented in values", () => {
    expect(RECENT_PER_CATEGORY).toBeLessThanOrEqual(3);
    expect(RECENT_MERGED_LIMIT).toBeLessThanOrEqual(6);
  });
});
