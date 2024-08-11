const mongoose=require('mongoose');

const AutoIncrement = require('mongoose-sequence')(mongoose)
const Users=new mongoose.Schema
({
   name:{
    type:String,
    required:true,  
   },
   //username:{type:String,unique:true},
   Chats:{
      type:[mongoose.Schema.Types.ObjectId]      
   },
   color:{
      type:String,
      default:"#000000"
   },
   SettingsID:{
         type:mongoose.Schema.Types.ObjectId,
         ref:'Permissions',
         default:null}
      },
   {timestamps:true}
)
function randomColor() {
   const letters = '0123456789ABCDEF';
   let color = '#';
   for (let i = 0; i < 6; i++) {
       color += letters[Math.floor(Math.random() * 16)];
        }
   return color;
}

Users.plugin(AutoIncrement, { inc_field: 'user_id', start_seq: 0 });
Users.pre('save',function(next){this.color=randomColor();next()});

const UserModel=mongoose.model('Users',Users);

module.exports = UserModel;