import Entity from "./Entity.jsx";
import { useState,useEffect } from "react";
export default function Members(props) {
  const [members, setMembers] = useState(props.chat.users||[]);
  useEffect(() => {
    setMembers(props.chat.users||[]);
  }, [props.chat]);
  console.log(members,props.chat.users)
  return (
    <div className=" overflow-y-scroll w-auto max-w-82">
      {new Array(...members).map((data) => {
        return (
          <Entity
            key={data}
            members={members}
            admin={props.admin}
            setMembers={setMembers}
            id={data}
            chat={props.chat}
          />
        );
      })}
    </div>
  );
}
