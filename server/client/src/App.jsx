import { useState,useEffect } from 'react';
import { Router,RouterProvider } from 'react-router-dom';
import ChatScreen from './components/MainScreen/AppScreen';
import AuthScreen from './components/AuthScreen/AuthScreen';
//import App from './components/MainApp';


function App() {
   const [count, setCount] = useState(0)
   return <ChatScreen/>
  
}

export default App;
