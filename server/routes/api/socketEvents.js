const models = require("../../models/exports");
const ObjectID = require("mongoose").Types.ObjectId;
const fs = require("fs");
const path = require("path");
const xss = require("xss");

async function onConnection(socket, io) {
  let profile = null;
  try {
    const pid = socket.handshake.session.passport.user._id;
    profile = await models.UsersModel.findById(pid);
  } catch (err) {}
  
  socket.emit("auth", profile ? profile : null); 
  
  if (profile) {
    const chatSet=new Set(profile.Chats.map(chat=>chat.toString()));
    socket.use((stream,next)=>{console.log(1);next()})  
    socket.on("logout", async () => {
      socket.emit("logout", async () => {});
    });

    async function SendMessage(message) {
    
      if(chatSet.has(message.cid)){
      if(message.reply&&(!await models.MessagesModel.find({_id:new ObjectID(message.reply),cid:new ObjectID(message.cid)})))return;
      console.log("ack")
      const newMessage = new models.MessagesModel({
        chat: new ObjectID(message.cid),
        content: xss(message.content),
        uid: profile._id,
        reply_to:new ObjectID(message.reply)
      });
      newMessage
        .save()
        .catch((err) => console.log(err))
        .then((data) => {
          console.log(newMessage);
          io.to(message.cid).emit(`messages`,{id:message.cid,replace:message.replace,data:[newMessage,]});
        });
    }}

    socket.on("sendMessage", SendMessage);

    socket.on("search", async (stream) => {
      //console.log(stream);
      term = new RegExp(xss(`${stream.query}`), "i");
      const model =
        stream.target == 1
          ? models.UsersModel
          : stream.target == 2
          ? models.MessagesModel
          : models.ChatsModel;
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
        {$project:{password:0,email:0}},
        { $sort: { username: 1 } },
        { $limit: 10 },
      ]);
      socket.emit("searchResults", { results: data, target: stream.target });
    });
    socket.on("reportChat",(id)=>{

    })
    socket.on("deleteMessage",async ([mid,id,cid])=>{
      let success=null;
      if(chatSet.has(cid)){
        success=await models.MessagesModel.findByIdAndDelete({_id:new ObjectID(id),chat:new ObjectID(cid)});
      }
      if(!success)success={cid:cid,mid:mid,_id:id}
      socket.emit(`deleteMessage`,[success._id,success.mid,success.chat])
    })
    socket.on("leaveChat",async({id,del})=>{
      if(chatSet.has(id)){
        console.log(id)
        socket.leave(id);
        profile.Chats=profile.Chats.filter((x)=>x!=id);
        try{
         const resp=await models.ChatsModel.findByIdAndUpdate(new ObjectID(id),{$pull:{users:profile._id}},{new:true});
         console.log(resp)
         (await models.ChatsModel.findOneAndDelete({_id:new ObjectID(id),type:'private'}));
        }catch{}
        await profile.save();
        chatSet.delete(id);
      }
      socket.emit("leaveChat",[id,del])
      
    })
    socket.on("muteChat",(id)=>{
          
    })
    socket.on("chats", async (stream) => {
      const data =await models.ChatsModel.find({_id:{$in:[...chatSet]}});
      socket.emit("chat", {
        type: stream.type,
        chats: data,
        target: stream.target,
      });
    });

    socket.on("messages", async (stream) => {
      try {
        const obj = { chat:new  ObjectID(stream.cid) };
        if (stream.mid) obj.mid= (stream.gt)?{ $gt:stream.mid }:{ $lt:stream.mid };
        console.log(obj)
        const data = await models.MessagesModel.aggregate([
          { $match: obj },                                
          { $limit: 30 },                     
          {
            $lookup: {                         
              from: 'messages',                
              localField: 'reply_to',          
              foreignField: '_id',             
              as: 'replyToMessage'             
            } 
          },
          { $unwind: {                         
              path: "$replyToMessage",
              preserveNullAndEmptyArrays: true 
          }}
        ]);
        
        if (data.length){
          io.to(stream.cid).emit(`messages`, {id:stream.cid,data:data});
         console.log(data)
        }
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
      chatSet.forEach((x)=>io.emit('profile',profile))
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
      if (user._id!=profile._id) {
        const data = new models.ChatsModel({
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
        socket.join(chat._id.toString());
        socket.emit(`private.${stream.cid}`, chat);
        if (stream.content)
          SendMessage({
            content: stream.content,
            cid: data._id.toString(),
          });
      }
    });

    socket.on("createChat", async (stream) => {
      let owner = profile._id;
      let type = "group";
      let name = xss(stream.name);
      let users = [...new Set([profile._id, ...stream.members])];
      const data = new models.ChatsModel({
        name: name,
        src: "",
        users: users,
        type: type,
        owner: owner,
      });
      const chat = await data.save();
      for (id of users) {
        let user = await models.UsersModel.findByIdAndUpdate(new ObjectID(id), {
          $push: { Chats: chat._id },
        });
        if (user) socket.to(id.toString()).emit(`private.${id}`, chat);
      }
      profile.Chats.push(new ObjectID(chat._id));
      chatSet.add(chat._id.toString());
      socket.join(chat._id.toString());
      socket.emit("chat", { type: "chats", chats: [chat] });
    });

    socket.on("updateChat", async (stream) => {});
  } else {
    socket.disconnect();
  }
}

async function onDisconnection(socket) {}
module.exports = { onConnection, onDisconnection };
