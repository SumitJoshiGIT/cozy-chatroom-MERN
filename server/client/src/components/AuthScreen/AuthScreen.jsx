
import {useState} from 'react'
import { Outlet } from 'react-router-dom';
export default function(props){
       console.log(true)
      return (
         <div className="flex h-screen w-screen justify-center items-center">
                <Outlet/>
         </div>)
     }