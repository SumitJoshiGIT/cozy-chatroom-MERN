import { useCtx } from "../AppScreen";
import IconButton from "../../ui/IconButton";
import add from '/add.svg'
import menu from "/options.svg"
import SettingsButton from "./Settings.jsx";

export default function (props){
    const {setMessageDialog}=useCtx();

    return( <div style={props.style?{display:'block',width:'40px'}:{}} className="text-xl   rounded-xl mt-3 flex p-2 pb-0   justify-content items-center  w-full">
         <IconButton icon={menu} alt="Toggle sidebar" onClick={()=>{props.setStyle((prev)=>!prev)}} />
         <div className="w-full  flex flex-row justify-between">
         <div className="flex items-end">
          {props.style?null:<h1 className="text-xl font-bold text-gray-700">Messages</h1>}
          </div>

         <div className="flex flex-wrap w-fit h-fit items-center gap-1">
          <SettingsButton/>
          <IconButton icon={add} alt="New group" onClick={()=>{setMessageDialog(4)}} />
         </div>
        </div>
    </div>);
}
