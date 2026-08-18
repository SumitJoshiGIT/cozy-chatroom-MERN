import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { applyTheme, getStoredThemeId, applyDarkMode, getStoredDarkMode } from './theme.js'

applyTheme(getStoredThemeId());
applyDarkMode(getStoredDarkMode());
if (localStorage.getItem('lavender-reduce-motion') === 'true') {
  document.documentElement.classList.add('reduce-motion');
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />

)
