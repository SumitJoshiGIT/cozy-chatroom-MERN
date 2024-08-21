import { useState,useEffect } from 'react';
import { createBrowserRouter,RouterProvider } from 'react-router-dom';
import ChatScreen from './components/MainScreen/AppScreen';
import AuthScreen from './components/AuthScreen/AuthScreen';
import SignUp from './components/AuthScreen/SignUp/SignUp';
import SignIn from './components/AuthScreen/SignIn/SignIn';
import Verify from './components/AuthScreen/Verify/Verify';

//import App from './components/MainApp';
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
    },]
)

function App() {
   return <RouterProvider router={router}/>
}

export default App;
