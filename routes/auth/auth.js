const express=require("express");
const {passport,MessageScript, resendOTP}=require("./passportSetup");
const authRouter=express.Router();

authRouter.get('/auth/token',(req,res)=>{
    
    res.json({token:''})///req.csrfToken()});

})

authRouter.post('/auth/signup',(req,res,next)=>{
    console.log('recieved')
    passport.authenticate('local-signup',(err,user,info)=>{   
        if(err)return res.json({status:false,message:err.message})    
        res.json({status:true,message:"User signed up successfully"})
    
    })(req,res,next);
    });
    

authRouter.post('/auth/signin',passport.authenticate('local-signin'),(req,res,next)=>{
        return res.json({status:true,message:"User signed up successfully"})
        });

authRouter.post('/auth/verify',passport.authenticate('local-otp'),
(req,res,next)=>{
    return res.json({status:true,message:"User signed up successfully"})
    })

authRouter.post('/auth/resendOTP',resendOTP);
authRouter.post('/auth/google/oauth',passport.authenticate('google'))

authRouter.get('/auth/google/oauth/callback',passport.authenticate('google',{failureRedirect:"/"}),()=>MessageScript(true))
     

module.exports=authRouter;


















