const {post,get} =require('../Axios')

async function Signup(otp,setState,success){
    if(otp.match(/^[0-9]{6}/)){
       const data=(await post('/verify',{OTP:otp}))
       if(data.success){
        return {type:"verify",status:"success",message:'Verified Successfully'}
         setState(success);
      }
       else return {type:"verify",status:
       "error",message: data.error}       
    }
    else  return {type:"verify",status:"error",message:"OTP must be a 6 digit number"} 
    }

async function Resend(setState,success){
  const data=(await post('/verify?resend=true'))
  if(data.success){
    return {type:"verify",success:'Verified Successfully'}
    setState(success);
  }
  else return {type:"verify",error: data.error}            
}