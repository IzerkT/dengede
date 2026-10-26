export type FoodUnit = "g" | "ml" | "portion" | "slice" | "piece" | "cup";

export type Food = {
  id: string;
  name: string;
  alternativeNames: string[];
  caloriesPer100: number;
  proteinPer100: number;
  defaultUnit: FoodUnit;
  defaultQuantity: number;
  gramsPerUnit: number;
  source: string;
  isApproximate: boolean;
};

export type FoodEntry = {
  id: string;
  food: Food;
  quantity: number;
  unit: FoodUnit;
  meal: "Kahvaltı" | "Öğle" | "Akşam" | "Atıştırmalık";
  createdAt: string;
};

export type WaterEntry = { id: string; amountMl: number; createdAt: string };

export const foods: Food[] = [
  { id: "egg", name: "Yumurta", alternativeNames: ["Haşlanmış yumurta"], caloriesPer100: 155, proteinPer100: 13, defaultUnit: "piece", defaultQuantity: 1, gramsPerUnit: 50, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "bread", name: "Ekmek", alternativeNames: ["Tam buğday ekmeği"], caloriesPer100: 265, proteinPer100: 9, defaultUnit: "slice", defaultQuantity: 1, gramsPerUnit: 30, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "white-cheese", name: "Beyaz peynir", alternativeNames: ["Peynir"], caloriesPer100: 264, proteinPer100: 14, defaultUnit: "g", defaultQuantity: 30, gramsPerUnit: 1, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "yogurt", name: "Yoğurt", alternativeNames: ["Süzme yoğurt"], caloriesPer100: 61, proteinPer100: 3.5, defaultUnit: "cup", defaultQuantity: 1, gramsPerUnit: 200, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "chicken", name: "Tavuk göğsü (pişmiş)", alternativeNames: ["Tavuk"], caloriesPer100: 165, proteinPer100: 31, defaultUnit: "g", defaultQuantity: 100, gramsPerUnit: 1, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "beef", name: "Dana eti (pişmiş)", alternativeNames: ["Kırmızı et"], caloriesPer100: 250, proteinPer100: 26, defaultUnit: "g", defaultQuantity: 100, gramsPerUnit: 1, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "fish", name: "Levrek (pişmiş)", alternativeNames: ["Balık"], caloriesPer100: 124, proteinPer100: 24, defaultUnit: "g", defaultQuantity: 150, gramsPerUnit: 1, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "rice", name: "Pirinç (pişmiş)", alternativeNames: ["Pilav"], caloriesPer100: 130, proteinPer100: 2.7, defaultUnit: "cup", defaultQuantity: 1, gramsPerUnit: 160, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "pasta", name: "Makarna (pişmiş)", alternativeNames: ["Sade makarna"], caloriesPer100: 157, proteinPer100: 5.8, defaultUnit: "cup", defaultQuantity: 1, gramsPerUnit: 140, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "oats", name: "Yulaf ezmesi", alternativeNames: ["Yulaf"], caloriesPer100: 389, proteinPer100: 16.9, defaultUnit: "g", defaultQuantity: 40, gramsPerUnit: 1, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "potato", name: "Patates (haşlanmış)", alternativeNames: ["Patates"], caloriesPer100: 87, proteinPer100: 1.9, defaultUnit: "g", defaultQuantity: 150, gramsPerUnit: 1, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "lentil", name: "Mercimek (pişmiş)", alternativeNames: ["Mercimek yemeği"], caloriesPer100: 116, proteinPer100: 9, defaultUnit: "cup", defaultQuantity: 1, gramsPerUnit: 200, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "tomato", name: "Domates", alternativeNames: [], caloriesPer100: 18, proteinPer100: 0.9, defaultUnit: "piece", defaultQuantity: 1, gramsPerUnit: 120, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "banana", name: "Muz", alternativeNames: [], caloriesPer100: 89, proteinPer100: 1.1, defaultUnit: "piece", defaultQuantity: 1, gramsPerUnit: 118, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "almond", name: "Badem", alternativeNames: ["Çiğ badem"], caloriesPer100: 579, proteinPer100: 21.2, defaultUnit: "g", defaultQuantity: 25, gramsPerUnit: 1, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "olive-oil", name: "Zeytinyağı", alternativeNames: [], caloriesPer100: 884, proteinPer100: 0, defaultUnit: "g", defaultQuantity: 10, gramsPerUnit: 1, source: "USDA FoodData Central, yaklaşık", isApproximate: true },
  { id: "menemen", name: "Menemen", alternativeNames: ["Yumurtalı menemen"], caloriesPer100: 120, proteinPer100: 6, defaultUnit: "portion", defaultQuantity: 1, gramsPerUnit: 200, source: "İçerik tarifine göre yaklaşık hesap", isApproximate: true },
  { id: "kuru-fasulye", name: "Kuru fasulye (pişmiş)", alternativeNames: ["Fasulye yemeği"], caloriesPer100: 140, proteinPer100: 9, defaultUnit: "cup", defaultQuantity: 1, gramsPerUnit: 200, source: "İçerik tarifine göre yaklaşık hesap", isApproximate: true },
];

export function quantityToGrams(quantity: number, unit: FoodUnit, gramsPerUnit: number): number {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Miktar sıfır veya daha büyük olmalıdır.");
  return unit === "g" || unit === "ml" ? quantity : quantity * gramsPerUnit;
}

export function calculateNutrition(food: Pick<Food, "caloriesPer100" | "proteinPer100" | "gramsPerUnit">, quantity: number, unit: FoodUnit) {
  const grams = quantityToGrams(quantity, unit, food.gramsPerUnit);
  return { grams, calories: (food.caloriesPer100 * grams) / 100, protein: (food.proteinPer100 * grams) / 100 };
}

export function sumNutrition(entries: Array<{ calories: number; protein: number }>) {
  return entries.reduce((total, entry) => ({ calories: total.calories + entry.calories, protein: total.protein + entry.protein }), { calories: 0, protein: 0 });
}

export function filterFoods(query: string) {
  const normalized = query.trim().toLocaleLowerCase("tr-TR");
  if (!normalized) return foods;
  return foods.filter((food) => [food.name, ...food.alternativeNames].some((value) => value.toLocaleLowerCase("tr-TR").includes(normalized)));
}
