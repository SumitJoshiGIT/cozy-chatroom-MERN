export function startCall(socket, chat, kind = 'video') {
  const cid = chat?._id || chat?.id;
  if (!cid) return;
  const fail = (message) => window.dispatchEvent(new CustomEvent('lavender:call-error', { detail: message }));
  socket.current.timeout(6000).emit('startCall', { cid: String(cid), kind }, (timedOut, result) => {
    if (timedOut) return fail('Could not place the call. Check your connection.');
    if (!result?.ok) return fail(result?.message || 'Could not place the call.');
    const detail = { cid: String(cid), roomName: `lavender-${cid}`, kind: result.kind, ringing: result.ringing };
    window.dispatchEvent(new CustomEvent('lavender:start-call', { detail }));
  });
}
