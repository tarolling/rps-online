import { Analytics } from "@vercel/analytics/react";
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import reportWebVitals from './reportWebVitals';
import { sendToVercelAnalytics } from './vitals';

const root = createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /><Analytics /></React.StrictMode>)

reportWebVitals(sendToVercelAnalytics);
