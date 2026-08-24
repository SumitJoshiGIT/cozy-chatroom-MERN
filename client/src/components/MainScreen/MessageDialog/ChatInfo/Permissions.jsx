import { useState, useEffect } from "react";
import { useCtx } from "../../AppScreen";
import Switch from "../../../ui/Switch";
import Spinner from "../../../ui/Spinner";

const ROWS = [
  { key: "sendMessages", label: "Send messages", body: "Who can post new messages in this group." },
  { key: "editInfo", label: "Edit chat info", body: "Who can change the group name, photo, and about text." },
  { key: "pinMessages", label: "Pin messages", body: "Who can pin or unpin messages in this group." },
];

export default function Permissions(props) {
  const { socket } = useCtx();
  const chat = props.chat;
  const [permission, setPermission] = useState(null);

  useEffect(() => {
    setPermission(null);
    socket.current.emit("getPermissions", { cid: chat._id });
  }, [chat._id]);

  useEffect(() => {
    const onPermissions = (data) => {
      if (data.cid === chat._id) setPermission(data.permission);
    };
    socket.current.on("permissions", onPermissions);
    return () => socket.current.off("permissions", onPermissions);
  }, [chat._id]);

  const setKey = (key, everyone) => {
    const value = everyone ? "everyone" : "admins";
    setPermission((prev) => ({ ...prev, [key]: value }));
    socket.current.emit("updatePermissions", { cid: chat._id, permissions: { [key]: value } });
  };

  if (!permission) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {ROWS.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-medium text-sm text-gray-800 dark:text-gray-100">{row.label}</div>
            <div className="text-xs text-gray-400">{row.body}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400">{permission[row.key] === "everyone" ? "Everyone" : "Admins only"}</span>
            <Switch
              checked={permission[row.key] === "everyone"}
              onChange={(v) => setKey(row.key, v)}
              label={row.label}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
