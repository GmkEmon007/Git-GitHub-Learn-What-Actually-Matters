/* =========================================================
   Interactive widgets embedded in lessons via  ::name arg
   ========================================================= */
(function (global) {
  'use strict';
  const { esc } = MD;
  const D = () => global.PB_DATA;

  const W = {};

  /* ---------- guided simulator lab ---------- */
  W.lab = (el, arg) => {
    const lab = D().LABS[arg];
    if (!lab) { el.textContent = 'Unknown lab ' + arg; return; }
    SimUI.createSim(el, { lab, onComplete: l => App.store.markLab(l.id) });
  };

  /* ---------- quiz ---------- */
  W.quiz = (el, arg) => {
    const qs = arg === 'final' ? App.finalQuestions() : (D().QUIZZES[arg] || []);
    renderQuiz(el, qs, arg === 'final' ? '🎓 Final Exam' : `📝 Part ${arg} Quiz`, 'quiz-' + arg);
  };
  function renderQuiz(el, qs, title, key) {
    let answered = 0, correct = 0;
    el.innerHTML = `<div class="card"><div class="w-title">${title} <span class="tag">${qs.length} questions</span></div>
      ${qs.map(([q, opts, ans, exp], i) => `<div class="quiz-q" data-i="${i}"><h4><span class="qn">Q${i + 1}.</span>${MD.inline(q)}</h4>
        ${opts.map((o, j) => `<button class="quiz-opt" data-j="${j}">${MD.inline(o)}</button>`).join('')}
        <div class="quiz-exp">${MD.inline(exp)}</div></div>`).join('')}
      <div class="row"><span class="quiz-score"></span><button class="btn small" data-retry hidden>↺ Try again</button></div></div>`;
    el.querySelectorAll('.quiz-q').forEach(qEl => {
      const [, , ans] = qs[+qEl.dataset.i];
      qEl.addEventListener('click', e => {
        const b = e.target.closest('.quiz-opt'); if (!b || b.disabled) return;
        const j = +b.dataset.j;
        qEl.querySelectorAll('.quiz-opt').forEach((o, k) => { o.disabled = true; if (k === ans) o.classList.add('correct'); });
        if (j === ans) correct++; else b.classList.add('wrong');
        qEl.querySelector('.quiz-exp').classList.add('show');
        answered++;
        const sc = el.querySelector('.quiz-score');
        sc.textContent = `Score: ${correct} / ${answered}${answered === qs.length ? (correct === qs.length ? ' — perfect! 🎉' : correct / qs.length >= .7 ? ' — well done! 👍' : ' — review the lesson and retry 💪') : ''}`;
        if (answered === qs.length) {
          el.querySelector('[data-retry]').hidden = false;
          App.store.saveQuiz(key, correct, qs.length);
          if (correct === qs.length) App.celebrate('Perfect score!');
        }
      });
    });
    el.querySelector('[data-retry]').addEventListener('click', () => renderQuiz(el, key === 'quiz-final' ? App.finalQuestions() : qs, title, key));
  }

  /* ---------- three areas animation ---------- */
  W.areas = el => {
    const files = [{ n: 'index.html', at: 'work', st: 'U' }, { n: 'style.css', at: 'work', st: 'U' }];
    const draw = (msg) => {
      const box = at => files.filter(f => f.at === at).map(f => `<span class="fchip"><span class="badge b-${f.st === '✓' ? 'C' : f.st}">${f.st}</span>${f.n}</span>`).join('') || '<div class="muted" style="font-size:12px">—</div>';
      el.querySelector('.areas3').innerHTML = `
        <div class="abox ${msg && msg.lit === 'work' ? 'lit' : ''}"><h5>📁 Working Directory</h5>${box('work')}</div><div class="aarrow">git add<br>→</div>
        <div class="abox ${msg && msg.lit === 'stage' ? 'lit' : ''}"><h5>📋 Staging Area</h5>${box('stage')}</div><div class="aarrow">git commit<br>→</div>
        <div class="abox ${msg && msg.lit === 'repo' ? 'lit' : ''}"><h5>🗃️ Repository</h5>${box('repo')}<div class="muted" style="font-size:12px">${commits} commit${commits === 1 ? '' : 's'}</div></div>`;
      el.querySelector('.amsg').innerHTML = msg ? msg.t : 'Click the buttons to move files through Git\'s three areas.';
    };
    let commits = 0;
    el.innerHTML = `<div class="card"><div class="w-title">🎬 Working → Stage → Commit <span class="tag">interactive</span></div>
      <div class="areas3"></div><p class="amsg muted" style="margin:0 0 10px"></p>
      <div class="row"><button class="btn small" data-a="edit">✏️ Edit index.html</button><button class="btn small" data-a="add">git add .</button><button class="btn small" data-a="addone">git add index.html</button><button class="btn small primary" data-a="commit">git commit -m "…"</button><button class="btn small" data-a="reset">↺</button></div></div>`;
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      let msg;
      if (a === 'edit') {
        const f = files[0];
        if (f.at === 'repo' || f.st === '✓') { f.at = 'work'; f.st = 'M'; msg = { t: '<b>index.html</b> was changed after the last commit → <b>M</b> (modified).', lit: 'work' }; }
        else msg = { t: 'The file is already changed. Stage it with git add.', lit: 'work' };
      } else if (a === 'add' || a === 'addone') {
        const sel = files.filter(f => f.at === 'work' && (a === 'add' || f.n === 'index.html'));
        sel.forEach(f => { f.at = 'stage'; f.st = f.st === 'U' ? 'A' : 'M'; });
        msg = sel.length ? { t: `Staged ${sel.map(f => '<b>' + f.n + '</b>').join(', ')} — selected for the <b>next commit</b>.`, lit: 'stage' } : { t: 'Nothing in the working directory to stage.' };
      } else if (a === 'commit') {
        const sel = files.filter(f => f.at === 'stage');
        if (!sel.length) msg = { t: '<span style="color:var(--red)">nothing to commit</span> — stage something first!' };
        else { sel.forEach(f => { f.at = 'repo'; f.st = '✓'; }); commits++; msg = { t: `📸 Snapshot #${commits} saved in history. Working tree clean for these files.`, lit: 'repo' }; }
      } else { files.forEach(f => { f.at = 'work'; f.st = 'U'; }); commits = 0; }
      draw(msg);
    });
    draw();
  };

  /* ---------- status code decoder ---------- */
  W.status = el => {
    const X = { ' ': 'unchanged in staging', M: 'modified & staged', A: 'new file staged', D: 'deletion staged', R: 'rename staged', '?': 'untracked', U: 'unmerged (conflict)' };
    const Y = { ' ': 'no new changes in working dir', M: 'modified (not staged)', D: 'deleted (not staged)', '?': 'untracked', U: 'unmerged (conflict)' };
    const examples = ['?? test.txt', ' M index.html', 'M  style.css', 'MM style.css', 'A  app.js', ' D old.txt', 'UU index.html'];
    el.innerHTML = `<div class="card"><div class="w-title">🔎 Status code decoder <span class="tag">try it</span></div>
      <div class="row"><input class="txt mono" style="flex:1;min-width:220px" value="MM style.css" spellcheck="false"></div>
      <div class="row" style="margin-top:8px">${examples.map(x => `<button class="mini-btn mono" data-ex="${x}">${x.replace(/ /g, '·')}</button>`).join('')}</div>
      <div class="sd-out" style="margin-top:12px"></div></div>`;
    const inp = el.querySelector('input'), outEl = el.querySelector('.sd-out');
    const upd = () => {
      const v = inp.value.padEnd(3, ' ');
      const x = v[0], y = v[1], f = v.slice(3) || 'file';
      if (x === '?' && y === '?') { outEl.innerHTML = `<b class="mono" style="color:var(--red)">??</b> → <b>${esc(f)}</b> is <b>untracked</b>: Git sees it but is not tracking it. Run <code>git add ${esc(f)}</code>.`; return; }
      outEl.innerHTML = `<div class="table-wrap"><table><tr><th>Column</th><th>Char</th><th>Meaning</th></tr>
        <tr><td>X — staging area</td><td class="mono" style="color:var(--green)">${x === ' ' ? '·' : esc(x)}</td><td>${X[x] || 'unknown'}</td></tr>
        <tr><td>Y — working directory</td><td class="mono" style="color:var(--red)">${y === ' ' ? '·' : esc(y)}</td><td>${Y[y] || 'unknown'}</td></tr></table></div>
        <p style="margin:6px 0 0">${x === 'M' && y === 'M' ? `You staged <b>${esc(f)}</b>, then edited it again. The commit would contain only the staged version!` :
          x !== ' ' && y === ' ' ? `<b>${esc(f)}</b> is ready to commit.` : x === ' ' && y === 'M' ? `<b>${esc(f)}</b> changed but is not staged yet → <code>git add ${esc(f)}</code>` :
          x === 'U' ? 'Merge conflict! Edit the file, then git add it.' : ''}</p>`;
    };
    inp.addEventListener('input', upd);
    el.addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (b) { inp.value = b.dataset.ex; upd(); } });
    upd();
  };

  /* ---------- reset modes visualizer ---------- */
  W.reset = el => {
    const modes = {
      soft: { repo: ['A', 'B', 'C̶'], stage: 'change C (staged)', work: 'change C', note: '<b>--soft</b>: HEAD moves back to B. Change C stays <b>staged</b> — perfect to redo the commit.' },
      mixed: { repo: ['A', 'B', 'C̶'], stage: null, work: 'change C (unstaged)', note: '<b>--mixed</b> (default): HEAD moves back, change C is <b>unstaged</b> but still in your files.' },
      hard: { repo: ['A', 'B', 'C̶'], stage: null, work: null, note: '<b>--hard</b> ⚠️: HEAD moves back and change C is <b>discarded</b> from staging AND your files.' }
    };
    el.innerHTML = `<div class="card"><div class="w-title">⏪ git reset HEAD~1 — compare the modes</div>
      <div class="seg"><button data-m="before" class="on">Before</button><button data-m="soft">--soft</button><button data-m="mixed">--mixed</button><button data-m="hard">--hard</button></div>
      <div class="rv-grid"></div><p class="rv-note" style="margin:10px 0 0"></p></div>`;
    const draw = m => {
      el.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === m));
      const before = m === 'before', d = modes[m];
      const commits = ['A', 'B', 'C'].map(c => `<div class="rv-item ${!before && c === 'C' ? 'gone' : ''}">● Commit ${c}${(before ? c === 'C' : c === 'B') ? ' ← HEAD' : ''}</div>`).join('');
      el.querySelector('.rv-grid').innerHTML = `
        <div class="rv-box"><h5>🗃️ Repository (HEAD)</h5>${commits}</div>
        <div class="rv-box"><h5>📋 Staging Area</h5>${before ? '<div class="muted" style="font-size:12px">clean</div>' : d.stage ? `<div class="rv-item new">${d.stage}</div>` : '<div class="muted" style="font-size:12px">empty</div>'}</div>
        <div class="rv-box"><h5>📁 Working Directory</h5>${before ? '<div class="rv-item">files = A + B + C</div>' : d.work ? `<div class="rv-item new">files still contain ${d.work}</div>` : '<div class="rv-item warn">change C is GONE</div>'}</div>`;
      el.querySelector('.rv-note').innerHTML = before ? 'History: A → B → C, HEAD on C. Pick a mode to see what <code>git reset &lt;mode&gt; HEAD~1</code> does.' : d.note;
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) draw(b.dataset.m); });
    draw('before');
  };

  /* ---------- merge / rebase / squash visualiser (uses the simulator) ---------- */
  W.history = el => {
    const setup = ['git init', 'echo "a" > a.txt', 'git add .', 'git commit -m "A"', 'echo "b" > b.txt', 'git add .', 'git commit -m "B"',
      'git switch -c feature', 'echo "c" > c.txt', 'git add .', 'git commit -m "C"', 'echo "d" > d.txt', 'git add .', 'git commit -m "D"',
      'git switch main', 'echo "e" > e.txt', 'git add .', 'git commit -m "E"', 'echo "f" > f.txt', 'git add .', 'git commit -m "F"'];
    const acts = {
      before: { cmds: [], note: 'Two branches diverged from B. main has E, F — feature has C, D.' },
      merge: { cmds: ['git merge feature'], note: '<b>Merge</b>: a new merge commit ties both histories together. Nothing is rewritten — safe for shared branches.' },
      rebase: { cmds: ['git switch feature', 'git rebase main', 'git switch main', 'git merge feature'], note: '<b>Rebase</b>: C and D are replayed on top of F as NEW commits C\' and D\' (faded originals are abandoned). Linear history, but rewritten.' },
      squash: { cmds: ['git merge --squash feature', 'git commit -m "Add feature (C+D)"'], note: '<b>Squash</b>: all of feature\'s changes become ONE new commit on main. Clean main history.' }
    };
    el.innerHTML = `<div class="card"><div class="w-title">🔀 Merge vs Rebase vs Squash <span class="tag">live graph</span></div>
      <div class="seg"><button data-h="before" class="on">Before</button><button data-h="merge">git merge</button><button data-h="rebase">git rebase</button><button data-h="squash">squash merge</button></div>
      <div class="sim-graph" style="margin-top:12px;background:var(--bg);border:1px solid var(--border);border-radius:10px"></div>
      <p class="h-note" style="margin:10px 0 0"></p><pre class="h-cmd mono muted" style="padding:0;font-size:12.5px"></pre></div>`;
    const draw = k => {
      el.querySelectorAll('[data-h]').forEach(b => b.classList.toggle('on', b.dataset.h === k));
      const sim = new GitSim(); sim.setup([...setup, ...acts[k].cmds]);
      SimUI.renderGraph(el.querySelector('.sim-graph'), sim.graphModel('local'));
      el.querySelector('.h-note').innerHTML = acts[k].note;
      el.querySelector('.h-cmd').textContent = acts[k].cmds.map(c => '$ ' + c).join('\n');
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) draw(b.dataset.h); });
    draw('before');
  };

  /* ---------- conflict resolver ---------- */
  W.conflict = el => {
    const OURS = '<h1>Hello</h1>', THEIRS = '<h1>Welcome</h1>';
    const start = `<header>\n<<<<<<< HEAD\n${OURS}\n=======\n${THEIRS}\n>>>>>>> feature/navbar\n</header>`;
    el.innerHTML = `<div class="card"><div class="w-title">⚔️ Resolve the conflict in index.html <span class="tag">editor</span></div>
      <div class="conflict-code"></div>
      <div class="row" style="margin:12px 0"><button class="btn small" data-c="ours">Accept current (HEAD)</button><button class="btn small" data-c="theirs">Accept incoming</button><button class="btn small" data-c="both">Accept both</button><button class="btn small" data-c="reset">↺ Reset</button></div>
      <textarea class="txt" rows="7" spellcheck="false"></textarea>
      <div class="row" style="margin-top:10px"><button class="btn small primary" data-c="done">git add index.html && git commit</button><span class="cf-msg"></span></div></div>`;
    const ta = el.querySelector('textarea'), view = el.querySelector('.conflict-code'), msg = el.querySelector('.cf-msg');
    const paint = () => {
      let mode = null;
      view.innerHTML = ta.value.split('\n').map(l => {
        let c = 'cf-ctx';
        if (/^<{7}/.test(l)) { mode = 'o'; c = 'cf-mark'; } else if (/^={7}/.test(l)) { mode = 't'; c = 'cf-mark'; } else if (/^>{7}/.test(l)) { mode = null; c = 'cf-mark'; }
        else if (mode === 'o') c = 'cf-ours'; else if (mode === 't') c = 'cf-theirs';
        const tag = c === 'cf-mark' ? (/^</.test(l) ? '   ← start of YOUR version (current branch)' : /^=/.test(l) ? '   ← separator' : '   ← end of INCOMING version') : '';
        return `<div class="${c}">${esc(l) || ' '}<span class="muted" style="font-weight:400">${tag}</span></div>`;
      }).join('');
    };
    const set = v => { ta.value = v; paint(); msg.textContent = ''; };
    el.addEventListener('click', e => {
      const c = e.target.closest('[data-c]')?.dataset.c; if (!c) return;
      if (c === 'reset') return set(start);
      if (c === 'ours') return set(`<header>\n${OURS}\n</header>`);
      if (c === 'theirs') return set(`<header>\n${THEIRS}\n</header>`);
      if (c === 'both') return set(`<header>\n${OURS}\n${THEIRS}\n</header>`);
      if (c === 'done') {
        if (/^(<{7}|={7}|>{7})/m.test(ta.value)) { msg.innerHTML = '<span style="color:var(--red)">✗ Conflict markers are still in the file! Remove them first.</span>'; }
        else { msg.innerHTML = '<span style="color:var(--green)">✓ Conflict resolved and merge committed!</span>'; App.celebrate('Conflict resolved!'); }
      }
    });
    ta.addEventListener('input', paint);
    set(start);
  };

  /* ---------- .gitignore tester ---------- */
  W.ignore = (el, arg) => {
    const presets = {
      python: '__pycache__/\n*.pyc\n\n.venv/\nvenv/\n\n.env\n\n.ipynb_checkpoints/\n\n*.log\n\n.DS_Store',
      node: 'node_modules/\ndist/\n.next/\n\n.env\n.env.local\n\n*.log',
      basic: 'node_modules/\n.env\n__pycache__/\n*.log\ndist/\n.vscode/'
    };
    const files = ['index.html', 'style.css', 'app.py', '.env', '.env.local', 'README.md', 'node_modules/react/index.js', 'dist/bundle.js', '.next/cache/a.json',
      '__pycache__/app.cpython-312.pyc', 'utils.pyc', '.venv/bin/python', 'venv/lib/x.py', 'debug.log', 'logs/server.log', '.DS_Store', '.vscode/settings.json',
      'notebook/.ipynb_checkpoints/a.ipynb', 'src/main.js', 'package.json'];
    el.innerHTML = `<div class="card"><div class="w-title">🙈 .gitignore tester <span class="tag">edit the rules</span></div>
      <div class="row" style="margin-bottom:10px"><span class="muted" style="font-size:13px">Template:</span><button class="mini-btn" data-p="basic">Basic</button><button class="mini-btn" data-p="python">Python</button><button class="mini-btn" data-p="node">Node.js</button><button class="mini-btn" data-p="empty">Empty</button></div>
      <div class="ig-grid"><div><textarea class="txt" rows="14" spellcheck="false"></textarea><p class="muted" style="font-size:12.5px;margin:6px 0 0"><code>*</code> wildcard · <code>dir/</code> folder · <code>!file</code> re-include · <code>#</code> comment</p></div>
      <div><div class="ig-sum muted" style="font-size:13px;margin-bottom:6px"></div><div class="ig-files"></div></div></div></div>`;
    const ta = el.querySelector('textarea');
    const upd = () => {
      const rules = GitSimUtil.parseIgnore(ta.value);
      let n = 0;
      el.querySelector('.ig-files').innerHTML = files.map(f => {
        const r = GitSimUtil.ignoredBy(f, rules); if (r) n++;
        return `<div class="ig-file ${r ? 'ignored' : ''}"><span>${esc(f)}</span>${r ? `<span class="why">matched by <b>${esc(r.raw)}</b></span>` : '<span class="why" style="color:var(--green)">tracked ✓</span>'}</div>`;
      }).join('');
      el.querySelector('.ig-sum').innerHTML = `<b>${files.length - n}</b> files would be committed · <b>${n}</b> ignored`;
    };
    ta.addEventListener('input', upd);
    el.addEventListener('click', e => { const p = e.target.closest('[data-p]')?.dataset.p; if (p) { ta.value = presets[p] || ''; upd(); } });
    ta.value = presets[arg] || presets.basic; upd();
  };

  /* ---------- commit message checker ---------- */
  W.commitmsg = el => {
    const VERBS = /^(add|fix|update|remove|implement|refactor|improve|create|delete|rename|move|replace|support|allow|prevent|change|document|optimize|bump|revert|merge|style|test|use|make|handle|clean|upgrade|introduce|enable|disable|set)\b/i;
    el.innerHTML = `<div class="card"><div class="w-title">✍️ Commit message checker</div>
      <div class="row"><span class="mono muted">git commit -m "</span><input class="txt mono" style="flex:1;min-width:200px" value="changes"><span class="mono muted">"</span></div>
      <div class="row" style="margin-top:8px">${['changes', 'fixed stuff', 'Add responsive navbar', 'Fix navbar mobile layout', 'update', 'Implement product search'].map(x => `<button class="mini-btn" data-x="${x}">${x}</button>`).join('')}</div>
      <div class="row" style="margin-top:12px;align-items:flex-start"><div class="cm-score"></div><ul class="cm-checks"></ul></div></div>`;
    const inp = el.querySelector('input');
    const upd = () => {
      const m = inp.value.trim();
      const checks = [
        [m.length >= 10, 'Descriptive enough (≥ 10 characters)'],
        [m.length <= 72, 'Short summary (≤ 72 characters)'],
        [VERBS.test(m), 'Starts with an imperative verb (Add, Fix, Update, Remove…)'],
        [/^[A-Z]/.test(m), 'Starts with a capital letter'],
        [!/\.$/.test(m), 'No trailing period'],
        [!/^(changes?|update[sd]?|fix(ed)?( stuff)?|wip|stuff|asdf|misc|final.*)$/i.test(m), 'Not vague (avoid "changes", "update", "wip")']
      ];
      const score = checks.filter(c => c[0]).length;
      el.querySelector('.cm-score').innerHTML = `<span style="color:${score >= 6 ? 'var(--green)' : score >= 4 ? 'var(--yellow)' : 'var(--red)'}">${score}/6</span>`;
      el.querySelector('.cm-checks').innerHTML = checks.map(([ok, t]) => `<li>${ok ? '✅' : '❌'} ${t}</li>`).join('');
    };
    inp.addEventListener('input', upd);
    el.addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (b) { inp.value = b.dataset.x; upd(); } });
    upd();
  };

  /* ---------- step-by-step flow ---------- */
  W.flow = (el, arg) => {
    const f = D().FLOWS[arg]; if (!f) return;
    let cur = 0, timer = null;
    el.innerHTML = `<div class="card"><div class="w-title">🧭 ${esc(f.title)} <span class="tag">step through</span></div>
      <div class="flow-track">${f.steps.map(([ic, t], i) => `<div class="flow-step" data-s="${i}"><div class="dot">${ic}</div>${esc(t)}</div>`).join('')}</div>
      <div class="flow-detail"></div>
      <div class="row" style="margin-top:12px"><button class="btn small" data-f="prev">← Prev</button><button class="btn small accent" data-f="next">Next →</button><button class="btn small" data-f="play">▶ Auto-play</button></div></div>`;
    const draw = () => {
      el.querySelectorAll('.flow-step').forEach((s, i) => { s.classList.toggle('past', i < cur); s.classList.toggle('cur', i === cur); });
      const [ic, t, d, cmd] = f.steps[cur];
      el.querySelector('.flow-detail').innerHTML = `<h4>${ic} Step ${cur + 1}/${f.steps.length}: ${esc(t)}</h4><p>${MD.inline(d)}</p>${cmd ? `<pre>${cmd.split('\n').map(c => '<span style="color:var(--green)">$</span> ' + esc(c)).join('\n')}</pre>` : ''}`;
    };
    const stop = () => { clearInterval(timer); timer = null; el.querySelector('[data-f="play"]').textContent = '▶ Auto-play'; };
    el.addEventListener('click', e => {
      const s = e.target.closest('[data-s]'); if (s) { cur = +s.dataset.s; stop(); return draw(); }
      const a = e.target.closest('[data-f]')?.dataset.f; if (!a) return;
      if (a === 'prev') { cur = Math.max(0, cur - 1); stop(); }
      if (a === 'next') { cur = Math.min(f.steps.length - 1, cur + 1); stop(); }
      if (a === 'play') {
        if (timer) stop();
        else { if (cur === f.steps.length - 1) cur = 0; e.target.textContent = '⏸ Pause'; timer = setInterval(() => { if (cur >= f.steps.length - 1) return stop(); cur++; draw(); }, 1800); }
      }
      draw();
    });
    draw();
  };

  /* ---------- GitHub Projects kanban ---------- */
  W.kanban = el => {
    const cols = ['Todo', 'In Progress', 'Review', 'Done'];
    const cards = [['#24 Fix mobile navbar', '🐛 bug', 0], ['#25 Add login page', '✨ feature', 0], ['#26 Write README', '📚 docs', 1], ['#27 Improve load time', '🔧 improvement', 2], ['#23 Setup repository', '🔧 chore', 3]];
    el.innerHTML = `<div class="card"><div class="w-title">📋 GitHub Projects board <span class="tag">drag the cards</span></div><div class="kanban"></div>
      <p class="muted kb-msg" style="font-size:13px;margin:10px 0 0">Drag issues between columns as work progresses.</p></div>`;
    const draw = () => {
      el.querySelector('.kanban').innerHTML = cols.map((c, ci) => `<div class="kcol" data-col="${ci}"><h5>${c}<span class="muted">${cards.filter(k => k[2] === ci).length}</span></h5>
        ${cards.map((k, i) => k[2] === ci ? `<div class="kcard" draggable="true" data-k="${i}">${esc(k[0])}<small>${k[1]}</small></div>` : '').join('')}</div>`).join('');
    };
    let drag = null;
    el.addEventListener('dragstart', e => { const k = e.target.closest('.kcard'); if (k) { drag = +k.dataset.k; e.dataTransfer.setData('text/plain', drag); } });
    el.addEventListener('dragover', e => { const c = e.target.closest('.kcol'); if (c) { e.preventDefault(); c.classList.add('over'); } });
    el.addEventListener('dragleave', e => { const c = e.target.closest('.kcol'); if (c) c.classList.remove('over'); });
    el.addEventListener('drop', e => {
      const c = e.target.closest('.kcol'); if (!c || drag === null) return;
      e.preventDefault(); cards[drag][2] = +c.dataset.col;
      const tips = ['Planned work.', 'Create a branch: git switch -c …', 'A Pull Request is open and waiting for review.', 'Merged! The issue is closed. 🎉'];
      el.querySelector('.kb-msg').textContent = `${cards[drag][0]} → ${cols[+c.dataset.col]}: ${tips[+c.dataset.col]}`;
      drag = null; draw();
    });
    draw();
  };

  /* ---------- mount all widgets inside a root ---------- */
  function mountAll(root) {
    root.querySelectorAll('.widget[data-widget]').forEach(el => {
      const fn = W[el.dataset.widget];
      if (fn) { try { fn(el, el.dataset.arg); } catch (e) { console.error(e); el.textContent = 'Widget failed to load: ' + e.message; } }
    });
  }

  global.Widgets = { mountAll, W, renderQuiz };
})(window);
