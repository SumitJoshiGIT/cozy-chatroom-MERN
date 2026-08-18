const passport=require('passport');
const bcrypt=require('bcrypt');
const GoogleStrategy=require('passport-google-oauth2').Strategy;
const LocalStrategy=require('passport-local').Strategy;
const CustomStrategy=require('passport-custom').Strategy;
const Users=require('../../models/Users')
const sendOTP=require('../../utils/sendMail')
const xss=require('xss')
require('dotenv').config();

const credentials={
  clientID:process.env.GOOGLE_CLIENT_ID,
  clientSecret:process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:process.env.GOOGLE_REDIRECT_URI,
}

const EMAIL_RE=/^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/;
const PASSWORD_RE=/^(?!.*[<>;'"&]).{8,64}$/;

function generateOTP(){
  return Math.floor(100000+Math.random()*900000).toString();
}

async function ValidateOtp(req,done) {
      const otp=xss(req.body.otp)
      if(!req.session.otp) return done(null,false,{status:false,message:"OTP has expired"});
      if(req.session.otp.tries>3) return done(null,false,{status:false,message:"Tries exhausted"});
      req.session.otp.tries+=1;
      if(await bcrypt.compare(otp,req.session.otp.hash)){
        const user=await Users({email:req.session.otp.email,password:req.session.otp.password});
        await user.save();
        req.session.otp=null;
        return done(null,{_id:user._id});
      }
      return done(null,false,{status:false,message:"OTP is incorrect"});
      }


async function signInCallback(email,password,done) {
  email=xss(email)
  password=xss(password)
  if(!EMAIL_RE.test(email)) return done(null,false,{status:false,message:"Please enter a valid email"});
  if(!PASSWORD_RE.test(password)) return done(null,false,{status:false,message:"Invalid password"});

  const user=await Users.findOne({email:email})
  if(user){
    if(await bcrypt.compare(password,user.password)){
      return done(null,{_id:user._id});
    }
    return done(null,false,{status:false,message:"Passwords do not match"});
  }
  return done(null,false,{status:false,message:"User doesn't exist"});
};

async function resendOTP(req,res,next){
  if(!req.session.otp) return res.json({status:false,message:"No pending verification"});
  const OTP=generateOTP();
  const response=await sendOTP(OTP,req.session.otp.email);
  if(response){
    req.session.otp={
      ...req.session.otp,
      hash:await bcrypt.hash(OTP,10),
      tries:0,
      time:Date.now(),
    };
    return res.json({status:true});
  }
  return res.json({status:false,message:"Failed to send email"});
}

async function signUpCallback(req,email,password,done) {
  email=xss(email)
  password=xss(password)
  if(!EMAIL_RE.test(email)) return done(null,false,{status:false,message:"Please enter a valid email"});
  if(!PASSWORD_RE.test(password)) return done(null,false,{status:false,message:"Password must be 8-64 characters"});

  const existingUser=await Users.findOne({email:email})
  if(existingUser){
    return done(null,false,{status:false,message:"User already exists"});
  }
  const OTP=generateOTP();
  const response=await sendOTP(OTP,email);
  if(response){
       req.session.otp={
         email:email,
         hash:await bcrypt.hash(OTP,10),
         password:await bcrypt.hash(password,10),
         tries:0,
         time:Date.now()
        };
        return done(null,false,{status:true,message:"OTP sent"})
  }
   return done(null,false,{status:false,message:"Failed to send verification email"});
};

async function GoogleCallback(accessToken,refreshToken,profile,done) {
          const json=profile._json;
          try{
            let user=await Users.findOne({sub:json.sub});
            if(!user){
              user=new Users({name:json.name,email:json.email,sub:json.sub});
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
  done(null,profile);
})

passport.deserializeUser(async(profile,done)=>{
   try{
     const deserialized=await Users.findById(profile._id);
     done(null,deserialized);
   }catch(err){done(err,null)}
});
passport.use('google',new GoogleStrategy(credentials,GoogleCallback));

module.exports={passport,ValidateOtp,resendOTP}
