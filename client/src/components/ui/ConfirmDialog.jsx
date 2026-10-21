import { useState } from "react";
import { createPortal } from "react-dom";
import Button from "./Button";

const preferenceKey = (action) => `lavender-confirm-${action}`;

export default function ConfirmDialog({ action, title, message, confirmLabel = "Yes", danger = false, onConfirm, onCancel, reasonPrompt, durationOptions }) {
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState(durationOptions?.[0]?.value || "");

  const confirm = () => {
    if (dontAskAgain) localStorage.setItem(preferenceKey(action), "1");
    onConfirm(reasonPrompt ? reason : durationOptions ? duration : undefined);
  };

  const dialog = (
    <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`confirm-${action}-title`} onMouseDown={(event) => event.stopPropagation()}>
        <h2 id={`confirm-${action}-title`}>{title}</h2>
        <p>{message}</p>
        {reasonPrompt && (
          <textarea
            className="confirm-dialog-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={reasonPrompt}
            maxLength={500}
            rows={3}
          />
        )}
        {durationOptions && (
          <select className="confirm-dialog-select" value={duration} onChange={(event) => setDuration(event.target.value)}>
            {durationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        )}
        <label className="confirm-dialog-preference">
          <input type="checkbox" checked={dontAskAgain} onChange={(event) => setDontAskAgain(event.target.checked)} />
          <span>Don't show this again</span>
        </label>
        <div className="confirm-dialog-actions">
          <Button variant="ghost" onClick={onCancel}>No</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={confirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

export function shouldConfirm(action) {
  return localStorage.getItem(preferenceKey(action)) !== "1";
}
