import { useEffect, useState } from "react";
import { apiOrigin } from "../apiOrigin";
import { decryptBytes, safeMediaType } from "./crypto";

const urls = new Map();
const pending = new Map();

export const decryptedUrl = (attachment) => urls.get(attachment.src);

async function decrypt(attachment, mediaToken) {
  const response = await fetch(`${apiOrigin}/${attachment.src}?mt=${encodeURIComponent(mediaToken)}`);
  if (!response.ok) throw new Error("Download failed");
  const plain = await decryptBytes(await response.arrayBuffer(), attachment.sealedWith);
  urls.set(attachment.src, URL.createObjectURL(new Blob([plain], { type: safeMediaType(attachment.contentType) })));
}

// Sealed files can't go straight into <img src>, so they're fetched, decrypted
// and swapped in as blob URLs. Rerenders the caller when one becomes ready.
export function useDecryptedAttachments(attachments, mediaToken) {
  const [, setReady] = useState(0);
  const missing = (attachments || []).filter((a) => a.sealedWith?.key && a.src && !urls.has(a.src));
  const signature = missing.map((a) => a.src).join("|");
  useEffect(() => {
    if (!mediaToken || !signature) return undefined;
    let active = true;
    missing.forEach((attachment) => {
      if (!pending.has(attachment.src)) {
        pending.set(attachment.src, decrypt(attachment, mediaToken).finally(() => pending.delete(attachment.src)));
      }
      pending.get(attachment.src).then(() => active && setReady((n) => n + 1), () => {});
    });
    return () => { active = false; };
  }, [signature, mediaToken]);
}
