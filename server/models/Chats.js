const mongoose=require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose)


const Chats=new mongoose.Schema
({  group:{
        type:mongoose.Schema.ObjectId,
        ref:'Groups',
        default:null
    }, 
    about:String,
    name:String,
    img:new mongoose.Schema({
        src:String,
        name:String,
        contentType: String,
        dimensions:[Number]
    }),
    users:{
        default:null,
        ref:'Users',
        type:[mongoose.Schema.Types.ObjectId]
    },
    type:{
    type:String,
    required:true,
    default:"private"
   },
   permissions:mongoose.Schema.Types.ObjectId
},
   {timestamps:true}
)
Chats.index({name:'text',_id:'text'})
Chats.plugin(AutoIncrement, { inc_field: 'chat_id', start_seq: 0 });


const ChatModel=mongoose.model('Chats',Chats);
module.exports=ChatModel;










