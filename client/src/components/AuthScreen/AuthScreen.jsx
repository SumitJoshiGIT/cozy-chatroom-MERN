import { Outlet, Link } from 'react-router-dom';
import icon from '/icon.svg';

export default function AuthScreen() {
  return (
    <div className="flex flex-col h-screen w-screen justify-center items-center gap-6 px-4">
      <Link to="/" className="flex items-center gap-2 animate-fade-in-up">
        <img src={icon} alt="" className="h-10 w-auto" />
        <span className="font-display text-3xl text-purple-950">Lavender</span>
      </Link>
      <div className="animate-fade-in-up w-full flex justify-center" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
        <Outlet />
      </div>
    </div>
  )
}
