/* Session card rendering with Embla Carousel */

import EmblaCarousel from 'embla-carousel';
import { subscribe, setSelectedSession, state, getSession } from '#state';
import { escapeHtml, formatRelativeTime, statusLabel } from '#utils';

const DEVICE_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="9" rx="1.5"/><path d="M5 14h6M8 11v3"/></svg>';

let grid = null;
let emblaApi = null;
let emblaRoot = null;
let emblaContainer = null;
let dotsContainer = null;
let prevBtn = null;
let nextBtn = null;
let durationInterval = null;

function getPreviewText(session) {
  if (session.status === 'attention' && session.questionText) {
    return escapeHtml(session.questionText);
  }
  switch (session.status) {
    case 'done': return 'Completed';
    case 'working': return 'Working...';
    case 'stale': return 'Inactive';
    default: return 'Working...';
  }
}

function setupEmblaStructure() {
  if (!grid) return;

  // Viewport wrapper for arrows positioning
  const viewport = document.createElement('div');
  viewport.className = 'embla__viewport';

  emblaRoot = document.createElement('div');
  emblaRoot.className = 'embla';

  emblaContainer = document.createElement('div');
  emblaContainer.className = 'embla__container';

  emblaRoot.appendChild(emblaContainer);
  viewport.appendChild(emblaRoot);

  // Prev arrow
  prevBtn = document.createElement('button');
  prevBtn.className = 'embla__btn embla__btn--prev';
  prevBtn.setAttribute('aria-label', 'Previous sessions');
  prevBtn.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

  // Next arrow
  nextBtn = document.createElement('button');
  nextBtn.className = 'embla__btn embla__btn--next';
  nextBtn.setAttribute('aria-label', 'Next sessions');
  nextBtn.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>';

  viewport.appendChild(prevBtn);
  viewport.appendChild(nextBtn);
  grid.appendChild(viewport);

  dotsContainer = document.createElement('div');
  dotsContainer.className = 'embla__dots';
  grid.appendChild(dotsContainer);
}

function initEmbla() {
  if (!emblaRoot) return;

  emblaApi = EmblaCarousel(emblaRoot, {
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false
  });

  emblaApi.on('init', updateNavigation);
  emblaApi.on('reInit', updateNavigation);
  emblaApi.on('select', updateNavigation);

  if (prevBtn) prevBtn.addEventListener('click', () => emblaApi.scrollPrev());
  if (nextBtn) nextBtn.addEventListener('click', () => emblaApi.scrollNext());
}

function updateNavigation() {
  if (!emblaApi) return;

  // Update dots
  if (dotsContainer) {
    const scrollSnaps = emblaApi.scrollSnapList();
    const selectedIndex = emblaApi.selectedScrollSnap();

    dotsContainer.innerHTML = scrollSnaps.map((_, i) => {
      const activeClass = i === selectedIndex ? ' active' : '';
      return `<button class="embla__dot${activeClass}" aria-label="Go to slide ${i + 1}"></button>`;
    }).join('');

    dotsContainer.querySelectorAll('.embla__dot').forEach((dot, i) => {
      dot.addEventListener('click', () => emblaApi.scrollTo(i));
    });
  }

  // Update arrow states
  if (prevBtn) prevBtn.classList.toggle('disabled', !emblaApi.canScrollPrev());
  if (nextBtn) nextBtn.classList.toggle('disabled', !emblaApi.canScrollNext());
}

function renderCard(session) {
  if (!emblaContainer) return;

  let slide = emblaContainer.querySelector(`[data-session-id="${session.sessionId}"]`);
  if (!slide) {
    slide = document.createElement('div');
    slide.className = 'embla__slide';
    slide.dataset.sessionId = session.sessionId;

    const card = document.createElement('div');
    card.className = 'session-card';
    card.addEventListener('click', () => {
      setSelectedSession(session.sessionId);
    });
    slide.appendChild(card);
    emblaContainer.appendChild(slide);
  }

  const card = slide.querySelector('.session-card');
  const isSelected = state.selectedSessionId === session.sessionId;
  const isAttention = session.status === 'attention';

  card.className = 'session-card';
  card.classList.add(isSelected ? 'glass-card' : 'glass-subtle');
  if (isSelected) card.classList.add('selected');
  if (isAttention) card.classList.add('attention');

  const durationText = session.status === 'stale'
    ? 'Inactive'
    : formatRelativeTime(session.lastActivity);

  const replyBtn = isAttention
    ? `<button class="session-reply-btn" data-reply="${session.sessionId}">Send Reply</button>`
    : '';

  card.innerHTML = `
    <div class="session-card-header">
      <h3 class="session-project">${escapeHtml(session.project || 'Unknown')}</h3>
      <span class="status-badge badge-${session.status}">${statusLabel(session.status)}</span>
    </div>
    <div class="session-machine">
      ${DEVICE_ICON}
      <span>${escapeHtml(session.machine || 'unknown')}</span>
    </div>
    <p class="session-preview">${getPreviewText(session)}</p>
    <div class="session-meta">
      <span class="session-duration" data-activity="${session.lastActivity}">${durationText}</span>
      ${replyBtn}
    </div>
  `;

  // Reply button click should also select the session
  const replyBtnEl = card.querySelector('[data-reply]');
  if (replyBtnEl) {
    replyBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      setSelectedSession(session.sessionId);
    });
  }

  // Reinitialize embla to pick up DOM changes
  if (emblaApi) emblaApi.reInit();
}

function removeCard(sessionId) {
  if (!emblaContainer) return;
  const slide = emblaContainer.querySelector(`[data-session-id="${sessionId}"]`);
  if (slide) {
    slide.remove();
    if (emblaApi) emblaApi.reInit();
  }
}

function updateSelectedState({ sessionId }) {
  if (!emblaContainer) return;
  const slides = emblaContainer.querySelectorAll('.embla__slide');
  slides.forEach(slide => {
    const id = slide.dataset.sessionId;
    const card = slide.querySelector('.session-card');
    if (!card) return;
    const session = getSession(id);
    const isSelected = id === sessionId;
    const isAttention = session && session.status === 'attention';

    card.classList.remove('glass-subtle', 'glass-card', 'selected');
    card.classList.add(isSelected ? 'glass-card' : 'glass-subtle');
    if (isSelected) card.classList.add('selected');
    card.classList.toggle('attention', !!isAttention);
  });
}

function updateDurations() {
  if (!emblaContainer) return;
  const els = emblaContainer.querySelectorAll('.session-duration[data-activity]');
  els.forEach(el => {
    const session = getSession(el.closest('.embla__slide')?.dataset.sessionId);
    if (session && session.status !== 'stale') {
      el.textContent = formatRelativeTime(session.lastActivity);
    }
  });
}

function initSessions() {
  grid = document.getElementById('session-grid');
  if (!grid) return;

  setupEmblaStructure();
  initEmbla();

  subscribe('session:update', (sessionData) => {
    renderCard(sessionData);
  });

  subscribe('session:remove', ({ sessionId }) => {
    removeCard(sessionId);
  });

  subscribe('session:select', updateSelectedState);

  // Render any sessions already loaded into state (from GET /sessions before init)
  const existing = state.sessions instanceof Map ? state.sessions : new Map();
  for (const session of existing.values()) {
    renderCard(session);
  }

  // Update duration displays every 60s
  durationInterval = setInterval(updateDurations, 60000);
}

export { initSessions };
