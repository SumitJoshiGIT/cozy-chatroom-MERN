import { apiOrigin } from "./apiOrigin";
import { decryptedUrl } from "./e2ee/attachments";

// Three shapes: a pending upload (only local bytes), a private attachment
// (needs the media token) and a legacy public file. Returns undefined while
// the token hasn't arrived so the browser doesn't fetch a guaranteed failure.
export function attachmentUrl(attachment, mediaToken) {
  if (attachment.sealedWith?.key) return decryptedUrl(attachment);
  if (!attachment.src) return `data:${attachment.contentType || attachment.type};base64,${attachment.file}`;
  if (!attachment.src.startsWith("media/")) return `${apiOrigin}/${attachment.src}`;
  return mediaToken ? `${apiOrigin}/${attachment.src}?mt=${encodeURIComponent(mediaToken)}` : undefined;
}
