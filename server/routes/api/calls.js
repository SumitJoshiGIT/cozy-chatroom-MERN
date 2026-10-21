const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const { verifyToken } = require('../../utils/socketAuthTokens');
const models = require('../../models/exports');
const { Types } = require('mongoose');

const callsRouter = express.Router();

function getUserId(req) {
  const sessionUser = req.user && req.user._id;
  if (sessionUser) return String(sessionUser);
  const authorization = req.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  return verifyToken(authorization.slice(7));
}

callsRouter.post('/calls/token', async (req, res) => {
  const userId = getUserId(req);
  const cid = typeof req.body?.cid === 'string' ? req.body.cid : '';
  const roomName = typeof req.body?.roomName === 'string' ? req.body.roomName : '';
  if (!userId || !Types.ObjectId.isValid(cid) || roomName !== `lavender-${cid}`) {
    return res.status(401).json({ status: false, message: 'Call authentication failed' });
  }
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return res.status(503).json({ status: false, message: 'Video calls are not configured' });
  }

  try {
    const chat = await models.ChatsModel.findById(cid, 'users');
    const isMember = chat && (chat.users || []).some((id) => String(id) === String(userId));
    if (!isMember) return res.status(403).json({ status: false, message: 'You are not a member of this chat' });

    const user = await models.UsersModel.findById(userId, 'name username img');
    if (!user) return res.status(401).json({ status: false, message: 'User not found' });
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: String(user._id),
      name: user.name || user.username || 'Lavender user',
      metadata: JSON.stringify({ image: user.img?.src || null }),
    });
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    return res.json({ status: true, token: await token.toJwt(), url: process.env.LIVEKIT_URL });
  } catch (err) {
    console.error('Failed to create LiveKit token:', err);
    return res.status(500).json({ status: false, message: 'Unable to join call' });
  }
});

module.exports = callsRouter;
