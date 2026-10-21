import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCtx } from "../../AppScreen";
import { post } from "../../../Axios";
import Card from "../../../ui/Card";
import IconButton from "../../../ui/IconButton";
import Button from "../../../ui/Button";
import Avatar from "../../../ui/Avatar";
import Switch from "../../../ui/Switch";
import { THEMES, applyTheme, getStoredThemeId, applyDarkMode, getStoredDarkMode } from "../../../../theme";
import { clearStoredAuthToken } from "../../../../socketAuthToken";
import { isPushSupported, getStoredPushPreference, subscribeToPush, unsubscribeFromPush } from "../../../../pushNotifications";
import close from "/close.svg";

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">{title}</div>
      <div className="bg-gray-50 rounded-xl overflow-hidden">{children}</div>
    </div>
  );
}

export default function Settings(props) {
  const { profiles, userID, socket, setMessageDialog } = useCtx();
  const profile = profiles[userID.current] || {};
  const navigate = useNavigate();
  const [themeId, setThemeId] = useState(getStoredThemeId());
  const [reduceMotion, setReduceMotion] = useState(localStorage.getItem('lavender-reduce-motion') === 'true');
  const [darkMode, setDarkMode] = useState(getStoredDarkMode());
  const [pushEnabled, setPushEnabled] = useState(getStoredPushPreference());
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');

  const togglePush = async (val) => {
    setPushError('');
    setPushBusy(true);
    try {
      if (val) {
        const ok = await subscribeToPush(socket);
        if (!ok) {
          setPushError('Notifications permission was denied or is unsupported in this browser.');
          setPushBusy(false);
          return;
        }
      } else {
        await unsubscribeFromPush(socket);
      }
      setPushEnabled(val);
    } catch (err) {
      setPushError('Something went wrong enabling notifications.');
    }
    setPushBusy(false);
  };

  const toggleDarkMode = (val) => {
    setDarkMode(val);
    applyDarkMode(val);
  };

  const pickTheme = (id) => {
    applyTheme(id);
    setThemeId(id);
  };

  const toggleReduceMotion = (val) => {
    setReduceMotion(val);
    localStorage.setItem('lavender-reduce-motion', val ? 'true' : 'false');
    document.documentElement.classList.toggle('reduce-motion', val);
  };

  const logout = async () => {
    await post('/auth/logout');
    clearStoredAuthToken();
    socket.current.disconnect();
    navigate('/auth/signin');
  };

  return (
    <Card className="max-w-md w-full h-full flex flex-col overflow-hidden animate-fade-in-up">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
        <IconButton icon={close} alt="Close" onClick={() => setMessageDialog(0)} />
        <div className="font-semibold text-lg text-gray-800">Settings</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <button
          onClick={() => setMessageDialog(3)}
          className="w-full flex items-center gap-3 p-3 mb-6 rounded-xl bg-[var(--accent-light)] hover:brightness-95 transition-all"
        >
          <Avatar src={profile.img && profile.img.src} size="md" />
          <div className="flex-1 min-w-0 text-left">
            <div className="font-semibold text-gray-800 truncate">{profile.name || "You"}</div>
            <div className="text-xs text-gray-500 truncate">{profile.about || "View and edit your profile"}</div>
          </div>
          <span className="text-gray-400 text-xl">›</span>
        </button>

        <Section title="Appearance">
          <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 dark:border-gray-700">
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Dark mode</div>
              <div className="text-xs text-gray-400">Switch to a darker color scheme</div>
            </div>
            <Switch checked={darkMode} onChange={toggleDarkMode} label="Dark mode" />
          </div>
          <div className="p-3 flex items-center gap-3 flex-wrap">
            {THEMES.map((t) => (
              <button
                key={t.id}
                aria-label={t.name}
                onClick={() => pickTheme(t.id)}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={`w-8 h-8 rounded-full block ring-offset-2 transition-all ${themeId === t.id ? 'ring-2' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${t.gradStart}, ${t.gradEnd})`, '--tw-ring-color': t.accent }}
                />
                <span className="text-[0.65rem] text-gray-500">{t.name}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Notifications">
          <div className="flex items-center justify-between px-3 py-3">
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Push notifications</div>
              <div className="text-xs text-gray-400">
                {isPushSupported() ? 'Get notified about new messages when Lavender is in the background' : 'Not supported in this browser'}
              </div>
              {pushError && <div className="text-xs text-red-500 mt-1">{pushError}</div>}
            </div>
            <Switch checked={pushEnabled} onChange={togglePush} disabled={pushBusy || !isPushSupported()} label="Push notifications" />
          </div>
        </Section>

        <Section title="Accessibility">
          <div className="flex items-center justify-between px-3 py-3">
            <div>
              <div className="text-sm font-medium text-gray-700">Reduce motion</div>
              <div className="text-xs text-gray-400">Turns off animations and transitions</div>
            </div>
            <Switch checked={reduceMotion} onChange={toggleReduceMotion} label="Reduce motion" />
          </div>
        </Section>

        <Button variant="danger" className="w-full py-2" onClick={logout}>
          Log out
        </Button>
      </div>
    </Card>
  );
}
