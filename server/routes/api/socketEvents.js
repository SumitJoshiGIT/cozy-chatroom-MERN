
const models=require('../../models/exports')
const ObjectID=require('mongoose').Types.ObjectId

async function onConnection(socket,io){
    const profile=await models.UsersModel.findById('66b79ca9000e2080e855b411')
    socket.emit('userProfile',profile?profile:{});

    if(profile){
     let chats=profile.Chats;
     socket.on('sendMessage',async (message)=>{
        
       //  if(message.chat in chats){
                const newMessage=new models.MessagesModel({
                    chat:new ObjectID(message.chat),
                    content:message.content,
                    uid:profile._id
                });
                newMessage.save()
                .catch((err)=>console.log(err))
                .then(()=>{
                 io.to(message.chat).emit(`message.${message.chat}`,[newMessage])
                })
            //  }
            })

     socket.on('chats',async(stream)=>{
          data=await Promise.all(chats.slice(stream.curr,stream.curr+30).map(async function(x){
             let chat=await models.ChatsModel.findById(x);
             socket.join(chat._id.toString());
             return chat
          }))
          socket.emit('chat',data); 
      })
      
     socket.on('messages',async (stream)=>{    
      try{
          const obj={'chat':stream.cid}
          if(stream.mid)obj._id={'$lt':new ObjectID(stream.mid)} 
          const data=await models.MessagesModel.find(obj).sort({'_id':-1}).limit(30)
          console.log("recieved")
          if(data.length)io.to(stream.cid).emit(`message.${stream.cid}`,data.reverse());
             
        }
        catch(err){console.log(err)}
   })
   socket.on('getProfile',async (stream)=>{
     const user=await models.UsersModel.findById(stream.uid);
     io.to(stream.cid).emit(`profile.${stream.uid}`,user);
   })
}}

async function onDisconnection(socket){
   
}
module.exports={onConnection,onDisconnection};