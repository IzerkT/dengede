export type DailyStatus = "successful" | "partial" | "missed" | "no_data" | "incomplete";

export type GoalCriteria = {
  calorieLimit: number | null;
  waterTarget: number | null;
};

export type EffectiveGoal = GoalCriteria & { valid_from: string };

export type DailyTotals = {
  calories: number;
  protein: number;
  waterMl: number;
  hasCalories: boolean;
  hasProtein: boolean;
  hasWater: boolean;
};

export type DailyEvaluation = {
  status: DailyStatus;
  metMetrics: number;
  evaluatedMetrics: number;
};

export const STATUS_LABELS: Record<DailyStatus, string> = {
  successful: "Başarılı",
  partial: "Kısmen başarılı",
  missed: "Hedef kaçırıldı",
  no_data: "Veri yok",
  incomplete: "Veri eksik",
};

export const STATUS_DESCRIPTIONS: Record<DailyStatus, string> = {
  successful: "Kalori sınırına uyuldu ve su hedefi karşılandı.",
  partial: "İki günlük hedeften biri karşılandı.",
  missed: "Kalori ve su hedeflerinin hiçbiri karşılanmadı.",
  no_data: "Bu gün için takip kaydı bulunmuyor.",
  incomplete: "Kalori veya su verilerinden biri eksik.",
};

export function evaluateDay(criteria: GoalCriteria, totals: DailyTotals): DailyEvaluation {
  const calorieRecorded = criteria.calorieLimit !== null && totals.hasCalories;
  const waterRecorded = criteria.waterTarget !== null && totals.hasWater;
  const evaluatedMetrics = Number(calorieRecorded) + Number(waterRecorded);
  if (evaluatedMetrics === 0) return { status: "no_data", metMetrics: 0, evaluatedMetrics };
  if (evaluatedMetrics < 2) return { status: "incomplete", metMetrics: 0, evaluatedMetrics };
  const calorieMet = totals.calories <= (criteria.calorieLimit as number);
  const waterMet = totals.waterMl >= (criteria.waterTarget as number);
  const metMetrics = Number(calorieMet) + Number(waterMet);
  return { status: metMetrics === 2 ? "successful" : metMetrics === 1 ? "partial" : "missed", metMetrics, evaluatedMetrics };
}

export function selectHistoricalGoal(revisions: EffectiveGoal[], date: string, fallback: GoalCriteria): GoalCriteria {
  return revisions.find((revision) => revision.valid_from <= date) ?? fallback;
}

export function successRate(successfulDays: number, evaluableDays: number): number | null {
  return evaluableDays > 0 ? (successfulDays / evaluableDays) * 100 : null;
}

export function dataCoverage(evaluableDays: number, calendarDays: number): number {
  return calendarDays > 0 ? (evaluableDays / calendarDays) * 100 : 0;
}

export function calculateStreak(statuses: DailyStatus[]): number {
  let streak = 0;
  for (let index = statuses.length - 1; index >= 0; index -= 1) {
    if (statuses[index] !== "successful") break;
    streak += 1;
  }
  return streak;
}
