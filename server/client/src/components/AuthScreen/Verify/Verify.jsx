import React from "react";

export default function VerificationScreen(props){
  
        const [timer,setTimer]=useState(0);
        const verifyOTP=async function(){
           const otp=document.querySelector('.email-input').value;   
           Verify(otp,props.SetVerified)
        }
     
        const ResendOTP=async function(){
           Resend({token:props.token},setTimer,0);
           document.querySelector(".email-input").value="";
        }
        
  return (
    <div className="center">
     <div className="header">
        <h2>We have sent you a mail</h2>
     </div>
     <input placeholder="Enter OTP" className="email-input" type="text"></input>
     <div>{timer}/180</div>
     <br></br>
     <button onClick={verifyOTP} className='gmail-signup'>
        Verify
     </button>
     <div>Didn't recieve a mail?<a onClick={ResendOTP}>Resend</a></div>
    </div>
  )
}