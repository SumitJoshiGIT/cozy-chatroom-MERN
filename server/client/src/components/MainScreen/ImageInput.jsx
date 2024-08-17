import React,{useRef,useEffect, useState} from "react";
import edit from '/edit.svg'
const maxSize=2*1024*1024;
export default function(props){ 
    const [src,setSrc]=useState(props.src);
    const file=useRef();

return  <div className='border-1 w-fit h-fit flex items-baseline rounded-full'>
      <img className=" p-1 h-36 w-36  border rounded-full" src={src}></img> 
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
            
       {(props.uneditable)?'':<button className="outline-none active:outline-none" onClick={()=>{file.current.click()}}><img className='w-4' src={edit}></img></button>}
       </div>
      </div>
      }