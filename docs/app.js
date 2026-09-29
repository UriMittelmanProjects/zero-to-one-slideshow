import { PHOTOS } from './photos.js';
import { Player, motionFrames } from './player.js';
const $ = selector => document.querySelector(selector);
const player = new Player(PHOTOS);
const stage = $('#stage'), layers = $('#layers'), dialog = $('#photo-dialog');
let elapsed = 0, lastTick = performance.now(), loading = false, failed = false, requestId = 0;
let activeLayer = null, motion = null, resumeAfterDialog = false, opener = null;
const thumbs = [], checkboxes = [], cached = new Map();
function announce(text) { $('#announcement').textContent = text; }
function timeText(seconds) { const n = Math.round(seconds); return `${Math.floor(n / 60)}m ${String(n % 60).padStart(2, '0')}s`; }
function updateMotion() {
  const running = player.playing && !loading && !dialog.open && !document.hidden && !failed;
  if (motion) running ? motion.play() : motion.pause();
}
function beginMotion() {
  motion?.cancel(); motion = null;
  if (!activeLayer) return;
  if (player.settings.zoom !== 'off' || player.settings.pan !== 'off') {
    motion = activeLayer.querySelector('img').animate(motionFrames(player.settings), { duration: player.settings.seconds * 1000, easing: 'linear', fill: 'forwards' });
    motion.currentTime = elapsed; updateMotion();
  }
}
function render() {
  const count = player.included.length, current = PHOTOS[player.current], playing = player.playing && !dialog.open;
  $('#play-state').textContent = !count ? 'NO PHOTOS' : failed ? 'LOAD ERROR' : loading ? 'LOADING' : player.ended ? 'FINISHED' : playing ? 'PLAYING' : 'PAUSED';
  $('#play').setAttribute('aria-label', player.ended ? 'Replay slideshow' : playing ? 'Pause slideshow' : 'Play slideshow');
  $('#play-icon').innerHTML = playing ? '<path d="M9 6v12M15 6v12"/>' : '<path d="m9 5 10 7-10 7Z" fill="currentColor" stroke-width="0"/>';
  $('#photo-caption').textContent = current ? `${String(current.number).padStart(2, '0')} / 83` : '— / 83';
  $('#current-file').textContent = current?.filename ?? 'No photos selected';
  $('#sequence-summary').textContent = `${count} in rotation · ${timeText(count * player.settings.seconds)} ${player.settings.loop ? 'per loop' : 'total'}`;
  $('#chosen-count').textContent = `${count} / 83`;
  $('#skip-summary').textContent = count === 83 ? 'All 83 photos included' : `${count} included · ${83 - count} skipped`;
  $('#dialog-count').textContent = `${count} of 83 included`;
  $('#play').disabled = !count || failed;
  $('#previous').disabled = !count || (!player.settings.loop && player.current === player.included[0]);
  $('#next').disabled = !count || (!player.settings.loop && player.ended);
  $('#skip-current').disabled = !count;
  thumbs.forEach((button, i) => {
    const skipped = player.skipped.has(i);
    button.classList.toggle('is-skipped', skipped); button.disabled = skipped;
    button.setAttribute('aria-current', String(player.current === i));
    button.setAttribute('aria-label', `Show photo ${i + 1}${skipped ? ' (skipped)' : ''}`);
    checkboxes[i].checked = !skipped;
  });
  updateMotion();
}
function showMessage(text, action) {
  $('#stage-message').hidden = false; $('#message-text').textContent = text; $('#message-action').textContent = action;
}
function loadPhoto(photo) {
  if (cached.has(photo.id)) return cached.get(photo.id);
  const promise = new Promise((resolve, reject) => {
    const image = new Image(); image.decoding = 'async';
    const timeout = setTimeout(() => reject(new Error('Image download timed out.')), 20000);
    image.onload = async () => {
      try { await image.decode(); clearTimeout(timeout); resolve(image); }
      catch (error) { clearTimeout(timeout); reject(error); }
    };
    image.onerror = () => { clearTimeout(timeout); reject(new Error('Image could not load.')); }; image.src = photo.src;
  }).catch(error => { cached.delete(photo.id); throw error; });
  cached.set(photo.id, promise); return promise;
}
function preload() {
  const indices = player.included, position = indices.indexOf(player.current), keep = new Set([PHOTOS[player.current]?.id]);
  for (let offset = 1; offset <= 2 && offset < indices.length; offset++) {
    const photo = PHOTOS[indices[(position + offset) % indices.length]]; keep.add(photo.id); loadPhoto(photo).catch(() => {});
  }
  // Keep only current/upcoming decoded images; HTTP caching handles revisits.
  for (const key of cached.keys()) if (!keep.has(key)) cached.delete(key);
}
async function showPhoto({ cut = false } = {}) {
  const token = ++requestId; elapsed = 0; failed = false; $('#progress').style.transform = 'scaleX(0)';
  if (player.current < 0) {
    loading = false; motion?.cancel(); motion = null; activeLayer = null; layers.replaceChildren();
    showMessage('All photos are skipped. Include a few moments to start the slideshow.', 'Include all photos'); render(); return;
  }
  loading = true; motion?.pause(); render();
  const photo = PHOTOS[player.current];
  try {
    const loaded = await loadPhoto(photo);
    if (token !== requestId) return;
    const image = loaded.cloneNode(); image.alt = photo.alt;
    const incoming = document.createElement('div'); incoming.className = 'photo-layer'; incoming.append(image);
    const outgoing = activeLayer;
    // Freeze the previous photo at its current motion position through the transition.
    if (motion) { motion.commitStyles(); motion.cancel(); motion = null; }
    for (const child of [...layers.children]) if (child !== outgoing) child.remove();
    layers.append(incoming); activeLayer = incoming; $('#stage-message').hidden = true;
    const transition = cut ? 'cut' : player.settings.transition;
    if (outgoing && transition !== 'cut') {
      const duration = Math.min(600, player.settings.seconds * 250);
      const frames = transition === 'fade' ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }];
      const animation = incoming.animate(frames, { duration, easing: 'ease-in-out' });
      animation.finished.then(() => outgoing.remove()).catch(() => outgoing.remove());
      if (transition === 'slide') outgoing.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }], { duration, easing: 'ease-in-out', fill: 'forwards' });
    } else outgoing?.remove();
    loading = false; lastTick = performance.now(); beginMotion(); render(); preload();
    const thumb = thumbs[player.current];
    if (thumb && !dialog.open) {
      const strip = $('#filmstrip'), left = thumb.offsetLeft - strip.offsetLeft;
      if (left < strip.scrollLeft || left + thumb.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollTo({ left: Math.max(0, left - strip.clientWidth / 2 + 48), behavior: 'auto' });
    }
  } catch {
    if (token !== requestId) return;
    loading = false; failed = true; player.playing = false;
    showMessage('This photo could not load. Try again, or move to the next photo.', 'Try again'); render(); announce('Photo could not load. Try again or use Next.');
  }
}
function advance(direction = 1) {
  if (player.advance(direction)) showPhoto();
  else { render(); if (player.ended) announce('Slideshow finished. Press Play to start again.'); }
}
function togglePlay() { const restart = player.togglePlayback(); lastTick = performance.now(); if (restart) showPhoto(); else render(); }
function setSkipped(indices) { const changed = player.setSkipped(indices); if (changed) showPhoto(); else render(); }
function syncSettings() {
  $('#speed').value = player.settings.seconds; $('#speed-range').value = Math.min(15, player.settings.seconds);
  $('#loop').checked = player.settings.loop; $(`input[name="transition"][value="${player.settings.transition}"]`).checked = true;
  $('#zoom').value = player.settings.zoom; $('#pan').value = player.settings.pan;
}
function configure(patch) {
  player.configure(patch);
  if ('seconds' in patch || 'zoom' in patch || 'pan' in patch) { elapsed = 0; lastTick = performance.now(); $('#progress').style.transform = 'scaleX(0)'; beginMotion(); }
  syncSettings(); render();
}
for (const [index, photo] of PHOTOS.entries()) {
  const button = document.createElement('button'); button.className = 'thumb'; button.type = 'button';
  button.innerHTML = `<img src="${photo.thumbnail}" alt="" loading="lazy" width="${photo.width}" height="${photo.height}"><span>${String(photo.number).padStart(2, '0')}</span>`;
  button.addEventListener('click', () => { if (player.select(index)) showPhoto(); }); thumbs.push(button); $('#filmstrip').append(button);
  const label = document.createElement('label'); label.className = 'photo-choice';
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = true;
  checkbox.setAttribute('aria-label', `Include photo ${photo.number}: ${photo.filename}`);
  checkbox.addEventListener('change', () => { const skipped = new Set(player.skipped); checkbox.checked ? skipped.delete(index) : skipped.add(index); setSkipped(skipped); });
  const img = document.createElement('img'); img.src = photo.thumbnail; img.alt = ''; img.loading = 'lazy';
  const caption = document.createElement('span'); caption.innerHTML = `<b>${String(photo.number).padStart(2, '0')}</b>${photo.filename}`;
  label.append(checkbox, img, caption); checkboxes.push(checkbox); $('#photo-grid').append(label);
}
$('#previous').addEventListener('click', () => advance(-1)); $('#next').addEventListener('click', () => advance()); $('#play').addEventListener('click', togglePlay);
$('#skip-current').addEventListener('click', () => {
  const photo = PHOTOS[player.current]; if (!photo) return;
  setSkipped([...player.skipped, player.current]); announce(`Photo ${photo.number} skipped. You can include it again in Choose photos.`);
});
$('#message-action').addEventListener('click', () => {
  if (player.current < 0) { setSkipped([]); player.playing = true; render(); } else { player.playing = true; showPhoto({ cut: true }); }
});
for (const input of [$('#speed'), $('#speed-range')]) input.addEventListener(input.type === 'range' ? 'input' : 'change', () => {
  const seconds = Number(input.value);
  if (!Number.isFinite(seconds) || seconds < .5 || seconds > 60) { syncSettings(); announce('Choose a duration from 0.5 to 60 seconds.'); return; }
  configure({ seconds });
});
$('#loop').addEventListener('change', event => configure({ loop: event.target.checked }));
document.querySelectorAll('input[name="transition"]').forEach(input => input.addEventListener('change', () => configure({ transition: input.value })));
for (const name of ['zoom', 'pan']) $(`#${name}`).addEventListener('change', event => configure({ [name]: event.target.value }));
$('#reset').addEventListener('click', () => { player.reset(); syncSettings(); showPhoto({ cut: true }); announce('Defaults restored. All 83 photos included.'); });
function openPhotos(event) { opener = event.currentTarget; resumeAfterDialog = player.playing; player.playing = false; dialog.showModal(); render(); }
$('#open-photos').addEventListener('click', openPhotos); $('#manage-photos').addEventListener('click', openPhotos);
$('#close-photos').addEventListener('click', () => dialog.close()); $('#done-photos').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { player.playing = resumeAfterDialog && player.included.length > 0 && !failed; lastTick = performance.now(); render(); opener?.focus(); });
$('#include-all').addEventListener('click', () => setSkipped([])); $('#skip-all').addEventListener('click', () => setSkipped(PHOTOS.map((_, i) => i)));
async function fullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else if (stage.requestFullscreen) await stage.requestFullscreen(); else announce('Fullscreen is not supported in this browser.'); }
  catch { announce('Fullscreen is unavailable. You can still play the slideshow here.'); }
}
$('#fullscreen').addEventListener('click', fullscreen);
const controlOverlays = [...stage.querySelectorAll('.stage-top, .stage-bottom, .progress-track')];
let hiddenPointer = null;
function showControls() {
  stage.classList.remove('controls-hidden');
  controlOverlays.forEach(overlay => { overlay.inert = false; });
  hiddenPointer = null;
}
$('#hide-controls').addEventListener('click', event => {
  stage.focus({ preventScroll: true });
  hiddenPointer = { x: event.clientX, y: event.clientY };
  controlOverlays.forEach(overlay => { overlay.inert = true; });
  stage.classList.add('controls-hidden');
  announce('Controls hidden. Move the mouse, tap the photo, or press a key to show them.');
});
document.addEventListener('pointermove', event => {
  if (hiddenPointer && (event.clientX !== hiddenPointer.x || event.clientY !== hiddenPointer.y)) showControls();
}, { passive: true });
stage.addEventListener('pointerdown', event => { if (event.pointerType === 'touch') showControls(); }, { passive: true });
document.addEventListener('keydown', showControls, { capture: true });
document.addEventListener('fullscreenchange', showControls);
document.addEventListener('fullscreenchange', () => $('#fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'));
document.addEventListener('keydown', event => {
  if (dialog.open || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,select,textarea,button,a,[contenteditable="true"]')) return;
  if (event.code === 'Space') { event.preventDefault(); if (!failed) togglePlay(); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); advance(); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); advance(-1); }
  else if (event.key.toLowerCase() === 'f') { event.preventDefault(); fullscreen(); }
});
document.addEventListener('visibilitychange', () => { lastTick = performance.now(); updateMotion(); });
function tick(now) {
  const delta = now - lastTick; lastTick = now;
  if (player.playing && !loading && !failed && !dialog.open && !document.hidden && player.current >= 0) {
    elapsed += delta; const fraction = Math.min(1, elapsed / (player.settings.seconds * 1000));
    $('#progress').style.transform = `scaleX(${fraction})`; if (fraction >= 1) advance();
  }
  requestAnimationFrame(tick);
}
syncSettings(); showPhoto({ cut: true }); requestAnimationFrame(tick);
