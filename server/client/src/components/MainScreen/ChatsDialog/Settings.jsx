import { useState, useEffect, useCallback, useRef } from "react";
import { useCtx } from "../AppScreen";
import single from "/single.svg";
import down from "/down.svg";
import up from "/up.svg";
import setting from "/setting.svg"
export default function (props) {
  const { profiles, userID, setMessageDialog } = useCtx();
  const profile = profiles[userID.current] || {};
  const onClick = useCallback(function () {
    setMessageDialog(3);
  }, []);
  const src = profile.img ? profile.img.src : single;
  return (
        <button
          className="rounded-full border-1  outline-none border-none focus:outline-none focus:border-none"
          onClick={onClick} 
        >
          <img className=" h-6  shadow-sm rounded-full" src={setting} />
        </button>
  );
}
