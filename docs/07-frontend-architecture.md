# 7. Frontend Architecture

## Routing

`client/src/App.jsx` defines the whole route tree with `react-router-dom`'s
`createBrowserRouter`:

```
/                    → Hero (public landing page)
/auth                → AuthScreen (layout: logo + centered card)
  /auth/signin        → SignIn
  /auth/signup        → SignUp
  /auth/verify         → Verify (OTP)
/app                 → ChatScreen (the actual application)
```

`/` and `/app` are deliberately separate — `/` never mounts the socket connection
or touches IndexedDB, so an unauthenticated visitor gets a normal marketing page,
not a flash of a chat UI that immediately bounces them to `/auth/signin`. The whole
app tree is wrapped once in `<ToastProvider>` (see below) so any component can
surface a notification without prop-drilling.

## One Context, not a state-management library

There's no Redux, Zustand, or Recoil here — the entire app's live state (your
profile, every chat, every loaded message, who you're currently viewing) lives in
one component, `ChatScreen` in
`client/src/components/MainScreen/AppScreen.jsx`, and is exposed to the rest of
the tree through a single React Context:

```js
const Context = createContext();
export function useCtx() { return useContext(Context); }
```

Every screen under `/app` calls `useCtx()` to reach shared state — `profiles`,
`chatdata`, `Messages`, `chatID` (which chat is open), the `socket` ref itself, and
the setters for all of them. This is a reasonable choice at this app's scale: there
aren't competing concerns that need independent stores, and a single context keeps
"where does this piece of state live" a one-line answer. The tradeoff — and it's a
real one, worth naming if asked about it — is that **every** consumer of the
context re-renders when **any** part of the shared state changes, because
`useContext` doesn't support selecting a slice. At the current message-list and
chat-list sizes that's not a perceptible problem; it's the kind of thing you'd
split into narrower contexts (or reach for a selector-based store) if a chat
regularly held thousands of messages open in the DOM at once.

## Where the socket lives

The Socket.IO client instance is created once, in a `useRef` inside `AppScreen`,
and never re-created — `io(apiOrigin, {...})` runs exactly once per mount of the
top-level chat screen. Every event handler (`socket.current.on(...)`) is registered
inside effects there too, which is what makes `AppScreen.jsx` the single place that
translates raw socket events into React state updates (see
[Chapter 5](./05-realtime-messaging.md) for the event catalog those handlers
respond to). Individual screens further down the tree only ever call
`socket.current.emit(...)` — they don't listen for their own responses, they read
the resulting state back out of the context after `AppScreen` has processed it.

## The UI component library (`client/src/components/ui/`)

Originally, every screen in this app hand-rolled its own avatar-with-fallback
logic, its own button padding/radius, its own input styling — which is exactly the
kind of duplication that lets the *same* bug (like an operator-precedence mistake
in an avatar's fallback logic) get introduced independently in five different
files. That duplication was consolidated into a small shared component set:

| Component | Purpose |
|---|---|
| `Avatar` | Image-or-fallback-icon circle, consistent sizes (`xs`–`2xl`), always `object-cover` so non-square uploads don't distort |
| `Button` | Pill button with named variants (`primary`, `dark`, `google`, `danger`, `ghost`) and a real `disabled` state |
| `IconButton` | Circular icon-only button, same size scale as `Avatar` |
| `TextField` / `TextArea` | Consistent input styling, including a real *visual* disabled state (important for read-only views like someone else's profile) |
| `Card` | The white rounded-corner panel every dialog/screen is built from |
| `Toast` / `useToast()` | App-wide notification system (see below) |
| `Switch` | Toggle control, used by Settings |
| `ComingSoon` | Placeholder panel for features that have UI affordances but aren't implemented yet, so an unfinished feature fails gracefully instead of crashing |

The point of this layer isn't DRY-for-its-own-sake — it's that a fix to, say,
`Avatar`'s fallback logic now applies everywhere at once, and a new screen gets
consistent look-and-feel by construction instead of by careful copy-pasting.

### Toasts instead of `alert()`

Error and confirmation messages used to be raw `window.alert()` calls, which block
the entire tab (including, notably, browser automation and any pending network
callbacks) until dismissed. `ToastProvider` wraps the whole app and exposes
`useToast()` → `{ error, success, info }`, rendering a stack of auto-dismissing,
non-blocking notification cards instead. This is also a smaller, contained version
of a pattern worth recognizing: any global, app-wide capability (toasts, theming,
auth state) is a good candidate for "one React Context near the root," while
screen-specific state stays local to that screen.

## Theming

Accent color is implemented as a small set of CSS custom properties
(`--accent`, `--accent-dark`, `--accent-light`, `--grad-start`, `--grad-end`),
defined once on `:root` in `index.css` and overridden at runtime by
`client/src/theme.js`:

```js
export function applyTheme(id) {
  const theme = THEMES.find(t => t.id === id) ?? THEMES[0];
  document.documentElement.style.setProperty('--accent', theme.accent);
  // ...
  localStorage.setItem('lavender-theme', theme.id);
}
```

Because Tailwind utility classes can reference CSS variables directly
(`bg-[var(--accent)]`), components don't need to know which theme is active —
they just use the variable, and swapping the variable's value at the `:root`
re-paints everything using it, with no React re-render required. `main.jsx` calls
`applyTheme(getStoredThemeId())` synchronously before the app renders, so there's
no flash of the default theme on load for a returning user.

### Dark mode

Dark mode reuses that exact pattern rather than introducing a second theming
mechanism: `theme.js` also exports `applyDarkMode`/`getStoredDarkMode`, which
toggle a `dark` class on `<html>` and persist the choice under a separate
`lavender-dark-mode` `localStorage` key. `main.jsx` calls `applyDarkMode(
getStoredDarkMode())` synchronously alongside `applyTheme`, so dark mode is
already applied before first paint, same as the accent color. Tailwind is
configured with `darkMode: 'class'` (`client/tailwind.config.js`), so components
opt in per-utility with `dark:` variants (`bg-white dark:bg-gray-800`) rather than
a second set of CSS variables — accent color and dark mode are independent axes
that compose (an accent-colored button still gets its `dark:` background).
The toggle lives in the Settings panel (`Settings.jsx`), next to the accent
theme picker.

### Per-chat wallpaper

Chat wallpaper is deliberately *not* part of the theming system above — it's
per-chat, not global, so it's keyed by chat id rather than living on `<html>`.
`client/src/wallpaper.js` stores a `{ [chatId]: css }` map in its own
`lavender-wallpapers` `localStorage` key (`css` is a ready-to-use CSS
`background` value — a gradient string or `null` for the default tiled
background image) and is purely client-side: there's no server round trip and no
`Chats` schema field for it. `MessageDialog.jsx` reads the current chat's
wallpaper on chat switch and applies it as inline `style`; the picker itself
lives in the chat's options menu (`TitleBar.jsx`).
