const express=require("express");
const {passport,ValidateUser,ValidateOtp,MessageScript}=require("./passportSetup");
const authRouter=express.Router();

const VerificationStack=[]
const SignupStack=[]
const SigninStack=[]

authRouter.post("^/auth",ValidateUser)
authRouter.post('/auth/signup',passport.authenticate('local'));
authRouter.post('/auth/signin',passport.authenticate('local'));
authRouter.post('/auth/google/oauth',passport.authenticate('google'))
authRouter.post('/auth/verify',ValidateOtp);
//authRouter.post('/auth/logout',controllers.logout);
//authRouter.post('/auth/deleteUser',controllers.deleteUser);
authRouter.get('/auth/google/oauth/callback',passport.authenticate('google',{failureRedirect:"/"}),()=>MessageScript(true))
     

module.exports=authRouter;


















