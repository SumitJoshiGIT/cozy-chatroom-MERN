const crypto=require('crypto');
const passport=require('passport');
const bcrypt=require('bcrypt');
const GoogleStrategy=require('passport-google-oauth2').Strategy;
const LocalStrategy=require('passport-local').Strategy;
const CustomStrategy=require('passport-custom').Strategy;
const Users=require('../../models/Users')
const sendOTP=require('../../utils/sendMail')
require('dotenv').config();

const credentials={
  clientID:process.env.GOOGLE_CLIENT_ID,
  clientSecret:process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:process.env.GOOGLE_REDIRECT_URI,
}

const EMAIL_RE=/^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
const PASSWORD_RE=/^(?!.*[<>;'"&]).{8,64}$/;
const OTP_TTL_MS=10*60*1000;
const OTP_MAX_ATTEMPTS=5;
const OTP_MAX_RESENDS=3;
const OTP_RESEND_COOLDOWN_MS=30*1000;
// Same response for "no such user" and "wrong password" so sign-in can't be
// used to discover who has an account.
const BAD_CREDENTIALS={status:false,message:"Incorrect email or password"};

function generateOTP(){
  return crypto.randomInt(100000,1000000).toString();
}

const normalizeEmail=(email)=>(typeof email==='string'?email.trim().toLowerCase():'');
const otpExpired=(otp)=>!otp.time||Date.now()-otp.time>OTP_TTL_MS;

async function ValidateOtp(req,done) {
  try{
    const otp=typeof req.body.otp==='string'?req.body.otp.trim():'';
    const pending=req.session.otp;
    if(!pending||otpExpired(pending)){
      req.session.otp=null;
      return done(null,false,{status:false,message:"OTP has expired"});
    }
    if(pending.tries>=OTP_MAX_ATTEMPTS) return done(null,false,{status:false,message:"Tries exhausted"});
    pending.tries+=1;
    if(await bcrypt.compare(otp,pending.hash)){
      // Two sessions can both hold a valid OTP for one address.
      if(await Users.exists({email:pending.email})){
        req.session.otp=null;
        return done(null,false,{status:false,message:"User already exists"});
      }
      const user=await Users({email:pending.email,password:pending.password,showTutorial:true});
      await user.save();
      req.session.otp=null;
      return done(null,{_id:user._id});
    }
    return done(null,false,{status:false,message:"OTP is incorrect"});
  }catch(err){return done(err)}
}

async function signInCallback(email,password,done) {
  try{
    const address=normalizeEmail(email);
    if(!EMAIL_RE.test(address)||!PASSWORD_RE.test(password)) return done(null,false,BAD_CREDENTIALS);
    // Older accounts may have been stored before addresses were lower-cased.
    const user=await Users.findOne({email:{$in:[address,email]}});
    // Google-only accounts have no password hash to compare against.
    if(user&&user.password&&await bcrypt.compare(password,user.password)){
      return done(null,{_id:user._id});
    }
    return done(null,false,BAD_CREDENTIALS);
  }catch(err){return done(err)}
}

async function resendOTP(req,res,next){
  const pending=req.session.otp;
  if(!pending||otpExpired(pending)) return res.json({status:false,message:"No pending verification"});
  if((pending.resends||0)>=OTP_MAX_RESENDS) return res.status(429).json({status:false,message:"Too many codes requested. Start sign up again."});
  if(Date.now()-pending.time<OTP_RESEND_COOLDOWN_MS) return res.status(429).json({status:false,message:"Please wait a moment before requesting another code."});
  try{
    const OTP=generateOTP();
    const response=await sendOTP(OTP,pending.email);
    if(response){
      // tries is deliberately kept: resetting it here gave unlimited guesses.
      req.session.otp={
        ...pending,
        hash:await bcrypt.hash(OTP,10),
        time:Date.now(),
        resends:(pending.resends||0)+1,
      };
      return res.json({status:true});
    }
    return res.json({status:false,message:"Failed to send email"});
  }catch(err){return next(err)}
}

async function signUpCallback(req,email,password,done) {
  try{
    const address=normalizeEmail(email);
    if(!EMAIL_RE.test(address)) return done(null,false,{status:false,message:"Please enter a valid email"});
    if(!PASSWORD_RE.test(password)) return done(null,false,{status:false,message:"Password must be 8-64 characters"});

    const existingUser=await Users.findOne({email:address})
    if(existingUser){
      return done(null,false,{status:false,message:"User already exists"});
    }
    const OTP=generateOTP();
    const response=await sendOTP(OTP,address);
    if(response){
      req.session.otp={
        email:address,
        hash:await bcrypt.hash(OTP,10),
        password:await bcrypt.hash(password,10),
        tries:0,
        resends:0,
        time:Date.now()
      };
      return done(null,false,{status:true,message:"OTP sent"})
    }
    return done(null,false,{status:false,message:"Failed to send verification email"});
  }catch(err){return done(err)}
}

async function GoogleCallback(accessToken,refreshToken,profile,done) {
  const json=profile._json;
  try{
    let user=await Users.findOne({sub:json.sub});
    if(!user){
      const email=normalizeEmail(json.email);
      if(!email||json.email_verified===false) return done(null,false);
      // Link to the existing account for this address instead of creating a
      // second one, but only because Google has verified the address.
      user=await Users.findOne({email});
      if(user){
        user.sub=json.sub;
      }else{
        user=new Users({name:json.name,email,sub:json.sub,showTutorial:true});
      }
      await user.save();
    }
    return done(null,{_id:user._id});
  }
  catch(err){return done(err,null)};
}

passport.use('local-signin',new LocalStrategy( { usernameField: 'email', passwordField: 'password'},signInCallback));
passport.use('local-signup',new LocalStrategy( { usernameField: 'email', passwordField: 'password',passReqToCallback:true },signUpCallback));
passport.use('local-otp',new CustomStrategy(ValidateOtp))

passport.serializeUser((profile,done)=>{
  done(null,{_id:profile._id});
})

passport.deserializeUser(async(profile,done)=>{
   try{
     const deserialized=await Users.findById(profile._id);
     done(null,deserialized);
   }catch(err){done(err,null)}
});
passport.use('google',new GoogleStrategy(credentials,GoogleCallback));

module.exports={passport,ValidateOtp,resendOTP}
