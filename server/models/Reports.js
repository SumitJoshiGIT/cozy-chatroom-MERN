const mongoose=require('mongoose');

const Reports=new mongoose.Schema
({
   reporter:{
      type:mongoose.Schema.Types.ObjectId,
      ref:'Users',
      required:true
   },
   target:{
      type:mongoose.Schema.Types.ObjectId,
      required:true
   },
   targetType:{
      type:String,
      required:true,
      enum:['user','chat','message']
   },
   reason:{
      type:String,
      default:''
   },
},
   {timestamps:true}
)

const ReportModel=mongoose.model('Reports',Reports);
module.exports=ReportModel;
