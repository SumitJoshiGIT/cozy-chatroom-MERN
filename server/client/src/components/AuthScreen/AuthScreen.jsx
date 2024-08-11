
import Verify from './Verify/Verify';
import { Outlet, Link } from "react-router-dom";
import {useState} from 'react'
import SignIn from './SignIn/SignIn';
import SignUp from './SignUp/SignUp';

export default function(props){
      return (
         <div className="auth-screen">
                {(props.login)?<SignIn/>:<SignUp/>}
         </div>)
     }