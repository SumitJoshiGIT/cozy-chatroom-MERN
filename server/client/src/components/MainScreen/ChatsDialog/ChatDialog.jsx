import { useState,useEffect } from "react";
import Titlebar from './TitleBar/TitleBar';
import Chats from './Chats/Chats';
export default function (props){

    return( <>
    <div className="h-screen border border-r-grey-900 bg-white min-w-96 p-2 w-auto h-full">   
     <Titlebar></Titlebar>
     <Chats></Chats> 
    </div> 

    </>);
}