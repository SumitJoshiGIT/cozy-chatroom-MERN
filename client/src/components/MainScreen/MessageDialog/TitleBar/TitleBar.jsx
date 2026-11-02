import { useState,useEffect,useRef,useMemo } from "react";
import { createPortal } from "react-dom";
import { useCtx } from "../../AppScreen";
import Avatar from "../../../ui/Avatar";
import IconButton from "../../../ui/IconButton";
import options from '/options.svg'
import bell from '/bell.svg'
import report from '/report.svg'
import leave from '/leave.svg'
import del from '/delete.svg'
import back from '/back-one.svg'
import close from '/close.svg'
import up from '/up.svg'
import down from '/down.svg'
import searchIcon from '/search.svg'
import forwardIcon from '/forward.svg'
import copyIcon from '/copy.svg'
import { WALLPAPERS } from '../../../../wallpaper'
import { startCall } from '../../startCall';
import ConfirmDialog, { shouldConfirm } from '../../../ui/ConfirmDialog';


export default function (props){

    const {chatID,setChatID,db,chatdata,socket,profiles,userID,typingUsers,report:reportFn,deleteChat,isMobile,mutedChats}=useCtx()
    let chat=(chatdata)&&chatdata[chatID.id]||{};
    const [showWallpaper,setShowWallpaper]=useState(false);
    const [showOptions,setShowOptions]=useState(false);
    const [showDisappearing,setShowDisappearing]=useState(false);
    const [confirmDelete,setConfirmDelete]=useState(false);
    const [confirmation,setConfirmation]=useState(null);
    const mutedUntil = mutedChats && mutedChats[chatID.id];
    const isMuted = mutedUntil && new Date(mutedUntil).getTime() > Date.now();
    const isOwner = chat.type==='group' && chat.owner && userID.current===chat.owner;
    // Membership must come from the chat doc's own `users` list, not the
    // locally-cached user.Chats array - that cache is populated by separate
    // code paths (join/create/backstop-sync) and can lag or miss entries,
    // which used to make a chat you're already in show a bogus Join button.
    // Only render the button once chat.users has actually loaded, so we
    // never flash it during the moment chatdata hasn't populated yet.
    const membershipKnown = Array.isArray(chat.users);

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
    const disappearingLabel = (DISAPPEARING_OPTIONS.find((o) => o.value === chat.disappearingDuration) || {}).label;
    const isGroupAdmin = (chat.admins||[]).includes(userID.current) || chat.owner===userID.current;
    const canSetDisappearing = chat.type !== 'group' || isGroupAdmin;
    const isMember = membershipKnown && chat.users.includes(userID.current);

    const leaveChat=()=> {
      const action = chat.type === 'group' ? 'leave-group' : 'remove-chat';
      const proceed = () => {
        socket.current.emit('leaveChat',{id:chatID.id,del:true});
        setShowOptions(false);
        setConfirmation(null);
      };
      if (shouldConfirm(action)) setConfirmation({ action, title: chat.type === 'group' ? 'Leave this group?' : 'Remove this conversation?', message: chat.type === 'group' ? 'You will leave this group and stop receiving its messages.' : 'This removes the conversation from your list. It comes back if a new message arrives.', onConfirm: proceed });
      else proceed();
    }
    
    const reportChat=()=>{
     const proceed = (reason) => { reportFn(chatID.id,'chat', reason); setShowOptions(false); setConfirmation(null); };
     if (shouldConfirm('report-chat')) setConfirmation({ action: 'report-chat', title: 'Report this conversation?', message: 'Tell us what is concerning about this conversation.', reasonPrompt: 'Reason for reporting (optional)', onConfirm: proceed });
     else proceed();
    }
    const muteChat=()=>{
      if (isMuted) {
        socket.current.emit('unmuteChat', chatID.id);
        setShowOptions(false);
        return;
      }
      const proceed = (durationMs) => { socket.current.emit('muteChat',{ id: chatID.id, durationMs: durationMs === "forever" ? null : Number(durationMs) }); setShowOptions(false); setConfirmation(null); };
      const options = [{value: "3600000", label: "For 1 hour"}, {value: "28800000", label: "For 8 hours"}, {value: "604800000", label: "For 1 week"}, {value: "forever", label: "Until I turn it back on"}];
      if (shouldConfirm('mute-chat')) setConfirmation({ action: 'mute-chat', title: 'Mute this conversation?', message: 'Choose how long notification alerts should stay muted.', durationOptions: options, onConfirm: proceed });
      else proceed(options[0].value);
    }
    const deleteGroupChat=()=>{
      const proceed = () => { deleteChat(chatID.id); setConfirmation(null); setShowOptions(false); };
      if (shouldConfirm('delete-group')) setConfirmation({ action: 'delete-group', title: 'Delete this group?', message: 'This permanently removes the group and its messages for all members.', confirmLabel: 'Delete', danger: true, onConfirm: proceed });
      else proceed();
    }
    useEffect(()=>{
        setShowOptions(false);
        setConfirmDelete(false);
    },[chatID])
    useEffect(() => {
      const closeOptions = (event) => {
        if (!event.target.closest('.message-options-menu') && !event.target.closest('.message-options-trigger')) {
          setShowOptions(false);
        }
      };
      document.addEventListener('pointerdown', closeOptions);
      return () => document.removeEventListener('pointerdown', closeOptions);
    }, []);
    useEffect(()=>{
        if(!confirmDelete) return;
        const t=setTimeout(()=>setConfirmDelete(false),4000);
        return ()=>clearTimeout(t);
    },[confirmDelete])
   return( 
      <div className="w-full  rounded-t-xl ">
      {props.selectionMode ? (
      <div className="message-titlebar titlebar-swap w-full p-2 pl-4 justify-between items-center h-14 flex">
        <div className="flex items-center gap-3">
          <IconButton icon={close} alt="Cancel selection" onClick={props.onCancelSelection} />
          <div className="text-sm font-semibold text-[var(--text)]" aria-live="polite">{props.selectedCount} selected</div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton icon={forwardIcon} alt="Forward selected" onClick={props.onForwardSelected} />
          {props.canCopySelected && <IconButton icon={copyIcon} alt="Copy selected" onClick={props.onCopySelected} />}
          {props.canDeleteSelected && <IconButton icon={del} alt="Delete selected" onClick={props.onDeleteSelected} />}
        </div>
      </div>
      ) : props.chatSearchOpen ? (
      <div className="message-titlebar titlebar-swap w-full p-2 pl-4 justify-between items-center h-14 flex gap-2">
        <img src={searchIcon} className="w-4 h-4 opacity-50 dark:invert shrink-0" alt="" />
        <input
          autoFocus
          aria-label="Search in this chat"
          value={props.chatSearchQuery}
          onChange={(e) => props.onChatSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); props.onChatSearchNext(); }
            if (e.key === 'Escape') props.onToggleChatSearch();
          }}
          placeholder="Search in this chat"
          className="flex-1 min-w-0 outline-none bg-transparent text-sm text-[var(--text)] placeholder-ink-muted"
        />
        {props.chatSearchQuery && (
          <span className="text-xs text-ink-muted shrink-0 tabular-nums">
            {props.chatSearchResults.length > 0 ? `${props.chatSearchIndex + 1}/${props.chatSearchResults.length}` : '0/0'}
          </span>
        )}
        <IconButton icon={up} alt="Previous match" size="sm" disabled={props.chatSearchIndex <= 0} onClick={props.onChatSearchPrev} />
        <IconButton icon={down} alt="Next match" size="sm" disabled={props.chatSearchIndex >= props.chatSearchResults.length - 1} onClick={props.onChatSearchNext} />
        <IconButton icon={close} alt="Close search" onClick={props.onToggleChatSearch} />
      </div>
      ) : (
      <div className="message-titlebar w-full p-2 pl-4 justify-between items-center h-14 flex">
          
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
        <div className="p-2 pt-1 flex flex-col min-w-0">
        <div className="text-sm max-w-52 truncate font-semibold text-[var(--text)]">{chat.name||"Unnamed"}</div>
         <div className={`text-xs flex items-center gap-1.5 ${typingStatus ? 'text-[var(--accent-dark)]' : 'text-ink-muted'}`}>
           {typingStatus && <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>}
           <span className="truncate">{status}</span>
           {!typingStatus && chat.disappearingDuration > 0 && <span className="disappearing-pill" title="Disappearing messages are on">⏱ {disappearingLabel}</span>}
         </div>
        </div>
        </div>
        <div className="flex items-center">
        {chatID.id && isMember && (
          <>
            <IconButton icon={searchIcon} alt="Search in chat" className="mr-1" onClick={props.onToggleChatSearch} />
            <button
              type="button"
              title="Start audio call"
              aria-label="Start audio call"
              onClick={() => startCall(socket, chat, 'audio')}
              className="call-action-button mr-1 rounded-full text-[var(--text-muted)]"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7.2 4.2 4.8 6.1c-.7.6-.9 1.6-.5 2.4 2.4 5.1 6.2 8.9 11.3 11.3.8.4 1.8.2 2.4-.5l1.9-2.4c.5-.7.4-1.7-.3-2.2l-2.8-2.1c-.6-.4-1.4-.4-1.9.1l-1.2 1.2a14.5 14.5 0 0 1-3.6-3.6l1.2-1.2c.5-.5.5-1.3.1-1.9L9.4 4.5c-.5-.7-1.5-.8-2.2-.3Z" />
              </svg>
            </button>
            <button
              type="button"
              title="Start video call"
              aria-label="Start video call"
              onClick={() => startCall(socket, chat, 'video')}
              className="call-action-button mr-1 rounded-full text-[var(--text-muted)]"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3.5" y="6.5" width="11.5" height="11" rx="2" />
                <path d="m15 10 5-3v10l-5-3Z" />
              </svg>
            </button>
          </>
        )}
   
        <IconButton icon={options} alt="Options" className="message-options-trigger" onClick={()=>{
            setShowOptions((value) => !value)
          }} />

        </div>
    </div>
    )}
   
    {showOptions && createPortal(<div
         className="message-options-menu p-1 w-48 mt-2 h-fit z-20 rounded-2xl justify-start flex-col text-sm">
              <button onClick={muteChat} className="message-option rounded-xl px-2 py-2 flex items-center gap-2 w-full">
              <img src={bell}  className="w-4 h-4 dark:invert dark:opacity-80"></img><div>{isMuted ? "Unmute" : "Mute"}</div></button>
              <button onClick={(e)=>{e.stopPropagation();setShowOptions(false);setShowWallpaper(true);}}  className="message-option rounded-xl px-2 py-2 flex items-center gap-2 w-full">
              <span className="w-4 h-4 flex items-center justify-center">🖼</span><div>Wallpaper</div></button>
              {canSetDisappearing && (
              <button onClick={(e)=>{e.stopPropagation();setShowOptions(false);setShowDisappearing(true);}} className="message-option rounded-xl px-2 py-2 flex items-center gap-2 w-full">
              <span className="w-4 h-4 flex items-center justify-center">⏱</span><div>Disappearing messages</div></button>
              )}
              <button onClick={reportChat}  className="message-option rounded-xl px-2 py-2 flex items-center gap-2 w-full">
              <img src={report}  className="w-4 h-4 dark:invert dark:opacity-80"></img><div>Report</div></button>
              <button onClick={leaveChat} className="message-option rounded-xl px-2 py-2 flex items-center gap-2 w-full">
              <img src={leave}  className="w-4 h-4 dark:invert dark:opacity-80"></img><div>{(chat.type=='group')?'Leave':'Remove'}</div></button>
              {isOwner && (
              <button onClick={deleteGroupChat} className="message-option message-option-danger rounded-xl px-2 py-2 flex items-center gap-2 w-full">
              <img src={del}  className="w-4 h-4"></img><div>Delete group</div></button>
              )}

    </div>, document.body)}
    {showWallpaper && createPortal(
      <div
        onMouseLeave={()=>setShowWallpaper(false)}
        className="wallpaper-menu p-3 w-56 h-fit z-20 rounded-2xl fixed right-12 top-16 grid grid-cols-3 gap-2"
      >
        {WALLPAPERS.map((w)=>(
          <button
            key={w.id}
            title={w.name}
            onClick={()=>{ props.setWallpaper && props.setWallpaper(w.css); setShowWallpaper(false); }}
            className={`h-12 rounded-md border-2 ${ (props.wallpaper||null)===w.css ? 'border-[var(--accent)]' : 'border-transparent'}`}
            style={{ background: w.css || undefined }}
          />
        ))}
      </div>, document.body
    )}
    {showDisappearing && createPortal(
      <div
        onMouseLeave={()=>setShowDisappearing(false)}
        className="wallpaper-menu p-1 w-48 h-fit z-20 rounded-2xl fixed right-12 top-16 text-sm"
      >
        {DISAPPEARING_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setDisappearing(o.value)}
            className={`message-option rounded-xl px-3 py-2 flex items-center justify-between w-full ${
              (chat.disappearingDuration || 0) === o.value ? 'text-[var(--accent-dark)] font-semibold' : ''
            }`}
          >
            {o.label}
            {(chat.disappearingDuration || 0) === o.value && <span aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>, document.body
    )}
    {confirmation && <ConfirmDialog {...confirmation} onCancel={() => setConfirmation(null)} />}
   </div>
  );
}