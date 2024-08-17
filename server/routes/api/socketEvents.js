const models=require('../../models/exports');
const ObjectID=require('mongoose').Types.ObjectId
const fs=require('fs');
const path=require('path');


async function onConnection(socket,io){
    const profile=await models.UsersModel.findById('66c114b7ad2d866d9bec87b9')
    socket.emit('userProfile',profile?profile:{});
    
    if(profile){
     let chats=profile.Chats.map(x=>x.toString());
     socket.on('logout',async ()=>{
        socket.emit('logout',async ()=>{})
     })

    socket.on('addFriend',(data)=>{})
    
    socket.on('removeFriend',(data)=>{})
    socket.on('createPrivate',(data)=>{

    })
    socket.on('userSearch',async(data)=>{
      const results=await models.UsersModel.aggregate([
         { $match: { $text: { $search:data.text } } },
         { $sort: { username: 1 } },
         { $limit: 10 }
       ]);
      return results   
      })

   socket.on('sendMessage',async (message)=>{
    
       //if(message.chat in chats){
                const newMessage=new models.MessagesModel({
                    chat:new ObjectID(message.chat),
                    content:message.content,
                    uid:profile._id
                });
                newMessage.save()
                .catch((err)=>console.log(err))
                .then(()=>{
                 io.to(message.chat).emit(`message.${message.chat}`,newMessage)
                })
         //    }
            })

     socket.on('chats',async(stream)=>{
          data=await Promise.all(chats.slice(stream.curr,stream.curr+30).map(async function(x){
            
            let chat=await models.ChatsModel.findById(x);
            if(chat){ 
            socket.join(chat._id.toString());
             return chat
            }
          }))
          socket.emit('chat',data); 
      })
      
     socket.on('messages',async (stream)=>{    
      try{
          const obj={'chat':stream.cid}
      
          if(stream.mid)obj._id={'$lt':new ObjectID(stream.mid)} 
          const data=await models.MessagesModel.find(obj).sort({'_id':-1}).limit(30)
          if(data.length)io.to(stream.cid).emit(`message.${stream.cid}`,data.reverse());
             
        }
        catch(err){console.log(err)}
   })
   socket.on('updateProfile',async(stream)=>{
      if(stream.about||stream.name){ 
         const changes={};
         changes[stream.about?'about':'name']=stream.about||stream.name;
         const object=await models.UsersModel.findByIdAndUpdate(profile._id,{$set:changes})
         .then(()=>{
          profile[stream.about?'about':'name']=stream.about||stream.name;
          socket.emit('profile',profile)
        })
      }
      else if (stream.img){
         const allowedTypes=['image/png','image/jpeg','image/jpg','image/svg','image/svg+xml']
         if(allowedTypes.includes(stream.img.type)){
            const buffer=Buffer.from(new Uint8Array(stream.file))
            const pathto=path.join(`${profile._id}_${stream.img.name}`)
            const content={
               src:pathto,
               name:stream.img.name,
               size:stream.img.size,
               contentType:stream.img.type,
               dimensions:stream.img.dimensions
            }
            if(profile.img)fs.unlink(path.join(process.cwd(),'public',profile.img.src),(err)=>{})
            fs.writeFile(path.join(process.cwd(),'public',pathto),buffer,(err)=>{
               if(!err){
               models.UsersModel.findByIdAndUpdate(profile._id,{$set:{img:content}
               }).then(()=>{
                  profile.img=content
               })
      }})}}
      socket.emit('userProfile',profile);  

   })

   socket.on('contacts',async (stream)=>{ 
      socket.emit('contacts',profile.contacts);
   })
   socket.on('getProfile',async (stream)=>{
     const user=await models.UsersModel.findById(stream.uid);
     socket.emit(`profile`,user);
   })
   socket.on('createChat',async (stream)=>{
      const data=new models.ChatsModel(
         {name:stream.name,src:'',
         users:[...new Set([profile._id,...stream.members])],
         type:'group'
      }
      )
      data.save().then((data)=>{
        
         models.UsersModel.findByIdAndUpdate(profile._id,{$set:{Chats:[...profile.Chats,data._id]}})
         .then(()=>socket.emit('chat',[data]))})
         
      }

      );
    socket.on('updateChat',async(stream)=>{})


}}

async function onDisconnection(socket){
   
}
module.exports={onConnection,onDisconnection};