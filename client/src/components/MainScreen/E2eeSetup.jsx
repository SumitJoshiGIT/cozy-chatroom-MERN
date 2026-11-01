import { useState } from "react";
import { useCtx } from "./AppScreen";
import Button from "../ui/Button";
import { TextField } from "../ui/TextField";

const MIN_PASSPHRASE = 10;

// Setting up, unlocking and resetting all ask for a passphrase, so one form
// covers them. The passphrase never leaves this device.
export function E2eeForm() {
  const { e2ee, e2eeStatus } = useCtx();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (e2eeStatus === "unavailable") {
    return <p className="text-xs text-gray-500">This browser can't encrypt messages here. Encryption needs an HTTPS page.</p>;
  }
  if (e2eeStatus === "loading") return null;
  if (e2eeStatus === "ready" && !resetting) {
    return (
      <div>
        <p className="text-sm text-gray-700 dark:text-gray-200">Encryption is on for this device.</p>
        <button type="button" className="mt-1 text-xs text-red-500 underline" onClick={() => setResetting(true)}>
          Reset encryption key
        </button>
      </div>
    );
  }

  const creating = e2eeStatus === "none" || resetting;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (creating && passphrase.length < MIN_PASSPHRASE) return setError(`Use at least ${MIN_PASSPHRASE} characters.`);
    if (creating && passphrase !== confirm) return setError("The passphrases don't match.");
    setBusy(true);
    try {
      if (creating) await e2ee.current.setUp(passphrase);
      else await e2ee.current.unlock(passphrase);
      setResetting(false);
      setPassphrase("");
      setConfirm("");
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <p className="text-xs text-gray-500">
        {resetting
          ? "A new key can't read older encrypted messages, and your contacts will be told your key changed."
          : creating
            ? "Choose a passphrase. You'll need it on every new device, and nobody can recover it for you. Without it, encrypted messages are lost."
            : "Enter your encryption passphrase to read and send messages on this device."}
      </p>
      <TextField type="password" aria-label="Encryption passphrase" placeholder="Passphrase" autoComplete="new-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
      {creating && (
        <TextField type="password" aria-label="Confirm passphrase" placeholder="Confirm passphrase" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      )}
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Working…" : resetting ? "Reset key" : creating ? "Turn on encryption" : "Unlock"}
        </Button>
        {resetting && <button type="button" className="text-xs underline" onClick={() => setResetting(false)}>Cancel</button>}
        {!creating && (
          <button type="button" className="text-xs text-red-500 underline" onClick={() => setResetting(true)}>Forgot passphrase?</button>
        )}
      </div>
    </form>
  );
}

const DISMISSED = "lavender-e2ee-prompt-dismissed";
const readDismissed = () => {
  try { return sessionStorage.getItem(DISMISSED) === "true"; } catch { return false; }
};

export function E2eePrompt() {
  const { e2eeStatus } = useCtx();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);
  if ((e2eeStatus !== "none" && e2eeStatus !== "locked") || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISSED, "true"); } catch {}
  };

  return (
    <div className="e2ee-prompt mt-3 rounded-xl p-3">
      {open ? <E2eeForm /> : (
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="text-left text-sm font-semibold" onClick={() => setOpen(true)}>
            🔒 {e2eeStatus === "locked" ? "Unlock encrypted messages" : "Turn on encryption"}
          </button>
          <button type="button" className="text-xs underline" onClick={dismiss}>Later</button>
        </div>
      )}
    </div>
  );
}
