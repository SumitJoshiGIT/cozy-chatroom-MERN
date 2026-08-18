require('dotenv').config();
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcrypt');
const models = require('./models/exports');
const mongoose = require('mongoose');

mongoose.connect(process.env.DATABASE);

const Chats = models.ChatsModel;
const Permissions = models.PermissionsModel;
const Settings = models.SettingsModel;
const Users = models.UsersModel;
const Messages = models.MessagesModel;

const SEED_PASSWORD = 'password123';

const generateData = async () => {
    try {
        await Users.deleteMany({});
        await Chats.deleteMany({});
        await Messages.deleteMany({});
        await Permissions.deleteMany({});
        await Settings.deleteMany({});
        const hash = await bcrypt.hash(SEED_PASSWORD, 10);

        const user1 = new Users({
            name: faker.person.fullName(),
            Chats: [],
            password: hash,
            email: 'user1@example.com',
            SettingsID: null,
        });
        const user2 = new Users({
            name: faker.person.fullName(),
            Chats: [],
            password: hash,
            email: 'user2@example.com',
            SettingsID: null,
        });

        await user1.save();
        await user2.save();

        for (let i = 0; i < 10; i++) {
            try {
                await (new Users({
                    name: faker.person.fullName(),
                    Chats: [],
                    password: hash,
                    email: `user${i + 3}@example.com`,
                    SettingsID: null,
                })).save();
            } catch {}
        }

        const chat = new Chats({
            users: [user1._id, user2._id],
            type: 'private',
        });

        await chat.save();

        user1.Chats.push(chat._id);
        user2.Chats.push(chat._id);
        await user2.save();
        user1.contacts.push(user2._id);
        user2.contacts.push(user1._id);
        await user1.save();

        for (let i = 0; i < 50; i++) {
            await new Messages({
                chat: chat._id,
                content: faker.lorem.sentence(),
                type: 'text',
                uid: user1._id,
                reply_to: null,
            }).save();

            await new Messages({
                chat: chat._id,
                content: faker.lorem.sentence(),
                type: 'text',
                uid: user2._id,
                reply_to: null,
            }).save();
        }

        console.log(`Seeded. Sign in as ${user1.email} / ${SEED_PASSWORD}`);
        await mongoose.connection.close();
    } catch (error) {
        console.error(error);
        await mongoose.connection.close();
    }
};

generateData();
