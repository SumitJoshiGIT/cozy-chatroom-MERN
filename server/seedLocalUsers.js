require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const models = require('./models/exports');

const USERS = [
  { name: 'Aarav Sharma', email: 'aarav.local@lavender.test' },
  { name: 'Maya Patel', email: 'maya.local@lavender.test' },
  { name: 'Noah Williams', email: 'noah.local@lavender.test' },
  { name: 'Zara Khan', email: 'zara.local@lavender.test' },
  { name: 'Liam Carter', email: 'liam.local@lavender.test' },
];

function createPassword() {
  return `Lavender-${crypto.randomBytes(6).toString('base64url')}`;
}

async function seedLocalUsers() {
  if (!process.env.DATABASE) throw new Error('DATABASE env var is required');

  await mongoose.connect(process.env.DATABASE);
  const credentials = [];

  for (const definition of USERS) {
    let user = await models.UsersModel.findOne({ email: definition.email });
    let password;

    if (!user) {
      password = createPassword();
      user = await models.UsersModel.create({
        ...definition,
        password: await bcrypt.hash(password, 10),
        Chats: [],
        contacts: [],
      });
    } else {
      password = '[existing password not changed]';
    }

    credentials.push({
      name: user.name,
      email: user.email,
      password,
      userId: String(user._id),
    });
  }

  const output = [
    'Lavender local test users',
    `Generated: ${new Date().toISOString()}`,
    '',
    ...credentials.flatMap((user, index) => [
      `${index + 1}. ${user.name}`,
      `   email: ${user.email}`,
      `   password: ${user.password}`,
      `   userId: ${user.userId}`,
      '',
    ]),
  ].join('\n');

  const outputPath = path.join(__dirname, 'local-demo-users.txt');
  await fs.writeFile(outputPath, `${output}\n`, { mode: 0o600 });
  console.log(`Local users ready. Credentials written to ${outputPath}`);
  await mongoose.connection.close();
}

seedLocalUsers().catch(async (error) => {
  console.error('Failed to seed local users:', error);
  await mongoose.connection.close().catch(() => {});
  process.exitCode = 1;
});
