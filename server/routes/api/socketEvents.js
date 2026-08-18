const models = require("../../models/exports");
const ObjectID = require("mongoose").Types.ObjectId;
const fs = require("fs");
const path = require("path");
const xss = require("xss");
const allowedTypes = {
  "image/png":"png",
  "image/jpeg":"jpg",
  "image/jpg":"jpg",
  "image/webp":"webp",
  "image/svg":"svg",
  "image/svg+xml":"svg",
};
const maxUploadSize = 2*1024*1024;

async function saveUpload(base64, mimeType, name, size) {
  if (!base64 || !allowedTypes[mimeType]) return null;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > maxUploadSize) return null;
  const ext = allowedTypes[mimeType];
  const src = `${Date.now()}-${Math.round(Math.random()*1e9)}.${ext}`;
  await fs.promises.writeFile(path.join(process.cwd(), "public", src), buffer);
  return { src, name, size, contentType: mimeType };
}
async function onConnection(socket, io) {
  let profile = null;
  try {
    const pid = socket.handshake.session.passport.user._id;
    profile = await models.UsersModel.findById(pid);
  
  } catch (err) {}

  socket.emit("auth", profile ? profile : null);

  if (profile) {
    const chatSet = new Set(profile.Chats.map((chat) => chat.toString()));
    chatSet.forEach((id)=>socket.join(id))

    socket.use((stream, next) => {
     // console.log(1);
      next();
    });
    async function SendMessage(message) {
      if (chatSet.has(message.cid)) {
        console.log(message,"m")
        if (message.reply_to){
         if(!await models.MessagesModel.find({
          _id: (message.reply_to),
          chat: (message.cid),
        }))message.reply_to=null;
      }
        const attachments = [];
        if (Array.isArray(message.attachments)) {
          for (const attachment of message.attachments.slice(0, 10)) {
            const saved = await saveUpload(attachment.file, attachment.type, attachment.name, attachment.size);
            if (saved) attachments.push(saved);
          }
        }
        const newMessage = new models.MessagesModel({
          chat: (message.cid),
          content: xss(message.content),
          uid: profile._id,
          reply_to:(message.reply_to),
          status:"✔",
          attachments,
        });
        try {
          await newMessage.save();
          io.to(message.cid).emit(`messages`, {
            id: message.cid,
            replace: message.replace,
            data: [newMessage],
          });
        } catch (err) {
          console.log(err);
        }
      }
    }

    socket.on("join",async function ([cid]){
      const oid=(cid);
      let chat=null
      if(!chatSet.has(oid.toString())){
       chat =await models.ChatsModel.findById(oid)
       if(!chat) return;
       profile.Chats.push(chat._id);
       chatSet.add(oid.toString());
       chat.users.push(profile._id);
       await profile.save();
       await chat.save();
       console.log("joined",chat);
       socket.join(oid.toString());
      }
      if(chat)socket.emit("chat",{type:'join',chats:[chat]})

    })

    socket.on("sendMessage", SendMessage);

    socket.on("search", async (stream) => {
      console.log(stream);
      const term = new RegExp(xss(`${stream.query}`), "i");
      const model =
        stream.target == 1
          ? models.UsersModel
          : stream.target == 2
          ? models.MessagesModel
          : models.ChatsModel;
      const data = await model.aggregate([
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
        { $project: { password: 0, email: 0 } },
        { $sort: { username: 1 } },
        { $limit: 10 },
      ]);
      socket.emit("searchResults", { results: data, target: stream.target });
    });
    socket.on("reportChat", (id) => {});
    
    socket.on("deleteMessage", async ([mid, id, cid]) => {
      let success = null;
      console.log("delete")
      if (chatSet.has(cid)) {
        success = await models.MessagesModel.findByIdAndDelete({
          _id: (id),
          chat:(cid),
        });
      }
      if (!success) success = { cid: cid, mid: mid, _id: id };
      socket.emit(`deleteMessage`, [success._id, success.mid, success.chat]);
    });
    
    socket.on("leaveChat", async ({ id, del }) => {
      console.log("remove",id)
      if (chatSet.has(id)) {
        console.log(id);
        socket.leave(id);
        profile.Chats = profile.Chats.filter((x) => x != id);
        try {
          const resp = await models.ChatsModel.findByIdAndUpdate(
            (id),
            { $pull: { users: profile._id } },
            { new: true }
          );
          console.log(resp)(
            await models.ChatsModel.findOneAndDelete({
              _id: (id),
              type: "private",
            })
          );
        } catch {}
        await profile.save();
        chatSet.delete(id);
      }
      socket.emit("leaveChat", [id, del]);
    });
    socket.on("muteChat", (id) => {});
    socket.on("chats", async (stream) => {
      const data = await models.ChatsModel.find({ _id: { $in: [...chatSet] } });
      socket.emit("chat", {
        type: stream.type,
        chats: data,
        target: stream.target,
      });
    });

    socket.on("messages", async (stream) => {
      try {
         console.log(stream);
         const obj = { chat: new ObjectID(stream.cid) };
         if(!chatSet.has(stream.cid))obj.type='group'
           //if (stream.mid)
          //obj.mid = stream.gt ? { $gt: stream.mid } : { $lt: stream.mid };
         
         const data = await models.MessagesModel.aggregate([
          { $match: obj },
          { $limit: 30 },
          {
            $lookup: {
              from: "messages",
              localField: "reply_to",
              foreignField: "_id",
              as: "replyToMessage",
            },
          },
          {
            $unwind: {
              path: "$replyToMessage",
              preserveNullAndEmptyArrays: true,
            },
          },
        ]);
        if (data.length) {
          io.to(stream.cid).emit(`messages`, { id: stream.cid, data: data });
          console.log("len",data.length)
        
          //  console.log(data);
        }
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("updateProfile", async (stream) => {
        const changes = {};
        if (stream.about) {
                changes.about = xss(stream.about);
                profile.about = changes.about;
        }
        if (stream.name) {
                changes.name = xss(stream.name);
                profile.name = changes.name;
        }
        if (stream.username) {
                changes.username = xss(stream.username);
                profile.username = changes.username;
        }
        if (stream.img && allowedTypes[stream.img.type]) {
            const ext = allowedTypes[stream.img.type];
            const buffer = Buffer.from(stream.file,'base64');
            const oldSrc = profile.img && profile.img.src;
            const content = {
              src: `${profile._id}.${ext}`,
              name: stream.img.name,
              size: stream.img.size,
              contentType: stream.img.type,
            };

            await fs.promises.writeFile(path.join(process.cwd(), "public", content.src), buffer);
            if (oldSrc && oldSrc !== content.src) {
              fs.promises.unlink(path.join(process.cwd(), "public", oldSrc)).catch(() => {});
            }
            profile.img=content;
            changes.img=content;
        }
        await profile.save();
        changes._id=profile._id;
        socket.emit("profile",profile);
        chatSet.forEach((x) => io.to(x).emit("profile",changes));
    });

    function isChatAdmin(chat){
      return (chat.admins||[]).some(a=>a.toString()===profile._id.toString()) ||
        (chat.owner && chat.owner.toString()===profile._id.toString());
    }
    function isChatOwner(chat){
      return chat.owner && chat.owner.toString()===profile._id.toString();
    }

    socket.on("updateChat", async (stream) =>{
      const chat=await models.ChatsModel.findById(stream.cid)
      if(!chat || !chatSet.has(chat._id.toString()) || !isChatAdmin(chat)) return;

      if(stream.name) chat.name=xss(stream.name);
      if(stream.about) chat.about=xss(stream.about);
      if(stream.username) chat.username=xss(stream.username);
      if(stream.img && stream.file){
        const img=await saveUpload(stream.file, stream.img.type, stream.img.name, stream.img.size);
        if(img) chat.img=img;
      }
      await chat.save();
      io.to(chat._id.toString()).emit("chat",{type:"chats",chats:[chat]});
    });

    socket.on("removeUser", async ({chatID, userID: targetId}) => {
      const chat=await models.ChatsModel.findById(chatID);
      if(!chat || !isChatAdmin(chat)) return;
      await models.ChatsModel.findByIdAndUpdate(chatID,{$pull:{users:targetId, admins:targetId}});
      await models.UsersModel.findByIdAndUpdate(targetId,{$pull:{Chats:chatID}});
      const updated=await models.ChatsModel.findById(chatID);
      io.to(chatID).emit("chat",{type:"chats",chats:[updated]});
      socket.to(targetId.toString()).emit("leaveChat",[chatID,false]);
    });

    socket.on("promoteUser", async ({chatID, userID: targetId}) => {
      const chat=await models.ChatsModel.findById(chatID);
      if(!chat || !isChatOwner(chat)) return;
      await models.ChatsModel.findByIdAndUpdate(chatID,{$addToSet:{admins:targetId}});
      const updated=await models.ChatsModel.findById(chatID);
      io.to(chatID).emit("chat",{type:"chats",chats:[updated]});
    });

    socket.on("demoteUser", async ({chatID, userID: targetId}) => {
      const chat=await models.ChatsModel.findById(chatID);
      if(!chat || !isChatOwner(chat)) return;
      await models.ChatsModel.findByIdAndUpdate(chatID,{$pull:{admins:targetId}});
      const updated=await models.ChatsModel.findById(chatID);
      io.to(chatID).emit("chat",{type:"chats",chats:[updated]});
    });



    socket.on("contacts", async (stream) => {
      socket.emit("contacts", profile.contacts.map(String));
    });
    socket.on("getProfile", async (stream) => {
      const user = await models.UsersModel.findById(stream.uid);
      socket.emit(`profile`, user);
    });

    socket.on("createChatPrivate", async (stream) => {
    
      let user = await models.UsersModel.findById(stream.cid);
      if (user && user._id != profile._id) {
        let data = await models.ChatsModel.findOne({
          type: "private",
          users: { $size: 2, $all: [profile._id, user._id] },
        });
        if (!data){
           data = new models.ChatsModel({
            users: [...new Set([profile._id, user._id])],
            type: "private",
          });
          const chat = await data.save();
          chatSet.add(chat._id.toString());
          profile.Chats.push(chat._id);
          profile.contacts.push(user._id);
          user.contacts.push(profile._id);
          await profile.save();
          await user.save();
          chat.sender = stream.cid;
        }
        socket.join(data._id.toString());
        socket.emit(`private.${stream.cid}`,data);
        if (stream.content)
          SendMessage({
            content: stream.content,
            cid: data._id.toString(),
            reply_to: stream.reply_to,
            attachments: stream.attachments,
            replace: stream.replace,
          });
      }
    });

    socket.on("createChat", async (stream) => {
      let owner = profile._id;
      let type = "group";
      let name = xss(stream.name);
      let users = [...new Set([profile._id, ...(stream.members||[])])];
      const data = new models.ChatsModel({
        name: name,
        users: users,
        type: type,
        owner: owner,
        admins: [owner],
      });
      let chat = await data.save();
      const img = await saveUpload(stream.file, stream.type, stream.imgName, stream.size);
      if (img) {
        chat.img = img;
        chat = await chat.save();
      }
      for (const id of users) {
        let user = await models.UsersModel.findByIdAndUpdate((id), {
          $push: { Chats: chat._id },
        });
        if (user) socket.to(id.toString()).emit(`private.${id}`, chat);
      }
      profile.Chats.push((chat._id));
      chatSet.add(chat._id.toString());
      socket.join(chat._id.toString());
      socket.emit("chat", { type: "chats", chats: [chat] });
    });
  } else {
    socket.disconnect();
  }
}

async function onDisconnection(socket) {}
module.exports = { onConnection, onDisconnection };
