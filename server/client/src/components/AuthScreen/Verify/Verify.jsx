import React,{useRef, useState} from "react";
import { post } from "../../Axios";
import { useNavigate } from "react-router-dom";
export default function VerificationScreen(props){
  
   const [timer,setTimer]=useState(0);
   const ref=useRef('');
   const navigate=useNavigate()
   const verifyOTP=async function(){
           const otp=ref.current.value;   
           const response=await post('/auth/verify',{otp:otp,username:"otp"})
           if(response.status)navigate('/app')
         }
     
        const ResendOTP=async function(){
           Resend({token:props.token},setTimer,0);
           document.querySelector(".email-input").value="";
        }
        
  return (
    <div className="center" >
     <div className="header">
        <h2 className="text-2xl">We have sent you a mail</h2>
     </div>
     <input className="border-2 p-1 rounded-md pl-2 mt-2" placeholder="Enter OTP" ref={ref} type="text"></input>
     <div className="text-xs ml-1">{timer}/180</div>

     <button className='bg-black rounded-md mt-2 text-white p-1 text-sm pl-2 pr-2' onClick={verifyOTP} >
        Verify
     </button>
     <div className="text-sm">Didn't recieve a mail?<a onClick={ResendOTP} className="pl-1">Resend</a></div>
    </div>
  )
}