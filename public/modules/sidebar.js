/* Config sidebar — voice selection, template editing, rate/pitch controls
   Source: 05-UI-SPEC.md Component 4 */

import { state, subscribe, setConfig } from '#state';

const VOICES = [
  'en-US-GuyNeural',
  'en-US-EricNeural',
  'en-US-ChristopherNeural',
  'en-US-RogerNeural',
  'en-US-SteffanNeural',
  'en-US-AndrewNeural',
  'en-US-BrianNeural'
];

let sidebarEl = null;
let activeTab = 'done';
let saveTimer = null;

function shortName(voice) {
  return voice.replace('en-US-', '').replace('Neural', '');
}

function currentConfig() {
  return state.config[activeTab] || { voice: VOICES[0], template: '', rate: '+0%', pitch: '+0Hz' };
}

function initSidebar() {
  sidebarEl = document.getElementById('sidebar');
  if (!sidebarEl) return;

  const content = sidebarEl.querySelector('.sidebar-content');
  if (!content) return;

  content.innerHTML = buildSidebarHTML();
  bindEvents(content);
  loadTab();

  subscribe('config:update', () => {
    loadTab();
  });
}

function buildSidebarHTML() {
  return `
    <div class="sidebar-section">
      <h2 class="sidebar-section-title">Voice Settings</h2>
      <div class="tab-switcher">
        <button class="tab-btn active" data-tab="done">Done</button>
        <button class="tab-btn" data-tab="question">Question</button>
      </div>
      <div class="voice-grid">
        ${VOICES.map(v => `<button class="voice-option" data-voice="${v}">${shortName(v)}</button>`).join('')}
      </div>
    </div>
    <hr class="sidebar-divider">
    <div class="sidebar-section">
      <h2 class="sidebar-section-title">Message Templates</h2>
      <textarea class="template-textarea" rows="4" placeholder="Hey, {project} is done!"></textarea>
    </div>
    <hr class="sidebar-divider">
    <div class="sidebar-section">
      <div class="slider-group">
        <div class="slider-header">
          <span class="slider-label">Rate</span>
          <span class="slider-value rate-value">+0%</span>
        </div>
        <input type="range" class="rate-slider" min="-50" max="50" value="0">
      </div>
      <div class="slider-group">
        <div class="slider-header">
          <span class="slider-label">Pitch</span>
          <span class="slider-value pitch-value">+0Hz</span>
        </div>
        <input type="range" class="pitch-slider" min="-50" max="50" value="0">
      </div>
    </div>
    <hr class="sidebar-divider">
    <div class="sidebar-section">
      <button class="generate-btn glass-subtle">Generate Voice Samples</button>
      <div class="sample-list" style="margin-top:var(--space-sm)"></div>
    </div>
  `;
}

function bindEvents(content) {
  // Tab switching
  content.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      loadTab();
    });
  });

  // Voice selection
  content.querySelectorAll('.voice-option').forEach(btn => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.voice-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      saveConfig();
    });
  });

  // Template editing (debounced)
  const textarea = content.querySelector('.template-textarea');
  if (textarea) {
    textarea.addEventListener('input', () => debouncedSave());
    textarea.addEventListener('blur', () => saveConfig());
  }

  // Rate slider
  const rateSlider = content.querySelector('.rate-slider');
  const rateValue = content.querySelector('.rate-value');
  if (rateSlider) {
    rateSlider.addEventListener('input', () => {
      const v = parseInt(rateSlider.value);
      rateValue.textContent = (v >= 0 ? '+' : '') + v + '%';
      debouncedSave();
    });
  }

  // Pitch slider
  const pitchSlider = content.querySelector('.pitch-slider');
  const pitchValue = content.querySelector('.pitch-value');
  if (pitchSlider) {
    pitchSlider.addEventListener('input', () => {
      const v = parseInt(pitchSlider.value);
      pitchValue.textContent = (v >= 0 ? '+' : '') + v + 'Hz';
      debouncedSave();
    });
  }

  // Generate samples
  const generateBtn = content.querySelector('.generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', generateSamples);
  }
}

function loadTab() {
  if (!sidebarEl) return;
  const cfg = currentConfig();

  // Update voice selection
  sidebarEl.querySelectorAll('.voice-option').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.voice === cfg.voice);
  });

  // Update template
  const textarea = sidebarEl.querySelector('.template-textarea');
  if (textarea) textarea.value = cfg.template || '';

  // Update rate slider
  const rateSlider = sidebarEl.querySelector('.rate-slider');
  const rateValue = sidebarEl.querySelector('.rate-value');
  if (rateSlider && cfg.rate) {
    const rateNum = parseInt(cfg.rate);
    rateSlider.value = isNaN(rateNum) ? 0 : rateNum;
    if (rateValue) rateValue.textContent = cfg.rate;
  }

  // Update pitch slider
  const pitchSlider = sidebarEl.querySelector('.pitch-slider');
  const pitchValue = sidebarEl.querySelector('.pitch-value');
  if (pitchSlider && cfg.pitch) {
    const pitchNum = parseInt(cfg.pitch);
    pitchSlider.value = isNaN(pitchNum) ? 0 : pitchNum;
    if (pitchValue) pitchValue.textContent = cfg.pitch;
  }
}

function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveConfig, 500);
}

function getFormValues() {
  const selected = sidebarEl.querySelector('.voice-option.selected');
  const voice = selected ? selected.dataset.voice : VOICES[0];
  const template = sidebarEl.querySelector('.template-textarea')?.value || '';
  const rateSlider = sidebarEl.querySelector('.rate-slider');
  const pitchSlider = sidebarEl.querySelector('.pitch-slider');
  const rateNum = rateSlider ? parseInt(rateSlider.value) : 0;
  const pitchNum = pitchSlider ? parseInt(pitchSlider.value) : 0;
  const rate = (rateNum >= 0 ? '+' : '') + rateNum + '%';
  const pitch = (pitchNum >= 0 ? '+' : '') + pitchNum + 'Hz';
  return { voice, template, rate, pitch };
}

async function saveConfig() {
  clearTimeout(saveTimer);
  const { voice, template, rate, pitch } = getFormValues();

  try {
    const res = await fetch('/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: activeTab, voice, template, rate, pitch })
    });
    if (res.ok) {
      // Update local state
      const updated = { ...state.config };
      updated[activeTab] = { voice, template, rate, pitch };
      setConfig(updated);
    }
  } catch (e) {
    // Save failed silently
  }
}

async function generateSamples() {
  const { template } = getFormValues();
  const btn = sidebarEl.querySelector('.generate-btn');
  const sampleList = sidebarEl.querySelector('.sample-list');

  if (btn) btn.textContent = 'Generating...';

  try {
    await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: template || 'Hello, this is a test' })
    });

    const res = await fetch('/samples');
    const samples = await res.json();

    if (sampleList) {
      sampleList.innerHTML = samples.map(file => {
        const name = file.replace('.wav', '').replace('en-US-', '').replace('Neural', '');
        return `<div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <button class="sample-play glass-subtle" data-file="${file}" style="width:32px;height:32px;border:1px solid var(--border-thin);border-radius:8px;background:rgba(255,255,255,0.03);cursor:pointer;color:var(--text-primary);font-size:14px">&#9654;</button>
          <span style="font-size:14px;color:var(--text-primary)">${name}</span>
        </div>`;
      }).join('');

      // Bind play buttons
      sampleList.querySelectorAll('.sample-play').forEach(playBtn => {
        playBtn.addEventListener('click', () => {
          const audio = new Audio(`/wav/${playBtn.dataset.file}?t=${Date.now()}`);
          audio.play().catch(() => {});
        });
      });
    }
  } catch (e) {
    // Generation failed silently
  } finally {
    if (btn) btn.textContent = 'Generate Voice Samples';
  }
}

export { initSidebar };
