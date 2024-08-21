import React, { useState ,useEffect} from "react";
import { Navigate } from "react-router-dom";
import {post,get} from '../../Axios'
import { Link } from 'react-router-dom';

export default function Signup(){

   const [email,setEmail]=useState("");
   const [password,setPassword]=useState("");
   const [confirmPassword,setConfirmPassword]=useState("");
   const [Verified,SetVerified]=useState(false);
   let Token=null;
   async function SignUp(){
    if(confirmPassword!=password)alert("Passwords do not match"); 
    else{ 
    const result=await post("/signup",{
      email:{email},
      password:{password}
    }).catch(err=>{console.log('err')});
    if(result.success){
     Token=result.token;
     SetVerified(true); 
     return <Navigate state={{Token:Token}} to="auth/verify" />
   }
    else alert(result.message);
    }
   }
   
   const handleMessage=(event)=>{
      if(event.origin==origin){
       const data=event.data 
       if(data.type=="verify"){
         if(data.success)SetVerified(true);
      }
       else if(data.type=="error"){
        SetVerified(false); 
      }
      }
      else return;
     }

   useEffect(()=>{  

     window.addEventListener('message',handleMessage);
     return ()=>{
      window.removeEventListener('message',handleMessage);}
   }
     ,[])

 return (
    (Verified)?<Navigate to="/" />:
    <div className="flex justify-center items-center flex-col">
     <div className="text-3xl mb-2">
        <h2>Thank you </h2>
     </div>
     <div className="flex flex-col mb-2">
     <input placeholder="Enter your email address" className="border rounded-md  mt-2 pl-2 pr-4 text-ellipses p-1 border-2"  onChange={(e)=>setEmail(e.targetvalue)} value={email}></input>
     <input placeholder="Enter your password" className="border pl-2 pr-4 text-ellipses rounded-md p-1 mt-2 border-2"  onChange={(e)=>setPassword(e.targetvalue)} value={password} />
     <input placeholder="Confirm your password" className="border rounded-md  pl-2 pr-4 text-ellipses p-1 mt-2 border-2"  onChange={(e)=>setConfirmPassword(e.targetvalue)} value={confirmPassword} />
     </div>
     <button className='mt-2 p-1 bg-black text-white w-fit rounded-md shadow text-sm' onClick={SignUp}>Continue</button>
     <div className="text-sm m-1 w-full items-center flex justify-center">Or</div>
 
     <Link className=" bg-blue-400 p-1 rounded-md "  to="/auth/signin">
           SignIn with Google
     </Link>
     <div className="text-base">Already have an account? <Link to="/auth/signIn">SignIn</Link></div>
    </div>
 )
 }
