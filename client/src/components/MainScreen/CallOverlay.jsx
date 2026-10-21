import { useEffect, useRef, useState } from 'react';
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useIsSpeaking,
  useParticipantContext,
  useTrackRefContext,
  VideoTrack,
  isTrackReference,
  useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { apiOrigin } from '../../apiOrigin';
import { getStoredAuthToken } from '../../socketAuthToken';

async function getCallToken(cid, roomName) {
  const headers = { 'Content-Type': 'application/json' };
  const authToken = getStoredAuthToken();
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`${apiOrigin}/calls/token`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ cid, roomName }),
  });
  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message || 'Unable to join call');
  }
  return data;
}

function CallStage({ kind }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  return (
    <div className="call-stage h-full w-full">
      <div className="call-grid">
        <GridLayout tracks={tracks}>
          <ParticipantTile>
            <CallParticipantTile />
          </ParticipantTile>
        </GridLayout>
      </div>
      <ControlBar
        variation="minimal"
        controls={{
          microphone: true,
          camera: kind === 'video',
          screenShare: false,
          chat: false,
          settings: false,
          leave: false,
        }}
      />
    </div>
  );
}

function getParticipantAvatar(participant) {
  try {
    const metadata = participant.metadata ? JSON.parse(participant.metadata) : null;
    if (!metadata?.image) return null;
    return metadata.image.startsWith('http') ? metadata.image : `${apiOrigin}/${metadata.image.replace(/^\/+/, '')}`;
  } catch {
    return null;
  }
}

function CallParticipantTile() {
  const trackRef = useTrackRefContext();
  const participant = useParticipantContext();
  const speaking = useIsSpeaking(participant);
  const avatar = getParticipantAvatar(participant);
  const name = participant.name || participant.identity || 'Lavender user';
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const quality = String(participant.connectionQuality || 'unknown').toLowerCase();
  const hasVideo = isTrackReference(trackRef)
    && trackRef.publication?.kind === 'video'
    && Boolean(trackRef.publication?.track);

  return (
    <div className={`call-participant-content ${speaking ? 'call-participant-speaking' : ''}`}>
      {hasVideo ? (
        <VideoTrack trackRef={trackRef} />
      ) : (
        <div className="call-participant-avatar">
          {avatar ? (
            <img src={avatar} alt="" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
      )}
      <div className="call-participant-topline">
        <span className="call-participant-name">{name}</span>
        <span className={`call-signal call-signal-${quality}`} aria-label={`Connection: ${quality}`}>
          <i /><i /><i />
        </span>
      </div>
    </div>
  );
}

export default function CallOverlay({ socket }) {
  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [error, setError] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState(null);
  const dragRef = useRef(null);
  const callRef = useRef(null);

  useEffect(() => {
    const currentSocket = socket.current;
    if (!currentSocket) return undefined;

    const onIncoming = (data) => setIncoming(data);
    const onEnded = ({ cid }) => {
      setCall((activeCall) => activeCall?.cid === cid ? null : activeCall);
      setIncoming((pendingCall) => pendingCall?.cid === cid ? null : pendingCall);
    };

    currentSocket.on('incomingCall', onIncoming);
    currentSocket.on('callEnded', onEnded);
    return () => {
      currentSocket.off('incomingCall', onIncoming);
      currentSocket.off('callEnded', onEnded);
    };
  }, [socket]);

  useEffect(() => {
    const onStartCall = async (event) => {
      const details = event.detail;
      try {
        setError('');
        const credentials = await getCallToken(details.cid, details.roomName);
        setCall({ ...details, ...credentials });
      } catch (err) {
        setError(err.message || 'Unable to start call');
      }
    };
    window.addEventListener('lavender:start-call', onStartCall);
    return () => window.removeEventListener('lavender:start-call', onStartCall);
  }, []);

  const join = async (details) => {
    try {
      setError('');
      setIncoming(null);
      const credentials = await getCallToken(details.cid, details.roomName);
      setCall({ ...details, ...credentials });
    } catch (err) {
      setError(err.message || 'Unable to join call');
    }
  };

  const leave = () => {
    if (call) socket.current.emit('endCall', { cid: call.cid });
    setCall(null);
    setMinimized(false);
    setPosition(null);
  };

  const startDrag = (event) => {
    if (!minimized || event.button !== 0 || event.target.closest("button")) return;
    const rect = callRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    if (!dragRef.current || !callRef.current) return;
    const width = callRef.current.offsetWidth;
    const height = callRef.current.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - dragRef.current.offsetX));
    const top = Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - dragRef.current.offsetY));
    setPosition({ left, top });
  };

  const stopDrag = (event) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (call) {
    return (
      <div
        ref={callRef}
        style={minimized && position ? position : undefined}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        className={`call-shell fixed z-40 overflow-hidden ${
          minimized
            ? `call-shell-minimized h-72 w-[min(28rem,calc(100vw-2rem))] rounded-2xl shadow-2xl ${position ? "" : "bottom-5 right-5"}`
            : 'inset-0'
        }`}
      >
        <LiveKitRoom
          token={call.token}
          serverUrl={call.url}
          connect
          audio
          video={call.kind === 'video'}
          onDisconnected={leave}
        >
          <div
            className="call-header absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-3"
          >
            <span aria-hidden="true" />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMinimized((value) => !value)}
                aria-label={minimized ? 'Expand call' : 'Minimize call'}
                className="call-control"
              >
                {minimized ? '↗' : '—'}
              </button>
              <button
                type="button"
                onClick={leave}
                aria-label="End call"
                className="call-control call-end-control"
              >
                ×
              </button>
            </div>
          </div>
          <CallStage kind={call.kind} />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    );
  }

  return (
    <>
      {incoming && (
        <div className="incoming-call-card fixed right-4 top-4 z-50 w-80 p-4 text-[var(--text)]">
          <div className="flex items-center gap-3">
            <div className="incoming-call-icon flex h-10 w-10 items-center justify-center rounded-full text-lg">
              {incoming.kind === 'audio' ? '☎' : '▣'}
            </div>
            <div>
              <div className="font-semibold">{incoming.caller.name} is calling</div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">
                {incoming.kind === 'audio' ? 'Voice call' : 'Video call'}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => join(incoming)}
              className="incoming-call-answer flex-1 rounded-full px-3 py-2 text-sm font-semibold text-white"
            >
              Answer
            </button>
            <button
              type="button"
              onClick={() => setIncoming(null)}
              className="incoming-call-decline rounded-full px-3 py-2 text-sm font-semibold"
            >
              Decline
            </button>
          </div>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-600 px-4 py-2 text-sm text-white shadow-lg"
        >
          {error}
        </div>
      )}
    </>
  );
}

export function startCall(socket, chat, kind = 'video') {
  const cid = chat?._id || chat?.id;
  if (!cid) return;
  const details = { cid: String(cid), roomName: `lavender-${cid}`, kind };
  socket.current.emit('startCall', { cid: String(cid), kind });
  window.dispatchEvent(new CustomEvent('lavender:start-call', { detail: details }));
}
