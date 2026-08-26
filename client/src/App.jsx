import { lazy, Suspense } from 'react';
import { createBrowserRouter,RouterProvider } from 'react-router-dom';
import AuthScreen from './components/AuthScreen/AuthScreen';
import SignUp from './components/AuthScreen/SignUp/SignUp';
import SignIn from './components/AuthScreen/SignIn/SignIn';
import Verify from './components/AuthScreen/Verify/Verify';
import Hero from './components/Hero/Hero';
import Features from './components/Hero/Features';
import { ToastProvider } from './components/ui/Toast';

// The chat app itself (sockets, message rendering, settings, media, etc.)
// is by far the heaviest subtree - split it out of the landing/auth
// pages' bundle so a first-time visitor who never signs in never pays for it.
const ChatScreen = lazy(() => import('./components/MainScreen/AppScreen'));

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
      element:(
        <Suspense fallback={<div className="h-screen w-screen" />}>
          <ChatScreen/>
        </Suspense>
      )
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
     <RouterProvider router={router}/>
   </ToastProvider>
)}

export default App;
