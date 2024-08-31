import React,{useState,useEffect,useRef,useMemo,useCallback} from "react"
import { useCtx } from "../AppScreen";
import option from '/options.svg'
import up from '/up.svg';
import down from '/down.svg';

export default function (props){
    const {setChatdata,privateChats,socket}=useCtx();
    const ref=useRef('');
    const options=useRef('');
    const [target,setTarget]=useState(3);
    const onChange=useCallback(()=>{
        const query=ref.current.value
        if(query)
         socket.current.emit('search',{query:query,target:target})        
        else setChatdata(props.cache.current.chats)
        },[target])

    useEffect(onChange,[target])
    useEffect(()=>{
         socket.current.on('searchResults',(results)=>{
            const dict={};
            const flag=results.target===1;
            results.results.forEach((data)=>{
                if(data){   
                if(flag){
                    if(privateChats.current[data._id])
                        data=props.cache.current.chats[privateChats.current[data._id]]||data     
                    else data.type='user'  
                }
                dict[data._id]=data;
                }
            })
            setChatdata(dict)
        })
    },[])
    return <div style={{display:props.style?'none':'block'}} className=" text-sm w-100  ml-2 mb-2 mt-2">
     <div className="rounded-full p-2 items-center justify-center w-full overflow-clip h-fit flex ring-1 ring-gray-300 bg-white ">
      
      <input ref={ref}  placeholder='Search ' className="active:outline-none pl-2 outline-none w-full  p-0 "  onChange={onChange}/>
      <button onClick={()=>options.current.classList.toggle('hidden')} className="bg-white h-full ml-2"><img src={option} className="opacity-70  h-4 w-fit"></img>
      </button>
      </div>
      
      <div ref={options} className="flex hidden pt-1 w-full flex-row-reverse text-xs font-semibold">
      <button onClick={()=>{if(target){setTarget(3);onChange()}}} style={{backgroundColor:target!=3&&'white',color:target!=0&&'black'}} className=" bg-gray-300 mt-1 border-1  rounded-full border-gray-300  pl-2 pr-2">Chats</button>  
      <button onClick={()=>{if(!target){setTarget(1);onChange()}}} style={{backgroundColor:target!=1&&'white',color:target!=1&&'black'}} className=" mr-1 mt-1 bg-gray-300 border-1 rounded-full border-gray-300  pl-2 pr-2">Users</button>  
      <button onClick={()=>{if(target){setTarget(2);onChange()}}} style={{backgroundColor:target!=2&&'white',color:target!=2&&'black'}} className="mt-1 bg-gray-300 border-1 mr-1 rounded-full  border-gray-300  pl-2 pr-2">Messages</button>  
      <button onClick={()=>{if(target){setTarget(0);onChange()}}} style={{backgroundColor:target!=0&&'white',color:target!=3&&'black'}} className="bg-gray-300  mt-1 border-1  rounded-full border-gray-300 mr-2  pl-2 pr-2">All</button>  
      
     </div>
    </div>
}