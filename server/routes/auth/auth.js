const express=require("express");
const {passport, resendOTP}=require("./passportSetup");
const authRouter=express.Router();

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

authRouter.post('/auth/signup',(req,res,next)=>{
    passport.authenticate('local-signup',(err,user,info)=>{
        if(err) return res.status(500).json({status:false,message:'Internal server error'});
        return res.json(info);
    })(req,res,next);
});


authRouter.post('/auth/signin',(req,res,next)=>{
    passport.authenticate('local-signin',(err,user,info)=>{
        if(err) return res.status(500).json({status:false,message:'Internal server error'});
        if(!user) return res.status(401).json(info);
        req.logIn(user,(err)=>{
            if(err) return res.status(500).json({status:false,message:'Internal server error'});
            return res.json({status:true,message:"Signed in successfully"});
        });
    })(req,res,next);
});

authRouter.post('/auth/verify',(req,res,next)=>{
    passport.authenticate('local-otp',(err,user,info)=>{
        if(err) return res.status(500).json({status:false,message:'Internal server error'});
        if(!user) return res.status(401).json(info);
        req.logIn(user,(err)=>{
            if(err) return res.status(500).json({status:false,message:'Internal server error'});
            return res.json({status:true,message:"Verified successfully"});
        });
    })(req,res,next);
});

authRouter.post('/auth/resendOTP',resendOTP);

authRouter.get('/auth/google/oauth',passport.authenticate('google',{scope:['profile','email']}))

authRouter.get('/auth/google/oauth/callback',
  passport.authenticate('google',{failureRedirect:`${clientOrigin}/auth/signin`}),
  (req,res)=>res.redirect(`${clientOrigin}/app`)
)

authRouter.post('/auth/logout',(req,res)=>{
    req.logout((err)=>{
        if(err) return res.status(500).json({status:false,message:'Internal server error'});
        res.json({status:true});
    });
});

module.exports=authRouter;
