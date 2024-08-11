import { useState,useEffect } from "react";


export default function (props){

    return( <div className="flex sticky shadow-md  p-4 justify-content items-center h-14 bg-white w-full">
        <div>
         <div>{props.chatName}</div>
         <div>{props.nMembers}
         </div>
        </div>
        <button></button>
    </div>);
}