const express = require('express');
const { verifyMediaToken } = require('../../utils/socketAuthTokens');
const { ATTACHMENT_DIR, ATTACHMENT_PREFIX } = require('../../utils/uploads');
const models = require('../../models/exports');

const mediaRouter = express.Router();
const FILE_NAME_RE = /^[\w.-]+$/;

// <img>, <video> and iframes can't send headers and cross-site cookies are
// unreliable here, so access is a short-lived signed token in the URL. It is
// checked against current membership on every request: leaving a chat ends
// access to its files.
mediaRouter.get('/media/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const payload = verifyMediaToken(req.query.mt);
    if (!payload || !FILE_NAME_RE.test(name) || name.startsWith('.')) return res.status(404).end();
    const user = await models.UsersModel.findById(payload.uid, 'Chats tokensValidAfter');
    if (!user || (user.tokensValidAfter && payload.iat < user.tokensValidAfter.getTime())) return res.status(404).end();
    const allowed = await models.MessagesModel.exists({
      'attachments.src': `${ATTACHMENT_PREFIX}${name}`,
      chat: { $in: user.Chats },
    });
    if (!allowed) return res.status(404).end();
    return res.sendFile(name, {
      root: ATTACHMENT_DIR,
      headers: { 'Cache-Control': 'private, max-age=3600', 'Referrer-Policy': 'no-referrer' },
    }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
  } catch (err) {
    return next(err);
  }
});

module.exports = mediaRouter;
