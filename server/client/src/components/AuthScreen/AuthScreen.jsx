
import {useState,createContext, useEffect} from 'react'
import { Outlet,useNavigate } from 'react-router-dom';

export default function(props){
      const [authenticated,setAuthenticated]=useState(false)
      useEffect(()=>{
       if(authenticated)useNavigate('/app')
      },[authenticated])
      return (
         <div className="flex h-screen w-screen justify-center items-center">
                <Outlet context={setAuthenticated}/>
         </div>
         )
     }