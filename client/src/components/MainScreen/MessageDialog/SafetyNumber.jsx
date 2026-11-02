import { useEffect, useState } from "react";
import { useCtx } from "../AppScreen";

export default function SafetyNumber({ uid }) {
  const { e2ee, e2eeStatus, userID } = useCtx();
  const [number, setNumber] = useState(null);

  useEffect(() => {
    let active = true;
    setNumber(null);
    if (uid && uid !== userID.current && e2ee.current && e2eeStatus === "ready") {
      e2ee.current.safetyNumberWith(uid).then((value) => active && setNumber(value), () => {});
    }
    return () => { active = false; };
  }, [uid, e2eeStatus]);

  if (!number) return null;
  return (
    <div className="w-full px-1 py-2">
      <div className="text-sm font-semibold text-ink">🔒 Safety number</div>
      <p className="text-xs text-ink-muted">If this matches on their screen, nobody is intercepting your messages.</p>
      <code data-testid="safety-number" className="mt-1 block break-words text-xs text-ink">{number}</code>
    </div>
  );
}
