const mongoose=require('mongoose');

const AutoIncrement = require('mongoose-sequence')(mongoose)
const Permissions=new mongoose.Schema
({
   permission:{
    type:Object,
    required:true
   }
},{timestamps:true})
Permissions.plugin(AutoIncrement, { inc_field: 'p_id', start_seq: 0 });

const PermissionsModel=mongoose.model('Permissions',Permissions)

module.exports=PermissionsModel