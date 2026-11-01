const express=require("express");
const {passport, resendOTP}=require("./passportSetup");
const {issueToken,verifyTokenPayload}=require("../../utils/socketAuthTokens");
const rateLimit=require("express-rate-limit").rateLimit;
const Users = require("../../models/Users");
const PushSubscriptions = require("../../models/PushSubscriptions");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const authRouter=express.Router();

const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);
const demoEnabled = process.env.DEMO_ENABLED === 'true';
const demoTtlMs = Math.max(1, Number(process.env.DEMO_TTL_HOURS || 24)) * 60 * 60 * 1000;

const limiter=(windowMs,limit,message)=>rateLimit({
    windowMs,
    limit,
    standardHeaders:'draft-7',
    legacyHeaders:false,
    message:{status:false,message},
});
const attemptLimit=Number(process.env.AUTH_RATE_LIMIT||30);
const signinLimiter=limiter(15*60*1000,attemptLimit,'Too many sign-in attempts. Try again later.');
const otpLimiter=limiter(15*60*1000,attemptLimit,'Too many attempts. Try again later.');
const signupLimiter=limiter(60*60*1000,attemptLimit,'Too many sign-up attempts. Try again later.');
const demoLimiter=limiter(60*60*1000,attemptLimit,'Too many demo sessions. Try again later.');

authRouter.post('/auth/demo', demoLimiter, async (req, res) => {
    if (!demoEnabled) return res.status(404).json({ status: false, message: 'Demo access is unavailable' });
    try {
        const demoToken = typeof req.body?.demoToken === 'string' ? req.body.demoToken : '';
        let userId = null;
        if (demoToken) {
            userId = verifyTokenPayload(demoToken)?.uid;
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

authRouter.post('/auth/signup',signupLimiter,(req,res,next)=>{
    passport.authenticate('local-signup',(err,user,info)=>{
        if(err) return res.status(500).json({status:false,message:'Internal server error'});
        return res.json(info);
    })(req,res,next);
});


authRouter.post('/auth/signin',signinLimiter,(req,res,next)=>{
    passport.authenticate('local-signin',(err,user,info)=>{
        if(err) return res.status(500).json({status:false,message:'Internal server error'});
        if(!user) return res.status(401).json(info);
        req.logIn(user,(err)=>{
            if(err) return res.status(500).json({status:false,message:'Internal server error'});
            return res.json({status:true,message:"Signed in successfully"});
        });
    })(req,res,next);
});

authRouter.post('/auth/verify',otpLimiter,(req,res,next)=>{
    passport.authenticate('local-otp',(err,user,info)=>{
        if(err) return res.status(500).json({status:false,message:'Internal server error'});
        if(!user) return res.status(401).json(info);
        req.logIn(user,(err)=>{
            if(err) return res.status(500).json({status:false,message:'Internal server error'});
            return res.json({status:true,message:"Verified successfully"});
        });
    })(req,res,next);
});

authRouter.post('/auth/resendOTP',otpLimiter,resendOTP);

function originFromReferer(req) {
    try {
        const origin = new URL(req.headers.referer).origin;
        return clientOrigins.includes(origin) ? origin : clientOrigins[0];
    } catch {
        return clientOrigins[0];
    }
}

authRouter.get('/auth/google/oauth',
  (req,res,next)=>{
    req.session.oauthOrigin = originFromReferer(req);
    next();
  },
  passport.authenticate('google',{scope:['profile','email']}))

authRouter.get('/auth/google/oauth/callback',
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

// A plain logout ends this session and every bearer token (tokens can only be
// revoked together), so their open sockets close too; other cookie sessions
// stay signed in. `everywhere` also ends those.
async function endSockets(req,userId,everywhere){
    const sockets=await req.app.get('io').in(`user:${userId}`).fetchSockets();
    for(const socket of sockets){
        if(everywhere||socket.data.viaToken||socket.data.sessionId===req.sessionID){
            socket.emit('loggedOut');
            socket.disconnect(true);
        }
    }
}

authRouter.post('/auth/logout',async (req,res)=>{
    const authorization=req.get('authorization')||'';
    const bearer=authorization.startsWith('Bearer ')?verifyTokenPayload(authorization.slice(7)):null;
    const userId=(req.user&&req.user._id)||(bearer&&bearer.uid);
    const everywhere=req.body?.everywhere===true;
    try{
        if(userId){
            await Users.findByIdAndUpdate(userId,{tokensValidAfter:new Date()});
            await endSockets(req,String(userId),everywhere);
            if(everywhere){
                // connect-mongo stores each session as a JSON string.
                await mongoose.connection.collection('sessions').deleteMany({session:{$regex:`"_id":"${userId}"`}});
                await PushSubscriptions.deleteMany({user:userId});
            }
        }
    }catch(err){
        console.error('Failed to end sessions on logout:',err);
    }
    req.logout((err)=>{
        if(err) return res.status(500).json({status:false,message:'Internal server error'});
        req.session.destroy(()=>{
            res.clearCookie('connect.sid');
            res.json({status:true});
        });
    });
});

module.exports=authRouter;
