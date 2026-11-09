"use client";
import { HelpLabel } from "./help-tooltip";

import { useId, type ReactNode } from "react";
import { aiAgentModels, type AiAgentModel, type AiModelSelection } from "@cognelo/contracts";
export type AiModelConnectionOption = { id: string; displayName: string; model: string; provider: string; models?: AiAgentModel[]; isEnabled: boolean };

/** Connection credentials stay server-side; only configured names/purposes enter this picker. */
export function AiModelPicker({ connections, value, purpose, onChange, disabled = false, labels, connectionHelp, modelHelp }: {
  connections: AiModelConnectionOption[]; value: AiModelSelection | null; purpose: AiAgentModel["purpose"];
  onChange: (value: AiModelSelection | null) => void; disabled?: boolean;
  connectionHelp?: ReactNode; modelHelp?: ReactNode;
  labels: { connection: string; model: string; inherit: string; unavailable: string; noModels: string };
}) {
  const id = useId();
  const eligible = connections.filter(connection => connection.isEnabled && (purpose !== "embedding" || connection.provider !== "claude") && aiAgentModels(connection).some(model => model.purpose === purpose));
  const selected = eligible.find(connection => connection.id === value?.connectionId);
  const models = selected ? aiAgentModels(selected).filter(model => model.purpose === purpose) : [];
  return <div className="form-grid-two ai-model-picker">
    <div className="field"><HelpLabel help={connectionHelp}><label htmlFor={`${id}-connection`}>{labels.connection}</label></HelpLabel>
      <select id={`${id}-connection`} disabled={disabled} value={value?.connectionId ?? ""} onChange={event => {
        const connection = eligible.find(candidate => candidate.id === event.target.value);
        const options = connection ? aiAgentModels(connection).filter(model => model.purpose === purpose) : [];
        onChange(connection ? { connectionId: connection.id, model: (options.find(model => model.model === connection.model) ?? options[0]).model } : null);
      }}>
        <option value="">{labels.inherit}</option>
        {value && !selected && <option value={value.connectionId} disabled>{labels.unavailable}</option>}
        {eligible.map(connection => <option key={connection.id} value={connection.id}>{connection.displayName} · {connection.provider}</option>)}
      </select>
    </div>
    <div className="field"><HelpLabel help={modelHelp}><label htmlFor={`${id}-model`}>{labels.model}</label></HelpLabel>
      <select id={`${id}-model`} disabled={disabled || !selected} value={value?.model ?? ""} onChange={event => { if (selected) onChange({ connectionId: selected.id, model: event.target.value }); }}>
        {!selected && <option value={value?.model ?? ""}>{value?.model ?? labels.inherit}</option>}
        {selected && value && !models.some(model => model.model === value.model) && <option value={value.model} disabled>{value.model} — {labels.unavailable}</option>}
        {models.map(model => <option key={model.model} value={model.model}>{model.model}</option>)}
      </select>
    </div>
    {!eligible.length && <p className="muted">{labels.noModels}</p>}
  </div>;
}
