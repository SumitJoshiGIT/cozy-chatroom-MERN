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
    default:null,
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
   permissions:mongoose.Schema.Types.ObjectId
},
   {timestamps:true}
)

function randomColor() {
   
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) 
        color += letters[Math.floor(Math.random() * 16)];
    return color;
 }
Chats.pre('save',function(next){
    if (!this.username) this.username = `chat_${this._id}`;
    this.color=randomColor();next()
 });
 
Chats.index({name:'text',_id:'text',username:'text'})
Chats.plugin(AutoIncrement, { inc_field: 'chat_id', start_seq: 0 });


const ChatModel=mongoose.model('Chats',Chats);
module.exports=ChatModel;










