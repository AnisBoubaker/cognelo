import { translateMessage, type Locale } from "@/lib/i18n";

export function TestItemWeight({
  points,
  totalPoints,
  locale
}: {
  points: number;
  totalPoints: number;
  locale: Locale;
}) {
  const percentage = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2
  }).format(totalPoints > 0 ? points / totalPoints : 0);

  return (
    <span className="muted">
      {translateMessage(locale, "courseDetail.testItemWeight", { percentage })}
    </span>
  );
}
