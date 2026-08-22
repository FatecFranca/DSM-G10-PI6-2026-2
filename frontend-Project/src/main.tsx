import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from './App'
import { AuthProvider } from './state/AuthContext'
import { I18nProvider } from './state/I18nContext'
import { ThemeProvider } from './state/ThemeContext'
import { ToastProvider } from './state/ToastContext'

import './css/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeProvider>
            <I18nProvider>
                <ToastProvider>
                    <BrowserRouter>
                        <AuthProvider>
                            <App />
                        </AuthProvider>
                    </BrowserRouter>
                </ToastProvider>
            </I18nProvider>
        </ThemeProvider>
    </React.StrictMode>
)
