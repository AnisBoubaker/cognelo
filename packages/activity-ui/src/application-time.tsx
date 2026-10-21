"use client";


import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { formatZonedDateTime, type DateTimeValue } from "./zoned-date-time";

type ApplicationTimeContextValue = { timeZone: string; now: () => number; setTimeZone?: (zone: string) => void };
const ApplicationTimeContext = createContext<ApplicationTimeContextValue>({ timeZone: "UTC", now: () => Date.now() });
export function ApplicationTimeProvider({ children, value }: { children?: ReactNode; value: ApplicationTimeContextValue }) {
  return <ApplicationTimeContext.Provider value={value}>{children}</ApplicationTimeContext.Provider>;
}
export function useApplicationTime() { return useContext(ApplicationTimeContext); }
export function useServerNow(intervalMs = 1000) {
  const { now } = useApplicationTime();
  const [value, setValue] = useState(now);
  useEffect(() => { setValue(now()); const timer = setInterval(() => setValue(now()), intervalMs); return () => clearInterval(timer); }, [intervalMs, now]);
  return value;
}
export function AppDateTime({ value, locale, options }: { value: DateTimeValue; locale?: string; options?: Intl.DateTimeFormatOptions }) {
  const { timeZone } = useApplicationTime();
  return <>{formatZonedDateTime(value, timeZone, locale, options)}</>;
}
