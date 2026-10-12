import './themes/tokens.css'
import './themes/app.css'
import './themes/document.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { reportStatusToMain } from './state/documentStore'

reportStatusToMain()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
