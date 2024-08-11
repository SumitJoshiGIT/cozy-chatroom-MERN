const passport=require('passport');
const bcrypt=require('bcrypt');
const GoogleStrategy=require('passport-google-oauth2').Strategy;
const LocalStrategy=require('passport-local').Strategy;
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

async function ValidateOtp(req, res, next) {       
       if(!(req.otpHash||req.otpHash.hash))return res.json({status:"notFound",message:"Internal Server Error"});
       req.session.verification.tries+=1;
       const OTP=bcrypt.hash(req.body.OTP);
       if(bcrypt.compare(OTP,req.session.verification.hash)){
        const user=Users.findOne({email:req.session.verification.email});
        req.session.passport.user=user;
        return res.json({status:true,message:"OTP is correct"});
       } 
       return res.json({status:false,message:"OTP is incorrect"}); 
}

async function ValidateUser(req,res,next){ 
    if(!req.csrfToken())return res.send({status:false,message:"Csrf Token is either missing or invalid!"})
    if(length(req.body.password<8))return res.send({status:false,message:"Password character constraint is 8-64."})
    const email=(/^[\w-]+(?:\.[\w-]+)*@(?:[\w-]+\.)+[a-zA-Z]{2,7}$/.test(req.body.email))
    const password=/^(?!.*[<>;'"&]).{8,64}$/.test(req.body.password)
    if(!email)return res.json({status:false,message:"Please enter a valid email"})
    if(!password)return res.json({status:false,message:"Please enter a valid password"})
    req.body={email:xss(req.body.email)
            ,password:bcrypt.hash(xss(req.body.password))
           ,username:"somename"
          };
    next();
}

async function generateOTP(req,res,next){
   const OTP=(Math.random()*1000000).toFixed(); 
   const response=await sendOTP(scaledNumber,req.body.email);
    if(response.status=="success"){
        req.session.verification={
          ...req.body,
          hash:bcrypt.hash(scaledNumber),
          tries:0,
          time:Date.now()
        };
        req.json({status:true,message:"OTP generated successfully"})      
        setTimeout(()=>delete req.session.otpHash,60000);
    }
    else return res.json({status:false,message:"Internal Server Error"});
}

async function Signup(req,res,next){
         return generateOTP(req,res,next); 
    }

async function LocalCallback(email,password,done) {
  const user=await Users.find({email:email})
  if(user){
    if(bcrypt.compare(password,user.password)){
      return done(null,{email:email});
    }
    else return done({ status:false,message:"Passwords do not match",status:false});
  }
  else return done({message:"User Doesnt Exist",status:"doesnt exist"},);

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
          const user=await Users.find({sub:profile.sub})
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
          done(null,profile);
}

passport.serializeUser((profile,done)=>{
    
  done(null,profile);
})

passport.deserializeUser(async(profile,done)=>{
   profile=await Users.findOne(profile);  
   done(null,profile);
});

passport.use('local',new LocalStrategy(LocalCallback));
passport.use('google',new GoogleStrategy(credentials,GoogleCallback));

module.exports={passport,ValidateUser,ValidateOtp,MessageScript}






