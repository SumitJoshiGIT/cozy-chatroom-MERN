import { useState,useEffect,useRef, useCallback, useMemo} from "react";
import Entity from "./Entity";
import socket from "../../../Socket"
import { useCtx } from "../../AppScreen";
export default function (props){
    const {chatdata,profiles,userID}=useCtx()
    const chats=useMemo(()=>{return Object.keys(chatdata).map((key)=><Entity cid={props.cid} key={key} id={key}/>)},[chatdata])
    return( <div  className=" overflow-y-scroll w-auto">
         {chats}
    </div>);
}