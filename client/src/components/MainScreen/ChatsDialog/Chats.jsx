import { useState,useEffect,useRef, useCallback, useMemo} from "react";
import Entity from "./Entity";
import SearchBar from "./SearchBar"
import Spinner from "../../ui/Spinner";
import { useCtx } from "../AppScreen";
export default function (props){
    const {chatdata, chatsLoaded}=useCtx()
    const chats=useMemo(()=>{return Object.keys((chatdata||{})).map((key)=><Entity cache={props.cache} style={props.style} setStyle={props.setStyle} key={key} id={key}/>)},[chatdata,props.style])
    const showLoading = !chatsLoaded && chats.length === 0;
    return(
      <div className="flex flex-col w-full flex-1 min-h-0 mt-2">
      <SearchBar cache={props.cache} style={props.style}/>
      <div className={`flex flex-col overflow-x-hidden overflow-y-scroll flex-1 min-h-0 rounded-xl ${props.style ? 'items-center mt-1' : 'mt-4'}`}>
         {showLoading ? (
           <div className="flex justify-center py-6"><Spinner /></div>
         ) : chats}
      </div>
      </div>

    )
}