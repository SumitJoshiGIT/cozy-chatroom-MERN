const { faker } = require('@faker-js/faker');
const models = require('./models/exports');
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/ChatApp');

const Chats = models.ChatsModel;
const Groups = models.GroupsModel;
const Permissions = models.PermissionsModel;
const Settings = models.SettingsModel;
const Users = models.UsersModel;
const Messages = models.MessagesModel;

const generateData = async () => {
    try {
        await Users.deleteMany({});
        await Chats.deleteMany({});
        await Messages.deleteMany({});
        await Permissions.deleteMany({});
        await Settings.deleteMany({});
        let x=faker.person.fullName()
        // Create users
        const user1 = new Users({
            name:x,
            Chats: [],
            username:x,
            password:'pass',
            email:`${faker.animal.fish()}@gmail.com`, 
            SettingsID: null,
        });
        x=faker.person.fullName()
        const user2 = new Users({
            name: x,
            Chats: [],
            username:x,
            
            password:'pass',
            email:`${faker.animal.fish()}@gmail.com`, 
            SettingsID: null,
        });

        await user1.save();
        await user2.save();
        for(let i=0;i<10;i++){
            try{
            (new Users({
                name: faker.person.fullName(),
                Chats: [],
                username:x,  
                password:'pass',
                email:`${faker.animal.fish()}@gmail.com`, 
                SettingsID: null,
            })).save();
        }catch{}
        }
        // Create chat
        const chat = new Chats({
            group: null,
            users:[user1._id,user2._id],
            type: 'private',
        });

        await chat.save();

        // Add chat to users
        user1.Chats.push(chat._id);
        user2.Chats.push(chat._id);
        await user2.save();
        user1.contacts.push(user2._id);
        await user1.save();

        // Create messages for each user
        for (let i = 0; i < 50; i++) {
            const message1 = new Messages({
                chat: chat._id,
                content: faker.lorem.sentence(),
                type: 'text',
                uid: user1._id,
                reply_to: null,
            });

            const message2 = new Messages({
                chat: chat._id,
                content: faker.lorem.sentence(),
                type: 'text',
                uid: user2._id,
                reply_to: null,
            });

            await message1.save();
            await message2.save();
        }
 
        console.log(user1._id);
        mongoose.connection.close();
    } catch (error) {
        console.error(error);
        mongoose.connection.close();
    }
};

generateData();
