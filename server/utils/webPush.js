const webpush = require('web-push');

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || null;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || null;
const enabled = !!(vapidPublicKey && vapidPrivateKey);

if (enabled) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    vapidPublicKey,
    vapidPrivateKey
  );
} else {
  console.warn('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set - push notifications are disabled');
}

module.exports = { webpush, vapidPublicKey, enabled };
