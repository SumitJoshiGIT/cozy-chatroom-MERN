require('dotenv').config()
const nodemailer = require('nodemailer');

console.log({
  user: process.env.email, 
  pass:process.env.password
 
})

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  pool:true,
  auth: {
    user: process.env.email, 
    pass:process.env.password  
  }
,    tls: {
  rejectUnauthorized: false
}
});

async function sendOTP(text,recepient){
  const mailOptions = {
        from: process.env.email,
        to: recepient,
        subject: 'Your OPT for User Authentication Has Been Generated.',
        text: text
      };  
  try{   
   const response=await new Promise((resolve,reject)=>{transporter.sendMail(mailOptions, (error, info) => {
    if (error)reject(false);
    else resolve(true);
    
    })});
  return response;
  }
  catch(error){return false}
 
}

module.exports=sendOTP;