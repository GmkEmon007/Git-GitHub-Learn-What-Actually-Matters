/* =========================================================
   App shell: routing, sidebar, progress, search, pages.
   ========================================================= */
(function (global) {
  'use strict';
  const { esc } = MD;
  const { PARTS, LABS, QUIZZES, FLASHCARDS, CHEATSHEET } = PB_DATA;
  const $ = s => document.querySelector(s);

  /* ---------- lessons from <script type="text/markdown"> ---------- */
  const LESSONS = [...document.querySelectorAll('script[type="text/markdown"][data-lesson]')].map(s => ({
    id: s.dataset.lesson, part: +s.dataset.part, title: s.dataset.title, md: s.textContent.replace(/^\n/, ''),
    text: s.textContent.toLowerCase()
  }));
  const byId = id => LESSONS.find(l => l.id === String(id));

  /* ---------- progress store ---------- */
  const KEY = 'git-playbook-v1';
  const store = {
    d: (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })(),
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* ignore */ } },
    get done() { return (this.d.done = this.d.done || {}); },
    get labs() { return (this.d.labs = this.d.labs || {}); },
    get quiz() { return (this.d.quiz = this.d.quiz || {}); },
    toggle(id) { if (this.done[id]) delete this.done[id]; else this.done[id] = Date.now(); this.save(); refreshProgress(); },
    complete(id) { this.done[id] = this.done[id] || Date.now(); this.save(); refreshProgress(); },
    markLab(id) { this.labs[id] = Date.now(); this.save(); },
    saveQuiz(k, c, t) { const old = this.quiz[k]; if (!old || c > old[0]) this.quiz[k] = [c, t]; this.save(); },
    setLast(id) { this.d.last = id; this.save(); },
    reset() { this.d = {}; this.save(); refreshProgress(); }
  };

  /* ---------- theme ---------- */
  const setTheme = t => { document.documentElement.dataset.theme = t; localStorage.setItem('git-playbook-theme', t); $('#themeBtn').textContent = t === 'light' ? '🌙' : '☀️'; };
  setTheme(localStorage.getItem('git-playbook-theme') || 'dark');
  $('#themeBtn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
  $('#menuBtn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  const overlay = $('#overlay');
  if (overlay) overlay.addEventListener('click', () => document.body.classList.remove('nav-open'));

  /* ---------- sidebar ---------- */
  function buildSidebar() {
    const nav = $('#nav');
    const collapsed = JSON.parse(localStorage.getItem('git-playbook-collapsed') || '{}');
    nav.innerHTML = `<div class="nav-main">
        <a href="#/" data-route="home">🏠 Home</a>
        <a href="#/playground" data-route="playground">💻 Git Playground</a>
        <a href="#/cheatsheet" data-route="cheatsheet">📜 Cheat Sheet</a>
        <a href="#/flashcards" data-route="flashcards">🃏 Flashcards</a>
        <a href="#/exam" data-route="exam">🎓 Final Exam</a>
      </div>` + PARTS.map(p => {
      const ls = LESSONS.filter(l => l.part === p.id);
      return `<div class="nav-part ${collapsed[p.id] ? 'collapsed' : ''}" data-part="${p.id}">
        <button class="nav-part-head">${p.icon} ${esc(p.title)} <span class="pp" data-pp="${p.id}"></span><span class="caret">▾</span></button>
        <div class="nav-lessons">${ls.map(l => `<a class="nav-lesson" href="#/lesson/${l.id}" data-lesson="${l.id}"><span class="num">${/^\d+$/.test(l.id) ? l.id : '★'}</span>${esc(l.title)}<span class="check"></span></a>`).join('')}</div></div>`;
    }).join('');
    nav.addEventListener('click', e => {
      const h = e.target.closest('.nav-part-head');
      if (h) {
        const part = h.parentElement; part.classList.toggle('collapsed');
        collapsed[part.dataset.part] = part.classList.contains('collapsed');
        localStorage.setItem('git-playbook-collapsed', JSON.stringify(collapsed));
      }
      if (e.target.closest('a')) document.body.classList.remove('nav-open');
    });
  }

  function refreshProgress() {
    const n = LESSONS.filter(l => store.done[l.id]).length;
    const pct = Math.round(n / LESSONS.length * 100);
    $('#topBar').style.width = pct + '%';
    $('#topPct').textContent = `${n}/${LESSONS.length} lessons`;
    document.querySelectorAll('.nav-lesson').forEach(a => a.classList.toggle('done', !!store.done[a.dataset.lesson]));
    PARTS.forEach(p => {
      const ls = LESSONS.filter(l => l.part === p.id);
      const el = document.querySelector(`[data-pp="${p.id}"]`);
      if (el) el.textContent = `${ls.filter(l => store.done[l.id]).length}/${ls.length}`;
    });
  }

  /* ---------- search ---------- */
  $('#search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.nav-lesson').forEach(a => {
      const l = byId(a.dataset.lesson);
      a.classList.toggle('hidden', !!q && !(l.title.toLowerCase().includes(q) || l.text.includes(q)));
    });
    document.querySelectorAll('.nav-part').forEach(p => {
      if (q) p.classList.remove('collapsed');
      p.style.display = q && !p.querySelector('.nav-lesson:not(.hidden)') ? 'none' : '';
    });
  });
  $('#search').addEventListener('keydown', e => {
    if (e.key === 'Enter') { const a = document.querySelector('.nav-lesson:not(.hidden)'); if (a) location.hash = a.getAttribute('href'); }
    if (e.key === 'Escape') { e.target.value = ''; e.target.dispatchEvent(new Event('input')); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('#search').focus(); }
  });

  /* ---------- copy buttons ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]');
    if (b) {
      const code = b.closest('.code').querySelector('pre').innerText.replace(/^\$ /gm, '');
      copy(code, b);
    }
    const cs = e.target.closest('[data-cscopy]');
    if (cs) copy(cs.textContent, null, 'Copied: ' + cs.textContent);
  });
  function copy(text, btn, msg) {
    const done = () => { if (btn) { btn.textContent = 'Copied!'; btn.classList.add('ok'); setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('ok'); }, 1400); } else toast(msg || 'Copied'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } t.remove(); done(); }
  }

  /* ---------- toast + confetti ---------- */
  let tt;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2400); }
  function celebrate(msg) {
    toast('🎉 ' + msg);
    const colors = ['#f05033', '#58a6ff', '#3fb950', '#bc8cff', '#d29922', '#f778ba'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
      c.style.animationDelay = Math.random() * .4 + 's';
      c.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4200);
    }
  }

  /* ---------- pages ---------- */
  const view = $('#view');

  function heroGraph() {
    const sim = new GitSim();
    sim.setup(['git init', 'touch a', 'git add .', 'git commit -m "init"', 'git switch -c feature', 'touch b', 'git add .', 'git commit -m "feat"', 'touch c', 'git add .', 'git commit -m "more"',
      'git switch main', 'touch d', 'git add .', 'git commit -m "fix"', 'git merge feature', 'touch e', 'git add .', 'git commit -m "ship"']);
    const box = document.createElement('div');
    SimUI.renderGraph(box, sim.graphModel('local'), { small: true });
    return box.innerHTML;
  }

  function pageHome() {
    const n = LESSONS.filter(l => store.done[l.id]).length;
    const labsDone = Object.keys(store.labs).filter(k => LABS[k]).length;
    const quizzes = Object.keys(store.quiz).length;
    const last = store.d.last && byId(store.d.last);
    const firstUndone = LESSONS.find(l => !store.done[l.id]) || LESSONS[0];
    view.className = 'content';
    view.innerHTML = `
      <section class="hero">
        <div class="hero-body">
          <div class="chip accent">📘 Interactive Playbook · ${LESSONS.length} lessons · ${Object.keys(LABS).length} hands-on labs</div>
          <h1>Learn Git &amp; GitHub<br>by <span class="hero-git">doing</span>.</h1>
          <p>Complete practical notes — from <code>git init</code> to Pull Requests, rebase and GitHub Actions — with a real Git simulator built right into every lesson. Type commands, watch the commit graph change, and get instant feedback.</p>
          <div class="cta">
            <a class="btn primary" href="#/lesson/${(last || firstUndone).id}">${last ? '▶ Continue: ' + esc(last.title) : '🚀 Start learning'}</a>
            <a class="btn" href="#/playground">💻 Open playground</a>
            <a class="btn" href="#/cheatsheet">📜 Cheat sheet</a>
          </div>
        </div>
        <div class="hero-preview">
          <div class="hero-preview-top">
            <div class="dots"><i></i><i></i><i></i></div>
            <span class="hero-preview-label">Live Commit Graph</span>
          </div>
          <div class="hero-graph-box">${heroGraph()}</div>
        </div>
      </section>
      <div class="stats">
        <div class="stat"><b>${Math.round(n / LESSONS.length * 100)}%</b><span>course progress</span><div class="pbar" style="margin-top:8px"><span style="width:${n / LESSONS.length * 100}%"></span></div></div>
        <div class="stat"><b>${n}<span class="muted" style="font-size:1rem">/${LESSONS.length}</span></b><span>lessons completed</span></div>
        <div class="stat"><b>${labsDone}<span class="muted" style="font-size:1rem">/${Object.keys(LABS).length}</span></b><span>labs finished</span></div>
        <div class="stat"><b>${quizzes}</b><span>quizzes taken</span></div>
      </div>
      <h2>📚 Course map</h2>
      <div class="parts-grid">${PARTS.map(p => {
        const ls = LESSONS.filter(l => l.part === p.id), d = ls.filter(l => store.done[l.id]).length;
        const q = store.quiz['quiz-' + p.id];
        return `<a class="part-card" href="#/lesson/${(ls.find(l => !store.done[l.id]) || ls[0]).id}">
          <div class="pi">${p.icon}</div><h3>Part ${p.id}: ${esc(p.title)}</h3><p>${esc(p.desc)}</p>
          <div class="row" style="justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px"><span>${d}/${ls.length} lessons</span><span>${q ? `quiz ${q[0]}/${q[1]}` : ''}</span></div>
          <div class="pbar"><span style="width:${d / ls.length * 100}%"></span></div></a>`;
      }).join('')}</div>
      <h2>🧰 Practice tools</h2>
      <div class="tools-grid">
        <a class="part-card" href="#/playground"><div class="pi">💻</div><h3>Git Playground</h3><p>A full simulated terminal + commit graph + fake GitHub remote. Break things safely.</p></a>
        <a class="part-card" href="#/cheatsheet"><div class="pi">📜</div><h3>Cheat Sheet</h3><p>${CHEATSHEET.length} essential commands, filterable, click to copy.</p></a>
        <a class="part-card" href="#/flashcards"><div class="pi">🃏</div><h3>Flashcards</h3><p>${FLASHCARDS.length} cards to memorise commands and concepts.</p></a>
        <a class="part-card" href="#/exam"><div class="pi">🎓</div><h3>Final Exam</h3><p>15 random questions from every part.</p></a>
      </div>
      <p class="muted" style="margin-top:30px;font-size:13px">Progress is saved in this browser. <a href="#" id="resetProgress">Reset progress</a> · Tip: press <code>/</code> to search, <code>←</code>/<code>→</code> to move between lessons.</p>`;
    $('#resetProgress').addEventListener('click', e => { e.preventDefault(); if (confirm('Reset all progress?')) { store.reset(); localStorage.removeItem(KEY); pageHome(); } });
  }

  function pageLesson(id) {
    const l = byId(id);
    if (!l) return pageHome();
    store.setLast(l.id);
    const i = LESSONS.indexOf(l), prev = LESSONS[i - 1], next = LESSONS[i + 1];
    const part = PARTS.find(p => p.id === l.part);
    const words = l.md.split(/\s+/).length;
    const labs = (l.md.match(/^::lab /gm) || []).length;
    view.className = 'content';
    view.innerHTML = `<article class="lesson">
      <div class="lesson-meta"><span class="chip accent">${part.icon} Part ${part.id} · ${esc(part.title)}</span><span class="chip">Lesson ${/^\d+$/.test(l.id) ? l.id : '★'} of ${LESSONS.length}</span>
        <span class="chip">⏱ ${Math.max(2, Math.round(words / 180))} min</span>${labs ? `<span class="chip">🧪 ${labs} lab${labs > 1 ? 's' : ''}</span>` : ''}</div>
      <h1>${esc(l.title)}</h1>
      ${MD.render(l.md)}
      <div class="lesson-foot">
        <button class="btn ${store.done[l.id] ? '' : 'primary'}" id="doneBtn">${store.done[l.id] ? '✓ Completed (click to undo)' : '✓ Mark as complete'}</button>
        <div class="nav-btns">
          ${prev ? `<a class="nav-btn" href="#/lesson/${prev.id}"><small>← Previous</small>${esc(prev.title)}</a>` : ''}
          ${next ? `<a class="nav-btn next" href="#/lesson/${next.id}" id="nextBtn"><small>Next →</small>${esc(next.title)}</a>` : `<a class="nav-btn next" href="#/exam"><small>Finish →</small>🎓 Final Exam</a>`}
        </div>
      </div></article>`;
    Widgets.mountAll(view);
    $('#doneBtn').addEventListener('click', () => {
      const was = !!store.done[l.id];
      store.toggle(l.id);
      if (!was) {
        if (LESSONS.every(x => store.done[x.id])) celebrate('You completed the whole playbook!');
        else toast('✓ Lesson complete');
        if (next) location.hash = '#/lesson/' + next.id; else pageLesson(l.id);
      } else pageLesson(l.id);
    });
  }

  function pagePlayground() {
    view.className = 'content wide';
    view.innerHTML = `<div class="lesson"><div class="lesson-meta"><span class="chip accent">💻 Sandbox</span></div>
      <h1>Git Playground</h1>
      <p class="muted">A safe, simulated Git + GitHub environment. Pick a scenario or practise freely. Click files to <code>cat</code> them, hover them for quick actions, click commits in the graph to <code>git show</code> them. Use <kbd>↑</kbd>/<kbd>↓</kbd> for history and <kbd>Tab</kbd> to autocomplete.</p>
      <div id="pg"></div>
      <div class="playground-help">
        <div class="card"><div class="w-title">🚀 Quick start</div><div class="mono" style="font-size:12.5px;line-height:1.9">git init<br>touch index.html<br>git add .<br>git commit -m "Initial commit"<br>git switch -c feature/navbar</div></div>
        <div class="card"><div class="w-title">☁️ Try GitHub</div><div class="mono" style="font-size:12.5px;line-height:1.9">git remote add origin https://github.com/you/app.git<br>git push -u origin main<br>👥 Teammate pushes → git pull</div></div>
        <div class="card"><div class="w-title">🧰 Shell helpers</div><div class="mono" style="font-size:12.5px;line-height:1.9">edit file  — append a line<br>echo "text" &gt; file<br>resolve file ours|theirs|both<br>restart — start over</div></div>
      </div></div>`;
    const scenarios = [{ label: '🆓 Free play — empty folder', lab: null }, ...Object.values(LABS).map(l => ({ label: '🧪 ' + l.title, lab: l }))];
    SimUI.createSim($('#pg'), { scenarios, title: '💻 Git Playground', onComplete: l => store.markLab(l.id) });
  }

  function pageCheatsheet() {
    const cats = [...new Set(CHEATSHEET.map(c => c[0]))];
    view.className = 'content wide';
    view.innerHTML = `<div class="lesson"><div class="lesson-meta"><span class="chip accent">📜 Reference</span></div><h1>Git Cheat Sheet</h1>
      <div class="row"><input class="txt" id="csq" placeholder="Filter commands… (e.g. stash, undo, remote)" style="flex:1;max-width:420px"></div>
      <div class="cs-filters"><button class="on" data-cat="">All</button>${cats.map(c => `<button data-cat="${c}">${c}</button>`).join('')}</div>
      <div class="cs-grid"></div><p class="muted" style="font-size:13px">Click any command to copy it.</p></div>`;
    let cat = '';
    const draw = () => {
      const q = $('#csq').value.toLowerCase();
      $('.cs-grid').innerHTML = CHEATSHEET.filter(c => (!cat || c[0] === cat) && (!q || (c[1] + c[2] + c[0]).toLowerCase().includes(q)))
        .map(c => `<div class="cs-item"><span class="cat">${c[0]}</span><code data-cscopy>${esc(c[1])}</code><span>${esc(c[2])}</span></div>`).join('') || '<p class="muted">No match.</p>';
    };
    $('#csq').addEventListener('input', draw);
    $('.cs-filters').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; document.querySelectorAll('.cs-filters button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
    draw();
  }

  function pageFlashcards() {
    let order = FLASHCARDS.map((_, i) => i), i = 0, known = new Set();
    view.className = 'content';
    view.innerHTML = `<div class="lesson"><div class="lesson-meta"><span class="chip accent">🃏 Memorise</span></div><h1>Flashcards</h1>
      <p class="muted">Click the card (or press <kbd>Space</kbd>) to flip. Use <kbd>←</kbd>/<kbd>→</kbd> to move.</p>
      <div class="fc-wrap"><div class="fc"><div class="fc-face front"></div><div class="fc-face back"></div></div></div>
      <div class="row" style="justify-content:center"><button class="btn" data-fc="prev">←</button><span class="fc-count muted mono"></span><button class="btn" data-fc="next">→</button>
      <button class="btn" data-fc="shuffle">🔀 Shuffle</button><button class="btn primary" data-fc="know">✓ I know this</button></div></div>`;
    const fc = $('.fc');
    const draw = () => {
      const [q, a] = FLASHCARDS[order[i]];
      fc.classList.remove('flip');
      setTimeout(() => {
        $('.fc .front').innerHTML = `<div class="big">${MD.inline(q)}</div><small>click to reveal</small>`;
        $('.fc .back').innerHTML = `<div style="font-size:1.15rem">${MD.inline(a)}</div><small>${known.has(order[i]) ? '✓ known' : ''}</small>`;
      }, 150);
      $('.fc-count').textContent = `${i + 1} / ${order.length} · known ${known.size}`;
    };
    fc.addEventListener('click', () => fc.classList.toggle('flip'));
    const act = a => {
      if (a === 'prev') i = (i - 1 + order.length) % order.length;
      if (a === 'next') i = (i + 1) % order.length;
      if (a === 'shuffle') { order.sort(() => Math.random() - .5); i = 0; }
      if (a === 'know') { known.add(order[i]); if (known.size === FLASHCARDS.length) celebrate('All flashcards known!'); i = (i + 1) % order.length; }
      draw();
    };
    view.addEventListener('click', e => { const b = e.target.closest('[data-fc]'); if (b) act(b.dataset.fc); });
    pageKeys = e => { if (e.key === ' ') { e.preventDefault(); fc.classList.toggle('flip'); } if (e.key === 'ArrowLeft') act('prev'); if (e.key === 'ArrowRight') act('next'); };
    draw();
  }

  function finalQuestions() {
    const all = Object.values(QUIZZES).flat();
    return all.sort(() => Math.random() - .5).slice(0, 15);
  }
  function pageExam() {
    view.className = 'content';
    const best = store.quiz['quiz-final'];
    view.innerHTML = `<div class="lesson"><div class="lesson-meta"><span class="chip accent">🎓 Assessment</span>${best ? `<span class="chip">Best: ${best[0]}/${best[1]}</span>` : ''}</div>
      <h1>Final Exam</h1><p class="muted">15 random questions from all 8 parts. Each attempt is different.</p><div class="widget" data-widget="quiz" data-arg="final"></div></div>`;
    Widgets.mountAll(view);
  }

  /* ---------- router ---------- */
  let pageKeys = null;
  function route() {
    pageKeys = null;
    const h = location.hash.replace(/^#\/?/, '');
    const [r, arg] = h.split('/');
    document.querySelectorAll('.sim.fullscreen').forEach(s => s.classList.remove('fullscreen'));
    document.body.style.overflow = '';
    if (r === 'lesson') pageLesson(arg);
    else if (r === 'playground') pagePlayground();
    else if (r === 'cheatsheet') pageCheatsheet();
    else if (r === 'flashcards') pageFlashcards();
    else if (r === 'exam') pageExam();
    else pageHome();
    document.querySelectorAll('[data-route]').forEach(a => a.classList.toggle('active', (a.dataset.route === (r || 'home'))));
    document.querySelectorAll('.nav-lesson').forEach(a => a.classList.toggle('active', r === 'lesson' && a.dataset.lesson === arg));
    const act = document.querySelector('.nav-lesson.active');
    if (act) { act.closest('.nav-part').classList.remove('collapsed'); act.scrollIntoView({ block: 'nearest' }); }
    window.scrollTo(0, 0);
  }
  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (pageKeys) return pageKeys(e);
    const m = location.hash.match(/^#\/lesson\/(\w+)/);
    if (!m) return;
    const i = LESSONS.findIndex(l => l.id === m[1]);
    if (e.key === 'ArrowRight' && LESSONS[i + 1]) location.hash = '#/lesson/' + LESSONS[i + 1].id;
    if (e.key === 'ArrowLeft' && LESSONS[i - 1]) location.hash = '#/lesson/' + LESSONS[i - 1].id;
  });

  global.App = { store, celebrate, toast, finalQuestions, LESSONS };
  buildSidebar();
  refreshProgress();
  window.addEventListener('hashchange', route);
  route();
})(window);
