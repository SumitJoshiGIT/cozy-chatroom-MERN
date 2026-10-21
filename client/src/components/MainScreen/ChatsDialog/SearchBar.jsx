import React,{useState,useEffect,useRef,useMemo,useCallback} from "react"
import { useCtx } from "../AppScreen";
import IconButton from "../../ui/IconButton";
import Spinner from "../../ui/Spinner";
import option from '/options.svg'

const FILTERS = [
  { label: 'All', value: 0 },
  { label: 'Users', value: 1 },
  { label: 'Messages', value: 2 },
  { label: 'Chats', value: 3 },
];

export default function (props){
    const {setChatdata,privateChats,socket}=useCtx();
    const ref=useRef('');
    const options=useRef('');
    const [target,setTarget]=useState(0);
    const [searching,setSearching]=useState(false);
    const reqId=useRef(0);
    const debounceTimer=useRef(null);

    const runSearch=useCallback(()=>{
        const query=ref.current.value
        if(query){
         setSearching(true);
         reqId.current+=1;
         console.info("[chat] searching", { query, target, reqId: reqId.current });
         socket.current.emit('search',{query:query,target:target,reqId:reqId.current})
        }
        else {
         reqId.current+=1;
         setSearching(false);
         setChatdata(props.cache.current.chats)
        }
        },[target])

    const onChange=useCallback(()=>{
        if(debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current=setTimeout(runSearch,250);
        },[runSearch])

    useEffect(runSearch,[target])
    useEffect(()=>{
         socket.current.on('searchResults',(results)=>{
            if(results.reqId!==reqId.current) return;
            console.info("[chat] search results", { count: results.results.length, target: results.target, reqId: results.reqId });
            setSearching(false);
            const dict={};
            results.results.forEach((data)=>{
                if(data){
                if(data.type==='user' && privateChats.current[data._id])
                    data=props.cache.current.chats[privateChats.current[data._id]]||data
                dict[data._id]=data;
                }
            })
            setChatdata(dict)
        })
        socket.current.on("searchError", (error) => {
            if (error.reqId !== reqId.current) return;
            console.error("[chat] search failed", error);
            setSearching(false);
        });
    },[])
    return <div style={{display:props.style?'none':'block'}} className="chat-search text-sm w-full mb-2">
     <div className="chat-search-field rounded-full p-2 items-center justify-center w-full overflow-clip h-fit flex">

      <input ref={ref}  placeholder='Search ' className="active:outline-none pl-2 outline-none w-full  p-0 bg-transparent"  onChange={onChange}/>
      {searching && <Spinner size="xs" className="mr-2 shrink-0" />}
      <IconButton icon={option} alt="Filters" size="sm" onClick={()=>options.current.classList.toggle('hidden')} />
      </div>

      <div ref={options} className="chat-search-filters flex hidden pt-2 gap-1 w-full flex-row-reverse text-xs font-semibold">
      {FILTERS.map(f => (
        <button
          key={f.value}
          onClick={()=>setTarget(f.value)}
          className={`mt-1 rounded-full px-2 py-1 border transition-colors ${target===f.value ? 'chat-filter-active' : 'chat-filter'}`}
        >{f.label}</button>
      ))}
     </div>
    </div>
}
