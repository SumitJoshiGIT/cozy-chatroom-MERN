import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import icon from '/icon.svg';

const CONVO = [
  { mine: false, name: 'Priya', color: '#c084fc', text: "you free to look at the mockups tonight?" },
  { mine: true, text: "yep! sending you the files now" },
  { mine: true, attachment: true },
  { mine: false, name: 'Priya', color: '#c084fc', text: "omg these are so good 😍" },
];

export default function Hero() {
  return (
    <div className="w-full min-h-screen overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-24 grid md:grid-cols-2 gap-16 items-center">

        <div className="flex flex-col items-start text-left">
          <img
            src={icon}
            alt="Lavender"
            className="h-44 w-auto -ml-9 -mb-4 animate-sway"
            style={{ transformOrigin: '50% 90%' }}
          />
          <h1 className="font-display text-6xl md:text-7xl text-purple-950 mt-4 leading-none animate-fade-in-up" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
            Lavender
          </h1>
          <p className="text-lg text-purple-950/70 mt-4 max-w-sm animate-fade-in-up" style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}>
            One quiet place for the conversations that matter — just you, your people, and nothing competing for your attention.
          </p>

          <div className="flex gap-3 mt-8 animate-fade-in-up" style={{ animationDelay: '240ms', animationFillMode: 'backwards' }}>
            <Button as={Link} to="/auth/signup" className="px-6 py-2 text-base">
              Get started
            </Button>
            <Button as={Link} to="/auth/signin" variant="ghost" className="px-6 py-2 text-base">
              Sign in
            </Button>
          </div>

          <dl className="flex gap-6 mt-14 text-sm text-purple-950/60 animate-fade-in-up" style={{ animationDelay: '320ms', animationFillMode: 'backwards' }}>
            <div>
              <dt className="font-semibold text-purple-950">Groups</dt>
              <dd>as easily as a DM</dd>
            </div>
            <div>
              <dt className="font-semibold text-purple-950">Photos & files</dt>
              <dd>previewed instantly</dd>
            </div>
            <div>
              <dt className="font-semibold text-purple-950">Everywhere</dt>
              <dd>synced in real time</dd>
            </div>
          </dl>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 bg-white/40 rounded-[2rem] blur-2xl" aria-hidden="true" />
          <div className="relative bg-white rounded-2xl shadow-2xl p-4 flex flex-col gap-2 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
            {CONVO.map((m, i) => (
              <div
                key={i}
                className={`flex items-end gap-2 animate-fade-in-up ${m.mine ? 'flex-row-reverse' : ''}`}
                style={{ animationDelay: `${500 + i * 450}ms`, animationFillMode: 'backwards' }}
              >
                {!m.mine && <Avatar size="xs" />}
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm ${m.mine ? 'bg-[#EEFFDE] rounded-br-sm' : 'bg-gray-100 rounded-bl-sm'}`}
                >
                  {!m.mine && <div className="text-xs font-bold" style={{ color: m.color }}>{m.name}</div>}
                  {m.attachment ? (
                    <div className="w-32 h-20 rounded-lg bg-gradient-to-br from-purple-200 to-pink-200 mt-0.5" />
                  ) : (
                    m.text
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
