require('dotenv').config();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const models = require('./models/exports');

const COUNT = 10;
const FIRST_NAMES = ['Ava', 'Liam', 'Maya', 'Noah', 'Zara', 'Kai', 'Luna', 'Ivy', 'Theo', 'Nora', 'Milo', 'Sage'];
const LAST_NAMES = ['Rivers', 'Hart', 'Novak', 'Cole', 'Blake', 'Reyes', 'Frost', 'Vance', 'Wren', 'Shaw'];
const ABOUTS = ['Just here to say hi 👋', 'New here!', 'Coffee first, messages later.', 'Ask me anything.', ''];

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function seed() {
  await mongoose.connect(process.env.DATABASE);
  const Users = models.UsersModel;
  let created = 0;
  for (let i = 0; i < COUNT; i++) {
    const name = `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`;
    const email = `demo.${Date.now()}.${i}@lavender.demo`;
    const password = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    try {
      await new Users({ name, email, password, about: randomFrom(ABOUTS) }).save();
      created++;
    } catch (err) {
      console.error(`Failed to create ${email}:`, err.message);
    }
  }
  console.log(`Created ${created}/${COUNT} demo users (no existing data was modified).`);
  await mongoose.connection.close();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.connection.close();
});
