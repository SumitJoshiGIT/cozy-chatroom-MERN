const mongoose=require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose)
const Messages=new mongoose.Schema
({   
    chat:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Chats',
        required:true  
    },
    content:String, 
    type:{
     type:String,
     required:true,
     default:"text"
   },
   uid:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Users',
        required:true
    },
    reply_to:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Messages',
        default:null
    },
    status:{
        type:String,
        default:'✔',
        enum:['✔','✔✔']  // pending, seen, read status for messages in a chat room.
     },
    attachments:{
        type:[new mongoose.Schema({
            src:String,
            name:String,
            size:Number,
            contentType:String,
        },{_id:false})],
        default:[],
    },
    location:{
        type:new mongoose.Schema({
            lat:Number,
            lng:Number,
            live:{type:Boolean, default:false},
            expiresAt:Date,
        },{_id:false}),
        default:null,
    },
    edited:{
        type:Boolean,
        default:false,
    },
    reactions:{
        type:[new mongoose.Schema({
            emoji:String,
            users:{type:[mongoose.Schema.Types.ObjectId], ref:'Users', default:[]},
        },{_id:false})],
        default:[],
    },
    // Disappearing messages: set at send time from the parent chat's
    // disappearingDuration (see Chats.js). Not the same field as
    // location.expiresAt above, which just marks when *live location
    // sharing* stops, not message deletion.
    expiresAt:{
        type:Date,
        default:null,
    },

},
   {timestamps:true}
)

// A TTL index - MongoDB's own background task removes a document once the
// current time passes its expiresAt value (expireAfterSeconds:0 means "at
// the timestamp itself", not offset from it). A null expiresAt (the default,
// for chats without disappearing messages on) is never indexed by a TTL
// index, so this is a no-op for every message until a chat turns the
// feature on. Actual removal can lag up to ~60s behind the timestamp -
// clients hide an expired message immediately client-side regardless (see
// Messages.jsx), this index is just what reclaims the DB record/storage.
Messages.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
Messages.index({content:'text'})
Messages.plugin(AutoIncrement, { inc_field: 'mid', start_seq: 0 });

const MessageModel=mongoose.model('Messages',Messages);

module.exports=MessageModel;

