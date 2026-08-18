import React,{useRef, useState,useEffect} from "react";
import { post } from "../../Axios";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { useToast } from "../../ui/Toast";

export default function VerificationScreen(props){
   const timeref=useRef(new Date());
   const [timer,setTimer]=useState(0);

   const ref=useRef();
   const navigate=useNavigate()
   const toast=useToast();
   const verifyOTP=async function(event){
           event.preventDefault();
           const otp=ref.current.value;
           const response=await post('/auth/verify',{otp:otp})
           if(response.status)navigate('/app')
           else toast.error(response.message)
         }

   const ResendOTP=async function(){
           const resp=await post('/auth/resendOTP')
           if(resp.status){
            ref.current.classList.remove('ring-2','ring-red-300');
            setTimer(0);
            toast.success('A new code is on its way.');
           } else {
            toast.error(resp.message);
           }
           ref.current.value="";
        }

   useEffect(()=>{
      if(timer>=180){
         ref.current.classList.add('ring-2','ring-red-300');
      }
      else  setTimeout(()=>setTimer((prev)=>prev+1),1000);
   },[timer])

   const remaining = Math.max(180 - timer, 0);
   const mm = Math.floor(remaining / 60);
   const ss = (remaining % 60).toString().padStart(2, '0');

  return (
    <Card className="flex justify-center items-center flex-col p-8 sm:p-10 gap-3 w-full max-w-sm">

     <div className="text-center mb-1">
        <h2 className="text-2xl font-bold text-gray-800">Check your inbox</h2>
        <p className="text-sm text-gray-400 mt-1">We sent a 6-digit code to your email.</p>
     </div>
     <form onSubmit={verifyOTP} className="w-full flex flex-col gap-1">
       <TextField className="w-full text-center tracking-[0.3em] text-lg" placeholder="000000" maxLength={6} ref={ref} type="text" inputMode="numeric" />
       <div className="text-xs w-full flex justify-end pr-1 text-gray-400">
        {remaining > 0 ? `Expires in ${mm}:${ss}` : "Code expired"}
       </div>
       <Button type="submit" className="mt-2 py-2">
          Verify
       </Button>
     </form>
     <div className="text-sm text-gray-500">Didn't get a code? <a onClick={ResendOTP} className="pl-1 text-[var(--accent-dark)] font-semibold cursor-pointer">Resend</a></div>
  </Card>
  )
}
