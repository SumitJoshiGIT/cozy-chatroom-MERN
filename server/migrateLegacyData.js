// One-off migration for data written before attachments became private and
// before text stopped being HTML-escaped on input. Idempotent.
//   node migrateLegacyData.js           report only
//   node migrateLegacyData.js --apply   make the changes
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const models = require('./models/exports');
const { UPLOAD_DIR, ATTACHMENT_DIR, ATTACHMENT_PREFIX } = require('./utils/uploads');

const apply = process.argv.includes('--apply');
const decode = (text) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const ESCAPED = /&(lt|gt);/;

async function moveAttachments() {
  let messages = 0;
  let files = 0;
  const cursor = models.MessagesModel.find({ 'attachments.0': { $exists: true } }).cursor();
  for await (const message of cursor) {
    const legacy = message.attachments.filter((a) => a.src && !a.src.startsWith(ATTACHMENT_PREFIX));
    if (!legacy.length) continue;
    messages += 1;
    if (!apply) { files += legacy.length; continue; }
    await fs.promises.mkdir(ATTACHMENT_DIR, { recursive: true });
    for (const attachment of legacy) {
      const name = path.basename(attachment.src);
      await fs.promises.rename(path.join(UPLOAD_DIR, name), path.join(ATTACHMENT_DIR, name)).then(
        () => { files += 1; },
        (err) => console.warn(`could not move ${name}: ${err.code}`)
      );
      attachment.src = `${ATTACHMENT_PREFIX}${name}`;
    }
    await models.MessagesModel.updateOne({ _id: message._id }, { $set: { attachments: message.attachments } }, { timestamps: false });
  }
  return { messages, files };
}

async function decodeField(model, field, options) {
  let changed = 0;
  const cursor = model.find({ [field]: ESCAPED }, field).lean().cursor();
  for await (const doc of cursor) {
    changed += 1;
    if (!apply) continue;
    const value = field.split('.').reduce((node, key) => node[key], doc);
    await model.updateOne({ _id: doc._id }, { $set: { [field]: decode(value) } }, options);
  }
  return changed;
}

(async () => {
  await mongoose.connect(process.env.DATABASE);
  console.log(apply ? 'Applying changes' : 'Report only (pass --apply to change data)');
  console.log('attachments:', await moveAttachments());
  // Chats keep their timestamps bump so client caches pick up the new preview.
  const keepTimestamps = { timestamps: false };
  console.log('message text:', await decodeField(models.MessagesModel, 'content', keepTimestamps));
  for (const field of ['lastMessage.content', 'name', 'about']) {
    console.log(`chat ${field}:`, await decodeField(models.ChatsModel, field));
  }
  for (const field of ['name', 'about']) {
    console.log(`user ${field}:`, await decodeField(models.UsersModel, field));
  }
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
