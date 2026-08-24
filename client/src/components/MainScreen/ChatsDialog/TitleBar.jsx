import { useCtx } from "../AppScreen";
import IconButton from "../../ui/IconButton";
import add from '/add.svg'
import menu from "/options.svg"
import starred from "/starred.svg"
import SettingsButton from "./Settings.jsx";

export default function (props){
    const {setMessageDialog}=useCtx();

    if (props.style) {
      return (
        <div className="flex flex-col items-center gap-2 w-full pb-3">
          <IconButton icon={menu} alt="Expand sidebar" onClick={()=>{props.setStyle((prev)=>!prev)}} />
          <div className="w-8 h-px bg-black/10 dark:bg-white/10" />
          <IconButton icon={starred} alt="Starred messages" onClick={()=>{setMessageDialog(6)}} />
          <SettingsButton/>
          <IconButton icon={add} alt="New group" onClick={()=>{setMessageDialog(4)}} />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between w-full pb-3">
        <div className="flex items-center gap-2">
          <IconButton icon={menu} alt="Collapse sidebar" onClick={()=>{props.setStyle((prev)=>!prev)}} />
          <h1 className="text-xl font-bold text-gray-700 dark:text-gray-100">Messages</h1>
        </div>
        <div className="flex items-center gap-1">
          <IconButton icon={starred} alt="Starred messages" onClick={()=>{setMessageDialog(6)}} />
          <SettingsButton/>
          <IconButton icon={add} alt="New group" onClick={()=>{setMessageDialog(4)}} />
        </div>
      </div>
    );
}
