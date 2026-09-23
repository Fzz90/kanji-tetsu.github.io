(() => {
  'use strict';

  // Core Slide Elements
  const slides = [...document.querySelectorAll('.slide')];
  const stage = document.querySelector('.stage');
  const slideNavButtons = [...document.querySelectorAll('.slide-nav button[data-go]')];
  const startButtons = [...document.querySelectorAll('[data-go]')];
  const previousButton = document.querySelector('.icon-button.previous');
  const nextButton = document.querySelector('.icon-button.next');
  const announcer = document.querySelector('#slide-announcer');
  const fullscreenButton = document.querySelector('#fullscreen-button');

  // Stroke Animator Elements (Slide 3)
  const strokePaths = [...document.querySelectorAll('#stroke-paths path')];
  const strokeNumbers = document.querySelector('#stroke-numbers');
  const strokeStatusBadge = document.querySelector('#stroke-status');
  const strokeDetailText = document.querySelector('#stroke-detail-text');
  const btnPlay = document.querySelector('#btn-play');
  const btnReplay = document.querySelector('#btn-replay');
  const btnPrevStroke = document.querySelector('#btn-prev-stroke');
  const btnNextStroke = document.querySelector('#btn-next-stroke');

  let currentSlide = 0;
  let strokeLengths = [];
  let isAnimatingStrokes = false;
  let currentStrokeIndex = 13; // default fully drawn
  let strokeAnimationTimer = null;

  // Description map for each of the 13 strokes
  const strokeDescriptions = [
    'Goresan 1: 払い (harai) — Miring kiri atas pada radikal kanehen.',
    'Goresan 2: 点 (ten) — Titik tebal miring kanan.',
    'Goresan 3: 横 (yoko) — Garis horizontal pendek.',
    'Goresan 4: 横 (yoko) — Garis horizontal kedua, sedikit lebih panjang.',
    'Goresan 5: 縦 (tate) — Garis vertikal lurus menembus bagian tengah.',
    'Goresan 6: 点 (ten) — Titik bawah sisi kiri.',
    'Goresan 7: 払い (harai) — Sapuan bawah sisi kanan.',
    'Goresan 8: 跳ね / 払い (hane) — Garis miring naik penutup radikal 釒.',
    'Goresan 9: 払い (harai) — Sapuan miring kiri pembuka bagian kanan (失).',
    'Goresan 10: 横 (yoko) — Garis horizontal pertama bagian kanan.',
    'Goresan 11: 横 (yoko) — Garis horizontal panjang melintang.',
    'Goresan 12: 左払い (hidari-harai) — Garis melengkung panjang ke arah kiri bawah.',
    'Goresan 13: 右払い (migi-harai) — Sapuan kuat melengkung ke arah kanan bawah.'
  ];

  /* -------------------------------------------------------------
     Stage Responsive Fit (16:9 Scale)
  ------------------------------------------------------------- */
  function fitStage() {
    if (!stage) return;
    if (window.innerWidth <= 900) {
      stage.style.removeProperty('--deck-scale');
    } else {
      stage.style.setProperty('--deck-scale', stage.clientWidth / 1440);
    }
  }

  /* -------------------------------------------------------------
     URL Hash Routing
  ------------------------------------------------------------- */
  function readHash() {
    const match = location.hash.match(/^#slide-(\d+)$/);
    if (!match) return 0;
    const index = Number(match[1]) - 1;
    return index >= 0 && index < slides.length ? index : 0;
  }

  function setHash(index) {
    history.replaceState(null, '', `#slide-${index + 1}`);
  }

  /* -------------------------------------------------------------
     Slide Navigation
  ------------------------------------------------------------- */
  function goToSlide(index, { focus = true } = {}) {
    if (index < 0 || index >= slides.length) return;

    const previousIndex = currentSlide;
    currentSlide = index;

    slides.forEach((slide, i) => {
      const isActive = i === currentSlide;
      slide.classList.toggle('active', isActive);
      slide.hidden = !isActive;
      slide.inert = !isActive;

      if (isActive) {
        slide.classList.remove('entering');
        void slide.offsetWidth; // Force reflow
        slide.classList.add('entering');
        if (focus) slide.focus();
      }
    });

    // Update Navigation Indicators
    slideNavButtons.forEach((btn, i) => {
      const isCurrent = i === currentSlide;
      btn.classList.toggle('current', isCurrent);
      if (isCurrent) {
        btn.setAttribute('aria-current', 'step');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    // Update Arrow Controls
    if (previousButton) previousButton.disabled = currentSlide === 0;
    if (nextButton) nextButton.disabled = currentSlide === slides.length - 1;

    setHash(currentSlide);

    // Announce to Screen Readers
    const slideTitle = slides[currentSlide]?.getAttribute('data-title') || `Slide ${currentSlide + 1}`;
    if (announcer) {
      announcer.textContent = `Slide ${currentSlide + 1} dari ${slides.length}: ${slideTitle}`;
    }

    // Auto trigger stroke animation if user lands on Slide 3 (index 2)
    if (currentSlide === 2) {
      setTimeout(() => {
        playStrokeAnimation();
      }, 350);
    }
  }

  /* -------------------------------------------------------------
     Stroke Animator Engine (Slide 3)
  ------------------------------------------------------------- */
  function initStrokeLengths() {
    strokeLengths = strokePaths.map(path => {
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len} ${len}`;
      path.style.strokeDashoffset = '0'; // default shown
      return len;
    });
  }

  function setStrokeCount(count) {
    currentStrokeIndex = Math.max(0, Math.min(count, strokePaths.length));

    strokePaths.forEach((path, i) => {
      const len = strokeLengths[i] || 100;
      if (i < currentStrokeIndex) {
        path.style.strokeDashoffset = '0';
        path.style.opacity = '1';
        path.classList.remove('highlight-stroke');
      } else {
        path.style.strokeDashoffset = `${len}`;
        path.style.opacity = '0';
        path.classList.remove('highlight-stroke');
      }
    });

    // Highlight current tip
    if (currentStrokeIndex > 0 && currentStrokeIndex <= strokePaths.length) {
      strokePaths[currentStrokeIndex - 1].classList.add('highlight-stroke');
      setTimeout(() => {
        strokePaths[currentStrokeIndex - 1]?.classList.remove('highlight-stroke');
      }, 400);
    }

    // Update Status Badge
    if (strokeStatusBadge) {
      strokeStatusBadge.textContent = `Goresan: ${currentStrokeIndex} / ${strokePaths.length}`;
    }

    // Update Description
    if (strokeDetailText) {
      if (currentStrokeIndex === 0) {
        strokeDetailText.innerHTML = 'Kanji masih kosong. Klik <strong>Putar</strong> atau tombol panah untuk memulai.';
      } else {
        const desc = strokeDescriptions[currentStrokeIndex - 1] || '';
        strokeDetailText.innerHTML = `<strong>${desc}</strong>`;
      }
    }
  }

  function playStrokeAnimation() {
    if (isAnimatingStrokes) return;
    isAnimatingStrokes = true;

    // Reset to 0
    setStrokeCount(0);

    let step = 0;
    function nextStroke() {
      if (step >= strokePaths.length) {
        isAnimatingStrokes = false;
        setStrokeCount(strokePaths.length);
        return;
      }

      step++;
      const path = strokePaths[step - 1];
      const len = strokeLengths[step - 1] || 100;

      path.style.opacity = '1';
      path.style.transition = 'stroke-dashoffset 0.28s ease-out, stroke 0.2s';
      path.classList.add('highlight-stroke');
      path.style.strokeDashoffset = '0';

      if (strokeStatusBadge) {
        strokeStatusBadge.textContent = `Goresan: ${step} / ${strokePaths.length}`;
      }
      if (strokeDetailText) {
        strokeDetailText.innerHTML = `<strong>${strokeDescriptions[step - 1]}</strong>`;
      }

      setTimeout(() => {
        path.classList.remove('highlight-stroke');
      }, 260);

      strokeAnimationTimer = setTimeout(nextStroke, 320);
    }

    strokeAnimationTimer = setTimeout(nextStroke, 150);
  }

  function replayStrokeAnimation() {
    clearTimeout(strokeAnimationTimer);
    isAnimatingStrokes = false;
    playStrokeAnimation();
  }

  function stepNextStroke() {
    clearTimeout(strokeAnimationTimer);
    isAnimatingStrokes = false;
    if (currentStrokeIndex < strokePaths.length) {
      setStrokeCount(currentStrokeIndex + 1);
    }
  }

  function stepPrevStroke() {
    clearTimeout(strokeAnimationTimer);
    isAnimatingStrokes = false;
    if (currentStrokeIndex > 0) {
      setStrokeCount(currentStrokeIndex - 1);
    }
  }

  /* -------------------------------------------------------------
     Fullscreen Toggle
  ------------------------------------------------------------- */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  /* -------------------------------------------------------------
     Keyboard Navigation
  ------------------------------------------------------------- */
  function handleKeydown(event) {
    if (event.defaultPrevented) return;
    const target = event.target;
    if (target.matches('input, textarea, select')) return;

    switch (event.key) {
      case 'ArrowRight':
      case 'PageDown':
        event.preventDefault();
        goToSlide(currentSlide + 1);
        break;

      case 'ArrowLeft':
      case 'PageUp':
        event.preventDefault();
        goToSlide(currentSlide - 1);
        break;

      case 'Home':
        event.preventDefault();
        goToSlide(0);
        break;

      case 'End':
        event.preventDefault();
        goToSlide(slides.length - 1);
        break;

      case 'f':
      case 'F':
        event.preventDefault();
        toggleFullscreen();
        break;
    }
  }

  /* -------------------------------------------------------------
     Touch / Swipe Support
  ------------------------------------------------------------- */
  let touchStartX = 0;
  let touchStartY = 0;

  function handleTouchStart(e) {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
  }

  function handleTouchEnd(e) {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        goToSlide(currentSlide + 1);
      } else {
        goToSlide(currentSlide - 1);
      }
    }
  }

  /* -------------------------------------------------------------
     Event Listeners Binding
  ------------------------------------------------------------- */
  function setupEventListeners() {
    window.addEventListener('resize', fitStage, { passive: true });
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('hashchange', () => goToSlide(readHash(), { focus: false }));

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Buttons with data-go
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-go]');
      if (btn) {
        e.preventDefault();
        const targetIndex = Number(btn.getAttribute('data-go'));
        if (!isNaN(targetIndex)) goToSlide(targetIndex);
      }
    });

    if (previousButton) {
      previousButton.addEventListener('click', () => goToSlide(currentSlide - 1));
    }

    if (nextButton) {
      nextButton.addEventListener('click', () => goToSlide(currentSlide + 1));
    }

    if (fullscreenButton) {
      fullscreenButton.addEventListener('click', toggleFullscreen);
    }

    // Stroke Animator Buttons
    if (btnPlay) btnPlay.addEventListener('click', playStrokeAnimation);
    if (btnReplay) btnReplay.addEventListener('click', replayStrokeAnimation);
    if (btnNextStroke) btnNextStroke.addEventListener('click', stepNextStroke);
    if (btnPrevStroke) btnPrevStroke.addEventListener('click', stepPrevStroke);
  }

  /* -------------------------------------------------------------
     Initialization
  ------------------------------------------------------------- */
  function init() {
    fitStage();
    initStrokeLengths();
    setupEventListeners();

    const initialIndex = readHash();
    goToSlide(initialIndex, { focus: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
