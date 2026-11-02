import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "../ui/Button";

const STEPS = [
  {
    title: "Welcome to Lavender",
    body: "Here's a quick look around. It only takes a moment.",
  },
  {
    target: ".chat-search",
    title: "Find people",
    body: "Search for someone by name or username, then select them to start a conversation.",
  },
  {
    target: '[data-tour="new-group"]',
    title: "Start a group",
    body: "Create a group chat, then invite people with a link.",
  },
  {
    title: "Your messages stay private",
    body: "Chats are end-to-end encrypted automatically, so only the people in them can read them. On a new device, approve it from one you've used before.",
  },
  {
    target: '[data-tour="missed-calls"]',
    title: "Never miss a call",
    body: "Calls you missed appear here, ready to call back.",
  },
  {
    target: '[data-tour="settings"]',
    title: "Make it yours",
    body: "Change your theme, notifications and account settings here.",
  },
  {
    title: "You're all set",
    body: "In a chat, hover over a message to react, or right-click it to reply, pin or forward. On a phone, press and hold instead. Use the buttons at the top of a chat to call.",
  },
];

const CARD_WIDTH = 340;
const CARD_HEIGHT = 210;
const GAP = 14;
const EDGE = 16;
const SPOTLIGHT_PADDING = 6;
const SIDEBAR_SETTLE_MS = 350;

const isVisible = (selector) => !!document.querySelector(selector)?.getClientRects().length;
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

function sameRect(a, b) {
  return a === b || (a && b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);
}

// Beside the target when it fits, which suits the sidebar on desktop. On a
// phone that leaves no room, so it goes below, or above near the bottom.
function cardPosition(rect) {
  const width = Math.min(CARD_WIDTH, window.innerWidth - EDGE * 2);
  const bottomLimit = window.innerHeight - CARD_HEIGHT - EDGE;
  if (rect.right + GAP + width + EDGE <= window.innerWidth) {
    return { left: rect.right + GAP, top: clamp(rect.top, EDGE, bottomLimit), width };
  }
  const below = rect.bottom + GAP;
  return {
    left: clamp(rect.left, EDGE, window.innerWidth - width - EDGE),
    top: below <= bottomLimit ? below : Math.max(EDGE, rect.top - CARD_HEIGHT - GAP),
    width,
  };
}

export default function Tutorial({ onClose }) {
  const [steps, setSteps] = useState(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const nextButton = useRef(null);

  // The sidebar starts collapsed, which hides most of what the tour points at.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("lavender:expand-sidebar"));
    const timer = setTimeout(() => {
      setSteps(STEPS.filter((step) => !step.target || isVisible(step.target)));
    }, SIDEBAR_SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);

  const step = steps?.[index];

  // Tracked every frame, so the spotlight follows resizes and animations.
  useLayoutEffect(() => {
    if (!step) return undefined;
    let frame;
    const track = () => {
      const box = step.target ? document.querySelector(step.target)?.getBoundingClientRect() : null;
      const next = box?.width ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height } : null;
      setRect((current) => (sameRect(current, next) ? current : next));
      frame = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    if (step) nextButton.current?.focus();
  }, [step]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!step) return null;
  const last = index === steps.length - 1;

  return createPortal(
    <div className="tour-layer">
      {rect ? (
        <div
          className="tour-spotlight"
          style={{
            left: rect.left - SPOTLIGHT_PADDING,
            top: rect.top - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
          }}
        />
      ) : <div className="tour-dim" />}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className={`tour-card ${rect ? "" : "is-centered"}`}
        style={rect ? cardPosition(rect) : undefined}
      >
        <p className="tour-progress">{index + 1} of {steps.length}</p>
        <h2 id="tour-title" className="tour-title">{step.title}</h2>
        <p id="tour-body" className="tour-body">{step.body}</p>
        <div className="tour-actions">
          {!last && <button type="button" className="tour-skip" onClick={onClose}>Skip tour</button>}
          <span className="flex-1" />
          {index > 0 && <Button variant="ghost" onClick={() => setIndex(index - 1)}>Back</Button>}
          <Button ref={nextButton} onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? "Get started" : index === 0 ? "Show me around" : "Next"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
