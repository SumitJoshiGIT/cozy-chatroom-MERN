const mongoose=require('mongoose');

const Groups=new mongoose.Schema
({
   name:{
    type:String,
    required:true},  
   owner:{
    type:Number,
    default:null
   },

   specialMembers:{
    type:{
        userId:{type:mongoose.Schema.Types.ObjectId,
                ref:'Users'},
        level:Number        
    },
    default:[]
   },
   SettingsId:{
         type:mongoose.Schema.Types.ObjectId,
         ref:'Settings',
         default:null},
    
    ChatId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'Chats',
            required:true
        },     
   members:{
   type:[
         {type:mongoose.Schema.Types.ObjectId,
          ref:'Users'}],
   default:[]
   }
},
   {timestamps:true}
)

const GroupsModel=mongoose.Model('Groups',Groups);
export default GroupsModel;
