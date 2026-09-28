import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { startStatistiek } from './statistiek'
import { startFoutmelder } from './foutmelder'
import Foutvanger from './components/Foutvanger'
import { vervangOudeNamenOpTelefoon } from './oudeNamen'

startStatistiek()
startFoutmelder()
vervangOudeNamenOpTelefoon()

// Geladen: de herlaad-beveiliging uit index.html mag weer, en het ?v=… uit het adres weg
try {
  sessionStorage.removeItem('hockey_herladen')
} catch {
  // geen opslag: niets aan de hand
}
if (window.location.search.includes('v=')) history.replaceState(null, '', window.location.pathname + window.location.hash)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Foutvanger>
      <App />
    </Foutvanger>
  </React.StrictMode>,
)
