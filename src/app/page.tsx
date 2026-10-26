"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import {
  calculateNutrition,
  foods as localFoods,
  type Food,
  type FoodUnit,
} from "@/lib/nutrition";
import { formatTurkishDate, todayInIstanbul } from "@/lib/date";
import {
  dataCoverage,
  evaluateDay,
  selectHistoricalGoal,
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
  successRate,
  type DailyStatus,
  type GoalCriteria,
} from "@/lib/daily-status";
import type { User } from "@supabase/supabase-js";

type Profile = { id: string; display_name: string };
type Goals = GoalCriteria & {
  calorie_goal: number | null;
  protein_goal: number | null;
  water_goal_ml: number | null;
};
type Entry = {
  id: string;
  owner_id: string;
  meal: string;
  recorded_at: string;
  food_entry_items: Array<{
    food_name_snapshot: string;
    calories_snapshot: number;
    protein_snapshot: number;
  }>;
};
type Water = {
  id: string;
  owner_id: string;
  amount_ml: number;
  recorded_at: string;
};
type Day = {
  date: string;
  entries: Entry[];
  water: Water[];
  status: ReturnType<typeof evaluateDay>;
};
type GoalRevision = Goals & { valid_from: string };

const defaultGoals: Goals = {
  calorie_goal: 2000,
  protein_goal: 120,
  water_goal_ml: 2500,
  calorieLimit: 2000,
  waterTarget: 2500,
};
const statusIcon: Record<DailyStatus, string> = {
  successful: "✓",
  partial: "◐",
  missed: "×",
  no_data: "–",
  incomplete: "!",
};
const monthNames = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return Array.from(
    { length: days },
    (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`,
  );
}
function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00+03:00`);
}
function totalsFor(entries: Entry[], water: Water[]) {
  const calories = entries.reduce(
    (sum, entry) =>
      sum +
      entry.food_entry_items.reduce(
        (inner, item) => inner + Number(item.calories_snapshot),
        0,
      ),
    0,
  );
  const protein = entries.reduce(
    (sum, entry) =>
      sum +
      entry.food_entry_items.reduce(
        (inner, item) => inner + Number(item.protein_snapshot),
        0,
      ),
    0,
  );
  return {
    calories,
    protein,
    waterMl: water.reduce((sum, item) => sum + item.amount_ml, 0),
    hasCalories: entries.length > 0,
    hasProtein: entries.length > 0,
    hasWater: water.length > 0,
  };
}
function normalizeGoals(row?: Record<string, unknown> | null): Goals {
  const value = <T,>(key: string, fallback: T) =>
    row && key in row ? (row[key] as T) : fallback;
  return {
    ...defaultGoals,
    calorie_goal: value("calorie_goal", defaultGoals.calorie_goal),
    protein_goal: value("protein_goal", defaultGoals.protein_goal),
    water_goal_ml: value("water_goal_ml", defaultGoals.water_goal_ml),
    calorieLimit: value("calorie_goal", defaultGoals.calorieLimit),
    waterTarget: value("water_goal_ml", defaultGoals.waterTarget),
  };
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [goalsByUser, setGoalsByUser] = useState<Record<string, Goals>>({});
  const [goalHistoryByUser, setGoalHistoryByUser] = useState<
    Record<string, GoalRevision[]>
  >({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [water, setWater] = useState<Water[]>([]);
  const [month, setMonth] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [section, setSection] = useState<
    "today" | "calendar" | "report" | "partner"
  >("today");
  const [calendarUserId, setCalendarUserId] = useState("");
  const [foodId, setFoodId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<FoodUnit>("piece");
  const [meal, setMeal] = useState("breakfast");
  const [goals, setGoals] = useState<Goals>(defaultGoals);
  const [inviteToken, setInviteToken] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const loadVersion = useRef(0);

  const foods = localFoods;
  const selectedFood = foods.find((food) => food.id === foodId) ?? foods[0];
  const dates = useMemo(() => monthDates(month), [month]);
  const goalForDate = useCallback(
    (ownerId: string, date: string) => {
      const revisions = goalHistoryByUser[ownerId] ?? [];
      return selectHistoricalGoal(
        revisions,
        date,
        revisions.length ? defaultGoals : (goalsByUser[ownerId] ?? goals),
      );
    },
    [goalHistoryByUser, goals, goalsByUser],
  );

  const loadData = useCallback(
    async (currentUser: User, selectedMonth: string) => {
      const requestId = ++loadVersion.current;
      const memberResult = await supabase
        .from("space_members")
        .select("space_id")
        .eq("user_id", currentUser.id)
        .maybeSingle();
      if (memberResult.error) throw memberResult.error;
      if (!memberResult.data) {
        setSpaceId(null);
        return;
      }
      const currentSpace = memberResult.data.space_id as string;
      setSpaceId(currentSpace);
      const membersResult = await supabase
        .from("space_members")
        .select("user_id")
        .eq("space_id", currentSpace);
      if (membersResult.error) throw membersResult.error;
      if (requestId !== loadVersion.current) return;
      const memberIds = (membersResult.data ?? []).map((item) => item.user_id);
      const [
        profilesResult,
        entriesResult,
        waterResult,
        goalsResult,
        allGoalsResult,
        historyResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name")
          .eq("id", currentUser.id)
          .single(),
        supabase
          .from("food_entries")
          .select(
            "id, owner_id, meal, recorded_at, food_entry_items(food_name_snapshot, calories_snapshot, protein_snapshot)",
          )
          .eq("space_id", currentSpace)
          .in("owner_id", memberIds)
          .gte("recorded_at", `${selectedMonth}-01T00:00:00+03:00`)
          .lt(
            "recorded_at",
            `${monthKey(new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 1))}-01T00:00:00+03:00`,
          )
          .order("recorded_at", { ascending: false }),
        supabase
          .from("water_entries")
          .select("id, owner_id, amount_ml, recorded_at")
          .eq("space_id", currentSpace)
          .in("owner_id", memberIds)
          .gte("recorded_at", `${selectedMonth}-01T00:00:00+03:00`)
          .lt(
            "recorded_at",
            `${monthKey(new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 1))}-01T00:00:00+03:00`,
          )
          .order("recorded_at", { ascending: false }),
        supabase
          .from("user_goals")
          .select("*")
          .eq("user_id", currentUser.id)
          .maybeSingle(),
        supabase.from("user_goals").select("*").in("user_id", memberIds),
        supabase
          .from("user_goal_history")
          .select("*")
          .in("user_id", memberIds)
          .lte("valid_from", `${selectedMonth}-31`)
          .order("valid_from", { ascending: false }),
      ]);
      if (
        membersResult.error ||
        profilesResult.error ||
        entriesResult.error ||
        waterResult.error ||
        goalsResult.error ||
        allGoalsResult.error ||
        historyResult.error
      )
        throw (
          membersResult.error ??
          profilesResult.error ??
          entriesResult.error ??
          waterResult.error ??
          goalsResult.error ??
          allGoalsResult.error ??
          historyResult.error
        );
      if (requestId !== loadVersion.current) return;
      const profileRows = memberIds.length
        ? await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", memberIds)
        : { data: [], error: null };
      if (profileRows.error) throw profileRows.error;
      const profileList = (profileRows.data ?? []) as Profile[];
      setPeople(profileList);
      setPartner(
        profileList.find((item) => item.id !== currentUser.id) ?? null,
      );
      setCalendarUserId((current) =>
        memberIds.includes(current) ? current : currentUser.id,
      );
      setProfile(profilesResult.data as Profile);
      setEntries((entriesResult.data ?? []) as Entry[]);
      setWater((waterResult.data ?? []) as Water[]);
      const ownGoals = normalizeGoals(goalsResult.data);
      setGoals(ownGoals);
      const mapped: Record<string, Goals> = { [currentUser.id]: ownGoals };
      (allGoalsResult.data ?? []).forEach((row) => {
        mapped[row.user_id] = normalizeGoals(row);
      });
      setGoalsByUser(mapped);
      const history: Record<string, GoalRevision[]> = {};
      (historyResult.data ?? []).forEach((row) => {
        history[row.user_id] = [
          ...(history[row.user_id] ?? []),
          { ...normalizeGoals(row), valid_from: row.valid_from },
        ];
      });
      setGoalHistoryByUser(history);
      const ownDays = monthDates(selectedMonth).map((date) => {
        const ownEntries = (entriesResult.data ?? []).filter(
          (entry: Entry) =>
            entry.owner_id === currentUser.id &&
            todayInIstanbul(new Date(entry.recorded_at)) === date,
        );
        const ownWater = (waterResult.data ?? []).filter(
          (item: Water) =>
            item.owner_id === currentUser.id &&
            todayInIstanbul(new Date(item.recorded_at)) === date,
        );
        return {
          status: evaluateDay(
            mapped[currentUser.id],
            totalsFor(ownEntries, ownWater),
          ).status,
          water: ownWater,
          totals: totalsFor(ownEntries, ownWater),
        };
      });
      const successfulCount = ownDays.filter(
        (day) => day.status === "successful",
      ).length;
      const waterSuccesses = ownDays.filter(
        (day) => day.status === "successful" && day.totals.hasWater,
      ).length;
      const awards = [
        successfulCount >= 1 && "first-success",
        successfulCount >= 3 && "three-successes",
        successfulCount >= 10 && "ten-successes",
        waterSuccesses >= 5 && "five-water",
        ownDays.some(
          (_, index) =>
            index >= 6 &&
            ownDays
              .slice(index - 6, index + 1)
              .every((day) => day.status === "successful"),
        ) && "first-week",
      ].filter((award): award is string => Boolean(award));
      if (awards.length)
        await supabase.from("user_achievements").upsert(
          awards.map((achievement_id) => ({
            user_id: currentUser.id,
            achievement_id,
          })),
          { onConflict: "user_id,achievement_id", ignoreDuplicates: true },
        );
      if (!foodId) setFoodId(foods[0].id);
    },
    [foodId, foods, supabase],
  );

  useEffect(() => {
    let mounted = true;
    if (!month) {
      const timer = window.setTimeout(() => {
        setMonth(monthKey(new Date()));
        setSelectedDate(todayInIstanbul());
      }, 0);
      return () => {
        mounted = false;
        window.clearTimeout(timer);
      };
    }
    supabase.auth.getUser().then(async ({ data, error: authError }) => {
      if (authError || !data.user) {
        router.push("/login");
        return;
      }
      if (!mounted) return;
      setUser(data.user);
      setCurrentDate(new Date().toISOString());
      try {
        await loadData(data.user, month);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Veriler yüklenemedi.",
        );
      } finally {
        if (mounted) setBusy(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadData, month, router, supabase]);

  const dayRows = useMemo(
    () =>
      dates.map((date) => {
        const dayEntries = entries.filter(
          (entry) =>
            todayInIstanbul(new Date(entry.recorded_at)) === date &&
            entry.owner_id === calendarUserId,
        );
        const dayWater = water.filter(
          (item) =>
            todayInIstanbul(new Date(item.recorded_at)) === date &&
            item.owner_id === calendarUserId,
        );
        const dayGoals = goalForDate(calendarUserId, date);
        return {
          date,
          entries: dayEntries,
          water: dayWater,
          status: evaluateDay(dayGoals, totalsFor(dayEntries, dayWater)),
        };
      }),
    [dates, entries, goalForDate, calendarUserId, water],
  );
  const selected =
    dayRows.find((row) => row.date === selectedDate) ?? dayRows[0];
  const todayEntries = entries.filter(
    (entry) =>
      entry.owner_id === user?.id &&
      todayInIstanbul(new Date(entry.recorded_at)) === todayInIstanbul(),
  );
  const todayWater = water.filter(
    (item) =>
      item.owner_id === user?.id &&
      todayInIstanbul(new Date(item.recorded_at)) === todayInIstanbul(),
  );
  const todayTotals = totalsFor(todayEntries, todayWater);
  const todayGoals = goalsByUser[user?.id ?? ""] ?? goals;

  async function refresh() {
    if (user) await loadData(user, month);
  }
  async function addFood() {
    if (!user || !spaceId || saving || quantity <= 0) return;
    setSaving(true);
    setError("");
    const result = calculateNutrition(selectedFood, quantity, unit);
    const entry = await supabase
      .from("food_entries")
      .insert({ space_id: spaceId, owner_id: user.id, meal })
      .select("id")
      .single();
    if (entry.error) setError(entry.error.message);
    else {
      const item = await supabase
        .from("food_entry_items")
        .insert({
          food_entry_id: entry.data.id,
          food_id: selectedFood.id,
          food_name_snapshot: selectedFood.name,
          quantity,
          unit,
          grams: result.grams,
          calories_snapshot: result.calories,
          protein_snapshot: result.protein,
        });
      if (item.error) {
        await supabase.from("food_entries").delete().eq("id", entry.data.id);
        setError(item.error.message);
      } else {
        setMessage("Yiyecek kaydedildi.");
        await refresh();
      }
    }
    setSaving(false);
  }
  async function addWater(amount: number) {
    if (!user || !spaceId || pending) return;
    setPending(true);
    const result = await supabase
      .from("water_entries")
      .insert({ space_id: spaceId, owner_id: user.id, amount_ml: amount });
    if (result.error) setError(result.error.message);
    else {
      setMessage(`${amount} ml su kaydedildi.`);
      await refresh();
    }
    setPending(false);
  }
  async function saveGoals() {
    if (!user || pending) return;
    setPending(true);
    setError("");
    const payload = {
      user_id: user.id,
      calorie_goal: goals.calorieLimit,
      protein_goal: goals.protein_goal,
      water_goal_ml: goals.waterTarget,
    };
    const result = await supabase
      .from("user_goals")
      .upsert(payload, { onConflict: "user_id" });
    const history = await supabase
      .from("user_goal_history")
      .upsert(
        { ...payload, valid_from: todayInIstanbul() },
        { onConflict: "user_id,valid_from" },
      );
    if (result.error || history.error)
      setError(
        (result.error ?? history.error)?.message ?? "Hedefler kaydedilemedi.",
      );
    else {
      setMessage("Hedeflerin kaydedildi.");
      await refresh();
    }
    setPending(false);
  }
  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }
  async function createSpace() {
    setPending(true);
    const result = await supabase.rpc("create_space", {
      space_name: "Bizim alanımız",
    });
    if (result.error) setError(result.error.message);
    else if (user) await refresh();
    setPending(false);
  }
  async function createInvite() {
    if (!spaceId || pending) return;
    setPending(true);
    const result = await supabase.rpc("create_invitation", {
      invite_space: spaceId,
    });
    if (result.error) setError(result.error.message);
    else setInviteToken(String(result.data));
    setPending(false);
  }
  async function joinSpace() {
    if (!invite.trim() || pending) return;
    setPending(true);
    const result = await supabase.rpc("join_space", {
      invite_token: invite.trim(),
    });
    if (result.error) setError(result.error.message);
    else if (user) {
      setInvite("");
      await refresh();
    }
    setPending(false);
  }

  if (busy)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8f7] text-slate-500">
        Veriler yükleniyor...
      </main>
    );
  if (!spaceId)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8f7] px-4">
        <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl">
          <h1 className="text-2xl font-bold">Dengede alanına başla</h1>
          <p className="mt-2 text-sm text-slate-500">
            Partnerinle özel bir alan oluştur veya davet koduyla katıl.
          </p>
          <button
            disabled={pending}
            onClick={createSpace}
            className="mt-6 w-full rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50"
          >
            {pending ? "Alan oluşturuluyor..." : "Yeni alan oluştur"}
          </button>
          <div className="my-5 border-t pt-5">
            <input
              value={invite}
              onChange={(event) => setInvite(event.target.value)}
              placeholder="Davet kodu"
              className="w-full rounded-xl border px-4 py-3"
            />
            <button
              disabled={!invite.trim() || pending}
              onClick={joinSpace}
              className="mt-2 w-full rounded-xl border border-emerald-200 py-3 font-bold text-emerald-700 disabled:opacity-50"
            >
              Davete katıl
            </button>
          </div>
          <button onClick={signOut} className="text-sm text-slate-400">
            Çıkış yap
          </button>
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </section>
      </main>
    );

  const reportRows = people.map((person) => {
    const rows = dates.map((date) => {
      const personEntries = entries.filter(
        (entry) =>
          entry.owner_id === person.id &&
          todayInIstanbul(new Date(entry.recorded_at)) === date,
      );
      const personWater = water.filter(
        (item) =>
          item.owner_id === person.id &&
          todayInIstanbul(new Date(item.recorded_at)) === date,
      );
      return {
        date,
        status: evaluateDay(
          goalForDate(person.id, date),
          totalsFor(personEntries, personWater),
        ),
        totals: totalsFor(personEntries, personWater),
      };
    });
    const evaluable = rows.filter(
      (row) => !["no_data", "incomplete"].includes(row.status.status),
    );
    return {
      person,
      rows,
      successful: rows.filter((row) => row.status.status === "successful")
        .length,
      partial: rows.filter((row) => row.status.status === "partial").length,
      missed: rows.filter((row) => row.status.status === "missed").length,
      noData: rows.filter((row) => row.status.status === "no_data").length,
      incomplete: rows.filter((row) => row.status.status === "incomplete")
        .length,
      evaluable,
      calories: rows.filter((row) => row.totals.hasCalories),
      protein: rows.filter((row) => row.totals.hasProtein),
      water: rows.filter((row) => row.totals.hasWater),
    };
  });

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <p className="text-xl font-bold text-emerald-800">Dengede</p>
            <p className="text-xs text-slate-500">
              {profile?.display_name} ·{" "}
              {partner
                ? `${partner.display_name} ile ortak alan`
                : "Partner bekleniyor"}
            </p>
          </div>
          <button
            onClick={signOut}
            className="rounded-full border bg-white px-4 py-2 text-sm"
          >
            Çıkış yap
          </button>
        </header>
        <nav
          aria-label="Ana menü"
          className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-sm sm:grid-cols-4"
        >
          {[
            ["today", "Bugün"],
            ["calendar", "Takvim"],
            ["report", "Aylık rapor"],
            ["partner", "Partnerim"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSection(key as typeof section)}
              className={`rounded-xl px-2 py-3 text-sm font-semibold ${section === key ? "bg-emerald-600 text-white" : "text-slate-600"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        {message && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {message}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {section === "today" && (
          <>
            <section className="mb-5 rounded-3xl bg-[#123c35] p-6 text-white">
              <p className="text-sm text-emerald-200">
                {currentDate
                  ? formatTurkishDate(new Date(currentDate))
                  : "Bugün"}
              </p>
              <h1 className="mt-2 text-3xl font-bold">
                Günaydın, {profile?.display_name} 👋
              </h1>
              <p className="mt-2 text-sm text-emerald-100/80">
                {
                  STATUS_DESCRIPTIONS[
                    evaluateDay(todayGoals, todayTotals).status
                  ]
                }
              </p>
            </section>
            <Metrics
              totals={todayTotals}
              goals={todayGoals}
              status={evaluateDay(todayGoals, todayTotals).status}
            />
            <SimpleGoalEditor
              goals={goals}
              setGoals={setGoals}
              saveGoals={saveGoals}
              pending={pending}
            />
            <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <FoodForm
                foods={foods}
                selectedFood={selectedFood}
                quantity={quantity}
                setQuantity={setQuantity}
                unit={unit}
                setUnit={setUnit}
                meal={meal}
                setMeal={setMeal}
                foodId={foodId}
                setFoodId={setFoodId}
                addFood={addFood}
                saving={saving}
                addWater={addWater}
                pending={pending}
              />
              <DayDetails
                selected={{
                  date: todayInIstanbul(),
                  entries: todayEntries,
                  water: todayWater,
                  status: evaluateDay(todayGoals, todayTotals),
                }}
              />
            </section>
          </>
        )}
        {section === "partner" && (
          <PartnerDashboard
            partner={partner}
            entries={entries}
            water={water}
            goals={goalsByUser[partner?.id ?? ""] ?? defaultGoals}
            inviteToken={inviteToken}
            createInvite={createInvite}
            pending={pending}
            currentDate={currentDate}
          />
        )}
        {section === "calendar" && (
          <CalendarView
            month={month}
            setMonth={setMonth}
            dates={dates}
            rows={dayRows}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            calendarUserId={calendarUserId}
            setCalendarUserId={setCalendarUserId}
            people={people}
            selected={selected}
          />
        )}
        {section === "report" && (
          <ReportView
            month={month}
            setMonth={setMonth}
            reportRows={reportRows}
          />
        )}
        <p className="mt-8 text-xs text-slate-500">
          Başarı hesabı yalnızca kayıtlı ve yapılandırılmış hedefleri kullanır.
          Veri yok veya eksik günler başarısız sayılmaz.
        </p>
      </div>
    </main>
  );
}

function Metrics({
  totals,
  goals,
  status,
}: {
  totals: ReturnType<typeof totalsFor>;
  goals: Goals;
  status: DailyStatus;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-4">
      <Metric label="Durum" value={STATUS_LABELS[status]} />
      <Metric
        label="Kalori"
        value={`${Math.round(totals.calories)} / ${goals.calorieLimit ?? "—"} kcal`}
      />
      <Metric
        label="Protein"
        value={`${Math.round(totals.protein)} / ${goals.protein_goal ?? "—"} g`}
      />
      <Metric
        label="Su"
        value={`${totals.waterMl} / ${goals.waterTarget ?? "—"} ml`}
      />
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 font-bold">{value}</p>
    </div>
  );
}
function FoodForm({
  foods,
  selectedFood,
  foodId,
  setFoodId,
  quantity,
  setQuantity,
  unit,
  setUnit,
  meal,
  setMeal,
  addFood,
  saving,
  addWater,
  pending,
}: {
  foods: Food[];
  selectedFood: Food;
  foodId: string;
  setFoodId: (value: string) => void;
  quantity: number;
  setQuantity: (value: number) => void;
  unit: FoodUnit;
  setUnit: (value: FoodUnit) => void;
  meal: string;
  setMeal: (value: string) => void;
  addFood: () => void;
  saving: boolean;
  addWater: (amount: number) => void;
  pending: boolean;
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-bold">Bugün kayıt ekle</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <select
          value={foodId}
          onChange={(event) => setFoodId(event.target.value)}
          className="rounded-xl border px-3 py-3"
        >
          {foods.map((food) => (
            <option key={food.id} value={food.id}>
              {food.name}
            </option>
          ))}
        </select>
        <select
          value={meal}
          onChange={(event) => setMeal(event.target.value)}
          className="rounded-xl border px-3 py-3"
        >
          <option value="breakfast">Kahvaltı</option>
          <option value="lunch">Öğle</option>
          <option value="dinner">Akşam</option>
          <option value="snack">Atıştırmalık</option>
        </select>
        <input
          type="number"
          min="0.1"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
          className="rounded-xl border px-3 py-3"
        />
        <select
          value={unit}
          onChange={(event) => setUnit(event.target.value as FoodUnit)}
          className="rounded-xl border px-3 py-3"
        >
          <option value="g">gram</option>
          <option value="piece">adet</option>
          <option value="portion">porsiyon</option>
          <option value="slice">dilim</option>
          <option value="cup">kupa</option>
        </select>
      </div>
      <button
        onClick={addFood}
        disabled={saving}
        className="mt-3 w-full rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50"
      >
        {saving ? "Kaydediliyor..." : `${selectedFood.name} ekle`}
      </button>
      <div className="mt-5 border-t pt-4">
        <p className="text-sm font-bold">Su ekle</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[200, 500, 750].map((amount) => (
            <button
              key={amount}
              onClick={() => addWater(amount)}
              disabled={pending}
              className="rounded-xl border border-sky-200 py-3 text-sm font-semibold text-sky-700 disabled:opacity-50"
            >
              {amount} ml
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
function DayDetails({ selected }: { selected?: Day }) {
  if (!selected) return null;
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-bold">{selected.date} kayıtları</h2>
      {selected.entries.length || selected.water.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {selected.entries.flatMap((entry) =>
            entry.food_entry_items.map((item) => (
              <li
                key={`${entry.id}-${item.food_name_snapshot}`}
                className="flex justify-between border-b pb-2"
              >
                <span>{item.food_name_snapshot}</span>
                <span>{Math.round(Number(item.calories_snapshot))} kcal</span>
              </li>
            )),
          )}
          {selected.water.map((item) => (
            <li key={item.id} className="flex justify-between border-b pb-2">
              <span>Su</span>
              <span>{item.amount_ml} ml</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Bu gün için kayıt bulunmuyor.
        </p>
      )}
    </section>
  );
}
function InviteCard({
  inviteToken,
  createInvite,
  pending,
}: {
  inviteToken: string;
  createInvite: () => void;
  pending: boolean;
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-bold">Partner daveti</h2>
      <p className="mt-2 text-sm text-slate-500">
        Partnerin yalnızca ortak alanındaki kayıtları görebilir; kayıtlarını
        değiştiremez.
      </p>
      <button
        onClick={createInvite}
        disabled={pending}
        className="mt-4 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50"
      >
        {pending ? "Oluşturuluyor..." : "Davet kodu oluştur"}
      </button>
      {inviteToken && (
        <p className="mt-3 break-all rounded-xl bg-emerald-50 p-3 text-sm font-mono">
          {inviteToken}
        </p>
      )}
    </section>
  );
}
function CalendarView({
  month,
  setMonth,
  dates,
  rows,
  selectedDate,
  setSelectedDate,
  calendarUserId,
  setCalendarUserId,
  people,
  selected,
}: {
  month: string;
  setMonth: (value: string) => void;
  dates: string[];
  rows: Day[];
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  calendarUserId: string;
  setCalendarUserId: (value: string) => void;
  people: Profile[];
  selected?: Day;
}) {
  const [year, number] = month.split("-").map(Number);
  const move = (delta: number) => {
    const date = new Date(year, number - 1 + delta, 1);
    setMonth(monthKey(date));
    setSelectedDate(`${monthKey(date)}-01`);
  };
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {monthNames[number - 1]} {year}
        </h1>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button
            onClick={() => move(-1)}
            className="min-h-11 rounded-xl border bg-white px-3 py-2"
          >
            ‹ Önceki
          </button>
          <button
            onClick={() => move(1)}
            className="min-h-11 rounded-xl border bg-white px-3 py-2"
          >
            Sonraki ›
          </button>
        </div>
      </div>
      <label className="mt-4 block text-sm font-semibold">
        Takvimde gösterilen kişi
        <select
          value={calendarUserId}
          onChange={(event) => setCalendarUserId(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 py-3 sm:w-auto"
        >
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.id === calendarUserId
                ? `${person.display_name} (seçili)`
                : person.display_name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">
        {dates.map((date) => {
          const row = rows.find((item) => item.date === date);
          const status = row?.status.status ?? "no_data";
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              aria-label={`${date}: ${STATUS_LABELS[status]}`}
              className={`min-h-14 rounded-lg border p-1 text-left text-[10px] sm:min-h-20 sm:rounded-xl sm:p-2 sm:text-xs ${date === selectedDate ? "ring-2 ring-emerald-600" : ""} ${status === "successful" ? "bg-emerald-100" : status === "partial" ? "bg-amber-100" : status === "missed" ? "bg-red-100" : status === "incomplete" ? "bg-violet-100" : "bg-white"}`}
            >
              <span className="font-bold">{Number(date.slice(-2))}</span>
              <span className="mt-1 block truncate sm:mt-2">
                {statusIcon[status]}{" "}
                <span className="hidden sm:inline">
                  {STATUS_LABELS[status]}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <span key={status}>
            {statusIcon[status as DailyStatus]} {label}
          </span>
        ))}
      </div>
      <div className="mt-5">
        <DayDetails selected={selected} />
      </div>
    </section>
  );
}
function ReportView({
  month,
  setMonth,
  reportRows,
}: {
  month: string;
  setMonth: (value: string) => void;
  reportRows: Array<{
    person: Profile;
    successful: number;
    partial: number;
    missed: number;
    noData: number;
    incomplete: number;
    evaluable: unknown[];
    calories: Array<{ totals: { calories: number } }>;
    protein: Array<{ totals: { protein: number } }>;
    water: Array<{ totals: { waterMl: number } }>;
  }>;
}) {
  const date = dateFromKey(`${month}-01`);
  const move = (delta: number) => {
    const next = new Date(date.getFullYear(), date.getMonth() + delta, 1);
    setMonth(monthKey(next));
  };
  const average = (
    rows: Array<{ totals: Record<string, number> }>,
    key: string,
  ) =>
    rows.length
      ? Math.round(
          rows.reduce((sum, row) => sum + row.totals[key], 0) / rows.length,
        )
      : null;
  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {monthNames[date.getMonth()]} {date.getFullYear()} raporu
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => move(-1)}
            className="rounded-xl border bg-white px-3 py-2"
          >
            ‹
          </button>
          <button
            onClick={() => move(1)}
            className="rounded-xl border bg-white px-3 py-2"
          >
            ›
          </button>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {reportRows.map((row) => {
          const evaluable = row.evaluable.length;
          const rate = successRate(row.successful, evaluable);
          return (
            <article
              key={row.person.id}
              className="rounded-3xl bg-white p-5 shadow-sm"
            >
              <h2 className="font-bold">{row.person.display_name}</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Başarılı" value={String(row.successful)} />
                <Metric label="Kısmen" value={String(row.partial)} />
                <Metric label="Kaçırılan" value={String(row.missed)} />
                <Metric label="Veri yok" value={String(row.noData)} />
                <Metric label="Veri eksik" value={String(row.incomplete)} />
                <Metric
                  label="Başarı oranı"
                  value={
                    rate === null
                      ? "Henüz yeterli veri yok"
                      : `${row.successful}/${evaluable} · ${rate.toFixed(0)}%`
                  }
                />
                <Metric
                  label="Veri kapsamı"
                  value={`${evaluable}/${monthDates(month).length} · ${dataCoverage(evaluable, monthDates(month).length).toFixed(0)}%`}
                />
                <Metric
                  label="Ort. kalori"
                  value={
                    average(row.calories, "calories") === null
                      ? "—"
                      : `${average(row.calories, "calories")} kcal`
                  }
                />
                <Metric
                  label="Ort. protein"
                  value={
                    average(row.protein, "protein") === null
                      ? "—"
                      : `${average(row.protein, "protein")} g`
                  }
                />
                <Metric
                  label="Ort. su"
                  value={
                    average(row.water, "waterMl") === null
                      ? "—"
                      : `${average(row.water, "waterMl")} ml`
                  }
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
function PartnerDashboard({
  partner,
  entries,
  water,
  goals,
  inviteToken,
  createInvite,
  pending,
  currentDate,
}: {
  partner: Profile | null;
  entries: Entry[];
  water: Water[];
  goals: Goals;
  inviteToken: string;
  createInvite: () => void;
  pending: boolean;
  currentDate: string;
}) {
  if (!partner)
    return (
      <InviteCard
        inviteToken={inviteToken}
        createInvite={createInvite}
        pending={pending}
      />
    );
  const partnerEntries = entries.filter(
    (entry) =>
      entry.owner_id === partner.id &&
      todayInIstanbul(new Date(entry.recorded_at)) === todayInIstanbul(),
  );
  const partnerWater = water.filter(
    (item) =>
      item.owner_id === partner.id &&
      todayInIstanbul(new Date(item.recorded_at)) === todayInIstanbul(),
  );
  const totals = totalsFor(partnerEntries, partnerWater);
  const status = evaluateDay(goals, totals).status;
  const meals = [
    ["breakfast", "Kahvaltı", "☀"],
    ["lunch", "Öğle", "◴"],
    ["dinner", "Akşam", "☾"],
    ["snack", "Atıştırmalık", "◇"],
  ];
  return (
    <section>
      <div className="mb-5 rounded-3xl bg-gradient-to-br from-emerald-50 to-sky-50 p-6">
        <p className="text-sm text-slate-500">
          {currentDate ? formatTurkishDate(new Date(currentDate)) : "Bugün"}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          {partner.display_name}
          {"'"}in günü
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Partnerinin kayıtlarını görüntülüyorsun. Bu alan yalnızca okunabilir.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <PartnerStat
          icon="◒"
          label="Kalori"
          value={`${Math.round(totals.calories)} kcal`}
          detail={`Sınır ${goals.calorieLimit ?? "—"} kcal`}
          tone="orange"
        />
        <PartnerStat
          icon="◈"
          label="Protein"
          value={`${Math.round(totals.protein)} g`}
          detail={`Referans ${goals.protein_goal ?? "—"} g`}
          tone="violet"
        />
        <PartnerStat
          icon="◌"
          label="Su"
          value={`${totals.waterMl} ml`}
          detail={`Hedef ${goals.waterTarget ?? "—"} ml`}
          tone="sky"
        />
        <PartnerStat
          icon={statusIcon[status]}
          label="Günlük durum"
          value={STATUS_LABELS[status]}
          detail={STATUS_DESCRIPTIONS[status]}
          tone="emerald"
        />
      </div>
      <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Öğünler</h2>
        {partnerEntries.length === 0 && partnerWater.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
            Partnerin bugün henüz kayıt eklemedi.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {meals.map(([key, label, icon]) => {
              const mealEntries = partnerEntries.filter(
                (entry) => entry.meal === key,
              );
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-slate-100 p-4"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <span aria-hidden="true">{icon}</span>
                    {label}
                  </div>
                  {mealEntries.length ? (
                    <ul className="mt-3 space-y-2 text-sm">
                      {mealEntries.flatMap((entry) =>
                        entry.food_entry_items.map((item) => (
                          <li
                            key={`${entry.id}-${item.food_name_snapshot}`}
                            className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                          >
                            <span>{item.food_name_snapshot}</span>
                            <span className="text-slate-500">
                              {Math.round(Number(item.calories_snapshot))} kcal
                              · {Math.round(Number(item.protein_snapshot))} g
                              protein
                            </span>
                          </li>
                        )),
                      )}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">Kayıt yok</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function PartnerStat({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${tone === "orange" ? "border-orange-100 bg-orange-50" : tone === "violet" ? "border-violet-100 bg-violet-50" : tone === "sky" ? "border-sky-100 bg-sky-50" : "border-emerald-100 bg-emerald-50"}`}
    >
      <span aria-hidden="true" className="text-lg">
        {icon}
      </span>
      <p className="mt-2 text-xs text-slate-600">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

function SimpleGoalEditor({
  goals,
  setGoals,
  saveGoals,
  pending,
}: {
  goals: Goals;
  setGoals: (value: Goals) => void;
  saveGoals: () => void;
  pending: boolean;
}) {
  return (
    <section className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Hedeflerini düzenle</h2>
          <p className="text-xs text-slate-600">
            Günlük başarı yalnızca kalori sınırı ve su hedefiyle hesaplanır.
          </p>
        </div>
        <button
          onClick={saveGoals}
          disabled={pending}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Kalori sınırı
          <input
            type="number"
            min="1"
            value={goals.calorieLimit ?? ""}
            onChange={(event) =>
              setGoals({
                ...goals,
                calorieLimit:
                  event.target.value === "" ? null : Number(event.target.value),
                calorie_goal:
                  event.target.value === "" ? null : Number(event.target.value),
              })
            }
            className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm font-semibold">
          Su hedefi (ml)
          <input
            type="number"
            min="1"
            value={goals.waterTarget ?? ""}
            onChange={(event) =>
              setGoals({
                ...goals,
                waterTarget:
                  event.target.value === "" ? null : Number(event.target.value),
                water_goal_ml:
                  event.target.value === "" ? null : Number(event.target.value),
              })
            }
            className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2"
          />
        </label>
        <p className="text-xs text-slate-600">
          Protein: {goals.protein_goal ?? "—"} g (referans)
        </p>
      </div>
    </section>
  );
}
