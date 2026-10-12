import '@milkdown/kit/prose/view/style/prosemirror.css'
import '@milkdown/kit/prose/gapcursor/style/gapcursor.css'
import '@milkdown/crepe/theme/common/code-mirror.css'
import '@milkdown/crepe/theme/common/table.css'
import './themes/tokens.css'
import './themes/app.css'
import './themes/document.css'
import './themes/components.css'
import './themes/workspace.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { reportStatusToMain } from './state/documentStore'
import { startAutosave, startDraftKeeper } from './state/persistence'
import { startSettings } from './state/settingsStore'

startSettings()
reportStatusToMain()
startAutosave()
startDraftKeeper()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
