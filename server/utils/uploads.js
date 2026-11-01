const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "public");
// Lives under public/ so existing deploys and volumes keep it, but
// express.static refuses dot-directories: these files are only reachable
// through the member-checked /media route.
const ATTACHMENT_DIR = path.join(UPLOAD_DIR, ".attachments");
const ATTACHMENT_PREFIX = "media/";

function removeUpload(src) {
  if (!src) return;
  const dir = src.startsWith(ATTACHMENT_PREFIX) ? ATTACHMENT_DIR : UPLOAD_DIR;
  fs.promises.unlink(path.join(dir, path.basename(src))).catch(() => {});
}

module.exports = { UPLOAD_DIR, ATTACHMENT_DIR, ATTACHMENT_PREFIX, removeUpload };
