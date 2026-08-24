import { useState, useRef, useEffect } from "react";
import emojiAdd from "/emoji-add.svg";

const CATEGORIES = {
  "Smileys": ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","😍","🥰","😘","😗","😋","😛","😜","🤪","🤨","🧐","🤓","😎","🥳","😏","😒","😞","😔","😟","😕","🙁","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😴","🤤","😷","🤒","🤕"],
  "Gestures": ["👍","👎","👌","✌️","🤞","🤟","🤘","👏","🙌","👐","🤝","🙏","💪","👋","🤚","✋","🖐️","👆","👇","👈","👉","☝️","✊","👊"],
  "Hearts": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","💕","💞","💓","💗","💖","💘","💝","💟"],
  "Animals": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🦄","🐝","🦋","🐢","🐍"],
  "Food": ["🍎","🍊","🍋","🍌","🍉","🍇","🍓","🍒","🍑","🍍","🥑","🍅","🌶️","🌽","🥕","🍕","🍔","🍟","🌭","🍿","🍩","🍪","🎂","🍰","🍫","🍬","🍭","☕","🍵","🍺","🍷"],
  "Activities": ["⚽","🏀","🏈","⚾","🎾","🏐","🎱","🏓","🎮","🎲","🎯","🎨","🎬","🎤","🎧","🎸","🎉","🎊","🎁","🏆"],
  "Travel": ["🚗","🚕","🚙","🚌","🚀","✈️","🚢","⛵","🏠","🏢","🌍","🗺️","🏖️","⛰️","🌋","🗽","🌉","🌙","⭐","☀️","⛅","🌧️","⚡","🔥","❄️"],
  "Symbols": ["✨","🎈","💯","✅","❌","❓","❗","💤","💬","💭","🔔","🔒","🔑","⏰","📌","📎","✏️","📷","🎵","💡"],
};

export default function EmojiPicker({ onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Insert emoji"
        className="rounded-full p-1.5 h-fit hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all"
      >
        <img src={emojiAdd} alt="" className="w-6 h-6 opacity-70 dark:invert dark:opacity-80" />
      </button>
      {open && (
        <div className="absolute z-30 bottom-12 left-0 w-72 h-72 overflow-y-auto rounded-2xl shadow-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-2">
          {Object.entries(CATEGORIES).map(([category, emojis]) => (
            <div key={category} className="mb-2">
              <div className="text-[0.65rem] font-semibold text-gray-400 dark:text-gray-500 px-1 mb-1">{category}</div>
              <div className="grid grid-cols-8 gap-0.5">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onPick(emoji);
                      setOpen(false);
                    }}
                    className="text-lg leading-none p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
