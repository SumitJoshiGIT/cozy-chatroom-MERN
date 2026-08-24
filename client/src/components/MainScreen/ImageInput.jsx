import React,{useRef,useEffect, useState} from "react";
import edit from '/edit.svg'
import { useToast } from "../ui/Toast";
import Spinner from "../ui/Spinner";
const maxSize=2*1024*1024;
const validImageTypes = ['image/jpeg', 'image/png', 'image/webp','image/svg','image/svg+xml'];
export default function(props){
    const [src,setSrc]=useState(props.src);
    const [reading,setReading]=useState(false);
    const file=useRef();
    const ref=useRef();
    const toast=useToast();

    useEffect(()=>{
      setSrc(props.src);
    },[props.src])

    function handleChange(event){
        const picked=event.target.files[0];
        event.target.value='';
        if(!picked) return;
        if(!validImageTypes.includes(picked.type)){
          toast.error(`${picked.name}: unsupported file type`);
          return;
        }
        if(picked.size>=maxSize){
          toast.error(`${picked.name}: file too large (max 2MB)`);
          return;
        }
        const fileReader=new FileReader();
        setReading(true);
        fileReader.onloadend=((ev)=>{
          props.fileform.current.file=ev.target.result.split(',')[1]
          props.fileform.current.type=picked.type
          props.fileform.current.name=picked.name
          props.fileform.current.dimensions=[picked.width||-1,picked.height||-1]
          props.fileform.current.size=picked.size

          setSrc(ev.target.result)
          setReading(false);
          if(props.callback) props.callback()
        })
        fileReader.readAsDataURL(picked);
    }

return  <div className='border-1 overflow-clip w-fit h-36 flex items-baseline rounded-full'>
       <div onMouseEnter={()=>{if(!props.uneditable)ref.current.style.display='flex'}} onMouseLeave={()=>{
            ref.current.style.display='none'

            }}
            className="h-36 w-36 relative">
        <img className="h-36 w-36 bg-white border rounded-full object-cover" src={src}/>
        {reading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-full">
            <Spinner />
          </div>
        )}
        <div ref={ref} className="bg-transparent backdrop-blur-lg flex hidden  justify-center relative transition-3s bottom-1/2 items-center opacity-60 h-1/2 rounded-b-full w-36 ">
        <button className="outline-none active:outline-none" onClick={()=>{file.current.click()}}>
        <img className='w-8' src={edit}></img></button>

        </div>
       </div>
       <div>
       <input accept='image/*' onChange={handleChange} ref={file} className="text-xs w-0 h-0" type='file'/>
       </div>
      </div>
      }
