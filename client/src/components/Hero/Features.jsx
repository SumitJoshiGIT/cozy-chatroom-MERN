import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import icon from '/icon.svg';

const GROUPS = [
  {
    label: 'Messaging',
    items: [
      { emoji: '💬', name: 'Direct & group chats', text: 'Message one person or a whole group — same fast, focused composer either way.' },
      { emoji: '↩️', name: 'Reply, edit & delete', text: 'Quote a message to reply, fix a typo after sending, or take a message back.' },
      { emoji: '😄', name: 'Reactions', text: 'Drop a quick reaction on any message instead of typing a whole reply.' },
      { emoji: '📌', name: 'Pin & star', text: 'Pin what the group needs to see, star what you want to find again later.' },
      { emoji: '✍️', name: 'Typing indicators', text: "See when someone's mid-reply, in real time." },
      { emoji: '✔✔', name: 'Read receipts', text: 'Your tick turns purple the moment they\'ve actually seen it.' },
    ],
  },
  {
    label: 'Media & files',
    items: [
      { emoji: '🖼️', name: 'Photos & videos', text: 'Share a photo or a clip, previewed right in the chat.' },
      { emoji: '🎤', name: 'Voice messages', text: 'Hold to record, then play it back with a proper scrubber — no more silent walls of text.' },
      { emoji: '📄', name: 'Documents & zips', text: 'Send a PDF, spreadsheet, or zip file the same way you\'d send a photo.' },
      { emoji: '🙂', name: 'Emoji picker', text: 'Every emoji you actually use, sorted into categories, one tap from the composer.' },
    ],
  },
  {
    label: 'Location',
    items: [
      { emoji: '📍', name: 'Current location', text: 'Drop a pin on an interactive map — one tap, no typing an address.' },
      { emoji: '🔴', name: 'Live location', text: 'Share where you are for 15 minutes, an hour, or 8 — the map follows you until you stop it.' },
    ],
  },
  {
    label: 'Groups',
    items: [
      { emoji: '👥', name: 'Full member management', text: 'Add people, remove them, promote trusted members to admin.' },
      { emoji: '🔐', name: 'Granular permissions', text: 'Decide who can send messages, edit group info, or pin things — not just "admins vs. everyone".' },
    ],
  },
  {
    label: 'Finding things',
    items: [
      { emoji: '🔎', name: 'Search everything', text: 'One search box for people, chats, and message content — no separate modes to remember.' },
    ],
  },
  {
    label: 'Privacy',
    items: [
      { emoji: '🚫', name: 'Block & report', text: 'Stop hearing from someone, or flag a message, chat, or person that needs a look.' },
    ],
  },
  {
    label: 'Make it yours',
    items: [
      { emoji: '🎨', name: '5 accent colors + dark mode', text: 'Lavender, Rose, Ocean, Forest, or Sunset — light or dark, your call.' },
      { emoji: '🪪', name: 'Your profile, your way', text: 'Photo, name, username, and an about line that\'s actually yours.' },
    ],
  },
];

function DayDivider({ children }) {
  return (
    <div className="flex items-center justify-center my-2">
      <span className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-500 dark:text-gray-400 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
        {children}
      </span>
    </div>
  );
}

export default function Features() {
  return (
    <div className="w-full min-h-screen">
      <div className="max-w-4xl mx-auto px-6 pt-14 pb-24">

        <Link to="/" className="inline-flex items-center gap-2 text-sm text-purple-950/60 hover:text-purple-950 transition-colors">
          <img src={icon} alt="" className="h-6 w-auto" />
          Lavender
        </Link>

        <h1 className="font-display text-5xl md:text-6xl text-purple-950 mt-6 leading-none animate-fade-in-up" style={{ animationFillMode: 'backwards' }}>
          Everything inside
        </h1>
        <p className="text-lg text-purple-950/70 mt-4 max-w-xl animate-fade-in-up" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
          Not a feature checklist for its own sake — just what's actually in the app, so you know it's there before you go looking for it.
        </p>

        <div className="flex gap-3 mt-8 animate-fade-in-up" style={{ animationDelay: '140ms', animationFillMode: 'backwards' }}>
          <Button as={Link} to="/auth/signup" className="px-6 py-2 text-base">
            Get started
          </Button>
          <Button as={Link} to="/" variant="ghost" className="px-6 py-2 text-base">
            Back home
          </Button>
        </div>

        <div className="mt-16 flex flex-col gap-1">
          {GROUPS.map((group, gi) => (
            <div key={group.label}>
              <DayDivider>{group.label}</DayDivider>
              <div className="grid sm:grid-cols-2 gap-3">
                {group.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-start gap-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 animate-fade-in-up"
                    style={{ animationDelay: `${180 + gi * 40}ms`, animationFillMode: 'backwards' }}
                  >
                    <span className="text-2xl leading-none shrink-0" aria-hidden="true">{item.emoji}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-purple-950 dark:text-purple-100 text-sm">{item.name}</div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
