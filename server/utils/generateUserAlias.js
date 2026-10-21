const crypto = require("crypto");

const ADJECTIVES = [
  "Bright", "Calm", "Clever", "Cosmic", "Cozy", "Curious", "Gentle",
  "Happy", "Mellow", "Mighty", "Nimble", "Quiet", "Sunny", "Swift",
  "Velvet", "Wandering", "Warm", "Whimsical",
];

const ANIMALS = [
  "Badger", "Bunny", "Cat", "Dolphin", "Falcon", "Fox", "Koala",
  "Lynx", "Otter", "Panda", "Penguin", "Quokka", "Robin", "Seal",
  "Sparrow", "Tiger", "Whale", "Wolf",
];

function pick(values) {
  return values[crypto.randomInt(values.length)];
}

function generateUserAlias() {
  const adjective = pick(ADJECTIVES);
  const animal = pick(ANIMALS);
  const suffix = crypto.randomInt(1000, 10000);

  return {
    name: `${adjective} ${animal}`,
    username: `${adjective}${animal}${suffix}`.toLowerCase(),
  };
}

module.exports = generateUserAlias;
