import React, { useState ,useEffect} from "react";
import { Navigate } from "react-router-dom";
import {post,get} from '../../Axios'
import { Link,useNavigate } from 'react-router-dom';

export default function Signup(){
  
   const [email,setEmail]=useState("thor@gmail.com");
   const [password,setPassword]=useState("power@guM.com");
   const [confirmPassword,setConfirmPassword]=useState("power@guM.com");
   const navigate=useNavigate();
   
   async function SignUp(){
    if(confirmPassword!=password)alert("Passwords do not match"); 
    else{ 
    const data={
      email:email,
      password:password
    }  
    const result=await post("/auth/signup",data).catch(err=>{console.log('err')});
    if(result.status){
     console.log("success")
     navigate("/auth/verify")
   }
    else alert(result.message);
    }
   }
   

   useEffect(()=>{  
      
   const handleMessage=(event)=>{
    if(event.origin==origin){
     const data=event.data 
     if(data.type=="verify"){
       if(data.success)props.setAuthenticated(true);
    } 
    } 
    else return;
  }
     window.addEventListener('message',handleMessage);
     return ()=>{
      window.removeEventListener('message',handleMessage);}
   }
     ,[])

 return (
    <div className="flex justify-center items-center flex-col">
     <div className="text-3xl mb-2">
        <h2>Thank you </h2>
     </div>
     <div className="flex flex-col mb-2">
     <input placeholder="Enter your email address" className=" rounded-md  mt-2 pl-2 pr-4 text-ellipses p-1 border-2"  onChange={(e)=>setEmail(e.target.value)} value={email}></input>
     <input placeholder="Enter your password" className=" pl-2 pr-4 text-ellipses rounded-md p-1 mt-2 border-2"  onChange={(e)=>setPassword(e.target.value)} value={password} />
     <input placeholder="Confirm your password" className=" rounded-md  pl-2 pr-4 text-ellipses p-1 mt-2 border-2"  onChange={(e)=>setConfirmPassword(e.target.value)} value={confirmPassword} />
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
