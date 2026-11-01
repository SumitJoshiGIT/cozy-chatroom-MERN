const fs = require('fs');
const path = require('path');
const models = require('../models/exports');
const { ATTACHMENT_DIR, ATTACHMENT_PREFIX } = require('./uploads');

// Mongo's TTL index removes an expired message without touching its files, so
// a "disappearing" attachment would otherwise stay on disk forever. The grace
// period covers a file written moments before its message is saved.
const GRACE_MS = 60 * 60 * 1000;

async function cleanupOrphanAttachments() {
  const names = await fs.promises.readdir(ATTACHMENT_DIR).catch(() => []);
  let removed = 0;
  for (const name of names) {
    const file = path.join(ATTACHMENT_DIR, name);
    const { mtimeMs } = await fs.promises.stat(file);
    if (Date.now() - mtimeMs < GRACE_MS) continue;
    if (await models.MessagesModel.exists({ 'attachments.src': `${ATTACHMENT_PREFIX}${name}` })) continue;
    await fs.promises.unlink(file);
    removed += 1;
  }
  return removed;
}

module.exports = { cleanupOrphanAttachments };
