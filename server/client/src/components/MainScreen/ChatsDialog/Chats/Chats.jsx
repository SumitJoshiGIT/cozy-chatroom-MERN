import { useState,useEffect,useRef, useCallback, useMemo} from "react";
import Entity from "./Entity";
import SearchBar from "../SearchBar"
import { useCtx } from "../../AppScreen";
export default function (props){
    const {chatdata}=useCtx()
    const chats=useMemo(()=>{return Object.keys((chatdata||{})).map((key)=><Entity cache={props.cache} style={props.style} setStyle={props.setStyle} key={key} id={key}/>)},[chatdata,props.style])
    return( 
      <div className="overflow-hidden mt-2 flex-1">
      <SearchBar cache={props.cache} style={props.style}/>
      <div  className="h-full w-full overflow-x-hidden overflow-y-scroll mt-6 rounded-xl ">
         {chats}
       
      </div>
      </div>
      
    )
}