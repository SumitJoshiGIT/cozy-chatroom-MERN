import { useMemo } from 'react'
import placeholder from '/files.svg'
import { useCtx } from '../../AppScreen'
import { apiOrigin } from '../../../../apiOrigin'

export default function Media(props){
    const { Messages } = useCtx();

    const items = useMemo(() => {
      const chatMessages = Messages[props.chat._id] || {};
      const out = [];
      Object.values(chatMessages).forEach((m) => {
        (m.attachments || []).forEach((a) => out.push({ ...a, mid: m._id }));
      });
      return out.reverse();
    }, [Messages, props.chat._id]);

    if (items.length === 0) {
      return <div className='flex h-full justify-center flex-1'>
        <div className='flex pt-20 items-center flex-col text-gray-400 justify-center w-full h-full'>
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
            href={`${apiOrigin}/${a.src}`}
            target="_blank"
            rel="noreferrer"
            className="aspect-square rounded-md overflow-hidden bg-gray-100 animate-pop-in"
            style={{ animationDelay: `${Math.min(i, 12) * 30}ms`, animationFillMode: 'backwards' }}
          >
            <img src={`${apiOrigin}/${a.src}`} alt={a.name} className="w-full h-full object-cover hover:scale-105 transition-transform" />
          </a>
        ))}
      </div>
    )
}
