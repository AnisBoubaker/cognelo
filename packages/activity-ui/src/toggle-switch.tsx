"use client";
import { useId, type ReactNode } from "react";

/** Boolean settings use a switch; item-selection lists continue using checkboxes. */
export function ToggleSwitch({ checked, onChange, label, disabled = false, locale = "en" }: {
  checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; disabled?: boolean; locale?: string;
}) {
  const id = useId();
  const labels = ({ en: ["Off", "On"], fr: ["Désactivé", "Activé"], zh: ["关闭", "开启"], ar: ["متوقف", "مفعّل"] } as Record<string, string[]>)[locale] ?? ["Off", "On"];
  return <label className={`toggle-switch${disabled ? " is-disabled" : ""}`} htmlFor={id}>
    <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event => onChange(event.currentTarget.checked)} />
    <span className="toggle-switch-label">{label}</span><small className="toggle-switch-state" aria-hidden="true">{labels[checked ? 1 : 0]}</small>
  </label>;
}
