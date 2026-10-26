"use client";

export function ReviewGradeField({ id, maxScore, value, disabled, onChange, t }: {
  id: string; maxScore: number; value: string; disabled?: boolean; onChange: (value: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return <div className="inline-panel form">
    <div className="field" style={{ maxWidth: 260 }}>
      <label htmlFor={id}>{t("courseDetail.finalGrade", { max: Number.isInteger(maxScore) ? String(maxScore) : maxScore.toFixed(2) })}</label>
      <input id={id} inputMode="decimal" max={maxScore} min={0} step="any" type="number"
        value={value} disabled={disabled} onChange={event => onChange(event.target.value)} />
      <span className="muted">{t("courseDetail.finalGradeHelp")}</span>
    </div>
  </div>;
}
