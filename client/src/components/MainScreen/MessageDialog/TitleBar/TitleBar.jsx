import { useState,useEffect,useRef,useMemo } from "react";
import { useCtx } from "../../AppScreen";
import Avatar from "../../../ui/Avatar";
import IconButton from "../../../ui/IconButton";
import Button from "../../../ui/Button";
import options from '/options.svg'
import bell from '/bell.svg'
import report from '/report.svg'
import leave from '/leave.svg'
import del from '/delete.svg'
import back from '/back-one.svg'
import close from '/close.svg'
import forwardIcon from '/forward.svg'
import copyIcon from '/copy.svg'
import searchIcon from '/search.svg'
import up from '/up.svg'
import down from '/down.svg'
import { WALLPAPERS } from '../../../../wallpaper'


export default function (props){

    const {chatID,setChatID,db,chatdata,socket,profiles,userID,typingUsers,report:reportFn,deleteChat,isMobile}=useCtx()
    let chat=(chatdata)&&chatdata[chatID.id]||{};
    const [showWallpaper,setShowWallpaper]=useState(false);
    const [showDisappearing,setShowDisappearing]=useState(false);
    const [confirmDelete,setConfirmDelete]=useState(false);
    const [selMenuOpen,setSelMenuOpen]=useState(false);
    const option=useRef();
    const isOwner = chat.type==='group' && chat.owner && userID.current===chat.owner;
    // Membership must come from the chat doc's own `users` list, not the
    // locally-cached user.Chats array - that cache is populated by separate
    // code paths (join/create/backstop-sync) and can lag or miss entries,
    // which used to make a chat you're already in show a bogus Join button.
    // Only render the button once chat.users has actually loaded, so we
    // never flash it during the moment chatdata hasn't populated yet.
    const membershipKnown = Array.isArray(chat.users);
    const showJoin = chatID.type!='user' && membershipKnown && !chat.users.includes(userID.current);

    const otherProfile = chat.type !== 'group' ? profiles[chat.sender] : null;
    const memberCount = chat.users && chat.users.length;
    const typingIds = Object.keys((typingUsers && typingUsers[chatID.id]) || {});
    const typingStatus = typingIds.length
      ? (chat.type === 'group'
          ? `${typingIds.map((id) => (profiles[id] && profiles[id].name) || 'Someone').join(', ')} typing…`
          : 'typing…')
      : null;
    const status = typingStatus || (chat.type === 'group'
      ? `${memberCount || 0} member${memberCount === 1 ? '' : 's'}`
      : (otherProfile && otherProfile.username ? `@${otherProfile.username}` : 'Direct message'));

    const leaveChat=()=>{ 
      console.log("emit")
      try{
        socket.current.emit('leaveChat',{id:chatID.id,del:true});
        option.current.classList.toggle('hidden');
      }
    catch(e){console.log(e)}  
    }
    
    const reportChat=()=>{
     reportFn(chatID.id,'chat');
    }
    const muteChat=()=>{
      socket.current.emit('muteChat',chatID.id);
    }
    const DISAPPEARING_OPTIONS = [
      { label: 'Off', value: 0 },
      { label: '24 hours', value: 86400 },
      { label: '7 days', value: 604800 },
      { label: '90 days', value: 7776000 },
    ];
    const setDisappearing = (value) => {
      socket.current.emit('setDisappearing', { cid: chatID.id, duration: value || null });
      setShowDisappearing(false);
    };
    const disappearingLabel = (seconds) =>
      (DISAPPEARING_OPTIONS.find((o) => o.value === seconds) || {}).label
      || (seconds ? `${Math.round(seconds / 86400)}d` : null);
    const deleteGroupChat=(e)=>{
      if(!confirmDelete){
        e.stopPropagation();
        setConfirmDelete(true);
        return;
      }
      deleteChat(chatID.id);
      setConfirmDelete(false);
    }
    useEffect(()=>{
        if(option.current){
          option.current.classList.add('hidden');
        }
        setConfirmDelete(false);
    },[chatID])
    useEffect(()=>{
        if(!confirmDelete) return;
        const t=setTimeout(()=>setConfirmDelete(false),4000);
        return ()=>clearTimeout(t);
    },[confirmDelete])
   return(
      <div className="w-full  rounded-t-xl ">
      {props.selectionMode ? (
      <div className="w-full shadow-sm border-b dark:border-gray-700 p-2 pl-4 justify-between items-center h-14 bg-white dark:bg-gray-800 flex">
        <div className="flex items-center gap-3">
          <IconButton icon={close} alt="Cancel selection" onClick={props.onCancelSelection} />
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{props.selectedCount} selected</div>
        </div>
        <div className="relative flex items-center">
          <IconButton icon={options} alt="Selection actions" onClick={() => setSelMenuOpen((v) => !v)} />
          {selMenuOpen && (
            <div
              onMouseLeave={() => setSelMenuOpen(false)}
              className="absolute right-0 top-11 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-20 p-1 text-sm text-gray-600 dark:text-gray-200"
            >
              <button
                onClick={() => { props.onForwardSelected(); setSelMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <img src={forwardIcon} className="w-4 h-4 dark:invert dark:opacity-80" alt="" />
                <span>Forward</span>
              </button>
              {props.canCopySelected && (
                <button
                  onClick={() => { props.onCopySelected(); setSelMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <img src={copyIcon} className="w-4 h-4 dark:invert dark:opacity-80" alt="" />
                  <span>Copy</span>
                </button>
              )}
              <button
                onClick={() => { props.onDeleteSelected(); setSelMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500"
              >
                <img src={del} className="w-4 h-4" alt="" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>
      ) : props.chatSearchOpen ? (
      <div className="w-full shadow-sm border-b dark:border-gray-700 p-2 pl-4 justify-between items-center h-14 bg-white dark:bg-gray-800 flex gap-2">
        <img src={searchIcon} className="w-4 h-4 opacity-50 dark:invert shrink-0" alt="" />
        <input
          autoFocus
          value={props.chatSearchQuery}
          onChange={(e) => props.onChatSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); props.onChatSearchNext(); }
            if (e.key === 'Escape') props.onToggleChatSearch();
          }}
          placeholder="Search in this chat"
          className="flex-1 min-w-0 outline-none bg-transparent text-sm text-gray-700 dark:text-gray-100 placeholder-gray-400"
        />
        {props.chatSearchQuery && (
          <span className="text-xs text-gray-400 shrink-0 tabular-nums">
            {props.chatSearchResults.length > 0 ? `${props.chatSearchIndex + 1}/${props.chatSearchResults.length}` : '0/0'}
          </span>
        )}
        <IconButton icon={up} alt="Previous match" size="sm" disabled={props.chatSearchIndex <= 0} onClick={props.onChatSearchPrev} />
        <IconButton icon={down} alt="Next match" size="sm" disabled={props.chatSearchIndex >= props.chatSearchResults.length - 1} onClick={props.onChatSearchNext} />
        <IconButton icon={close} alt="Close search" onClick={props.onToggleChatSearch} />
      </div>
      ) : (
      <div className="  w-full shadow-sm  border-b dark:border-gray-700  p-2   pl-4 justify-between items-center  h-14 bg-white dark:bg-gray-800 flex">

        <div className="flex items-center">
         {isMobile && (
           <IconButton
             icon={back}
             alt="Back to chats"
             className="mr-1"
             onClick={()=>{setChatID({id:null,type:null})}}
           />
         )}
         <button onClick={()=>{
          props.setDialog(1);}} className="outline-none  border-none rounded-full h-fit w-fit">
           <Avatar src={chat.img && chat.img.src} kind={chat.type=='group'?'group':'user'} size="sm" />
         </button>
        <div className="p-2 pt-1 flex flex-col ">
         <div className="text-sm w-36 text-ellipses font-semibold text-gray-800 dark:text-gray-100">{chat.name||"Unnamed"}</div>
         <div className={`text-xs flex items-center gap-1 ${typingStatus ? 'text-[var(--accent-dark)] italic' : 'text-gray-400'}`}>
           <span>{status}</span>
           {!typingStatus && chat.disappearingDuration > 0 && (
             <span className="flex items-center gap-0.5 shrink-0" title={`Disappearing messages: ${disappearingLabel(chat.disappearingDuration)}`}>
               <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
               {disappearingLabel(chat.disappearingDuration)}
             </span>
           )}
         </div>
        </div>
        </div>
        <div className="flex items-center">
        {showJoin&&<Button variant="primary" className="mr-2 w-24" onClick={()=>{socket.current.emit("join",[chatID.id])}}>Join</Button>}

        <IconButton icon={searchIcon} alt="Search in chat" className="mr-1" onClick={props.onToggleChatSearch} />

        <IconButton icon={options} alt="Options" onClick={()=>{
            if(option.current){
              option.current.classList.toggle('hidden')
            }
          }} />

        </div>
    </div>
      )}

    <div ref={option} onClick={((event)=>{
          option.current.classList.toggle('hidden');
          option.current.removeEventListener('mouseLeave',(event)=>{
          option.current.classList.toggle('hidden');
        })})}
         onMouseLeave={(event)=>{
          option.current.classList.toggle('hidden');
         }}
         className=" p-1 w-40 mt-4 ring-red-100 opacity-95 h-fit z-10 bg-white dark:bg-gray-800 rounded-lg justify-start flex-col shadow-lg fixed right-12 py-2 hidden text-sm text-gray-600 dark:text-gray-200">
              <button onClick={muteChat} className="rounded-lg px-2 py-1.5 flex items-center gap-2 w-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <img src={bell}  className="w-4 h-4 dark:invert dark:opacity-80"></img><div>Mute</div></button>
              <button onClick={(e)=>{e.stopPropagation();setShowWallpaper((v)=>!v);}}  className="rounded-lg px-2 py-1.5 flex items-center gap-2 w-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <span className="w-4 h-4 flex items-center justify-center">🖼</span><div>Wallpaper</div></button>
              <button onClick={(e)=>{e.stopPropagation();setShowDisappearing((v)=>!v);}}  className="rounded-lg px-2 py-1.5 flex items-center gap-2 w-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
              <div>Disappearing messages</div></button>
              <button onClick={reportChat}  className="rounded-lg px-2 py-1.5 flex items-center gap-2 w-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <img src={report}  className="w-4 h-4 dark:invert dark:opacity-80"></img><div>Report</div></button>
              <button onClick={leaveChat} className="rounded-lg px-2 py-1.5 flex items-center gap-2 w-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <img src={leave}  className="w-4 h-4 dark:invert dark:opacity-80"></img><div>{(chat.type=='group')?'Leave':'Remove'}</div></button>
              {isOwner && (
              <button onClick={deleteGroupChat} className="rounded-lg px-2 py-1.5 flex items-center gap-2 w-full hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500">
              <img src={del}  className="w-4 h-4"></img><div>{confirmDelete?'Confirm delete?':'Delete group'}</div></button>
              )}

    </div>
    {showWallpaper && (
      <div
        onMouseLeave={()=>setShowWallpaper(false)}
        className="p-3 mt-1 w-56 h-fit z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg fixed right-12 grid grid-cols-3 gap-2"
      >
        {WALLPAPERS.map((w)=>(
          <button
            key={w.id}
            title={w.name}
            onClick={()=>{ props.setWallpaper && props.setWallpaper(w.css); setShowWallpaper(false); }}
            className={`h-12 rounded-md border-2 ${ (props.wallpaper||null)===w.css ? 'border-[var(--accent)]' : 'border-transparent'}`}
            style={{ background: w.css || `url(/background.jpg) center/cover` }}
          />
        ))}
      </div>
    )}
    {showDisappearing && (
      <div
        onMouseLeave={()=>setShowDisappearing(false)}
        className="p-1 mt-1 w-44 h-fit z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg fixed right-12 text-sm text-gray-600 dark:text-gray-200"
      >
        {DISAPPEARING_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setDisappearing(o.value)}
            className={`rounded-lg px-2 py-1.5 flex items-center justify-between w-full hover:bg-gray-100 dark:hover:bg-gray-700 ${
              (chat.disappearingDuration || 0) === o.value ? 'text-[var(--accent-dark)] font-semibold' : ''
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    )}
   </div>
  );
}