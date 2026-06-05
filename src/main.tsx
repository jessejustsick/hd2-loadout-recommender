import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { planetService } from '@/services/planets'
import { AuthProvider } from '@/context/AuthContext'
import App from './App'
import './styles/tokens.css'
import './styles/global.css'

planetService.prefetch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
