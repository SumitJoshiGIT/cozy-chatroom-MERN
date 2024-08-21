const models = require("../../models/exports");
const ObjectID = require("mongoose").Types.ObjectId;
const fs = require("fs");
const path = require("path");
const xss = require("xss");

async function onConnection(socket, io) {
  const profile = await models.UsersModel.findById("66c1ca73fc7fd3de92ce38cf");
  socket.emit("userProfile", profile ? profile : {});

  if (profile) {
    let chats = profile.Chats.map((x) => x.toString());

    socket.on("logout", async () => {
      socket.emit("logout", async () => {});
    });

    async function SendMessage(message) {
      console.log("message", message);
      //if(message.chat in chats){
      const newMessage = new models.MessagesModel({
        chat: new ObjectID(message.cid),
        content: message.content,
        uid: profile._id,
      });
      newMessage
        .save()
        .catch((err) => console.log(err))
        .then((data) => {
          console.log(newMessage);
          io.to(message.cid).emit(`message.${message.cid}`, newMessage);
        });
    }

    socket.on("sendMessage", SendMessage);
    
    socket.on("search",async (stream) => {
        console.log(stream)
         term = new RegExp(xss(`${stream.query}`), "i");
         const model = stream.target==1? models.UsersModel:stream.target==2?models.MessagesModel:models.ChatsModel;
         data = await model.aggregate([
           {
             $match: {
               $and: [
                 {
                   $or: [
                     { name: { $regex: term } },
                     { username: { $regex: term } },
                   ],
                 },
                 { type: { $ne: "private" } },
               ],
             },
           },
           { $sort: { username: 1 } },
           { $limit: 10 },
          ]); 
       socket.emit('searchResults',{results:data,target:stream.target});
    })

    socket.on("chats", async (stream) => {
       let data = [];
        data = await Promise.all(
          chats.map(async function (x) {
            let chat = await models.ChatsModel.findById(x);
            if (chat) socket.join(chat._id.toString());
            return chat;
          })
        );
      socket.emit("chat", {
        type: stream.type,
        chats: data,
        target: stream.target,
      });
    });

    socket.on("messages", async (stream) => {
      console.log('msg',stream)
      try {
        const obj = { chat: stream.cid };

        if (stream.mid) obj._id = { $lt: new ObjectID(stream.mid) };
   
        const data = await models.MessagesModel.find(obj)
          .sort({ _id: -1 })
          .limit(30);
        if (data.length)
          io.to(stream.cid).emit(`message.${stream.cid}`, data.reverse());
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("updateProfile", async (stream) => {
      if (stream.about || stream.name) {
        const changes = {};
        changes[stream.about ? "about" : "name"] = stream.about || stream.name;
        const object = await models.UsersModel.findByIdAndUpdate(profile._id, {
          $set: changes,
        }).then(() => {
          profile[stream.about ? "about" : "name"] =
            stream.about || stream.name;
          socket.emit("profile", profile);
        });
      } else if (stream.img) {
        const allowedTypes = [
          "image/png",
          "image/jpeg",
          "image/jpg",
          "image/svg",
          "image/svg+xml",
        ];
        if (allowedTypes.includes(stream.img.type)) {
          const buffer = Buffer.from(new Uint8Array(stream.file));
          const pathto = path.join(`${profile._id}_${stream.img.name}`);
          const content = {
            src: pathto,
            name: stream.img.name,
            size: stream.img.size,
            contentType: stream.img.type,
            dimensions: stream.img.dimensions,
          };
          if (profile.img)
            fs.unlink(
              path.join(process.cwd(), "public", profile.img.src),
              (err) => {}
            );
          fs.writeFile(
            path.join(process.cwd(), "public", pathto),
            buffer,
            (err) => {
              if (!err) {
                models.UsersModel.findByIdAndUpdate(profile._id, {
                  $set: { img: content },
                }).then(() => {
                  profile.img = content;
                });
              }
            }
          );
        }
      }
      socket.emit("userProfile", profile);
    });

    socket.on("contacts", async (stream) => {
      socket.emit("contacts", profile.contacts);
    });
    socket.on("getProfile", async (stream) => {
      const user = await models.UsersModel.findById(stream.uid);
      socket.emit(`profile`, user);
   
    });

    socket.on("createChatPrivate", async (stream) => {
      let user = await models.UsersModel.findById(stream.cid);
      const data = new models.ChatsModel({
        users: [...new Set([profile._id, user._id])],
        type: "private",
      });
      const chat = await data.save();
      profile.Chats.push(chat._id);
      await profile.save();
      await user.save();
      chat.sender=stream.cid;
      chat._id=chat._id;
      socket.join(chat._id.toString());
      socket.emit(`private.${stream.cid}`,chat) 
      if (stream.content)
        SendMessage({
          content: stream.content,
          cid: data._id.toString(),
        });
    });

    socket.on("createChat", async (stream) => {
      let owner = profile._id;
      let type = "group";
      let name = xss(stream.name);
      let users=[...new Set([profile._id, ...stream.members])]
      const data = new models.ChatsModel({
        name: name,
        src: "",
        users: users,
        type: type,
        owner: owner,
      });
      const chat = await data.save();
      for(id of users){
         let user = await models.UsersModel.findByIdAndUpdate(id,{$push:{Chats:chat._id}});
         if(user) socket.to(id.toString()).emit(`private.${id}`,chat)  ;
      }
      chat.sender=stream.cid;
      chat._id=chat._id;
      socket.join(chat._id.toString());
      socket.emit("chat", { type: "chats", chats: [chat] });
       
    });

    socket.on("updateChat", async (stream) => {});
  }
}

async function onDisconnection(socket) {}
module.exports = { onConnection, onDisconnection };
