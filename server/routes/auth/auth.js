const express=require("express");
const {passport,MessageScript, resendOTP}=require("./passportSetup");
const authRouter=express.Router();

authRouter.get('/auth/token',(req,res)=>{
    
    res.json({token:''})///req.csrfToken()});

})

authRouter.post('/auth/signup',passport.authenticate('local-signup'),(req,res,next)=>{   
    res.json({status:true,message:"User signed up successfully"})

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

//authRouter.post('/auth/logout',controllers.logout);
//authRouter.post('/auth/deleteUser',controllers.deleteUser);
authRouter.get('/auth/google/oauth/callback',passport.authenticate('google',{failureRedirect:"/"}),()=>MessageScript(true))
     

module.exports=authRouter;


















