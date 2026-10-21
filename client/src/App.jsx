import React from 'react';
import { createBrowserRouter,RouterProvider } from 'react-router-dom';
import ChatScreen from './components/MainScreen/AppScreen';
import AuthScreen from './components/AuthScreen/AuthScreen';
import SignUp from './components/AuthScreen/SignUp/SignUp';
import SignIn from './components/AuthScreen/SignIn/SignIn';
import Verify from './components/AuthScreen/Verify/Verify';
import Hero from './components/Hero/Hero';
import Features from './components/Hero/Features';
import { ToastProvider } from './components/ui/Toast';

class AppErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ui] render failed', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="flex min-h-screen w-screen items-center justify-center bg-[var(--surface-muted)] px-6 text-center text-[var(--text)]">
        <section className="glass-card max-w-md rounded-3xl border border-[var(--border)] p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-light)] text-xl text-[var(--accent-dark)]">!</div>
          <h1 className="font-display text-2xl">A quiet moment, please</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Lavender ran into an unexpected problem. Your saved conversations are safe.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-dark)]"
          >
            Refresh Lavender
          </button>
        </section>
      </main>
    );
  }
}

const router=createBrowserRouter([
    {
      path:"/auth",
      element:<AuthScreen/>,
      children:[
           {path:"signin",
           element:<SignIn/>},

           {path:"signup",
            element:<SignUp/>},
           {path:"verify",
               element:<Verify/>}
         ]
    },
    {
      path:"/app",
      element:<ChatScreen/>
    },
    {
      path:"/",
      element:<Hero/>
    },
    {
      path:"/features",
      element:<Features/>
    },

  ]
)

function App() {
  return (
   <ToastProvider>
     <AppErrorBoundary>
       <RouterProvider router={router}/>
     </AppErrorBoundary>
   </ToastProvider>
)}

export default App;
