import { describe, expect, it } from "vitest";
import { calculateNutrition, quantityToGrams, resolveFoodDatabaseId, sumNutrition, foods } from "./nutrition";

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

  it("resolves local food codes to database UUIDs", () => {
    const rows = [
      { id: "11111111-1111-4111-8111-111111111111", catalog_code: "egg" },
      { id: "22222222-2222-4222-8222-222222222222", catalog_code: "chicken" },
      { id: "33333333-3333-4333-8333-333333333333", catalog_code: "rice" },
    ];
    expect(resolveFoodDatabaseId("egg", rows)).toBe(rows[0].id);
    expect(resolveFoodDatabaseId("chicken", rows)).toBe(rows[1].id);
    expect(resolveFoodDatabaseId("rice", rows)).toBe(rows[2].id);
  });

  it("rejects an unmapped food before a UUID foreign-key insert", () => {
    expect(() => resolveFoodDatabaseId("unknown", [])).toThrow("veritabanı yiyecek kaydı bulunamadı");
    expect(() => resolveFoodDatabaseId("egg", [{ id: "egg", catalog_code: "egg" }])).toThrow("veritabanı yiyecek kaydı bulunamadı");
  });
});
