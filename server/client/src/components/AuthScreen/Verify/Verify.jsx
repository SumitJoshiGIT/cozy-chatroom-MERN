import React,{useRef, useState,useEffect} from "react";
import { post } from "../../Axios";
import { useNavigate } from "react-router-dom";

export default function VerificationScreen(props){
   const timeref=useRef(new Date());
   const [timer,setTimer]=useState(0);
     
   const ref=useRef();
   const navigate=useNavigate()
   const verifyOTP=async function(){
           const otp=ref.current.value;   
           const response=await post('/auth/verify',{otp:otp})
           if(response.status)navigate('/app')
         }
     
   const ResendOTP=async function(){
           const resp=await post('/auth/resend')
           if(resp.status){
            ref.current.classList.toggle('border-red-300');      
            setTimer(0);}
           document.querySelector(".email-input").value="";
        }
   
   useEffect(()=>{
      if(timer>=180){
         ref.current.classList.toggle('border-red-300');      
      }
      else  setTimeout(()=>setTimer((prev)=>prev+1),1000);
   },[timer])   

   
        
  return (
    <div className="center" >
      <div className="flex justify-center items-center flex-col bg-white p-10 rounded-lg shadow-lg">
   
     <div className="header">
        <h2 className="text-2xl font-bold">We have sent you a mail</h2>
     </div>
     <div>
     <input className="border-2 p-1 rounded-md pl-2 mt-2" placeholder="Enter OTP" ref={ref} type="text"></input>
     <div className="text-xs ml-1 w-full flex justify-end pr-2">{timer}/180</div>
     </div>
     <button  className='bg-black rounded-md mt-2 text-white p-1 text-sm pl-2 pr-2' onClick={verifyOTP} >
        Verify
     </button>
     <div className="text-sm">Didn't recieve a mail?<a onClick={ResendOTP} className="pl-1">Resend</a></div>
    </div>
  </div>
  )
}