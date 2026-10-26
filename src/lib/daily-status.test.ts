import { describe, expect, it } from "vitest";
import { calculateStreak, dataCoverage, evaluateDay, selectHistoricalGoal, successRate, type GoalCriteria } from "./daily-status";

const criteria: GoalCriteria = { calorieLimit: 2000, waterTarget: 2500 };
const totals = (overrides = {}) => ({ calories: 1800, protein: 0, waterMl: 3000, hasCalories: true, hasProtein: false, hasWater: true, ...overrides });

describe("basit günlük başarı durumu", () => {
  it("returns success when calories are within the limit and water reaches the target", () => {
    expect(evaluateDay(criteria, totals()).status).toBe("successful");
  });
  it("returns partial when exactly one required metric is met", () => {
    expect(evaluateDay(criteria, totals({ waterMl: 1000 })).status).toBe("partial");
    expect(evaluateDay(criteria, totals({ calories: 2400 })).status).toBe("partial");
  });
  it("returns missed when both metrics are recorded but neither is met", () => {
    expect(evaluateDay(criteria, totals({ calories: 2400, waterMl: 1000 })).status).toBe("missed");
  });
  it("distinguishes no data and incomplete data", () => {
    expect(evaluateDay(criteria, totals({ hasCalories: false, hasWater: false })).status).toBe("no_data");
    expect(evaluateDay(criteria, totals({ hasWater: false })).status).toBe("incomplete");
  });
  it("never uses protein to determine status", () => {
    expect(evaluateDay(criteria, totals({ protein: 0 })).status).toBe("successful");
    expect(evaluateDay(criteria, totals({ protein: 9999 })).status).toBe("successful");
  });
  it("keeps separate users' goals independent", () => {
    const otherUser = { calorieLimit: 1500, waterTarget: 2500 };
    expect(evaluateDay(criteria, totals()).status).toBe("successful");
    expect(evaluateDay(otherUser, totals()).status).toBe("partial");
  });
  it("uses the goal revision effective on the evaluated date", () => {
    const revisions = [
      { valid_from: "2026-10-20", calorieLimit: 1800, waterTarget: 2000 },
      { valid_from: "2026-10-01", calorieLimit: 2200, waterTarget: 2500 },
    ];
    expect(selectHistoricalGoal(revisions, "2026-10-10", criteria).calorieLimit).toBe(2200);
    expect(selectHistoricalGoal(revisions, "2026-09-30", criteria).calorieLimit).toBe(2000);
  });
});

describe("monthly calculations", () => {
  it("uses evaluable-day denominators", () => {
    expect(successRate(0, 0)).toBeNull();
    expect(successRate(3, 5)).toBe(60);
    expect(dataCoverage(5, 31)).toBeCloseTo(16.129);
  });
  it("calculates a consecutive success streak", () => {
    expect(calculateStreak(["successful", "successful", "partial", "successful"])).toBe(1);
  });
});
