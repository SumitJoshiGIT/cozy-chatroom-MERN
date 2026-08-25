require('dotenv').config();
const mongoose = require('mongoose');
const models = require('./models/exports');

// One-off migration for the lazy/eager chat sync redesign. Run once before
// any client starts relying on unreadCount, or every pre-existing chat
// would show as fully unread the moment that ships. Safe to re-run: it only
// ever advances lastReadMid up to each chat's current newest message, never
// backwards, so running it twice (or after a few more messages land) just
// re-marks "as of now" rather than losing anything.
async function backfill() {
  await mongoose.connect(process.env.DATABASE);
  const { ChatsModel, MessagesModel, ReadPositionsModel } = models;

  const chats = await ChatsModel.find({}, "_id users lastMessage");
  let chatsUpdated = 0;
  let positionsUpserted = 0;

  for (const chat of chats) {
    const newest = await MessagesModel.findOne({ chat: chat._id }).sort({ mid: -1 });
    if (newest) {
      const firstAttachment = Array.isArray(newest.attachments) && newest.attachments.length ? newest.attachments[0] : null;
      await ChatsModel.findByIdAndUpdate(chat._id, {
        $set: {
          lastMessage: {
            _id: newest._id,
            mid: newest.mid,
            uid: newest.uid,
            type: newest.type,
            content: newest.content,
            attachmentType: firstAttachment ? firstAttachment.contentType : undefined,
            attachmentName: firstAttachment ? firstAttachment.name : undefined,
            liveLocation: newest.location ? !!newest.location.live : undefined,
            createdAt: newest.createdAt,
          },
        },
      });
      chatsUpdated++;
    }
    const lastReadMid = newest ? newest.mid : -1;
    for (const userId of chat.users || []) {
      await ReadPositionsModel.findOneAndUpdate(
        { user: userId, chat: chat._id },
        { $set: { lastReadMid, lastReadAt: new Date() } },
        { upsert: true }
      );
      positionsUpserted++;
    }
  }

  console.log(`Backfilled lastMessage on ${chatsUpdated}/${chats.length} chats, upserted ${positionsUpserted} read positions.`);
  await mongoose.connection.close();
}

backfill().catch(async (err) => {
  console.error(err);
  await mongoose.connection.close();
});
