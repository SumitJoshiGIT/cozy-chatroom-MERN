import { useState } from 'react'
import placeholder from '/files.svg'
export default function(){
    const files=useState([])
    console.log(88)
    return <div className='flex h-full justify-center flex-1'>
    {    
       // (files.length==0)?
        <div className='flex  pt-20 items-center flex-col text-gray-400 justify-center w-full h-full'>
                <img src={placeholder} alt='placeholder' className='w-12 h-12 text-gray-100'/>
        <p className='pt-4'>Nothing here.</p>
        </div>
        //:null
        
    }
         
    </div>
}