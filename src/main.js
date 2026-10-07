import './style.css';
import { setupUI } from './ui.js';
import { runPipeline } from './pipeline.js';

function start() {
  setupUI({ onStart: runPipeline });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
