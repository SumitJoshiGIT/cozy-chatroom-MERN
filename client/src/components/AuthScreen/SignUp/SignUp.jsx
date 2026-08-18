import React, { useState } from "react";
import {post} from '../../Axios'
import { apiOrigin } from '../../../apiOrigin';
import { Link,useNavigate } from 'react-router-dom';
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Divider from "../../ui/Divider";
import { TextField } from "../../ui/TextField";
import { useToast } from "../../ui/Toast";

export default function Signup(){

   const [email,setEmail]=useState("");
   const [password,setPassword]=useState("");
   const [confirmPassword,setConfirmPassword]=useState("");
   const navigate=useNavigate();
   const toast=useToast();

   async function SignUp(event){
    event.preventDefault();
    if(confirmPassword!=password)toast.error("Passwords do not match");
    else{
    const data={
      email:email,
      password:password
    }
    const result=await post("/auth/signup",data);
    if(result.status){
     navigate("/auth/verify")
   }
    else toast.error(result.message);
    }
   }

 return (
    <Card className="flex justify-center items-center flex-col p-8 sm:p-10 gap-3 w-full max-w-sm">
     <div className="text-center mb-1">
        <h2 className="text-2xl font-bold text-gray-800">Welcome aboard</h2>
        <p className="text-sm text-gray-400 mt-1">Create an account to get started.</p>
     </div>
     <form onSubmit={SignUp} className="w-full flex flex-col gap-3">
       <TextField placeholder="Email address" type="email" className="w-full" onChange={(e)=>setEmail(e.target.value)} value={email} />
       <TextField placeholder="Password" type="password" className="w-full" onChange={(e)=>setPassword(e.target.value)} value={password} />
       <TextField placeholder="Confirm password" type="password" className="w-full" onChange={(e)=>setConfirmPassword(e.target.value)} value={confirmPassword} />
       <Button type="submit" className="mt-1 py-2">Continue</Button>
     </form>

     <Divider>or</Divider>

     <Button as="a" variant="google" href={`${apiOrigin}/auth/google/oauth`} className="w-full py-2">
           Continue with Google
     </Button>
     <div className="text-sm text-gray-500">Already have an account? <Link to="/auth/signin" className="text-[var(--accent-dark)] font-semibold">Sign in</Link></div>
    </Card>
 )
 }
