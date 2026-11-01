const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const mongoose = require(`${ROOT}/server/node_modules/mongoose`);
const bcrypt = require(`${ROOT}/server/node_modules/bcrypt`);
const models = require(`${ROOT}/server/models/exports`);

const APP = 'http://localhost:5173';
const API = 'http://localhost:3100';
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const failures = [];
const errors = [];
let pass = 0;
let pages = {};

async function check(name, fn) {
  try {
    let timer;
    await Promise.race([fn(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('check timed out')), 90000); })]);
    clearTimeout(timer);
    pass += 1;
    console.log('PASS', name);
  } catch (e) {
    failures.push(name);
    console.log('FAIL', name, '::', String(e.message).split('\n').slice(0, 3).join(' / ').slice(0, 280));
    for (const [key, page] of Object.entries(pages)) {
      await page.screenshot({ path: `${SHOTS}/fail-${failures.length}-${key}.png` }).catch(() => {});
    }
  }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const IGNORED_CONSOLE = /status code 401|attachment couldn't|favicon|Failed to load resource|fonts\.g|WebSocket connection|tile\.openstreetmap|could not establish|livekit/i;

async function open(browser, viewport = { width: 1280, height: 800 }, options = {}) {
  const context = await browser.newContext({ viewport, ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORED_CONSOLE.test(m.text())) errors.push(`console ${m.text().slice(0, 200)}`);
  });
  return page;
}
async function ready(page) {
  await page.getByRole('button', { name: /sidebar/ }).first().waitFor();
  const expand = page.getByRole('button', { name: 'Expand sidebar' });
  if (await expand.count()) await expand.click();
}
async function signIn(page, email, password = 'Password123') {
  await page.goto(`${APP}/auth/signin`);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.click('button[type=submit]');
  await page.waitForURL('**/app');
  await ready(page);
}
async function user(browser, email, viewport, options) {
  const page = await open(browser, viewport, options);
  await signIn(page, email);
  return page;
}
const entity = (page, name) => page.locator('.chat-entity').filter({ has: page.locator('.font-semibold.truncate', { hasText: new RegExp(`^${name}$`) }) }).first();
const composer = (page) => page.locator('textarea[aria-label="Message"]');
const send = async (page, text) => { await composer(page).fill(text); await composer(page).press('Enter'); };
const bubble = (page, text) => page.locator('.message-bubble').filter({ has: page.locator('.message-text', { hasText: text }) }).last();
const row = (page, text) => page.locator('.message-row').filter({ has: page.locator('.message-text', { hasText: text }) }).last();
const search = async (page, query) => { await page.fill('input[placeholder="Search "]', query); await page.waitForTimeout(500); };
const clearSearch = async (page) => { await page.fill('input[placeholder="Search "]', ''); await page.waitForTimeout(400); };
async function menu(page, text, item) {
  await bubble(page, text).click({ button: 'right' });
  await page.locator('.message-context-menu.is-open').getByRole('button', { name: new RegExp(`${item}$`) }).click();
}
const reload = async (page) => { await page.reload(); await ready(page); };

(async () => {
  await mongoose.connect(process.env.DATABASE);
  const hash = await bcrypt.hash('Password123', 4);
  const seed = (name) => models.UsersModel.create({ name, email: `${name.toLowerCase()}@test.invalid`, password: hash });
  const [alice, bob, carol, dave, erin, frank, grace] = await Promise.all(['Alice', 'Bob', 'Carol', 'Dave', 'Erin', 'Frank', 'Grace'].map(seed));
  const history = await models.ChatsModel.create({ type: 'private', users: [carol._id, dave._id] });
  await models.UsersModel.updateMany({ _id: { $in: [carol._id, dave._id] } }, { $push: { Chats: history._id }, $addToSet: { contacts: { $each: [carol._id, dave._id] } } });
  let last;
  for (let i = 1; i <= 80; i++) last = await models.MessagesModel.create({ chat: history._id, uid: i % 2 ? carol._id : dave._id, content: `history ${String(i).padStart(3, '0')}` });
  await models.ChatsModel.findByIdAndUpdate(history._id, { lastMessage: { _id: last._id, mid: last.mid, uid: last.uid, type: 'text', content: last.content, createdAt: last.createdAt } });
  await models.ReadPositionsModel.create({ user: carol._id, chat: history._id, lastReadMid: last.mid });

  const sealedRoom = await models.ChatsModel.create({ type: 'group', name: 'Sealed Room', users: [frank._id, grace._id], owner: frank._id, admins: [frank._id] });
  await models.UsersModel.updateMany({ _id: { $in: [frank._id, grace._id] } }, { $push: { Chats: sealedRoom._id } });

  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const media = { permissions: ['geolocation', 'microphone', 'camera'], geolocation: { latitude: 28.6, longitude: 77.2 } };
  const a = await user(browser, 'alice@test.invalid', undefined, media);
  const b = await user(browser, 'bob@test.invalid', undefined, media);
  pages = { a, b };

  await check('landing renders; bad password shows a generic error', async () => {
    const page = await open(browser);
    await page.goto(APP);
    await page.waitForSelector('text=Lavender');
    await page.goto(`${APP}/auth/signin`);
    await page.fill('input[type=email]', 'alice@test.invalid');
    await page.fill('input[type=password]', 'WrongPass123');
    await page.click('button[type=submit]');
    await page.getByText('Incorrect email or password').waitFor();
    await page.context().close();
  });

  await check('try the demo signs in and can use the app', async () => {
    const page = await open(browser);
    await page.goto(`${APP}/auth/signin`);
    await page.getByRole('button', { name: 'Try the demo' }).click();
    await page.waitForURL('**/app');
    await page.getByRole('button', { name: 'Skip tour' }).click();
    await ready(page);
    await page.getByRole('button', { name: 'New group' }).click();
    await page.getByPlaceholder('Name your group').fill('Demo Room');
    await page.getByRole('button', { name: /Create/ }).click();
    await entity(page, 'Demo Room').click();
    await send(page, 'demo works');
    await bubble(page, 'demo works').locator('.message-ticks').waitFor();
    await page.context().close();
  });

  await check('sign-up with an emailed OTP reaches the app', async () => {
    const page = await open(browser);
    await page.goto(`${APP}/auth/signup`);
    await page.getByPlaceholder('Email address').fill('New.Person@test.invalid');
    await page.getByPlaceholder('Password', { exact: true }).fill('Password123');
    await page.getByPlaceholder('Confirm password').fill('Password123');
    await page.click('button[type=submit]');
    await page.waitForURL('**/auth/verify');
    const code = fs.readFileSync(process.env.OTP_FILE, 'utf8').trim().split('\n').pop().split(' ')[1];
    assert(/^\d{6}$/.test(code), `bad code ${code}`);
    await page.locator('input').first().fill(code);
    await page.click('button[type=submit]');
    await page.waitForURL('**/app');

    const dialog = page.getByRole('dialog');
    await dialog.getByText('Welcome to Lavender').waitFor();
    await page.screenshot({ path: `${SHOTS}/tour-welcome.png` });
    await dialog.getByRole('button', { name: 'Show me around' }).click();
    await dialog.getByText('Find people').waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/tour-search.png` });
    await page.getByPlaceholder('Search ').click({ timeout: 1000 }).then(() => { throw new Error('tour let a click through'); }, () => {});
    await dialog.getByRole('button', { name: 'Back' }).click();
    await dialog.getByText('Welcome to Lavender').waitFor();
    await dialog.getByRole('button', { name: 'Show me around' }).click();
    for (const title of ['Find people', 'Start a group', 'Keep your messages private', 'Make it yours']) {
      await dialog.getByText(title).waitFor();
      await dialog.getByRole('button', { name: 'Next' }).click();
    }
    await dialog.getByText("You're all set").waitFor();
    await dialog.getByRole('button', { name: 'Get started' }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.waitForTimeout(300);
    const created = await models.UsersModel.findOne({ email: 'new.person@test.invalid' });
    assert(created, 'account not created');
    assert(created.showTutorial === false, 'tour completion not saved');
    await reload(page);
    await page.waitForTimeout(800);
    assert(await dialog.count() === 0, 'tour came back after reload');
    await page.context().close();
  });

  await check('first DM reaches an online recipient with an unread badge', async () => {
    await search(a, 'Bob');
    await entity(a, 'Bob').click();
    await send(a, 'hello bob');
    await entity(b, 'Alice').locator('.chat-unread-badge').waitFor();
    assert((await entity(b, 'Alice').locator('.chat-unread-badge').innerText()) === '1', 'badge');
  });

  await check('opening clears unread; read tick reaches the sender', async () => {
    await entity(b, 'Alice').click();
    await bubble(b, 'hello bob').waitFor();
    await b.waitForTimeout(400);
    assert(await entity(b, 'Alice').locator('.chat-unread-badge').count() === 0, 'badge stayed');
    await bubble(a, 'hello bob').locator('.message-ticks.is-read').waitFor();
  });

  await check('typing indicator, reply and sidebar preview update live', async () => {
    await clearSearch(a);
    await composer(b).pressSequentially('typing', { delay: 20 });
    await a.locator('.typing-dots').waitFor();
    await composer(b).fill('');
    await send(b, 'hi alice');
    await bubble(a, 'hi alice').waitFor();
    await entity(a, 'Bob').getByText('hi alice').waitFor();
  });

  await check('two rapid sends both arrive in order', async () => {
    await send(a, 'rapid one');
    await send(a, 'rapid two');
    await bubble(b, 'rapid two').waitFor();
    const texts = await b.locator('.message-text').allInnerTexts();
    assert(texts.includes('rapid one') && texts.indexOf('rapid one') < texts.indexOf('rapid two'), 'order');
  });

  await check('special characters render literally', async () => {
    const text = 'I <3 you & <b>bold</b> "q"';
    await send(a, text);
    const node = b.locator('.message-text', { hasText: 'bold' });
    await node.waitFor();
    assert((await node.innerText()) === text, 'text changed');
  });

  await check('reply, reaction, edit and delete sync across users', async () => {
    await menu(b, 'rapid one', 'Reply');
    await send(b, 'replying now');
    await row(a, 'replying now').getByText('rapid one').waitFor();
    // Step the mouse across: a direct click would skip the gap beside the bubble.
    await bubble(b, 'rapid two').hover();
    const reactTrigger = row(b, 'rapid two').getByRole('button', { name: 'React to message' });
    const box = await reactTrigger.boundingBox();
    await b.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
    await b.waitForTimeout(250);
    if (!(await reactTrigger.isVisible())) throw new Error('reaction trigger hid while moving to it');
    await b.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await row(b, 'rapid two').locator('.message-reaction-picker').getByText('👍').click();
    await row(a, 'rapid two').locator('.message-reaction-chip').waitFor();
    await menu(a, 'rapid two', 'Edit');
    await composer(a).fill('rapid two edited');
    await composer(a).press('Enter');
    await bubble(b, 'rapid two edited').waitFor();
    await menu(a, 'rapid one', 'Delete');
    await a.locator('.confirm-dialog').getByRole('button', { name: 'Delete' }).click();
    await b.locator('.message-text', { hasText: /^rapid one$/ }).waitFor({ state: 'detached' });
  });

  await check("no delete option on someone else's message", async () => {
    await bubble(a, 'hi alice').click({ button: 'right' });
    const open = a.locator('.message-context-menu.is-open');
    await open.getByRole('button', { name: /Reply$/ }).waitFor();
    assert(await open.getByRole('button', { name: /Delete$/ }).count() === 0, 'offered');
    await a.mouse.click(700, 500);
  });

  await check('attachments: viewer, private URLs, spoofed type refused', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC', 'base64');
    const attach = async (name, mimeType, buffer) => {
      await a.locator('input[type=file]').first().setInputFiles({ name, mimeType, buffer });
      await a.waitForTimeout(300);
      await composer(a).press('Enter');
    };
    await attach('dot.png', 'image/png', png);
    const image = b.locator('.message-media img');
    await image.waitFor();
    await b.waitForFunction(() => { const i = document.querySelector('.message-media img'); return i && i.complete && i.naturalWidth > 0; });
    const src = await image.getAttribute('src');
    assert(/\/media\/.*\?mt=/.test(src), `not private: ${src}`);
    const bare = src.split('?')[0];
    assert((await fetch(bare)).status === 404, 'readable without a token');
    assert((await fetch(src)).status === 200, 'token refused');
    await b.locator('.message-media').click();
    await b.locator('.media-viewer img[alt="dot.png"]').waitFor();
    const box = await b.locator('.media-viewer').boundingBox();
    assert(box.height >= 790 && box.width >= 1270, 'viewer not fullscreen');
    await b.keyboard.press('Escape');
    await attach('doc.pdf', 'application/pdf', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'));
    await b.getByText('doc.pdf').first().waitFor();
    await attach('evil.png', 'image/png', Buffer.from('<script>alert(1)</script>'));
    await a.locator('.message-bubble.is-failed .message-retry').waitFor();
    assert(await b.getByText('evil.png').count() === 0, 'spoof delivered');
    await menu2Delete(a);
  });

  async function menu2Delete(page) {
    await page.locator('.message-bubble.is-failed').click({ button: 'right' });
    await page.locator('.message-context-menu.is-open').getByRole('button', { name: /Delete$/ }).click();
    await page.locator('.confirm-dialog').getByRole('button', { name: 'Delete' }).click();
    await page.locator('.message-bubble.is-failed').waitFor({ state: 'detached' });
  }

  await check('voice note records, sends and is playable by the recipient', async () => {
    await a.getByRole('button', { name: 'Record voice message' }).click();
    await a.waitForTimeout(1200);
    await a.getByRole('button', { name: 'Send voice message' }).click();
    await a.waitForTimeout(600);
    const message = await models.MessagesModel.findOne({ 'attachments.contentType': /^audio\// });
    assert(message, 'not stored');
    const src = await b.evaluate(() => document.querySelector('audio')?.src);
    assert(src && /\/media\//.test(src), `no audio element: ${src}`);
    assert((await fetch(src)).status === 200, 'audio not fetchable');
  });

  await check('location message renders a map for the recipient', async () => {
    await a.locator('button:has(img[src="/attachment.svg"])').click();
    await a.getByRole('button', { name: /Location/ }).first().click();
    await a.getByRole('button', { name: 'Send current location' }).click();
    await b.locator('.leaflet-container').waitFor();
    const message = await models.MessagesModel.findOne({ type: 'location' });
    assert(Math.abs(message.location.lat - 28.6) < 0.01, 'wrong position');
  });

  await check('in-chat search finds and jumps', async () => {
    await a.getByRole('button', { name: 'Search in chat' }).click();
    await a.getByLabel('Search in this chat').fill('replying');
    await a.getByText('1/1').waitFor();
    await a.locator('.message-row.is-highlighted').waitFor();
    await a.keyboard.press('Escape');
  });

  await check('pin bar, star and selection keep the shell in place', async () => {
    await menu(a, 'replying now', 'Pin');
    await b.locator('.message-pin-bar').getByText('replying now').waitFor();
    await menu(a, 'replying now', 'Star');
    await bubble(a, 'replying now').locator('.text-amber-500').waitFor();
    await menu(a, 'replying now', 'Select');
    await a.getByText('1 selected').waitFor();
    await row(a, 'hi alice').click();
    await a.getByText('2 selected').waitFor();
    const shift = await a.evaluate(() => { const r = document.querySelector('.main-app'); return [r.scrollLeft, r.scrollTop, window.scrollX, window.scrollY]; });
    assert(shift.every((v) => v === 0), `shifted ${shift}`);
    await a.getByRole('button', { name: 'Cancel selection' }).click();
  });

  await check('draft survives reload and shows in the sidebar', async () => {
    await composer(a).fill('unfinished thought');
    await a.waitForTimeout(500);
    await reload(a);
    await entity(a, 'Bob').getByText('unfinished thought').waitFor();
    await entity(a, 'Bob').click();
    await bubble(a, 'hi alice').waitFor();
    await a.waitForTimeout(300);
    assert(await composer(a).inputValue() === 'unfinished thought', 'not restored');
    await composer(a).fill('');
    await a.waitForTimeout(450);
  });

  await check('disappearing messages sync and stamp an expiry', async () => {
    const choose = async (label) => {
      await a.getByRole('button', { name: 'Options', exact: true }).click();
      await a.getByRole('button', { name: 'Disappearing messages' }).click();
      await a.getByRole('button', { name: label }).click();
    };
    await choose('24 hours');
    await b.locator('.disappearing-pill').waitFor();
    await send(a, 'gone tomorrow');
    await bubble(b, 'gone tomorrow').waitFor();
    const message = await models.MessagesModel.findOne({ content: 'gone tomorrow' });
    assert(message.expiresAt > new Date(Date.now() + 23 * 3600e3), 'no expiry');
    await choose('Off');
    await b.locator('.disappearing-pill').waitFor({ state: 'detached' });
  });

  await check('unread is per chat and survives reload', async () => {
    const quiet = await models.ChatsModel.create({ type: 'group', name: 'Quiet Room', users: [alice._id, bob._id], owner: alice._id, admins: [alice._id] });
    await models.UsersModel.updateMany({ _id: { $in: [alice._id, bob._id] } }, { $addToSet: { Chats: quiet._id } });
    await reload(b);
    await entity(b, 'Quiet Room').click();
    await b.waitForTimeout(400);
    await entity(b, 'Alice').click();
    await b.waitForTimeout(400);
    await reload(a);
    await entity(a, 'Quiet Room').click();
    await send(a, 'quiet one');
    await entity(b, 'Quiet Room').locator('.chat-unread-badge').waitFor();
    for (let i = 0; i < 20; i++) await models.MessagesModel.create({ chat: history._id, uid: carol._id, content: 'noise' });
    await send(a, 'quiet two');
    await b.waitForFunction(() => [...document.querySelectorAll('.chat-entity')].some((e) => e.textContent.includes('Quiet Room') && e.querySelector('.chat-unread-badge')?.textContent === '2'));
    await reload(b);
    await entity(b, 'Quiet Room').locator('.chat-unread-badge').waitFor();
    const count = await entity(b, 'Quiet Room').locator('.chat-unread-badge').innerText();
    assert(count === '2', `got ${count}`);
    await entity(b, 'Alice').click();
    await entity(a, 'Bob').click();
  });

  await check('group: create, live for members, removal is immediate', async () => {
    await a.getByRole('button', { name: 'New group' }).click();
    await a.getByPlaceholder('Name your group').fill('Garden Club');
    await a.locator('.group-create-card').getByText('Bob').first().click();
    await a.locator('.group-create-card .animate-pop-in').getByText('Bob').waitFor();
    await a.getByRole('button', { name: /Create/ }).click();
    await entity(b, 'Garden Club').waitFor();
    await entity(a, 'Garden Club').click();
    await send(a, 'welcome to the club');
    await entity(b, 'Garden Club').locator('.chat-unread-badge').waitFor();
    await entity(b, 'Garden Club').click();
    await bubble(b, 'welcome to the club').waitFor();
    await a.locator('.message-titlebar button').first().click();
    await a.getByRole('button', { name: 'Members' }).click();
    await a.getByRole('button', { name: 'Remove' }).click();
    await entity(b, 'Garden Club').waitFor({ state: 'detached' });
    await a.getByRole('button', { name: 'Close' }).click();
  });

  await check('invite link joins through sign-in; reset kills the old link', async () => {
    await a.locator('.message-titlebar button').first().click();
    await a.getByRole('button', { name: 'Get invite link' }).click();
    const link = await a.getByLabel('Invite link').inputValue();
    assert(link.includes('/app?invite='), link);
    const page = await open(browser);
    await page.goto(link);
    await page.waitForURL('**/auth/signin');
    await page.fill('input[type=email]', 'erin@test.invalid');
    await page.fill('input[type=password]', 'Password123');
    await page.click('button[type=submit]');
    await page.waitForURL('**/app');
    await bubble(page, 'welcome to the club').waitFor();
    assert(!page.url().includes('invite='), 'code left in the URL');

    await a.getByRole('button', { name: 'Reset link' }).click();
    await a.waitForFunction((old) => document.querySelector('input[aria-label="Invite link"]').value !== old, link);
    const late = await user(browser, 'dave@test.invalid');
    await late.goto(link);
    await late.getByText(/invalid or has been reset/).waitFor();
    assert(await late.locator('.message-text', { hasText: 'welcome to the club' }).count() === 0, 'old link worked');
    await late.context().close();
    await page.context().close();
    await a.getByRole('button', { name: 'Close' }).click();
  });

  await check('Saved Messages stays private', async () => {
    await search(a, 'Alice');
    await entity(a, 'Alice').click();
    await send(a, 'note to self');
    await bubble(a, 'note to self').waitFor();
    await clearSearch(a);
    await entity(a, 'Saved Messages').getByText('note to self').waitFor();
    await b.waitForTimeout(300);
    assert(await b.getByText('note to self').count() === 0, 'reached Bob');
  });

  await check('audio call rings, connects and ends on both sides', async () => {
    await entity(a, 'Bob').click();
    await bubble(a, 'hi alice').waitFor();
    await entity(b, 'Alice').click();
    await a.getByRole('button', { name: 'Start audio call' }).click();
    await b.getByText(/Alice/).filter({ hasText: /call/i }).first().waitFor();
    await b.getByRole('button', { name: /^(Accept|Answer|Join)/i }).click();
    await a.waitForFunction(() => document.querySelector('.lk-room-container, [data-lk-theme]'));
    await b.waitForFunction(() => document.querySelector('.lk-room-container, [data-lk-theme]'));
    await a.screenshot({ path: `${SHOTS}/call.png` });
    await a.getByRole('button', { name: /leave|end|hang/i }).first().click();
    await a.waitForFunction(() => !document.querySelector('.lk-room-container, [data-lk-theme]'));
    await b.waitForFunction(() => !document.querySelector('.lk-room-container, [data-lk-theme]'));
  });

  await check('calling back while ringing does not connect; decline and missed calls are logged', async () => {
    await a.getByRole('button', { name: 'Start audio call' }).click();
    await b.getByRole('button', { name: 'Answer' }).waitFor();
    // The incoming card covers this button at most widths, so bypass hit-testing.
    await b.getByRole('button', { name: 'Start audio call' }).dispatchEvent('click');
    await b.getByText('You have an incoming call here').waitFor();
    assert(!(await b.locator('.lk-room-container, [data-lk-theme]').count()), 'callee connected without answering');
    await b.getByRole('button', { name: 'Decline' }).click();
    await a.getByText('Call declined').waitFor();
    await b.locator('.message-call-log', { hasText: 'Declined voice call' }).waitFor();
    await a.waitForFunction(() => !document.querySelector('.lk-room-container, [data-lk-theme]'));
    await a.getByRole('button', { name: 'Start audio call' }).click();
    await b.getByRole('button', { name: 'Answer' }).waitFor();
    await a.getByRole('button', { name: 'End call' }).click();
    await b.getByRole('button', { name: 'Answer' }).waitFor({ state: 'detached' });
    await b.locator('.message-call-log', { hasText: 'Missed voice call' }).waitFor();
    await a.locator('.message-call-log', { hasText: 'Unanswered voice call' }).waitFor();
  });

  await check('end-to-end encryption: server sees ciphertext; a new device needs the passphrase', async () => {
    const PASS = 'correct horse battery';
    const f = await user(browser, 'frank@test.invalid', undefined, media);
    const g = await user(browser, 'grace@test.invalid', undefined, media);
    pages = { ...pages, f, g };
    const turnOn = async (page) => {
      await page.getByRole('button', { name: /Turn on encryption/ }).click();
      await page.getByLabel('Encryption passphrase').fill(PASS);
      await page.getByLabel('Confirm passphrase').fill(PASS);
      await page.locator('.e2ee-prompt').getByRole('button', { name: 'Turn on encryption' }).click();
      await page.locator('.e2ee-prompt').waitFor({ state: 'detached' });
    };
    await turnOn(f);
    await turnOn(g);

    await search(f, 'Grace');
    await entity(f, 'Grace').click();
    await send(f, 'top secret hello');
    await entity(g, 'Frank').waitFor();
    await clearSearch(f);
    assert((await entity(g, 'Frank').innerText()).includes('top secret hello'), 'sidebar preview decrypts');
    await entity(g, 'Frank').click();
    await bubble(g, 'top secret hello').waitFor();
    await composer(g).and(g.locator('[placeholder="Encrypted message..."]')).waitFor();
    await send(g, 'secret reply');
    await bubble(f, 'secret reply').waitFor();

    const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    await f.locator('input[type=file]').first().setInputFiles({ name: 'private.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
    await composer(f).press('Enter');
    for (const page of [f, g]) {
      await page.waitForFunction(() => [...document.querySelectorAll('.message-media img')].some((img) => img.src.startsWith('blob:') && img.complete && img.naturalWidth > 0), null, { timeout: 15000 });
    }

    await menu(f, 'top secret hello', 'Edit');
    await composer(f).fill('top secret edited');
    await composer(f).press('Enter');
    await bubble(g, 'top secret edited').waitFor();

    await entity(f, 'Sealed Room').click();
    await entity(g, 'Sealed Room').click();
    await send(f, 'group secret');
    await bubble(g, 'group secret').waitFor();
    await f.getByRole('button', { name: 'Record voice message' }).click();
    await f.waitForTimeout(1200);
    await f.getByRole('button', { name: 'Send voice message' }).click();
    await g.waitForFunction(() => document.querySelector('audio')?.src.startsWith('blob:'), null, { timeout: 15000 });
    await f.locator('button:has(img[src="/attachment.svg"])').click();
    await f.getByRole('button', { name: /Location/ }).first().click();
    await f.getByRole('button', { name: 'Send current location' }).click();
    await g.locator('.leaflet-container').waitFor();
    await entity(f, 'Grace').click();
    await entity(g, 'Frank').click();
    await bubble(g, 'top secret edited').waitFor();

    const stored = await models.MessagesModel.find({ uid: { $in: [frank._id, grace._id] } }).lean();
    const chats = await models.ChatsModel.find({ users: frank._id }).lean();
    assert(stored.length === 6 && stored.every((m) => m.e2ee && !m.content && !m.location), 'every message is sealed');
    assert(!/top secret|secret reply|group secret|private\.png|image\/png|audio\/|voice-message|"lat"/.test(JSON.stringify([stored, chats])), 'plaintext reached the database');

    const safety = async (page, text) => {
      await row(page, text).locator('button').first().click();
      return page.getByTestId('safety-number').innerText();
    };
    const [fromFrank, fromGrace] = [await safety(f, 'secret reply'), await safety(g, 'top secret edited')];
    assert(fromFrank === fromGrace, 'safety numbers match');

    const other = await user(browser, 'grace@test.invalid');
    pages = { ...pages, other };
    await entity(other, 'Frank').click();
    await bubble(other, 'Unlock encryption to read').first().waitFor();
    await other.getByRole('button', { name: /Unlock encrypted messages/ }).click();
    await other.getByLabel('Encryption passphrase').fill('wrong passphrase');
    await other.locator('.e2ee-prompt').getByRole('button', { name: 'Unlock' }).click();
    await other.getByText('That passphrase is not correct').waitFor();
    await other.getByLabel('Encryption passphrase').fill(PASS);
    await other.locator('.e2ee-prompt').getByRole('button', { name: 'Unlock' }).click();
    await bubble(other, 'top secret edited').waitFor();
    await send(other, 'from my new device');
    await entity(f, 'Grace').filter({ hasText: 'from my new device' }).waitFor();
    pages = { a, b };
    await Promise.all([f, g, other].map((page) => page.context().close()));
  });

  await check('the tour fits a phone screen and is skipped with Escape', async () => {
    const page = await open(browser, { width: 375, height: 700 });
    await page.goto(`${APP}/auth/signin`);
    await page.getByRole('button', { name: 'Try the demo' }).click();
    await page.waitForURL('**/app');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Show me around' }).click();
    for (const title of ['Find people', 'Start a group']) {
      await dialog.getByText(title).waitFor();
      await page.waitForTimeout(300);
      const box = await dialog.boundingBox();
      assert(box.x >= 0 && box.x + box.width <= 375 && box.y >= 0 && box.y + box.height <= 700, `${title} card off screen: ${JSON.stringify(box)}`);
      await dialog.getByRole('button', { name: 'Next' }).click();
    }
    await page.screenshot({ path: `${SHOTS}/tour-mobile.png` });
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await page.context().close();
  });

  await check('reconnects after a network drop and keeps receiving', async () => {
    await a.context().setOffline(true);
    await a.waitForTimeout(500);
    await a.context().setOffline(false);
    await a.waitForTimeout(2500);
    await send(b, 'after reconnect');
    await bubble(a, 'after reconnect').waitFor({ timeout: 15000 });
  });

  await check('pagination loads older history without jumping', async () => {
    const page = await user(browser, 'carol@test.invalid');
    await entity(page, 'Dave').click();
    await bubble(page, 'noise').waitFor();
    assert(await page.getByText('history 001').count() === 0, 'loaded too much');
    const before = await page.locator('.message-row').count();
    const list = page.locator('.message-list');
    await list.evaluate((el) => { el.scrollTop = 0; });
    await page.waitForFunction((n) => document.querySelectorAll('.message-row').length > n, before);
    await page.waitForTimeout(250);
    assert(await list.evaluate((el) => el.scrollTop) > 100, 'jumped to top');
    for (let i = 0; i < 6 && !(await page.getByText('history 001').count()); i++) {
      await list.evaluate((el) => { el.scrollTop = 0; });
      await page.waitForTimeout(350);
    }
    await bubble(page, 'history 001').waitFor();
    await page.getByRole('button', { name: 'Jump to latest message' }).click();
    await page.waitForTimeout(2000);
    assert(await list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight < 100), 'jump failed');
    await page.context().close();
  });

  await check('upgrade clears other people\'s cached records from old builds', async () => {
    const page = await open(browser);
    await page.goto(`${APP}/auth/signin`);
    await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('ChatApp', 5);
      request.onupgradeneeded = () => ['meta', 'chats', 'profiles', 'messages'].forEach((s) => request.result.createObjectStore(s, { keyPath: '_id' }));
      request.onsuccess = () => {
        const tx = request.result.transaction('profiles', 'readwrite');
        tx.objectStore('profiles').put({ _id: 'someone', password: '$2b$hash' });
        tx.oncomplete = () => { request.result.close(); resolve(); };
      };
      request.onerror = () => reject(request.error);
    }));
    await signIn(page, 'dave@test.invalid');
    await page.waitForTimeout(400);
    const leaked = await page.evaluate(() => new Promise((resolve) => {
      const request = indexedDB.open('ChatApp');
      request.onerror = () => resolve(`open failed: ${request.error}`);
      request.onblocked = () => resolve('open blocked');
      request.onsuccess = () => {
        try {
          const database = request.result;
          const stores = [...database.objectStoreNames].join(',');
          if (database.version !== 6 || !database.objectStoreNames.contains('profiles')) return resolve(`v${database.version} stores=${stores}`);
          const get = database.transaction('profiles').objectStore('profiles').get('someone');
          get.onerror = () => resolve(`read failed: ${get.error}`);
          get.onsuccess = () => { resolve(get.result ? 'record survived' : ''); database.close(); };
        } catch (e) { resolve(`threw: ${e.message}`); }
      };
    }));
    assert(leaked === '', leaked);
    await page.context().close();
  });

  await check('log out of all devices ends the other device at once', async () => {
    const first = await user(browser, 'carol@test.invalid');
    const second = await user(browser, 'carol@test.invalid');
    await second.getByRole('button', { name: /settings/i }).first().click();
    await second.getByRole('button', { name: 'Log out of all devices' }).click();
    await second.waitForURL('**/auth/signin');
    await first.waitForURL('**/auth/signin');
    await first.waitForTimeout(300);
    assert(!(await first.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))).includes('ChatApp'), 'cache left');
    await first.context().close();
    await second.context().close();
  });

  await check('logout wipes the cache; the next account sees nothing', async () => {
    await a.getByRole('button', { name: /settings/i }).first().click();
    await a.getByRole('button', { name: 'Log out', exact: true }).click();
    await a.waitForURL('**/auth/signin');
    await a.waitForTimeout(300);
    assert(!(await a.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))).includes('ChatApp'), 'cache left');
    await signIn(a, 'dave@test.invalid');
    await entity(a, 'Carol').waitFor();
    assert(await a.getByText('hi alice').count() === 0, 'previous user leaked');
  });

  await check('mobile layout swaps list and conversation', async () => {
    const page = await user(browser, 'carol@test.invalid', { width: 390, height: 780 });
    await entity(page, 'Dave').click();
    await bubble(page, 'noise').waitFor();
    assert(await page.locator('.chat-entity').count() === 0, 'list still shown');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'overflow');
    await page.getByRole('button', { name: 'Back to chats' }).click();
    await entity(page, 'Dave').waitFor();
    await page.context().close();
  });

  await browser.close();
  await mongoose.disconnect();
  console.log(`\nRESULT pass=${pass} fail=${failures.length}`);
  if (failures.length) console.log('FAILED:', failures.join(' | '));
  const unique = [...new Set(errors)];
  console.log(`browser errors: ${unique.length}`);
  unique.slice(0, 15).forEach((e) => console.log('  ', e));
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS', e); process.exit(2); });
