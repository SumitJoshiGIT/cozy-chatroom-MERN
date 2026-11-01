export function startCall(socket, chat, kind = 'video') {
  const cid = chat?._id || chat?.id;
  if (!cid) return;
  const details = { cid: String(cid), roomName: `lavender-${cid}`, kind };
  socket.current.emit('startCall', { cid: String(cid), kind });
  window.dispatchEvent(new CustomEvent('lavender:start-call', { detail: details }));
}
