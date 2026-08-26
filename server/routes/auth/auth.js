const express=require("express");
const {passport, resendOTP}=require("./passportSetup");
const {issueToken}=require("../../utils/socketAuthTokens");
const authRouter=express.Router();

// CLIENT_ORIGIN is comma-separated - see the matching comment in app.js.
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);

// Google's callback strips the referer, so this is the only chance to learn
// which of our (now multiple) frontend origins actually started the flow.
// Validated against the configured allow-list, not trusted as-is - a bare
// referer header would otherwise let a request redirect the final OAuth
// token to an arbitrary origin.
function originFromReferer(req) {
  try {
    const origin = new URL(req.headers.referer).origin;
    return clientOrigins.includes(origin) ? origin : clientOrigins[0];
  } catch {
    return clientOrigins[0];
  }
}

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

authRouter.get('/auth/google/oauth',
  (req,res,next)=>{
    req.session.oauthOrigin = originFromReferer(req);
    next();
  },
  passport.authenticate('google',{scope:['profile','email']}))

authRouter.get('/auth/google/oauth/callback',
  // A failed attempt can't be redirected per-origin the same way (passport
  // evaluates this option once, not per-request) - it always lands on the
  // primary configured origin's sign-in page, which is a minor UX nit on an
  // already-failed flow, not a functional gap.
  passport.authenticate('google',{failureRedirect:`${clientOrigins[0]}/auth/signin`}),
  (req,res)=>{
    // The session cookie set during this top-level redirect gets partitioned by
    // browsers under lavender-app's own site, so it's invisible to the later
    // cross-site socket connection from the client's origin. Hand the client a
    // short-lived token instead, which it exchanges for socket auth directly.
    const token=issueToken(req.user._id);
    const origin = clientOrigins.includes(req.session.oauthOrigin) ? req.session.oauthOrigin : clientOrigins[0];
    res.redirect(`${origin}/app?st=${token}`);
  }
)

authRouter.post('/auth/logout',(req,res)=>{
    req.logout((err)=>{
        if(err) return res.status(500).json({status:false,message:'Internal server error'});
        res.json({status:true});
    });
});

module.exports=authRouter;
