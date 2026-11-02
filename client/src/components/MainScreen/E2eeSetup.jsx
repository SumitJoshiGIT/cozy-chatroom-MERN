import { useState } from "react";
import { useCtx } from "./AppScreen";
import Button from "../ui/Button";

// Settings panel: encryption is automatic, so this only reports its state.
export function E2eeForm() {
  const { e2ee, e2eeStatus, e2eeLinkCode } = useCtx();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  if (e2eeStatus === "unavailable") {
    return <p className="text-xs text-ink-muted">This browser can't encrypt messages here. Encryption needs an HTTPS page.</p>;
  }
  if (e2eeStatus === "loading") return null;

  const startFresh = async () => {
    setError("");
    try {
      await e2ee.current.createKey(true);
      setConfirming(false);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {e2eeStatus === "ready" && (
        <p className="text-sm text-ink">Your messages are end-to-end encrypted on this device.</p>
      )}
      {e2eeStatus === "locked" && <LinkMessage code={e2eeLinkCode} />}
      {confirming ? (
        <>
          <p className="text-xs text-ink-muted">
            A new key can't read older encrypted messages, and your contacts will be told your key changed.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="danger" onClick={startFresh}>Start fresh</Button>
            <button type="button" className="text-xs underline" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <button type="button" className="w-fit text-xs text-danger underline" onClick={() => setConfirming(true)}>
          {e2eeStatus === "ready" ? "Reset encryption key" : "I can't use my other device"}
        </button>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function LinkMessage({ code }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">Approve this device</p>
      <p className="text-xs text-ink-muted">Open Lavender on a device you've used before and approve this one. Check that it shows this code.</p>
      {code && <p data-testid="link-code" className="e2ee-link-code">{code}</p>}
    </div>
  );
}

// Sidebar: only appears when this device can't read messages yet.
export function E2eePrompt() {
  const { e2eeStatus } = useCtx();
  if (e2eeStatus !== "locked") return null;
  return <div className="e2ee-prompt mt-3 rounded-xl p-3"><E2eeForm /></div>;
}

export function E2eeLinkDialog() {
  const { linkRequest, respondToLink } = useCtx();
  if (!linkRequest) return null;
  return (
    <div role="alertdialog" aria-labelledby="link-title" className="e2ee-link-dialog">
      <h2 id="link-title" className="font-semibold text-ink">Approve a new device?</h2>
      <p className="mt-1 text-sm text-ink-muted">
        It will be able to read your encrypted messages. Only approve it if you just signed in and it shows this code.
      </p>
      <p data-testid="link-request-code" className="e2ee-link-code">{linkRequest.code}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => respondToLink(false)}>Decline</Button>
        <Button onClick={() => respondToLink(true)}>Approve</Button>
      </div>
    </div>
  );
}
