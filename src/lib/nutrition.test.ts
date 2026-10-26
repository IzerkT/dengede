import { describe, expect, it } from "vitest";
import { calculateNutrition, quantityToGrams, sumNutrition, foods } from "./nutrition";

describe("nutrition calculations", () => {
  it("converts standard serving units to grams", () => {
    expect(quantityToGrams(2, "slice", 30)).toBe(60);
    expect(quantityToGrams(250, "ml", 1)).toBe(250);
  });
  it("calculates calories and protein from a snapshot value", () => {
    expect(calculateNutrition(foods[0], 2, "piece")).toEqual({ grams: 100, calories: 155, protein: 13 });
  });
  it("aggregates daily totals without rounding intermediate values", () => {
    expect(sumNutrition([{ calories: 100, protein: 5 }, { calories: 55.5, protein: 2.25 }])).toEqual({ calories: 155.5, protein: 7.25 });
  });
});
