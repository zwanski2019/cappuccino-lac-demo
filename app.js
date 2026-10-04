'use strict';

// Progressive enhancement: the full menu remains usable without JavaScript.
const filters = [...document.querySelectorAll('[data-filter]')];
const menuItems = [...document.querySelectorAll('[data-category]')];
const menuStatus = document.getElementById('menu-status');
const menuSearch = document.getElementById('menu-search');
document.querySelector('.menu-search').hidden = false;
document.querySelector('.menu-tools').hidden = false;
let selectedCategory = 'all';
const normalizeSearch = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
function renderMenu() {
  const query = normalizeSearch(menuSearch.value.trim());
  let count = 0;
  for (const item of menuItems) {
    item.hidden = (selectedCategory !== 'all' && item.dataset.category !== selectedCategory) || !normalizeSearch(item.textContent).includes(query);
    if (!item.hidden) count++;
  }
  menuStatus.textContent = `${count} choix affichés`;
  document.getElementById('menu-empty').hidden = count !== 0;
}
for (const filter of filters) {
  filter.addEventListener('click', () => {
    selectedCategory = filter.dataset.filter;
    for (const button of filters) {
      button.classList.toggle('is-active', button === filter);
      button.setAttribute('aria-pressed', String(button === filter));
    }
    renderMenu();
  });
}
menuSearch.addEventListener('input', renderMenu);

// Only locally saved images verified as belonging to the business go here.
// Each photo is optional. Failed loads keep the designed brand treatment.
const verifiedPhotos = {
  house: { src: 'assets/terrace.jpg', alt: 'Terrasse à parasols de Cappuccino Lac sous le ciel bleu, photographie du compte Instagram Cappuccino Lac.' }
};
for (const [slotName, photo] of Object.entries(verifiedPhotos)) {
  const slot = document.querySelector(`[data-photo="${slotName}"]`);
  if (!slot) continue;
  const image = new Image();
  image.className = 'social-photo';
  image.alt = photo.alt;
  image.decoding = 'async';
  if (photo.position) image.style.objectPosition = photo.position;
  image.addEventListener('load', () => {
    slot.querySelector('.photo-fallback')?.remove();
    slot.prepend(image);
  }, { once: true });
  image.src = photo.src;
}

// One carousel controller, one cancellable timeout, no animation dependencies.
const carousel = document.querySelector('[data-carousel]');
if (carousel) {
  const slides = [...carousel.querySelectorAll('[data-slide]')];
  const dots = [...carousel.querySelectorAll('[data-carousel-dot]')];
  const stage = carousel.querySelector('[data-carousel-stage]');
  const play = carousel.querySelector('[data-carousel-play]');
  const status = carousel.querySelector('[data-carousel-status]');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = { index: 0, paused: false, focusStopped: false, hovered: false, visible: false, reduced: motionQuery.matches };
  let timer = null;
  let animations = [];
  let entrance = [];
  let transitionId = 0;
  let revealed = false;
  let gesture = null;
  let suppressClickUntil = 0;

  function settle() {
    transitionId += 1;
    for (const animation of animations) animation.cancel();
    animations = [];
    slides.forEach((slide, index) => { slide.hidden = index !== state.index; });
    carousel.dataset.transitioning = 'false';
  }

  function updateControls() {
    carousel.dataset.index = String(state.index);
    carousel.dataset.reducedMotion = String(state.reduced);
    carousel.querySelector('[data-carousel-count]').textContent = `${String(state.index + 1).padStart(2, '0')} / 04`;
    carousel.querySelector('[data-carousel-title]').textContent = slides[state.index].dataset.title;
    slides.forEach((slide, index) => {
      const inactive = index !== state.index;
      slide.inert = inactive;
      if (inactive) slide.setAttribute('aria-hidden', 'true');
      else slide.removeAttribute('aria-hidden');
    });
    dots.forEach((dot, index) => dot.setAttribute('aria-pressed', String(index === state.index)));
    const stopped = state.paused || state.focusStopped;
    play.disabled = state.reduced;
    play.setAttribute('aria-label', state.reduced ? 'Animation désactivée : mouvements réduits' : stopped ? 'Activer le défilement automatique' : 'Mettre le défilement en pause');
    play.querySelector('[data-play-symbol]').textContent = state.reduced || stopped ? '▷' : 'Ⅱ';
    play.querySelector('[data-play-label]').textContent = state.reduced ? 'Fixe' : stopped ? 'Lecture' : 'Pause';
  }

  function syncMotion() {
    clearTimeout(timer);
    timer = null;
    const reason = state.reduced ? 'reduced-motion' : state.paused ? 'user' : state.focusStopped ? 'focus' : document.hidden ? 'hidden' : !state.visible ? 'offscreen' : state.hovered ? 'hover' : '';
    const running = !reason;
    carousel.dataset.running = String(running);
    carousel.dataset.pauseReason = reason;
    updateControls();
    if (!running) {
      settle();
      // A pause settles entrance effects too; no decorative motion continues.
      for (const animation of entrance) animation.cancel();
      entrance = [];
    } else {
      timer = setTimeout(() => { timer = null; show(state.index + 1, false); }, 6000);
    }
  }

  function show(requestedIndex, manual = true) {
    const next = (requestedIndex + slides.length) % slides.length;
    if (manual) state.paused = true;
    const previous = state.index;
    settle();
    state.index = next;
    syncMotion();
    if (manual) status.textContent = `Moment ${next + 1} sur ${slides.length} : ${slides[next].dataset.title}`;
    if (next === previous || state.reduced || !state.visible || document.hidden || typeof slides[next].animate !== 'function') return;
    const oldSlide = slides[previous];
    const newSlide = slides[next];
    oldSlide.hidden = false;
    newSlide.hidden = false;
    const direction = ((next - previous + slides.length) % slides.length) === 1 ? 1 : -1;
    const token = ++transitionId;
    carousel.dataset.transitioning = 'true';
    const timing = { duration: 850, easing: 'cubic-bezier(.22,.68,.18,1)', fill: 'both' };
    animations = [
      oldSlide.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-direction * 7}%)` }], timing),
      newSlide.animate([{ opacity: 0, transform: `translateX(${direction * 10}%)` }, { opacity: 1, transform: 'translateX(0)' }], timing),
      newSlide.querySelector('.hero-food').animate([{ transform: 'translateY(22px)' }, { transform: 'translateY(0)' }], timing)
    ];
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (token === transitionId) settle();
    }).catch(() => { /* Rapid navigation cancels the previous transition. */ });
  }

  carousel.querySelector('[data-carousel-prev]').addEventListener('click', () => show(state.index - 1));
  carousel.querySelector('[data-carousel-next]').addEventListener('click', () => show(state.index + 1));
  dots.forEach((dot, index) => dot.addEventListener('click', () => show(index)));
  let stoppedOnPointerDown = null;
  play.addEventListener('pointerdown', () => { stoppedOnPointerDown = state.paused || state.focusStopped; });
  play.addEventListener('click', event => {
    if (state.reduced) return;
    const wasStopped = event.detail > 0 && stoppedOnPointerDown !== null ? stoppedOnPointerDown : state.paused || state.focusStopped;
    stoppedOnPointerDown = null;
    if (wasStopped) { state.paused = false; state.focusStopped = false; }
    else state.paused = true;
    syncMotion();
  });
  carousel.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') { state.hovered = true; syncMotion(); }
  });
  carousel.addEventListener('pointerleave', () => { state.hovered = false; syncMotion(); });
  carousel.addEventListener('focusin', () => { state.focusStopped = true; syncMotion(); });
  carousel.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(state.index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  // Native vertical scrolling remains available. A horizontal gesture commits
  // only after direction and distance are clear; caption taps remain links.
  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.pointerType === 'mouse') return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null };
  });
  stage.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 12) gesture.axis = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y';
    if (gesture.axis === 'x' && event.cancelable) event.preventDefault();
  }, { passive: false });
  stage.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const horizontal = gesture.axis !== 'y' && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4;
    gesture = null;
    if (horizontal) {
      suppressClickUntil = performance.now() + 450;
      show(state.index + (dx < 0 ? 1 : -1));
    }
  });
  stage.addEventListener('pointercancel', () => { gesture = null; });
  stage.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  document.addEventListener('visibilitychange', syncMotion);
  motionQuery.addEventListener('change', event => {
    state.reduced = event.matches;
    // Removing the OS preference does not silently resume motion.
    if (state.reduced) state.paused = true;
    syncMotion();
  });

  function visibilityChanged(visible) {
    if (state.visible === visible) return;
    state.visible = visible;
    syncMotion();
    if (visible && !revealed) {
      revealed = true;
      if (!state.reduced && carousel.dataset.running === 'true' && typeof carousel.animate === 'function') {
        const targets = [document.querySelector('.hero h1'), carousel, document.querySelector('.hero-copy')];
        entrance = targets.map((target, index) => target.animate([
          { opacity: 0, transform: 'translateY(18px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 900, delay: index * 100, easing: 'cubic-bezier(.22,.68,.18,1)', fill: 'backwards' }));
      }
    }
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => visibilityChanged(entries[0].isIntersecting && entries[0].intersectionRatio >= 0.15), { threshold: [0, 0.15] }).observe(carousel);
  } else {
    const check = () => { const rect = carousel.getBoundingClientRect(); visibilityChanged(rect.bottom > 0 && rect.top < innerHeight); };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();
  }
  for (const image of carousel.querySelectorAll('img')) {
    const failed = () => {
      image.classList.add('is-unavailable');
      const fallback = image.parentElement.querySelector('.carousel-photo-fallback');
      fallback.removeAttribute('aria-hidden');
      fallback.setAttribute('role', 'img');
      fallback.setAttribute('aria-label', 'Cappuccino Lac — photographie indisponible');
    };
    image.addEventListener('error', failed, { once: true });
    if (image.complete && image.naturalWidth === 0) failed();
  }
  carousel.querySelector('[data-carousel-controls]').hidden = false;
  carousel.dataset.enhanced = 'true';
  syncMotion();
}

// Dessert spotlight opens the corresponding menu selection, even after a search.
for (const link of document.querySelectorAll('[data-menu-shortcut]')) {
  link.addEventListener('click', () => {
    menuSearch.value = '';
    document.querySelector(`[data-filter="${link.dataset.menuShortcut}"]`).click();
  });
}
