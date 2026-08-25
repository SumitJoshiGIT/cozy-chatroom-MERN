const mongoose = require('mongoose');

const ReadPositions = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
  chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chats', required: true },
  lastReadMid: { type: Number, default: -1 },
  lastReadAt: { type: Date, default: null },
}, { timestamps: true });

ReadPositions.index({ user: 1, chat: 1 }, { unique: true });

const ReadPositionsModel = mongoose.model('ReadPositions', ReadPositions);

module.exports = ReadPositionsModel;
