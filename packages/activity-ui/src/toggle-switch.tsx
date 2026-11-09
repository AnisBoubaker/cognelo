"use client";
import { HelpTooltip } from "./help-tooltip";
import { useId, type ReactNode } from "react";

/** Boolean settings use a switch; item-selection lists continue using checkboxes. */
export function ToggleSwitch({ checked, onChange, label, help, disabled = false, locale = "en" }: {
  checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; help?: ReactNode; disabled?: boolean; locale?: string;
}) {
  const id = useId();
  const labels = ({ en: ["Off", "On"], fr: ["Désactivé", "Activé"], zh: ["关闭", "开启"], ar: ["متوقف", "مفعّل"] } as Record<string, string[]>)[locale] ?? ["Off", "On"];
  if (help) return <span className={`toggle-switch${disabled ? " is-disabled" : ""}`}>
    <input id={id} type="checkbox" role="switch" aria-labelledby={`${id}-label`} checked={checked} disabled={disabled} onChange={event => onChange(event.currentTarget.checked)} />
    <label id={`${id}-label`} htmlFor={id} className="toggle-switch-label">{label}</label><HelpTooltip content={help} label={label} locale={locale} /><small className="toggle-switch-state" aria-hidden="true">{labels[checked ? 1 : 0]}</small>
  </span>;
  return <label className={`toggle-switch${disabled ? " is-disabled" : ""}`} htmlFor={id}>
    <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event => onChange(event.currentTarget.checked)} />
    <span className="toggle-switch-label">{label}</span><small className="toggle-switch-state" aria-hidden="true">{labels[checked ? 1 : 0]}</small>
  </label>;
}
