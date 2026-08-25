const models = require("../../models/exports");
const { verifyToken } = require("../../utils/socketAuthTokens");
const ObjectID = require("mongoose").Types.ObjectId;
const fs = require("fs");
const path = require("path");
const xss = require("xss");
// SVG deliberately excluded: it's served same-origin via express.static, and
// an uploaded SVG can embed <script> - a stored-XSS vector if it's ever
// opened directly rather than rendered inside an <img> tag.
const allowedTypes = {
  "image/png":"png",
  "image/jpeg":"jpg",
  "image/jpg":"jpg",
  "image/webp":"webp",
};
const allowedDocTypes = {
  "application/pdf":"pdf",
  "application/msword":"doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx",
  "application/vnd.ms-excel":"xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx",
  "application/vnd.ms-powerpoint":"ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":"pptx",
  "text/plain":"txt",
  "text/csv":"csv",
  "application/zip":"zip",
};
const allowedAudioTypes = {
  "audio/webm":"webm",
  "audio/ogg":"ogg",
  "audio/mp4":"m4a",
  "audio/mpeg":"mp3",
  "audio/wav":"wav",
};
const allowedVideoTypes = {
  "video/mp4":"mp4",
  "video/webm":"webm",
  "video/ogg":"ogv",
  "video/quicktime":"mov",
};
const maxUploadSize = 2*1024*1024;

const PERMISSION_DEFAULTS = { sendMessages: "everyone", editInfo: "admins", pinMessages: "admins" };

async function resolvePermissions(chat) {
  const perm = chat.permissions ? await models.PermissionsModel.findById(chat.permissions) : null;
  return { ...PERMISSION_DEFAULTS, ...(perm ? perm.permission : {}) };
}

async function saveUpload(base64, mimeType, name, size, extraTypes) {
  const allowList = extraTypes ? { ...allowedTypes, ...extraTypes } : allowedTypes;
  const normalizedType = (mimeType || '').split(';')[0].trim();
  if (!base64 || !allowList[normalizedType]) return null;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > maxUploadSize) return null;
  const ext = allowList[normalizedType];
  const src = `${Date.now()}-${Math.round(Math.random()*1e9)}.${ext}`;
  await fs.promises.writeFile(path.join(process.cwd(), "public", src), buffer);
  return { src, name, size, contentType: normalizedType };
}
async function onConnection(socket, io) {
  // Every socket.on(...) handler below is async and mostly unguarded. On
  // Node's current default, an unhandled rejection kills the whole process -
  // not just this one request - taking down every connected user. Wrapping
  // registration here (instead of every individual handler) means a single
  // bad request just gets logged instead of crashing the server.
  const rawSocketOn = socket.on.bind(socket);
  socket.on = (event, handler) => rawSocketOn(event, async (...args) => {
    try {
      await handler(...args);
    } catch (err) {
      console.log(err);
    }
  });

  let profile = null;
  try {
    const tokenUserId = verifyToken(socket.handshake.auth && socket.handshake.auth.token);
    const pid = tokenUserId || socket.handshake.session.passport.user._id;
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
        const parentChat = await models.ChatsModel.findById(message.cid);
        if (parentChat && parentChat.type === "private") {
          const otherId = (parentChat.users || []).find((u) => u.toString() !== profile._id.toString());
          if (otherId) {
            const other = await models.UsersModel.findById(otherId, "blocked");
            if (other && other.blocked.some((b) => b.toString() === profile._id.toString())) return;
          }
        }
        if (parentChat && parentChat.type === "group" && !(await canPerform(parentChat, "sendMessages"))) return;
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
            const saved = await saveUpload(attachment.file, attachment.type, attachment.name, attachment.size, { ...allowedDocTypes, ...allowedAudioTypes, ...allowedVideoTypes });
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

    socket.on("sendLocation", async (stream, ack) => {
      try {
        if (!chatSet.has(stream.cid)) return;
        const lat = Number(stream.lat);
        const lng = Number(stream.lng);
        if (!isFinite(lat) || !isFinite(lng)) return;
        const parentChat = await models.ChatsModel.findById(stream.cid);
        if (!parentChat) return;
        if (parentChat.type === "private") {
          const otherId = (parentChat.users || []).find((u) => u.toString() !== profile._id.toString());
          if (otherId) {
            const other = await models.UsersModel.findById(otherId, "blocked");
            if (other && other.blocked.some((b) => b.toString() === profile._id.toString())) return;
          }
        }
        if (parentChat.type === "group" && !(await canPerform(parentChat, "sendMessages"))) return;
        const live = !!stream.live;
        const durationMs = Math.min(Math.max(Number(stream.durationMs) || 0, 0), 8 * 60 * 60 * 1000);
        const newMessage = new models.MessagesModel({
          chat: stream.cid,
          content: "",
          type: "location",
          uid: profile._id,
          status: "✔",
          location: {
            lat,
            lng,
            live,
            expiresAt: live ? new Date(Date.now() + (durationMs || 15 * 60 * 1000)) : null,
          },
        });
        await newMessage.save();
        io.to(stream.cid).emit("messages", {
          id: stream.cid,
          replace: stream.replace,
          data: [newMessage],
        });
        if (typeof ack === "function") ack({ _id: newMessage._id.toString() });
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("updateLocation", async (stream) => {
      try {
        const lat = Number(stream.lat);
        const lng = Number(stream.lng);
        if (!isFinite(lat) || !isFinite(lng)) return;
        const message = await models.MessagesModel.findById(stream.id);
        if (!message || !message.location || !message.location.live) return;
        if (message.uid.toString() !== profile._id.toString()) return;
        if (!chatSet.has(message.chat.toString())) return;
        if (message.location.expiresAt && message.location.expiresAt.getTime() < Date.now()) return;
        message.location.lat = lat;
        message.location.lng = lng;
        await message.save();
        io.to(message.chat.toString()).emit("locationUpdated", {
          cid: message.chat.toString(),
          mid: message.mid,
          lat,
          lng,
        });
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("stopLiveLocation", async (stream) => {
      try {
        const message = await models.MessagesModel.findById(stream.id);
        if (!message || !message.location || !message.location.live) return;
        if (message.uid.toString() !== profile._id.toString()) return;
        message.location.live = false;
        await message.save();
        io.to(message.chat.toString()).emit("locationStopped", {
          cid: message.chat.toString(),
          mid: message.mid,
        });
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("search", async (stream) => {
      try {
        const escaped = xss(`${stream.query}`).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const term = new RegExp(escaped, "i");
        const chatIds = [...chatSet].map((id) => new ObjectID(id));

        const searchUsers = async () => {
          const users = await models.UsersModel.aggregate([
            {
              $match: {
                $or: [{ name: { $regex: term } }, { username: { $regex: term } }],
              },
            },
            { $project: { password: 0, email: 0 } },
            { $sort: { username: 1 } },
            { $limit: 10 },
          ]);
          return users.map((u) => ({ ...u, type: "user" }));
        };

        const searchChatsByName = () =>
          models.ChatsModel.aggregate([
            {
              $match: {
                _id: { $in: chatIds },
                type: { $ne: "private" },
                $or: [{ name: { $regex: term } }, { username: { $regex: term } }],
              },
            },
            { $sort: { name: 1 } },
            { $limit: 10 },
          ]);

        // "Messages" search: find chats (the user is in) containing a matching message.
        const searchChatsByMessage = () =>
          models.MessagesModel.aggregate([
            { $match: { chat: { $in: chatIds }, content: { $regex: term } } },
            { $sort: { updatedAt: -1 } },
            { $group: { _id: "$chat", updatedAt: { $first: "$updatedAt" } } },
            { $sort: { updatedAt: -1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: "chats",
                localField: "_id",
                foreignField: "_id",
                as: "chatDoc",
              },
            },
            { $unwind: "$chatDoc" },
            { $replaceRoot: { newRoot: "$chatDoc" } },
          ]);

        let data;
        if (stream.target == 1) {
          data = await searchUsers();
        } else if (stream.target == 2) {
          data = await searchChatsByMessage();
        } else if (stream.target == 3) {
          data = await searchChatsByName();
        } else {
          const [users, byName, byMessage] = await Promise.all([
            searchUsers(),
            searchChatsByName(),
            searchChatsByMessage(),
          ]);
          const chats = [...byName];
          const seen = new Set(chats.map((c) => c._id.toString()));
          byMessage.forEach((c) => {
            if (!seen.has(c._id.toString())) {
              seen.add(c._id.toString());
              chats.push(c);
            }
          });
          data = [...chats, ...users];
        }

        socket.emit("searchResults", { results: data, target: stream.target, reqId: stream.reqId });
      } catch (err) {
        console.log(err);
      }
    });
    socket.on("report", async ({ id, targetType, reason }) => {
      if (!id || !["user", "chat", "message"].includes(targetType)) return;
      try {
        await new models.ReportsModel({
          reporter: profile._id,
          target: id,
          targetType,
          reason: xss(`${reason || ""}`),
        }).save();
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("typing", ({ cid }) => {
      if (!chatSet.has(cid)) return;
      socket.to(cid).emit("typing", { cid, uid: profile._id.toString() });
    });

    socket.on("blockUser", async ({ id }) => {
      if (!id || id.toString() === profile._id.toString()) return;
      if (!profile.blocked.some((b) => b.toString() === id.toString())) {
        profile.blocked.push(id);
        await profile.save();
      }
      socket.emit("blocked", profile.blocked.map(String));
    });

    socket.on("unblockUser", async ({ id }) => {
      if (!id) return;
      profile.blocked = profile.blocked.filter((b) => b.toString() !== id.toString());
      await profile.save();
      socket.emit("blocked", profile.blocked.map(String));
    });

    socket.on("pinMessage", async ({ id, cid }) => {
      const chat = await models.ChatsModel.findById(cid);
      if (!chat || !chatSet.has(cid) || (chat.type === "group" && !(await canPerform(chat, "pinMessages")))) return;
      if (!chat.pinned.some((p) => p.toString() === id.toString())) {
        chat.pinned.push(id);
        await chat.save();
      }
      io.to(cid).emit("chat", { type: "chats", chats: [chat] });
    });

    socket.on("unpinMessage", async ({ id, cid }) => {
      const chat = await models.ChatsModel.findById(cid);
      if (!chat || !chatSet.has(cid) || (chat.type === "group" && !(await canPerform(chat, "pinMessages")))) return;
      chat.pinned = chat.pinned.filter((p) => p.toString() !== id.toString());
      await chat.save();
      io.to(cid).emit("chat", { type: "chats", chats: [chat] });
    });

    socket.on("reactMessage", async ({ id, cid, emoji }) => {
      if (!chatSet.has(cid) || !emoji) return;
      const message = await models.MessagesModel.findOne({ _id: id, chat: cid });
      if (!message) return;
      const uidStr = profile._id.toString();
      let entry = message.reactions.find((r) => r.emoji === emoji);
      if (entry) {
        const idx = entry.users.findIndex((u) => u.toString() === uidStr);
        if (idx !== -1) entry.users.splice(idx, 1);
        else entry.users.push(profile._id);
      } else {
        message.reactions.push({ emoji, users: [profile._id] });
      }
      message.reactions = message.reactions.filter((r) => r.users.length > 0);
      message.markModified("reactions");
      await message.save();
      io.to(cid).emit("reactMessage", { id: message._id, mid: message.mid, cid, reactions: message.reactions });
    });

    socket.on("deleteChat", async ({ id }) => {
      const chat = await models.ChatsModel.findById(id);
      if (!chat || !chatSet.has(id)) return;
      if (chat.type === "group" && !isChatOwner(chat)) return;
      const memberIds = (chat.users || []).map(String);
      await models.MessagesModel.deleteMany({ chat: id });
      await models.ChatsModel.findByIdAndDelete(id);
      await models.UsersModel.updateMany({ _id: { $in: memberIds } }, { $pull: { Chats: id } });
      io.to(id).emit("leaveChat", [id, true]);
    });


    socket.on("deleteMessage", async ([mid, id, cid]) => {
      let success = null;
      console.log("delete")
      if (chatSet.has(cid)) {
        // findByIdAndDelete coerces its argument down to just _id, silently
        // ignoring `chat` - that let any member of any chat delete any
        // message anywhere by id. findOneAndDelete actually applies both
        // filter fields.
        success = await models.MessagesModel.findOneAndDelete({
          _id: (id),
          chat:(cid),
        });
      }
      if (!success) success = { cid: cid, mid: mid, _id: id };
      socket.emit(`deleteMessage`, [success._id, success.mid, success.chat]);
    });

    socket.on("editMessage", async ({ id, cid, content }) => {
      if (!chatSet.has(cid) || !content || !content.trim()) return;
      const message = await models.MessagesModel.findOne({ _id: id, chat: cid });
      if (!message || message.uid.toString() !== profile._id.toString()) return;
      message.content = xss(content);
      message.edited = true;
      await message.save();
      io.to(cid).emit("editMessage", { id: message._id, mid: message.mid, cid, content: message.content, edited: true });
    });

    socket.on("toggleStar", async ({ id }) => {
      if (!id) return;
      const already = profile.starred.some((s) => s.toString() === id.toString());
      if (already) profile.starred = profile.starred.filter((s) => s.toString() !== id.toString());
      else profile.starred.push(id);
      await profile.save();
      socket.emit("starred", profile.starred.map(String));
    });

    socket.on("getStarred", async () => {
      const messages = await models.MessagesModel.find({ _id: { $in: profile.starred } }).sort({ createdAt: -1 });
      socket.emit("starred", profile.starred.map(String));
      socket.emit("starredMessages", messages);
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

    socket.on("markSeen", async ({ cid }) => {
      if (!cid || !chatSet.has(cid)) return;
      try {
        const result = await models.MessagesModel.updateMany(
          { chat: cid, uid: { $ne: profile._id }, status: { $ne: "✔✔" } },
          { $set: { status: "✔✔" } }
        );
        if (result.modifiedCount > 0) {
          io.to(cid).emit("messagesSeen", { cid, uid: profile._id.toString() });
        }
      } catch (err) {
        console.log(err);
      }
    });
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
        // Always respond, even with an empty list - the client marks a chat
        // "loaded" (and stops showing the spinner) only when this event
        // arrives. Skipping the emit for chats with zero messages used to
        // leave those chats stuck loading forever, which in turn meant a
        // freshly-typed message's own <Message> bubble never mounted (it's
        // gated behind the same loading check), so its send-on-mount effect
        // never fired and the message never actually reached the server.
        socket.emit(`messages`, { id: stream.cid, data: data });
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
        if (stream.img && stream.file) {
            // Route through the shared saveUpload helper (same one used for
            // chat photos/attachments) instead of duplicating the upload
            // logic here - that duplicate had no size check and wrote to a
            // fixed <id>.<ext> filename, so re-uploading a same-type avatar
            // produced the exact same URL and the browser never re-fetched it.
            const oldSrc = profile.img && profile.img.src;
            const saved = await saveUpload(stream.file, stream.img.type, stream.img.name, stream.img.size);
            if (saved) {
              if (oldSrc && oldSrc !== saved.src) {
                fs.promises.unlink(path.join(process.cwd(), "public", oldSrc)).catch(() => {});
              }
              profile.img = saved;
              changes.img = saved;
            }
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
    async function canPerform(chat, key){
      if (isChatAdmin(chat)) return true;
      const perm = await resolvePermissions(chat);
      return perm[key] === "everyone";
    }

    socket.on("updateChat", async (stream) =>{
      const chat=await models.ChatsModel.findById(stream.cid)
      if(!chat || !chatSet.has(chat._id.toString()) || !(await canPerform(chat, "editInfo"))) return;

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

    socket.on("getPermissions", async ({ cid }) => {
      const chat = await models.ChatsModel.findById(cid);
      if (!chat || !chatSet.has(cid)) return;
      socket.emit("permissions", { cid, permission: await resolvePermissions(chat) });
    });

    socket.on("updatePermissions", async ({ cid, permissions }) => {
      const chat = await models.ChatsModel.findById(cid);
      if (!chat || !chatSet.has(cid) || chat.type !== "group" || !isChatAdmin(chat)) return;
      const update = {};
      for (const key of Object.keys(PERMISSION_DEFAULTS)) {
        if (permissions[key] === "everyone" || permissions[key] === "admins") update[key] = permissions[key];
      }
      const merged = { ...(await resolvePermissions(chat)), ...update };
      if (chat.permissions) {
        await models.PermissionsModel.findByIdAndUpdate(chat.permissions, { permission: merged });
      } else {
        const perm = await models.PermissionsModel.create({ permission: merged });
        chat.permissions = perm._id;
        await chat.save();
      }
      io.to(cid).emit("permissions", { cid, permission: merged });
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
      if (user && user._id != profile._id && !user.blocked.some((b) => b.toString() === profile._id.toString())) {
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
