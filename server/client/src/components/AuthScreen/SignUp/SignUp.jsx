import React, { useState ,useEffect} from "react";
import { Navigate } from "react-router-dom";
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
    });
    if(result.success){
     Token=result.token;
     SetVerified(true); 
     return <Navigate state={{Token:Token}} to="/verify" />
   }
    else alert(result.message);
    }
   }
   
   useEffect(()=>{  
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
     window.addEventListener('message',handleMessage);
     return ()=>{
      window.removeEventListener('message',handleMessage);}
   }
   )

 return (
    (Verified)?<Navigate to="/" />:
    <div className="center">
     <div className="header">
        <h2>Thank you </h2>
     </div>
     <input placeholder="Enter your email address" className="email-input" type="email" onChange={(e)=>setPassword(email)}value={email}></input>
     <br></br>
     <input placeholder="Enter your password" className="email-input password-input" type="password" onChange={(e)=>setPassword(password)}value={password} />
     <br></br>
     <input placeholder="Confirm your password" className="email-input password-input" type="password" onChange={(e)=>setPassword(confirmPassword)} value={password} />
     <button className='email-signup' onClick={SignUp}>Continue with Email</button>
     <div style={{marginBottom:'20px'}}>Or</div>
     <Link to="/SignIn" className='gmail-signup'>
         SignIn with Gmail
     </Link>
    </div>
 )
 }
