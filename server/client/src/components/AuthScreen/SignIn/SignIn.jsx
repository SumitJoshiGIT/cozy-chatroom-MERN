import React from "react";
import { Link,Outlet } from 'react-router-dom';
export default function Signup(){
 return (

    <div className="flex justify-center items-center flex-col">
     <div className="text-3xl mb-2">
        <h2>Get your free account</h2>
     </div>
     <button className='bg-blue-400 shadow shadow-2 p-1 rounded-md '>
         Signup with Gmail
     </button>
     <div className="m-1 text-sm">Or</div>
     <input placeholder="Enter your email address" className="border rounded-md  mt-1 pl-2 pr-4 text-ellipses p-1 border-2" type="text"></input>
     <iframe src="/oauth/callback" class="google-auth hidden" style={{position:'absolute',width:'100vw',height:'100vh'}}>
     </iframe>
     <Link className="mt-2 bg-black text-white p-1 pl-2 pr-2 rounded-md mb-2" to="auth/verify">Continue </Link>
     <div className="text-base">Don't have an account? <Link to="/auth/signup">SignUp</Link></div>
    </div>
 )
}