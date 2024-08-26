import { useState, useEffect, useCallback, useRef } from "react";
import { useCtx } from "../AppScreen";
import single from "/single.svg";
import down from "/down.svg";
import up from "/up.svg";
export default function (props) {
  const { profiles, userID,setMessageDialog } = useCtx();
  const profile = profiles[userID.current] || {};
  const [dropdown, setDropdown] = useState(up);
  const onClick = useCallback(function () {
    setMessageDialog(3);
  }, []);
  const src = profile.img ? profile.img.src : single;
  return (
    <div className="text-xl  rounded-xl mt-1 ml-2 p-1 flex pr-3  pl-5  gradient-2 justify-content items-center">
      <span style={{fontFamily:"Pacifico,cursive"}} className="mr-2">Lavender</span>
      <div className="w-full  flex justify-end">
        <div className='mr-2 overflow-hidden' style={{ display:(dropdown==down)?"flex":"none"}}>
          <button
            className="rounded-full "
            onClick={onClick}
          >
            <img className="w-8  h-8   rounded-full " src={src} />
          </button>
        </div>
        <button 
          className="rounded-full border-1  outline-none border-none focus:outline-none focus:border-none"
          onClick={() => {
           setDropdown(dropdown==down?up:down);
          }}
        >
          <img className=" h-5  shadow-sm rounded-full" src={dropdown} />
        </button>
      </div>
      
    </div>
  );
}
