const mongoose=require('mongoose');

const AutoIncrement = require('mongoose-sequence')(mongoose)
const Users=new mongoose.Schema
({
   name:{
    type:String,
    required:true,  
   },
   about:String,
   img:new mongoose.Schema({
      src:String,
      name:String,
      size:Number,
      contentType: String,
      dimensions:[Number]
  }),//username:{type:String,unique:true},
   Chats:{
      ref:'Chats',
      type:[mongoose.Schema.Types.ObjectId]      
   },
   email:{
    type:String,
    required:true,
    validate:{
        validator:function(v){
            return /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/.test(v)
        },
        message:props=>'Please enter a valid email'
    }
   },
   username:{
    type:String,
    unique:true,
    required:true
   }, 
   contacts:{
      ref:'Users',
      type:[mongoose.Schema.Types.ObjectId]},
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
   for (let i = 0; i < 6; i++) 
       color += letters[Math.floor(Math.random() * 16)];
   return color;
}
Users.pre('save',function(next){
   if (!this.username) this.username = `user_${this._id}`;
   this.color=randomColor();next()
});

Users.index({name:'text',email:'text',username:'text'})
Users.plugin(AutoIncrement, { inc_field: 'user_id', start_seq: 0 });


const UserModel=mongoose.model('Users',Users);

module.exports = UserModel;