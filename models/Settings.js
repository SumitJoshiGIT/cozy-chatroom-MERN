const mongoose=require('mongoose');

const AutoIncrement = require('mongoose-sequence')(mongoose)
const Settings=new mongoose.Schema
({
   permission:{
    type:Object,
    required:true
   }
},{timestamps:true})
Settings.plugin(AutoIncrement, { inc_field: 's_id', start_seq: 0 });

const SettingsModel=mongoose.model('Settings',Settings)

module.exports=SettingsModel




