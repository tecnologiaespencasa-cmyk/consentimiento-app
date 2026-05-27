export const APP_TIMEZONE = "America/Bogota";
const BOGOTA_UTC_OFFSET_HOURS = 5;

type DateInput = Date | string | number | null | undefined;

const bogotaPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toValidDate(value: DateInput): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getBogotaParts(value: DateInput): { year: number; month: number; day: number } | null {
  const date = toValidDate(value);
  if (!date) return null;

  const parts = bogotaPartsFormatter
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

export function getBogotaDateKey(value: DateInput): string {
  const parts = getBogotaParts(value);
  if (!parts) return "";
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${parts.year}-${m}-${d}`;
}

export function isSameBogotaDay(value: DateInput, reference: DateInput = new Date()): boolean {
  const a = getBogotaDateKey(value);
  const b = getBogotaDateKey(reference);
  return Boolean(a) && a === b;
}

export function getStartOfBogotaDayUtc(reference: DateInput = new Date()): Date {
  const parts = getBogotaParts(reference) ?? getBogotaParts(new Date());
  const year = parts?.year ?? new Date().getUTCFullYear();
  const month = parts?.month ?? 1;
  const day = parts?.day ?? 1;
  return new Date(Date.UTC(year, month - 1, day, BOGOTA_UTC_OFFSET_HOURS, 0, 0, 0));
}

export function getStartOfBogotaMonthUtc(reference: DateInput = new Date()): Date {
  const parts = getBogotaParts(reference) ?? getBogotaParts(new Date());
  const year = parts?.year ?? new Date().getUTCFullYear();
  const month = parts?.month ?? 1;
  return new Date(Date.UTC(year, month - 1, 1, BOGOTA_UTC_OFFSET_HOURS, 0, 0, 0));
}

export function addUtcDays(base: Date, days: number): Date {
  const out = new Date(base);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function addUtcMonths(base: Date, months: number): Date {
  const out = new Date(base);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

export function parseBogotaDateInputStart(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return new Date(Date.UTC(year, month - 1, day, BOGOTA_UTC_OFFSET_HOURS, 0, 0, 0));
}

export function parseBogotaDateInputEnd(value: string): Date | null {
  const start = parseBogotaDateInputStart(value);
  if (!start) return null;
  const nextDay = addUtcDays(start, 1);
  return new Date(nextDay.getTime() - 1);
}

export function formatBogotaDate(value: DateInput, locale = "es-CO", options?: Intl.DateTimeFormatOptions): string {
  const date = toValidDate(value);
  if (!date) return "-";
  return date.toLocaleDateString(locale, { timeZone: APP_TIMEZONE, ...options });
}

export function formatBogotaTime(value: DateInput, locale = "es-CO", options?: Intl.DateTimeFormatOptions): string {
  const date = toValidDate(value);
  if (!date) return "-";
  return date.toLocaleTimeString(locale, { timeZone: APP_TIMEZONE, ...options });
}

export function formatBogotaDateTime(value: DateInput, locale = "es-CO", options?: Intl.DateTimeFormatOptions): string {
  const date = toValidDate(value);
  if (!date) return "-";
  return date.toLocaleString(locale, { timeZone: APP_TIMEZONE, ...options });
}
