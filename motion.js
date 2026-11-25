const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');

function syncTheme() {
  const dark = root.dataset.theme === 'dark';
  themeToggle.setAttribute('aria-pressed', String(dark));
  themeColor.content = getComputedStyle(root).getPropertyValue('--bg').trim();
}

themeToggle.addEventListener('click', () => {
  root.dataset.theme = themeToggle.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark';
  try { localStorage.setItem('portfolio-theme', root.dataset.theme); } catch {}
  syncTheme();
});
syncTheme();
themeToggle.hidden = false;

const stage = document.querySelector('.portrait-stage');
const card = stage.querySelector('.portrait-card');
const sceneHost = stage.querySelector('.portrait-scene');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const pointer = { x: 0, y: 0 };
let visible = false;
let frame = 0;
let drawOrbit;
let loadingOrbit = false;

function render(time) {
  frame = 0;
  if (!visible || motionPreference.matches) return;
  const bounds = stage.getBoundingClientRect();
  const progress = Math.max(-1, Math.min(1, (innerHeight / 2 - bounds.top - bounds.height / 2) / (innerHeight * 0.65)));
  const pitch = 3 * progress - 3 * pointer.y;
  const yaw = -7 * progress + 4 * pointer.x;
  card.style.setProperty('--portrait-lift', (-9 * progress).toFixed(2) + 'px');
  card.style.setProperty('--portrait-pitch', pitch.toFixed(2) + 'deg');
  card.style.setProperty('--portrait-yaw', yaw.toFixed(2) + 'deg');
  if (drawOrbit && sceneHost.clientWidth > 0) {
    drawOrbit(progress, pointer, time);
    schedule();
  }
}

function schedule() {
  if (visible && !motionPreference.matches && frame === 0) frame = requestAnimationFrame(render);
}

async function loadOrbit() {
  if (!visible || motionPreference.matches || !sceneHost.getClientRects().length || loadingOrbit || drawOrbit) return;
  loadingOrbit = true;
  try {
    const three = await import('./vendor/three.module.min.js');
    if (!motionPreference.matches) {
      drawOrbit = makeOrbit(three);
      stage.classList.add('has-orbit');
    }
  } catch {
    // The CSS portrait still animates when WebGL or the module is unavailable.
  } finally {
    loadingOrbit = false;
    schedule();
  }
}

function makeOrbit(three) {
  const renderer = new three.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  sceneHost.append(renderer.domElement);
  const scene = new three.Scene();
  const camera = new three.PerspectiveCamera(36, 1, 0.1, 30);
  camera.position.z = 9;
  const orbit = new three.Group();
  scene.add(orbit);

  for (let index = 0; index < 3; index++) {
    const ring = new three.Mesh(
      new three.TorusGeometry(2.28 + index * 0.20, 0.016, 8, 96),
      new three.MeshBasicMaterial({ transparent: true, opacity: 0.64 - index * 0.13 })
    );
    ring.rotation.set(0.5 + index * 0.44, 0.18 + index * 0.38, index * 0.45);
    const marker = new three.Mesh(
      new three.SphereGeometry(0.065, 12, 8),
      new three.MeshBasicMaterial()
    );
    const angle = 0.8 + index * 2.5;
    marker.position.set(Math.cos(angle) * ring.geometry.parameters.radius, Math.sin(angle) * ring.geometry.parameters.radius, 0);
    ring.add(marker);
    orbit.add(ring);
  }

  let darkMode;
  let width = 0;
  let height = 0;
  return (progress, point, time) => {
    const dark = themeToggle.getAttribute('aria-pressed') === 'true';
    if (dark !== darkMode) {
      darkMode = dark;
      const palette = getComputedStyle(root);
      orbit.children.forEach((ring, index) => {
        const color = palette.getPropertyValue(index === 1 ? '--frame' : '--accent').trim();
        ring.material.color.set(color);
        ring.children[0].material.color.set(color);
      });
    }
    const newWidth = sceneHost.clientWidth;
    const newHeight = sceneHost.clientHeight;
    if (newWidth !== width || newHeight !== height) {
      width = newWidth;
      height = newHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }
    orbit.rotation.set(0.16 + progress * 0.62 + point.y * 0.13, progress * 0.72 + point.x * 0.22, progress * 0.55 + (time % 22000) / 22000 * 2 * Math.PI);
    renderer.render(scene, camera);
  };
}

const observer = new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  loadOrbit();
  schedule();
});
observer.observe(stage);

stage.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse') return;
  const bounds = stage.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
  pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  schedule();
});
stage.addEventListener('pointerleave', () => {
  pointer.x = 0;
  pointer.y = 0;
  schedule();
});
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', () => { loadOrbit(); schedule(); });
motionPreference.addEventListener('change', () => {
  sceneHost.hidden = motionPreference.matches;
  if (motionPreference.matches) {
    cancelAnimationFrame(frame);
    frame = 0;
  } else {
    loadOrbit();
    schedule();
  }
});

const reveal = new IntersectionObserver(entries => {
  for (const { isIntersecting, target } of entries) {
    if (!isIntersecting) continue;
    reveal.unobserve(target);
    if (!motionPreference.matches) {
      target.animate(
        [{ opacity: 0.65, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 350, easing: 'cubic-bezier(.2,.75,.25,1)' }
      );
    }
  }
}, { threshold: 0.18 });
document.querySelectorAll('.project, .timeline article, .skill-grid article, .contact').forEach(element => reveal.observe(element));
