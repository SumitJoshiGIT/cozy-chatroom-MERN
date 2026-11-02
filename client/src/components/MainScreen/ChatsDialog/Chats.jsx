import { useLayoutEffect,useRef,useMemo,useState} from "react";
import { motionAllowed } from "../../../motion";
import Entity from "./Entity";
import SearchBar from "./SearchBar"
import { E2eePrompt } from "../E2eeSetup";
import MissedCalls from "./MissedCalls";
import Spinner from "../../ui/Spinner";
import { useCtx } from "../AppScreen";
export default function (props){
    const {chatdata, chatsLoaded, unseenMissedCalls}=useCtx()
    const [section,setSection]=useState("chats")
    const showingCalls=section==="calls"&&!props.style
    const chats=useMemo(()=>{
      const lastActivity=(chat)=>new Date((chat&&chat.lastMessage&&chat.lastMessage.createdAt)||(chat&&chat.createdAt)||0).getTime();
      const ordered=Object.keys(chatdata||{}).sort((a,b)=>lastActivity(chatdata[b])-lastActivity(chatdata[a]));
      return ordered.map((key)=><div className="w-full" data-chat-id={key} key={key}><Entity cache={props.cache} style={props.style} setStyle={props.setStyle} id={key}/></div>)},[chatdata,props.style])

    // When a message moves a chat up, the rows glide to their new places.
    const list=useRef(null);
    const positions=useRef(new Map());
    useLayoutEffect(()=>{
      if(!list.current) return;
      const scrollTop=list.current.scrollTop;
      const next=new Map();
      list.current.querySelectorAll("[data-chat-id]").forEach((row)=>{
        const top=row.offsetTop-scrollTop;
        const id=row.dataset.chatId;
        next.set(id,top);
        const previous=positions.current.get(id);
        if(previous===undefined||previous===top||!motionAllowed()) return;
        const rising=previous>top;
        row.style.position="relative";
        row.style.zIndex=rising?"1":"";
        row.animate(
          [{transform:`translateY(${previous-top}px)`},{transform:"none"}],
          {duration:rising?420:300,easing:"cubic-bezier(0.16, 1, 0.3, 1)"},
        ).onfinish=()=>{row.style.zIndex="";};
      });
      positions.current=next;
    },[chats]);
    const showLoading = !chatsLoaded && chats.length === 0;
    return(
      <div className="flex flex-col w-full flex-1 min-h-0 mt-2">
      <SearchBar cache={props.cache} style={props.style}/>
      {!props.style && <E2eePrompt />}
      {props.style ? (
        <button
          type="button"
          data-tour="missed-calls"
          aria-label="Missed calls"
          className="sidebar-section sidebar-section-rail mb-2"
          onClick={()=>{setSection("calls");props.setStyle(0)}}
        >
          ☎{unseenMissedCalls>0&&<span className="chat-unread-badge sidebar-section-badge">{unseenMissedCalls}</span>}
        </button>
      ) : (
        <div role="tablist" aria-label="Sidebar sections" className="sidebar-sections mt-2">
          <button type="button" role="tab" aria-selected={!showingCalls} className="sidebar-section" onClick={()=>setSection("chats")}>Chats</button>
          <button type="button" role="tab" aria-selected={showingCalls} data-tour="missed-calls" className="sidebar-section" onClick={()=>setSection("calls")}>
            Missed calls
            {unseenMissedCalls>0&&<span key={unseenMissedCalls} className="chat-unread-badge">{unseenMissedCalls}</span>}
          </button>
        </div>
      )}
      <div ref={list} className={`flex flex-col overflow-x-hidden overflow-y-scroll flex-1 min-h-0 rounded-xl ${props.style ? 'items-center mt-1' : 'mt-2'}`}>
         {showingCalls ? <MissedCalls/> : showLoading ? (
           <div className="flex justify-center py-6"><Spinner /></div>
         ) : chats.length ? chats : !props.style ? (
           <div className="px-4 py-10 text-center animate-fade-in">
             <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-light)] text-xl">
               ✿
             </div>
             <p className="text-sm font-semibold text-[var(--text)]">Your garden is quiet</p>
             <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
               Search for someone to start a fresh conversation.
             </p>
           </div>
         ) : null}
      </div>
      </div>

    )
}