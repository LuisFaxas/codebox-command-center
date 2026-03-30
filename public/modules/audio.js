/* Voice notification audio playback
   Plays TTS audio from /notify-wav on trigger events */

import { subscribe } from '#state';

let audioEl = null;

function initAudio() {
  audioEl = document.createElement('audio');
  audioEl.style.display = 'none';
  document.body.appendChild(audioEl);

  subscribe('trigger', (data) => {
    const src = `/notify-wav?type=${encodeURIComponent(data.type)}&project=${encodeURIComponent(data.project)}&t=${Date.now()}`;
    audioEl.src = src;
    audioEl.load();
    audioEl.play().catch(() => {
      // Autoplay blocked until user interaction — silently fail
    });
  });
}

export { initAudio };
