const mongoose = require('mongoose');

const PushSubscriptions = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
}, { timestamps: true });

PushSubscriptions.index({ user: 1 });

const PushSubscriptionsModel = mongoose.model('PushSubscriptions', PushSubscriptions);

module.exports = PushSubscriptionsModel;
