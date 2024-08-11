import React from "react";
import { Link,Outlet } from 'react-router-dom';
export default function Signup(){
 return (

    <div className="center">
     <div className="header">
        <h2>Get your free account</h2>
     </div>
     <button className='gmail-signup'>
         Signup with Gmail
     </button>
     <div style={{marginBottom:'20px'}}>Or</div>
     <input placeholder="Enter your email address" className="email-input" type="text"></input>
     <br></br>
     <iframe src="/oauth/callback" class="google-auth hidden" style={{position:'absolute',width:'100vw',height:'100vh'}}>
     </iframe>
     <Link to="/verify">Continue with Email</Link>
     <div>Already have an account <Link to="/signIn">SignIn</Link></div>
    </div>
 )
}