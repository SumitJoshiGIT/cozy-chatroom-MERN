import React,{useRef,useEffect, useState} from "react";
import edit from '/edit.svg'
const maxSize=2*1024*1024;
export default function(props){ 
    const [src,setSrc]=useState(props.src);
    const file=useRef();
    const ref=useRef();
return  <div className='border-1 overflow-clip w-fit h-36 flex items-baseline rounded-full'>
       <div onMouseEnter={()=>{if(!props.uneditable)ref.current.style.display='flex'}} onMouseLeave={()=>{
            ref.current.style.display='none'
            
            }}
            className="h-36 w-36">
        <img  className="  h-36 w-36 bg-white border rounded-full" src={src}/> 
        <div ref={ref} className="bg-transparent backdrop-blur-lg flex hidden  justify-center relative transition-3s bottom-1/2 items-center opacity-60 h-1/2 rounded-b-full w-36 ">
        <button className="outline-none active:outline-none" onClick={()=>{file.current.click()}}>
        <img className='w-8' src={edit}></img></button>
      
        </div>
       </div>
       <div>
       <input  accept='image/*' onChange={(event)=>{
           const file=(event.target.files[0]);
           
           if(file.size<maxSize){
           const validImageTypes = ['image/jpeg', 'image/png', 'image/webp','image/svg','image/svg+xml']; 
           if(validImageTypes.includes(file.type)){
            const fileReader=new FileReader();
            fileReader.onload=((e)=>{
                setSrc(e.target.result)
                }
                )

            fileReader.readAsDataURL(file);        
           
            fileReader.onloadend = function(e) {      
                    const Reader=new FileReader();
                    Reader.onload=((ev)=>{
                      props.fileform.current.file=ev.target.result
                      props.fileform.current.type=file.type
                      props.fileform.current.name=file.name
                      props.fileform.current.dimensions=[file.width||-1,file.height||-1]
                      props.fileform.current.size=file.size
                      console.log(props.fileform)  
                      props.callback()
                      })
                    Reader.readAsArrayBuffer(file)
            };   
           }}}} ref={file} className="text-xs w-0 h-0" type='file'/>
            
       
       </div>
      </div>
      }