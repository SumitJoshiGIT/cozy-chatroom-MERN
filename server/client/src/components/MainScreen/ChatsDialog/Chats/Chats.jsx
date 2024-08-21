import { useState,useEffect,useRef, useCallback, useMemo} from "react";
import Entity from "./Entity";
import socket from "../../../Socket"
import SearchBar from "./SearchBar"
import { useCtx } from "../../AppScreen";
export default function (props){
    const {chatdata,profiles,userID}=useCtx()
    
    console.log(chatdata,Object.keys(chatdata))
    const chats=useMemo(()=>{return Object.keys(chatdata).map((key)=><Entity cache={props.cache} key={key} id={key}/>)},[chatdata])
    return( 
      <div className="overflow-hidden h-full">
      <SearchBar cache={props.cache}/>
      <div  className="h-full overflow-y-scroll rounded-xl ">
         {chats}
      </div>
      </div>
      
    )
}