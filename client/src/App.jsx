import { createBrowserRouter,RouterProvider } from 'react-router-dom';
import ChatScreen from './components/MainScreen/AppScreen';
import AuthScreen from './components/AuthScreen/AuthScreen';
import SignUp from './components/AuthScreen/SignUp/SignUp';
import SignIn from './components/AuthScreen/SignIn/SignIn';
import Verify from './components/AuthScreen/Verify/Verify';
import Hero from './components/Hero/Hero';
import { ToastProvider } from './components/ui/Toast';

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

  ]
)

function App() {
  return (
   <ToastProvider>
     <RouterProvider router={router}/>
   </ToastProvider>
)}

export default App;
