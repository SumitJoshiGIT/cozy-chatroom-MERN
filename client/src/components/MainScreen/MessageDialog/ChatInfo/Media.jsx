import { useMemo } from 'react'
import placeholder from '/files.svg'
import { useCtx } from '../../AppScreen'
import { attachmentUrl } from '../../../../attachmentUrl'
import { useDecryptedAttachments } from '../../../../e2ee/attachments'

export default function Media(props){
    const { Messages, mediaToken } = useCtx();

    const items = useMemo(() => {
      const chatMessages = Messages[props.chat._id] || {};
      const out = [];
      Object.values(chatMessages).forEach((m) => {
        (m.attachments || []).forEach((a) => out.push({ ...a, mid: m._id }));
      });
      return out.reverse();
    }, [Messages, props.chat._id]);

    useDecryptedAttachments(items, mediaToken);

    if (items.length === 0) {
      return <div className='flex h-full justify-center flex-1'>
        <div className='flex pt-20 items-center flex-col text-ink-muted justify-center w-full h-full'>
                <img src={placeholder} alt='placeholder' className='w-12 h-12 text-gray-100'/>
        <p className='pt-4'>No photos or files shared yet.</p>
        </div>
      </div>
    }

    return (
      <div className="grid grid-cols-3 gap-1 p-1 overflow-y-auto flex-1">
        {items.map((a, i) => (
          <a
            key={`${a.mid}-${i}`}
            href={attachmentUrl(a, mediaToken)}
            target="_blank"
            rel="noreferrer"
            title={a.name}
            className="aspect-square rounded-md overflow-hidden bg-surface-muted animate-pop-in"
            style={{ animationDelay: `${Math.min(i, 12) * 30}ms`, animationFillMode: 'backwards' }}
          >
            {(a.contentType || '').startsWith('image/') ? (
              <img src={attachmentUrl(a, mediaToken)} alt={a.name} className="w-full h-full object-cover hover:scale-105 transition-transform" />
            ) : (a.contentType || '').startsWith('video/') ? (
              <video src={attachmentUrl(a, mediaToken)} muted className="w-full h-full object-cover" />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-ink-muted">
                <span aria-hidden="true" className="text-xl">{(a.contentType || '').startsWith('audio/') ? '🎤' : '📄'}</span>
                <span className="w-full truncate text-xs">{a.name}</span>
              </span>
            )}
          </a>
        ))}
      </div>
    )
}
