import { useCallback } from "react";
import { useCtx } from "../AppScreen";
import IconButton from "../../ui/IconButton";
import setting from "/setting.svg"

export default function (props) {
  const { setMessageDialog } = useCtx();
  const onClick = useCallback(function () {
    setMessageDialog(5);
  }, []);
  return <IconButton icon={setting} alt="Settings" onClick={onClick} />;
}
