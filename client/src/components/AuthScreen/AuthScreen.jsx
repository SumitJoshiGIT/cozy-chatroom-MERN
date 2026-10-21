import { Outlet, Link } from 'react-router-dom';
import icon from '/icon.svg';

export default function AuthScreen() {
  return (
    <div className="auth-shell flex flex-col h-screen w-screen justify-center items-center gap-6 px-4">
      <div className="floral-decor" aria-hidden="true">
        <span className="floral-leaf floral-leaf-1" />
        <span className="floral-leaf floral-leaf-2" />
        <span className="floral-leaf floral-leaf-3" />
        <span className="floral-leaf floral-leaf-4" />
        <span className="floral-leaf floral-leaf-5" />
        <span className="floral-leaf floral-leaf-6" />
      </div>
      <Link to="/" className="auth-brand flex items-center gap-2 animate-fade-in-up">
        <img src={icon} alt="" className="h-10 w-auto" />
        <span className="font-display text-3xl text-[var(--text)]">Lavender</span>
      </Link>
      <div className="auth-content animate-fade-in-up w-full flex justify-center" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
        <Outlet />
      </div>
    </div>
  )
}
