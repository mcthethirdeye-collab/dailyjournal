/*
 * app.js — journal UI: entries are stored in this browser's localStorage,
 * each entry is analysed and its main event rendered as an animation.
 */
(function () {
  'use strict';

  const { analyze, SCENES } = window.JournalAnalyzer;
  const { Animator, DURATION } = window.JournalAnimator;
  const STORE_KEY = 'dailyreel.entries.v1';

  const EXAMPLES = [
    'Woke up late and grabbed a coffee. Then Sarah threw me a surprise birthday party with a huge chocolate cake! Best night ever.',
    'Long day at the office, lots of meetings. Then my boss told me I finally got the promotion!! Called Mom right away.',
    'Took the dog to the beach this morning. He chased the waves and the ball for an hour, so happy.',
    'Went hiking up the mountain with Jake. The view from the summit was incredible.',
    'It rained all afternoon and I felt kind of lonely. I miss my friends back home.',
    'Me and Tom played basketball in the park and our team won the match!',
    'Drove to the coast with Mia for a road trip. Sang to the radio the whole way.',
    'Had dinner with Leo at a tiny Italian restaurant. The pasta and wine were perfect.',
    'Went to a concert tonight and danced until midnight. The band was amazing!',
    'Stayed home with a cold, drank tea and slept most of the day.'
  ];

  // ---------- storage ----------
  function load() {
    try { const v = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); return Array.isArray(v) ? v : []; }
    catch { return []; }
  }
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(entries)); return true; }
    catch { toast('Could not save — browser storage is unavailable.'); return false; }
  }

  // ---------- state ----------
  let entries = load();
  let currentId = null;
  let reel = null; // { list, index, timer }
  let typingTimer = 0;

  const $ = (id) => document.getElementById(id);
  const els = {
    list: $('entryList'), empty: $('emptyList'), search: $('search'), newBtn: $('newBtn'),
    form: $('editor'), date: $('date'), text: $('text'), scene: $('sceneSelect'),
    save: $('saveBtn'), del: $('deleteBtn'), example: $('exampleBtn'), saveState: $('saveState'),
    chips: $('chips'), mainEvent: $('mainEvent'), replay: $('replayBtn'), download: $('downloadBtn'),
    playAll: $('playAllBtn'), reelBadge: $('reelBadge'), menuBtn: $('menuBtn'), menu: $('menu'),
    exportBtn: $('exportBtn'), importInput: $('importInput'), toastEl: $('toast')
  };

  const animator = new Animator($('stage'));
  // The doodle style draws its text in a handwriting font; load it so the first frames use it.
  if (document.fonts && document.fonts.load) document.fonts.load('22px "Patrick Hand"').catch(() => {});

  // ---------- helpers ----------
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function fmtDate(iso, long) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, long ? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function storyFor(text, sceneOverride) {
    const st = analyze(text);
    st.fullText = text;
    if (sceneOverride && SCENES[sceneOverride]) {
      st.scene = sceneOverride;
      st.sceneLabel = SCENES[sceneOverride].label;
      st.sceneIcon = SCENES[sceneOverride].icon;
    }
    return st;
  }
  let toastTimer = 0;
  function toast(msg) {
    els.toastEl.textContent = msg; els.toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (els.toastEl.hidden = true), 2600);
  }
  function esc(s) { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------- rendering ----------
  function renderList() {
    const q = els.search.value.trim().toLowerCase();
    const sorted = [...entries].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    const shown = q ? sorted.filter((e) => e.text.toLowerCase().includes(q) || e.date.includes(q)) : sorted;
    els.list.innerHTML = '';
    for (const e of shown) {
      const st = storyFor(e.text, e.sceneOverride);
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'entry' + (e.id === currentId ? ' active' : '');
      btn.innerHTML = `<span class="ico" aria-hidden="true">${st.sceneIcon}</span>
        <span class="meta"><span class="title">${esc(st.title)}</span><span class="when">${fmtDate(e.date)} · ${st.moodIcon} ${st.mood}</span></span>`;
      btn.addEventListener('click', () => openEntry(e.id));
      li.appendChild(btn);
      els.list.appendChild(li);
    }
    els.empty.hidden = entries.length > 0;
    els.empty.textContent = entries.length && !shown.length ? 'No entries match your search.' : 'No entries yet. Write your first one!';
    if (entries.length && !shown.length) els.empty.hidden = false;
  }

  function renderStory(st, date) {
    animator.setStory(st, { date: fmtDate(date) });
    const chips = [
      `${st.sceneIcon} ${st.sceneLabel}`,
      `${st.moodIcon} ${st.mood}`,
      `${{ morning: '🌅', day: '☀️', evening: '🌇', night: '🌙' }[st.time]} ${st.time}`
    ];
    if (st.people.length) chips.push(`👥 ${st.people.join(', ')}`);
    if (st.props.length) chips.push(st.props.join(' '));
    els.chips.innerHTML = chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('');
    els.mainEvent.textContent = st.mainEvent || '—';
  }

  function previewFromEditor() {
    const text = els.text.value.trim();
    if (!text) {
      renderStory(storyFor('A quiet, ordinary day — waiting to be written.', els.scene.value || null), els.date.value);
      els.mainEvent.textContent = 'Start writing and your animation appears here.';
      return;
    }
    renderStory(storyFor(text, els.scene.value || null), els.date.value);
  }

  function fillSceneSelect() {
    const opts = ['<option value="">Auto-detect</option>'].concat(
      Object.entries(SCENES).map(([id, s]) => `<option value="${id}">${s.icon} ${s.label}</option>`)
    );
    els.scene.innerHTML = opts.join('');
  }

  // ---------- actions ----------
  function newEntry(focus = true) {
    stopReel();
    disarmDelete();
    currentId = null;
    els.date.value = today();
    els.text.value = '';
    els.scene.value = '';
    els.del.hidden = true;
    els.saveState.textContent = '';
    renderList();
    previewFromEditor();
    if (focus === true) els.text.focus({ preventScroll: true });
  }

  function openEntry(id) {
    stopReel();
    disarmDelete();
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    currentId = id;
    els.date.value = e.date;
    els.text.value = e.text;
    els.scene.value = e.sceneOverride || '';
    els.del.hidden = false;
    els.saveState.textContent = 'Saved';
    renderList();
    previewFromEditor();
    if (window.matchMedia('(max-width: 900px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function saveEntry(ev) {
    ev && ev.preventDefault();
    const text = els.text.value.trim();
    if (!text) { toast('Write something first ✍️'); els.text.focus(); return; }
    const now = new Date().toISOString();
    const data = { date: els.date.value || today(), text, sceneOverride: els.scene.value || null, updatedAt: now };
    if (currentId) Object.assign(entries.find((e) => e.id === currentId), data);
    else { currentId = uid(); entries.push(Object.assign({ id: currentId, createdAt: now }, data)); }
    if (persist()) { els.saveState.textContent = 'Saved'; toast('Saved — here’s your day in motion 🎬'); }
    els.del.hidden = false;
    renderList();
    previewFromEditor();
  }

  // Two-step delete built into the page (browser confirm() dialogs are blocked in some embeds).
  let deleteArmed = 0;
  function disarmDelete() { clearTimeout(deleteArmed); deleteArmed = 0; els.del.textContent = 'Delete'; }
  function deleteEntry() {
    if (!currentId) return;
    if (!deleteArmed) {
      els.del.textContent = 'Tap again to delete';
      deleteArmed = setTimeout(disarmDelete, 3000);
      return;
    }
    disarmDelete();
    entries = entries.filter((e) => e.id !== currentId);
    persist();
    toast('Entry deleted');
    newEntry();
  }

  let exampleIdx = Math.floor(Math.random() * EXAMPLES.length);
  function tryExample() {
    exampleIdx = (exampleIdx + 1) % EXAMPLES.length;
    els.text.value = EXAMPLES[exampleIdx];
    els.scene.value = '';
    els.saveState.textContent = currentId ? 'Unsaved changes' : 'Example — save it to keep it';
    previewFromEditor();
  }

  // ---------- reel: play every entry back to back ----------
  function playReel() {
    if (reel) { stopReel(); return; }
    if (!entries.length) { toast('Save a few entries first, then play your reel.'); return; }
    const list = [...entries].sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
    reel = { list, index: -1, timer: 0 };
    els.playAll.textContent = '■ Stop reel';
    nextInReel();
  }
  function nextInReel() {
    if (!reel) return;
    reel.index++;
    if (reel.index >= reel.list.length) { stopReel(); toast('That’s your story so far ✨'); return; }
    const e = reel.list[reel.index];
    renderStory(storyFor(e.text, e.sceneOverride), e.date);
    els.reelBadge.hidden = false;
    els.reelBadge.textContent = `Reel ${reel.index + 1} / ${reel.list.length}`;
    reel.timer = setTimeout(nextInReel, DURATION * 1000 - 50);
  }
  function stopReel() {
    if (!reel) return;
    clearTimeout(reel.timer);
    reel = null;
    els.reelBadge.hidden = true;
    els.playAll.textContent = '▶ Play my reel';
  }

  async function downloadVideo() {
    if (!animator.canRecord()) { toast('Video export isn’t supported in this browser.'); return; }
    stopReel();
    els.download.disabled = true;
    const label = els.download.textContent;
    els.download.textContent = '● Recording…';
    try {
      const blob = await animator.record();
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `daily-reel-${els.date.value || today()}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Video saved 🎥');
    } catch (err) {
      toast('Recording failed: ' + (err && err.message ? err.message : err));
    } finally {
      els.download.disabled = false;
      els.download.textContent = label;
    }
  }

  function exportEntries() {
    const blob = new Blob([JSON.stringify({ app: 'daily-reel', version: 1, entries }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `daily-reel-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    closeMenu();
  }

  function importEntries(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incoming = (Array.isArray(data) ? data : data.entries || []).filter((e) => e && typeof e.text === 'string');
        let added = 0;
        for (const e of incoming) {
          if (entries.some((x) => x.id === e.id)) continue;
          entries.push({ id: e.id || uid(), date: e.date || today(), text: e.text, sceneOverride: e.sceneOverride || null, createdAt: e.createdAt || new Date().toISOString(), updatedAt: e.updatedAt || new Date().toISOString() });
          added++;
        }
        persist(); renderList();
        toast(`Imported ${added} entr${added === 1 ? 'y' : 'ies'}`);
      } catch { toast('That file isn’t a valid backup.'); }
    };
    reader.readAsText(file);
    closeMenu();
  }

  function closeMenu() { els.menu.hidden = true; els.menuBtn.setAttribute('aria-expanded', 'false'); }

  // ---------- wiring ----------
  if (window.DAILYREEL_EMBED) { els.download.hidden = true; els.exportBtn.hidden = true; }
  fillSceneSelect();
  els.form.addEventListener('submit', saveEntry);
  els.newBtn.addEventListener('click', newEntry);
  els.del.addEventListener('click', deleteEntry);
  els.example.addEventListener('click', tryExample);
  els.replay.addEventListener('click', () => { stopReel(); animator.restart(); });
  els.download.addEventListener('click', downloadVideo);
  els.playAll.addEventListener('click', playReel);
  els.search.addEventListener('input', renderList);
  els.scene.addEventListener('change', () => { stopReel(); els.saveState.textContent = currentId ? 'Unsaved changes' : ''; previewFromEditor(); });
  els.date.addEventListener('change', () => { els.saveState.textContent = currentId ? 'Unsaved changes' : ''; previewFromEditor(); });
  els.text.addEventListener('input', () => {
    stopReel();
    els.saveState.textContent = currentId ? 'Unsaved changes' : '';
    clearTimeout(typingTimer);
    typingTimer = setTimeout(previewFromEditor, 700);
  });
  els.text.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveEntry(e); });
  els.menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = els.menu.hidden;
    els.menu.hidden = !open; els.menuBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => { if (!els.menu.hidden && !els.menu.contains(e.target)) closeMenu(); });
  els.exportBtn.addEventListener('click', exportEntries);
  els.importInput.addEventListener('change', () => els.importInput.files[0] && importEntries(els.importInput.files[0]));
  document.addEventListener('visibilitychange', () => (document.hidden ? animator.stop() : animator.play()));

  // start
  renderList();
  if (entries.length) {
    const latest = [...entries].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))[0];
    openEntry(latest.id);
  } else {
    newEntry(false);
    els.text.value = EXAMPLES[0];
    els.saveState.textContent = 'Example — save it to keep it';
    previewFromEditor();
  }
})();
