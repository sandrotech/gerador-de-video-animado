import React from 'react';
import {createRoot} from 'react-dom/client';
import {StudioApp} from './StudioApp';
import './studio.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <StudioApp />
    </React.StrictMode>
  );
}

