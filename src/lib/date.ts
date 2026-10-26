export const APP_TIMEZONE = "Europe/Istanbul";

export function todayInIstanbul(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function formatTurkishDate(date = new Date()) {
  return new Intl.DateTimeFormat("tr-TR", { timeZone: APP_TIMEZONE, weekday: "long", day: "numeric", month: "long" }).format(date);
}

export function isSameIstanbulDay(left: string, right: string) {
  return todayInIstanbul(new Date(left)) === todayInIstanbul(new Date(right));
}
