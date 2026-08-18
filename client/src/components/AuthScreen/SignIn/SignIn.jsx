import React,{useState} from "react";
import { Link, useNavigate } from 'react-router-dom';
import { post } from "../../Axios";
import { apiOrigin } from "../../../apiOrigin";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Divider from "../../ui/Divider";
import { TextField } from "../../ui/TextField";
import { useToast } from "../../ui/Toast";
export default function Signup(){
   const [value,setValue]=useState("");
   const [pass,setPass]=useState("");
   const navigate=useNavigate();
   const toast=useToast();
   const onSubmit=async(event)=>{
         event.preventDefault();
         const data=await post("/auth/signin",{email:value,password:pass})
         if(data.status)navigate('/app')
         else toast.error(data.message)
      }
   return (

    <Card className="flex p-8 sm:p-10 justify-center items-center flex-col gap-3 w-full max-w-sm">
     <div className="text-center mb-1">
        <h2 className="text-2xl font-bold text-gray-800">Welcome back</h2>
        <p className="text-sm text-gray-400 mt-1">Sign in to keep the conversation going.</p>
     </div>
     <Button as="a" variant="secondary" href={`${apiOrigin}/auth/google/oauth`} className="w-full py-2">
         Continue with Google
     </Button>
     <Divider>or</Divider>
     <form onSubmit={onSubmit} className="w-full flex flex-col gap-3">
       <TextField value={value} onChange={(event)=>setValue(event.target.value)} placeholder={"Email address"} type="email" className="w-full" />
       <TextField value={pass} onChange={(event)=>setPass(event.target.value)} placeholder={"Password"} type="password" className="w-full" />
       <Button type="submit" className="mt-1 py-2">Continue</Button>
     </form>
     <div className="text-sm text-gray-500">Don't have an account? <Link to="/auth/signup" className="text-[var(--accent-dark)] font-semibold">Sign up</Link></div>
    </Card>
 )
}
