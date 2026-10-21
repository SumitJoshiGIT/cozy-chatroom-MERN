const express=require("express");
const {passport, resendOTP}=require("./passportSetup");
const {issueToken}=require("../../utils/socketAuthTokens");
const Users = require("../../models/Users");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const authRouter=express.Router();

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const demoEnabled = process.env.DEMO_ENABLED === 'true';
const demoTtlMs = Math.max(1, Number(process.env.DEMO_TTL_HOURS || 24)) * 60 * 60 * 1000;

authRouter.post('/auth/demo', async (req, res) => {
    if (!demoEnabled) return res.status(404).json({ status: false, message: 'Demo access is unavailable' });
    try {
        const demoToken = typeof req.body?.demoToken === 'string' ? req.body.demoToken : '';
        let userId = null;
        if (demoToken) {
            const { verifyToken } = require("../../utils/socketAuthTokens");
            userId = verifyToken(demoToken);
            if (userId) {
                const existing = await Users.findOne({ _id: userId, isDemo: true, demoExpiresAt: { $gt: new Date() } });
                if (existing) {
                    return res.json({ status: true, token: issueToken(existing._id, { ttlMs: demoTtlMs, demo: true }), expiresAt: existing.demoExpiresAt });
                }
            }
        }
        const expiresAt = new Date(Date.now() + demoTtlMs);
        const id = crypto.randomBytes(8).toString('hex');
        const user = await Users.create({
            name: 'Demo User',
            email: `demo-${id}@demo.invalid`,
            password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
            isDemo: true,
            demoExpiresAt: expiresAt,
        });
        return res.json({ status: true, token: issueToken(user._id, { ttlMs: demoTtlMs, demo: true }), expiresAt });
    } catch (err) {
        console.error('Failed to create demo account:', err);
        return res.status(500).json({ status: false, message: 'Unable to start demo' });
    }
});

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
  (req,res)=>{
    // The session cookie set during this top-level redirect gets partitioned by
    // browsers under lavender-app's own site, so it's invisible to the later
    // cross-site socket connection from the client's origin. Hand the client a
    // short-lived token instead, which it exchanges for socket auth directly.
    const token=issueToken(req.user._id);
    res.redirect(`${clientOrigin}/app?st=${token}`);
  }
)

authRouter.post('/auth/logout',(req,res)=>{
    req.logout((err)=>{
        if(err) return res.status(500).json({status:false,message:'Internal server error'});
        res.json({status:true});
    });
});

module.exports=authRouter;
