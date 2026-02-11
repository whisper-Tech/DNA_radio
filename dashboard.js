// dashboard.js - The Secret Dashboard
// Cyberpunk Space aesthetic with DNA helix and shared radio

// Mock song queue - each rung is a song
let songQueue = Array.from({ length: 50 }, (_, i) => ({
  id: `song-${i}`,
  title: `Track ${i + 1}`,
  artist: `Artist ${i + 1}`,
  position: i,
  isPlaying: i === 0
}));

// Global clock sync - all users hear same song at same millisecond
let globalClockOffset = 0;
let currentSongIndex = 0;
let songStartTime = 0;

// Canvas and helix state
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
let rotation = 0;
let isDragging = false;
let dragStartX = 0;
let rotationStart = 0;

// Drag and drop state
let draggedSong = null;

function init() {
  const container = document.createElement('div');
  container.id = 'dashboard-container';
  container.className = 'dashboard-container';
  document.body.appendChild(container);

  // Header
  const header = document.createElement('header');
  header.className = 'dashboard-header';
  header.innerHTML = `
    <span class="header-text">The Secret</span>
    <div class="sync-status">
      <span class="status-dot"></span>
      <span class="status-text">SYNCED</span>
    </div>
  `;
  container.appendChild(header);

  // Canvas container
  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'canvas-container';
  canvasContainer.appendChild(canvas);
  container.appendChild(canvasContainer);

  // Song queue sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'song-sidebar';
  sidebar.innerHTML = '<div class="sidebar-title">QUEUE</div>';
  container.appendChild(sidebar);

  // Drag drop zone
  const dropZone = document.createElement('div');
  dropZone.className = 'drop-zone';
  dropZone.innerHTML = '<span class="drop-text">DRAG SONGS HERE</span>';
  container.appendChild(dropZone);

  // Setup canvas
  setupCanvas();
  setupDragAndDrop(dropZone);
  startRenderLoop();
  startGlobalClock();
}

function setupCanvas() {
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  // Pointer events for rotation
  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    rotationStart = rotation;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const delta = e.clientX - dragStartX;
    rotation = rotationStart + delta * 0.01;
  });

  canvas.addEventListener('pointerup', () => {
    isDragging = false;
  });

  canvas.addEventListener('pointerleave', () => {
    isDragging = false;
  });
}

function setupDragAndDrop(dropZone) {
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const songData = e.dataTransfer.getData('text/plain');
    if (songData) {
      const song = JSON.parse(songData);
      addSongToQueue(song);
    }
  });
}

function addSongToQueue(song) {
  const newSong = {
    id: `song-${Date.now()}`,
    title: song.title || 'New Track',
    artist: song.artist || 'Unknown',
    position: songQueue.length,
    isPlaying: false
  };
  songQueue.push(newSong);
}

function startRenderLoop() {
  function render() {
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const helixRadius = Math.min(width, height) * 0.2;
    const rungCount = 60;
    const spacing = 8;

    // Draw DNA helix
    for (let i = 0; i < rungCount; i++) {
      const song = songQueue[i % songQueue.length];
      const angle = (i * spacing + rotation) * 0.08;
      const y = (i - rungCount / 2) * spacing;

      // Perspective scaling
      const scale = 1 - Math.abs(y) / (rungCount * spacing);
      const xOffset = Math.cos(angle) * helixRadius * scale;
      const zOffset = Math.sin(angle) * 50 * scale;

      // Left and right points
      const xLeft = centerX - xOffset;
      const xRight = centerX + xOffset;
      const yPos = centerY + y;

      // Color based on song state
      const isCurrentSong = song.id === songQueue[currentSongIndex]?.id;
      const baseAlpha = 0.2 + (zOffset + 50) / 100;
      const alpha = Math.max(0.1, Math.min(1, baseAlpha));

      if (isCurrentSong) {
        ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
        ctx.lineWidth = 3 * scale;
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 10;
      } else {
        ctx.strokeStyle = `rgba(139, 233, 253, ${alpha * 0.6})`;
        ctx.lineWidth = 2 * scale;
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.moveTo(xLeft, yPos);
      ctx.lineTo(xRight, yPos);
      ctx.stroke();

      // Draw helix strands
      ctx.strokeStyle = `rgba(6, 182, 212, ${alpha * 0.4})`;
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.moveTo(xLeft, yPos);
      ctx.lineTo(centerX - Math.cos(angle + 0.5) * helixRadius * scale, yPos + spacing * 0.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(xRight, yPos);
      ctx.lineTo(centerX + Math.cos(angle + 0.5) * helixRadius * scale, yPos + spacing * 0.5);
      ctx.stroke();
    }

    // Auto-rotate slowly
    if (!isDragging) {
      rotation += 0.002;
    }

    requestAnimationFrame(render);
  }
  render();
}

function startGlobalClock() {
  // Simulate global clock sync
  globalClockOffset = performance.now();
  songStartTime = performance.now();

  // Simulate song progression
  setInterval(() => {
    const elapsed = performance.now() - songStartTime;
    const songDuration = 180000; // 3 minutes per song

    if (elapsed > songDuration) {
      currentSongIndex = (currentSongIndex + 1) % songQueue.length;
      songStartTime = performance.now();
      updateSyncStatus();
    }
  }, 1000);
}

function updateSyncStatus() {
  const statusText = document.querySelector('.status-text');
  const statusDot = document.querySelector('.status-dot');
  
  if (statusText && statusDot) {
    statusText.textContent = 'SYNCED';
    statusDot.style.background = '#22d3ee';
    statusDot.style.boxShadow = '0 0 10px #22d3ee';
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
