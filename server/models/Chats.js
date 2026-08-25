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
    
   username:{
    type:String,
    unique:true,
   }, 
   admins:{
    default:[],
    ref:'Users',
    type:[mongoose.Schema.Types.ObjectId]
   },
   owner:{
    default:null,
    ref:'Users',
    type:mongoose.Schema.Types.ObjectId
   },
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
   pinned:{
    default:[],
    ref:'Messages',
    type:[mongoose.Schema.Types.ObjectId]
   },
   permissions:{
    default:null,
    ref:'Permissions',
    type:mongoose.Schema.Types.ObjectId
   },
   // Denormalized so the chat list can show a preview and the sync manifest
   // can tell a chat changed without ever loading its message history.
   lastMessage:{
    type:new mongoose.Schema({
        _id:mongoose.Schema.Types.ObjectId,
        mid:Number,
        uid:mongoose.Schema.Types.ObjectId,
        type:String,
        content:String,
        // Just enough to render the sidebar preview (📷/🎥/🎤/📍 labels)
        // without ever loading the full message/attachment list.
        attachmentType:String,
        attachmentName:String,
        liveLocation:Boolean,
        createdAt:Date,
    },{_id:false}),
    default:null,
   }
},
   {timestamps:true}
)

Chats.pre('save',function(next){
    if (!this.username) this.username = `chat_${this._id}`;
    next()
 });
 
Chats.index({name:'text',_id:'text',username:'text'})
Chats.plugin(AutoIncrement, { inc_field: 'chat_id', start_seq: 0 });


const ChatModel=mongoose.model('Chats',Chats);
module.exports=ChatModel;










