const {faker}=require('@faker-js/faker');
const models=require('./exports');
const mongoose=require('mongoose');
mongoose.connect("mongodb://localhost:27017/ChatApp")
const Chats=models.ChatsModel
const Groups=models.GroupsModel
const Permissions=models.PermissionsModel
const Settings=models.SettingsModel
const Users=models.UsersModel
const Messages=models.MessagesModel

mongoose.connect('mongodb://localhost:27017/ChatApp');

const generateData = async () => {
    try {
        await Users.deleteMany({});
        await Chats.deleteMany({});
        await Messages.deleteMany({});
        await Permissions.deleteMany({});
        await Settings.deleteMany({});

        // Create users
        const user1 = new Users({
            name: faker.name.fullName(),
            Chats: [],
            SettingsID: null,
        });

        const user2 = new Users({
            name: faker.name.fullName(),
            Chats: [],
            SettingsID: null,
        });

        await user1.save();
        await user2.save();

        // Create chat
        const chat = new Chats({
            group: null,
            type: "private",
        });

        await chat.save();

        // Add chat to users
        user1.Chats.push(chat._id);
        user2.Chats.push(chat._id);

        await user1.save();
        await user2.save();

        // Create 10 messages for each user
        const messages = [];
        for (let i = 0; i < 10; i++) {
            messages.push(
                new Messages({
                    chat: chat._id,
                    content: faker.lorem.sentence(),
                    type: "text",
                    uid: user1._id,
                    reply_to: null,
                })
            );
            messages.push(
                new Messages({
                    chat: chat._id,
                    content: faker.lorem.sentence(),
                    type: "text",
                    uid: user2._id,
                    reply_to: null,
                })
            );
        }

        await Messages.insertMany(messages);

        console.log('Data generated successfully');
        mongoose.connection.close();
    } catch (error) {
        console.error(error);
        mongoose.connection.close();
    }
};

generateData();
