"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type DateTimeMinuteInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function DateTimeMinuteInput({ id, value, onChange, disabled }: DateTimeMinuteInputProps) {
  const { t } = useI18n();
  const [datePart, setDatePart] = useState("");
  const [timePart, setTimePart] = useState("");

  useEffect(() => {
    const nextDate = value ? value.slice(0, 10) : "";
    const nextTime = value ? value.slice(11, 16) : "";
    setDatePart(nextDate);
    setTimePart(nextTime);
  }, [value]);

  function emit(nextDate: string, nextTime: string) {
    if (!nextDate) {
      onChange("");
      return;
    }

    const normalizedTime = isValidTimeValue(nextTime) ? nextTime : "00:00";
    onChange(`${nextDate}T${normalizedTime}`);
  }

  return (
    <div className="date-time-minute-input">
      <input
        id={id}
        type="date"
        value={datePart}
        disabled={disabled}
        onChange={(event) => {
          const nextDate = event.target.value;
          const nextTime = timePart || "00:00";
          setDatePart(nextDate);
          if (!nextDate) {
            setTimePart("");
            onChange("");
            return;
          }
          setTimePart(nextTime);
          emit(nextDate, nextTime);
        }}
      />
      <input
        id={`${id}-time`}
        type="text"
        inputMode="numeric"
        placeholder="HH:MM"
        aria-label={t("common.time")}
        value={timePart}
        disabled={disabled || !datePart}
        maxLength={5}
        onChange={(event) => {
          const nextTime = normalizeTimeDraft(event.target.value);
          setTimePart(nextTime);
          if (!datePart) {
            return;
          }
          if (isValidTimeValue(nextTime)) {
            emit(datePart, nextTime);
          }
        }}
        onBlur={() => {
          if (!datePart) {
            return;
          }
          const normalizedTime = isValidTimeValue(timePart) ? timePart : "00:00";
          setTimePart(normalizedTime);
          emit(datePart, normalizedTime);
        }}
      />
    </div>
  );
}

function normalizeTimeDraft(value: string) {
  const digits = value.replace(/[^\d]/g, "").slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidTimeValue(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
