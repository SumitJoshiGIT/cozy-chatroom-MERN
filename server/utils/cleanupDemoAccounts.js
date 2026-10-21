const models = require('../models/exports');

async function cleanupDemoAccounts() {
  const expired = await models.UsersModel.find({
    isDemo: true,
    demoExpiresAt: { $lte: new Date() },
  }, '_id Chats');

  for (const user of expired) {
    const demoChats = await models.ChatsModel.find({
      _id: { $in: user.Chats || [] },
      isDemo: true,
    }, '_id');
    const chatIds = demoChats.map((chat) => chat._id);
    if (chatIds.length) {
      await models.MessagesModel.deleteMany({ chat: { $in: chatIds } });
      await models.ChatsModel.deleteMany({ _id: { $in: chatIds } });
    }
    await models.UsersModel.deleteOne({ _id: user._id, isDemo: true });
  }
  return expired.length;
}

module.exports = { cleanupDemoAccounts };
