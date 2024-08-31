import React,{useState} from "react";
import { Link,Outlet, useNavigate } from 'react-router-dom';
import { post } from "../../Axios";
import { pl } from "@faker-js/faker";
export default function Signup(){
   const [value,setValue]=useState("thor@gmail.com");
   const [pass,setPass]=useState("power@guM.com");
   const navigate=useNavigate();
   const onClick=async()=>{
         const data=await post("/auth/signin",{email:value,password:pass}) 
         console.log(data);
         if(data.status)navigate('/app')
      }
   return (
    
    <div className="flex bg-white p-10 rounded-lg  shadow-lg justify-center items-center flex-col">
     <div className="text-3xl mb-2">
        <h2 className="mb-2 font-bold">Welcome Back</h2>
     </div>
     <button className='bg-blue-400 shadow-md font-bold p-1 pl-3 pr-3 rounded-full  '>
         Signin with Google
     </button>
     <div className="m-1 text-sm font-semibold">Or</div>
     <input value={value} onChange={(event)=>setValue(event.target.value)} placeholder={"Enter your email address"} className="rounded-full border font-roboto   mt-1 pl-4 pr-4 text-ellipses p-1 text-gray-600 bg-gray-100 " type="text"></input>
     <input value={pass} onChange={(event)=>setPass(event.target.value)} placeholder={"Enter your password"} className=" rounded-full font-roboto   mt-2 mb-2 pl-4 pr-4 text-ellipses p-1 border text-gray-600 bg-gray-100" type="text "></input>
    
     <iframe src="/oauth/callback" class="google-auth hidden" style={{position:'absolute',width:'100vw',height:'100vh'}}>
     </iframe>
     <button className="mt-2 bg-black text-white p-1 pl-3 pr-3 rounded-full mb-2" onClick={onClick}>Continue </button>
     <div className="text-base">Don't have an account? <Link to="/auth/signup">SignUp</Link></div>
    </div>
 )
}