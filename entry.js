// entry.js - The Gate
// Cyberpunk Space aesthetic landing page with starfield and long-press interaction

const STAR_COUNT = 150;
const GATE_STAR_INDEX = 0;

function init() {
  const container = document.createElement('div');
  container.id = 'entry-container';
  container.className = 'entry-container';
  document.body.appendChild(container);

  // Create starfield
  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    const size = Math.random() < 0.7 ? 1 : 2;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.opacity = Math.random() * 0.5 + 0.3;
    star.style.animationDelay = `${Math.random() * 5}s`;
    container.appendChild(star);

    if (i === GATE_STAR_INDEX) {
      star.className = 'star gate-star';
      star.style.left = '50%';
      star.style.top = '40%';
      star.style.width = '8px';
      star.style.height = '8px';
      star.style.opacity = '1';
      star.style.transform = 'translate(-50%, -50%)';
      
      // Long-press handlers
      let holdTimer = null;
      const HOLD_DURATION = 2000;

      const startHold = (e) => {
        e.preventDefault();
        holdTimer = setTimeout(() => {
          triggerSequence();
        }, HOLD_DURATION);
      };

      const cancelHold = () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      };

      star.addEventListener('pointerdown', startHold);
      star.addEventListener('pointerup', cancelHold);
      star.addEventListener('pointerleave', cancelHold);
      star.addEventListener('touchstart', startHold, { passive: false });
      star.addEventListener('touchend', cancelHold);
    }
  }

  // Create sequence elements (hidden initially)
  const welcome = document.createElement('div');
  welcome.id = 'welcome-text';
  welcome.className = 'sequence-text hidden';
  welcome.textContent = 'welcome';
  container.appendChild(welcome);

  const toTheSecret = document.createElement('div');
  toTheSecret.id = 'to-secret-text';
  toTheSecret.className = 'sequence-text hidden';
  toTheSecret.textContent = 'to The Secret';
  container.appendChild(toTheSecret);

  const header = document.createElement('header');
  header.id = 'main-header';
  header.className = 'hidden';
  header.innerHTML = '<span class="header-text">The Secret</span>';
  container.appendChild(header);
}

function triggerSequence() {
  const welcome = document.getElementById('welcome-text');
  const toTheSecret = document.getElementById('to-secret-text');
  const header = document.getElementById('main-header');
  const container = document.getElementById('entry-container');

  // Fade in welcome
  welcome.classList.remove('hidden');
  welcome.style.opacity = '0';
  welcome.style.transition = 'opacity 1s ease-in';
  requestAnimationFrame(() => {
    welcome.style.opacity = '1';
  });

  // After 2s, fade out welcome and fade in "to The Secret"
  setTimeout(() => {
    welcome.style.opacity = '0';
    toTheSecret.classList.remove('hidden');
    toTheSecret.style.opacity = '0';
    toTheSecret.style.transition = 'opacity 1s ease-in';
    requestAnimationFrame(() => {
      toTheSecret.style.opacity = '1';
    });
  }, 2000);

  // After 4s, move "The Secret" to header
  setTimeout(() => {
    toTheSecret.style.opacity = '0';
    header.classList.remove('hidden');
    header.style.opacity = '0';
    header.style.transition = 'opacity 1s ease-in';
    requestAnimationFrame(() => {
      header.style.opacity = '1';
    });

    // After header appears, transition to dashboard
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 1500);
  }, 4000);
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
