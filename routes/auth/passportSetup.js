const passport=require('passport');
const bcrypt=require('bcrypt');
const GoogleStrategy=require('passport-google-oauth2').Strategy;
const LocalStrategy=require('passport-local').Strategy;
const CustomStrategy=require('passport-custom').Strategy;
const Users=require('../../models/Users')
const sendOTP=require('../../utils/sendMail')
const {randomBytes}=require('crypto')
const xss=require('xss')
require('dotenv').config();

const credentials={
  clientID:process.env.client_id,  
  clientSecret:process.env.client_secret, 
  callbackURL:process.env.redirect_uris,   
    passReqToCallback   : true
}

async function ValidateOtp(req,done) {      
      const otp=xss(req.body.otp)
      console.log(otp)
      if(req.session.otp){
        if(req.session.otp.tries>3)return done({status:false,message:"Tries exhausted"});
       req.session.otp.tries+=1;
       const OTP=await bcrypt.hash(otp,10);
       if((await bcrypt.compare(otp,req.session.otp.hash))||req.session.otp.otp==otp){
     
        const user=await Users({email:req.session.otp.email,password:req.session.otp.password});
        await user.save();
        console.log("user created")
        return done(null,{_id:user._id});
       } 
      return done({status:false,message:"OTP is incorrect"}); 
      }
      return done({status:false,message:"OTP has expired"});
      }


async function signInCallback(email,password,done) {
  email=xss(email)
  password=xss(password)
  if(/^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)){}
  else if(/^(?!.*[<>;'"&]).{8,64}$/.test(password)){}

  const user=await Users.findOne({email:email})
  if(user){
    console.log("P1")
  
    if(await bcrypt.compare(password,user.password)){
      return done(null,{_id:user._id});
    }
    else return done({ status:false,message:"Passwords do not match",status:false});
  }
  else return done({message:"User Doesnt Exist",status:"doesnt exist"},);

};

async function resendOTP(req,res,next){
  if(req.session.otp){
    const OTP=((Math.random()*1000000).toFixed()).toString(); 
    const response=await sendOTP(OTP,req.otp.email);
    if(response.status){
      verification={
        unverified:true,
        email:email,
        password:password,
        hash:await bcrypt.hash(OTP,10),
        tries:0,
        time:Date.now()
       };
      req.session.otp=verification;
    return {status:true};
    }
    return {status:false}
  }
  return {status:false}
}

async function signUpCallback(req,email,password,done) {
  email=xss(email)
  password=xss(password)
  if(/^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/.test(req.body.email)){}
  else if(/^(?!.*[<>;'"&]).{8,64}$/.test(req.body.password)){}

  const existingUser=await Users.findOne({email:email})
  if(existingUser){
    return done({message:"User already exists",status:"already exist"});
  }
  const OTP=(Math.random()*1000000).toFixed();
  console.log(OTP)
  const response=await sendOTP(OTP,email);
  if(response){
       verification={
         unverified:true,
         email:email,
         hash:await bcrypt.hash(OTP,10),
         password:await bcrypt.hash(password,10),
         otp:OTP,
         tries:0,
         time:Date.now()
        };
        req.session.otp=verification;
        return done(null,false,verification)      
  
      }
   else return res.json({status:false,message:"Internal Server Error"});
     
  
};
function MessageScript(value){
    const script=(msg)=>{return `<script>
    
    </script>
    window.parent.postMessage(${msg})
    <script>
    `}
    return script((value)?{status:true,message:"Email is valid"}:
                  {status:false,message:"Internal Error"});
    
}

async function GoogleCallback(accessToken,refreshToken,profile,next) {
          profile=profile.__json;
          let user=await Users.find({sub:profile.sub})
          profile={
            name:profile.name,
            email:profile.email,
            sub:profile.sub
          }
          if(!user)
           try{ 
            user=new Users(profile);
            await user.save()
           }
           catch(err){return done(err,null)}; 
          done(null,{_id:user._id});
}


passport.use('local-signin',new LocalStrategy( { usernameField: 'email', passwordField: 'password'},signInCallback));
passport.use('local-signup',new LocalStrategy( { usernameField: 'email', passwordField: 'password',passReqToCallback:true },signUpCallback));
passport.use('local-otp',new CustomStrategy(ValidateOtp))

passport.serializeUser((profile,done)=>{
  done(null,profile);
})

passport.deserializeUser(async(profile,done)=>{
   const deserialized=await Users.findById(profile._id);  
   done(null,deserialized);
});
passport.use('google',new GoogleStrategy(credentials,GoogleCallback));

module.exports={passport,ValidateOtp,MessageScript,resendOTP}






