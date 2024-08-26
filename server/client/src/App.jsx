import { useState,useEffect, useRef } from 'react';
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
    },
    {
      path:"/",
      element:<ChatScreen/>
    },
  
  ]
)

function App() {
  const token=useRef('')
 /* useEffect(()=>{
    setInterval(async()=>{ 
       await get('/auth/token').then(res=>{token.current=res.token})
    },6400)
},[])*/ 
  return (
   <RouterProvider router={router}/>
 
)}

export default App;
