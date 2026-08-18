require('dotenv').config()
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  pool:true,
  auth: {
    user: process.env.EMAIL_USER,
    pass:process.env.EMAIL_PASS
  }
,    tls: {
  rejectUnauthorized: false
}
});

async function sendOTP(text,recepient){
  const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recepient,
        subject: 'Your OTP for User Authentication Has Been Generated.',
        text: text
      };
  try{
   await transporter.sendMail(mailOptions);
   return true;
  }
  catch(error){
    console.error('failed to send OTP email', error.message);
    return false;
  }
}

module.exports=sendOTP;
