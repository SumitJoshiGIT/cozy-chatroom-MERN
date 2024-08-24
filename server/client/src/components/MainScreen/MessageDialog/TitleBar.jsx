import { useState, useEffect, useCallback, useRef } from "react";
import { useCtx } from "../AppScreen";
import single from "/single.svg";
import add from "/add.svg";
import down from "/down.svg";
import up from "/up.svg";
export default function (props) {
  const { profiles, userID } = useCtx();
  const profile = profiles[userID.current] || {};
  const [dropdown, setDropdown] = useState(down);
  const onClick = useCallback(function () {
    props.setDialog((prev) => (prev ? 0 : 1));
  }, []);
  const src = profile.img ? profile.img.src : single;
  return (
    <div className="text-xl  rounded-xl mt-3 flex p-3 pb-0 pl-5  justify-content items-center  w-full">
      <div className="w-full  flex justify-end">
        <div className='mr-2 overflow-hidden' style={{ display:(dropdown==down)?"flex":"none"}}>
          <button
            className="rounded-full border  focus:outline-none focus:border-none"
            onClick={onClick}
          >
            <img className="w-10 h-10 border rounded-full " src={src} />
          </button>
        </div>
        <button
          className="rounded-full  outline-none border-none focus:outline-none focus:border-none"
          onClick={() => {
           setDropdown(dropdown==down?up:down);
          }}
        >
          <img className=" h-5  rounded-full" src={dropdown} />
        </button>
      </div>
      <button></button>
    </div>
  );
}
