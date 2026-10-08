/* =========================================================
   Simulator UI — areas panels, SVG commit graph, terminal,
   lab task checklist. Used by labs and the Playground.
   ========================================================= */
(function (global) {
  'use strict';
  const { esc, GIT_SUBS } = GitSimUtil;
  const LANE_COLORS = ['#f0883e', '#58a6ff', '#bc8cff', '#3fb950', '#f778ba', '#39c5cf', '#d29922', '#ff7b72'];

  /* ---------------- SVG commit graph ---------------- */
  function renderGraph(box, g, opts = {}) {
    if (!g || !g.nodes.length) {
      box.innerHTML = `<div class="graph-empty">${opts.empty || 'No commits yet — stage something and run git commit -m "..."'}</div>`;
      return;
    }
    const small = !!opts.small;
    const DX = small ? 54 : 96, R = small ? 7 : 10;
    const idx = {}; g.nodes.forEach((c, i) => { idx[c.hash] = i; });
    const refCount = h => (g.refs[h] || []).length;
    let top0 = 0, other = 0;
    g.nodes.forEach(c => { const k = refCount(c.hash); if (g.lane[c.hash] === 0) top0 = Math.max(top0, k); else other = Math.max(other, k); });
    const PH = small ? 15 : 19;
    const PY = 22 + top0 * PH;
    const DY = (small ? 40 : 62) + Math.max(0, other) * PH;
    const PX = small ? 22 : 46;
    const W = PX * 2 + (g.nodes.length - 1) * DX + (small ? 40 : 60);
    const H = PY + (g.lanes - 1) * DY + (small ? 22 : 50);
    const pos = c => [PX + idx[c.hash] * DX, PY + g.lane[c.hash] * DY];
    const col = h => LANE_COLORS[g.lane[h] % LANE_COLORS.length];
    let edges = '', nodes = '', labels = '';
    g.nodes.forEach(c => {
      const [x2, y2] = pos(c);
      c.parents.forEach((p, pi) => {
        const pc = g.nodes[idx[p]]; if (!pc) return;
        const [x1, y1] = pos(pc);
        const faded = !g.reach.has(c.hash);
        const color = pi === 0 && g.lane[c.hash] !== g.lane[p] ? col(c.hash) : (pi > 0 ? col(p) : col(c.hash));
        const d = y1 === y2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1 + DX * 0.6},${y1} ${x2 - DX * 0.6},${y2} ${x2},${y2}`;
        edges += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${small ? 2 : 3}" opacity="${faded ? 0.25 : 0.85}" ${faded ? 'stroke-dasharray="5 4"' : ''}/>`;
      });
    });
    g.nodes.forEach(c => {
      const [x, y] = pos(c);
      const faded = !g.reach.has(c.hash);
      const color = col(c.hash);
      const isHead = c.hash === g.headHash;
      const tip = `${c.hash.slice(0, 7)} — ${c.msg}\nby ${c.author}${c.parents.length > 1 ? '\n(merge commit: 2 parents)' : ''}${c.rebasedFrom ? `\n(rebased copy of ${c.rebasedFrom.slice(0, 7)})` : ''}${c.pickedFrom ? `\n(cherry-picked from ${c.pickedFrom.slice(0, 7)})` : ''}${faded ? '\n⚠ not reachable from any branch (orphaned)' : ''}`;
      nodes += `<g class="g-node" data-hash="${c.hash}" opacity="${faded ? 0.35 : 1}"><title>${esc(tip)}</title>`;
      if (isHead) nodes += `<circle cx="${x}" cy="${y}" r="${R + 6}" fill="none" stroke="${color}" stroke-width="2" opacity=".55"/>`;
      nodes += `<circle cx="${x}" cy="${y}" r="${R}" fill="${c.parents.length > 1 ? 'var(--bg)' : color}" stroke="${color}" stroke-width="3" ${faded ? 'stroke-dasharray="3 2"' : ''}/>`;
      if (!small) {
        nodes += `<text x="${x}" y="${y + R + 15}" text-anchor="middle" font-size="11" fill="var(--yellow)">${c.hash.slice(0, 7)}</text>`;
        const msg = c.msg.split('\n')[0];
        nodes += `<text x="${x}" y="${y + R + 29}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${esc(msg.length > 14 ? msg.slice(0, 13) + '…' : msg)}</text>`;
      }
      nodes += '</g>';
      (g.refs[c.hash] || []).forEach((r, k) => {
        const txt = r.head ? `HEAD → ${r.name}` : r.type === 'tag' ? `🏷 ${r.name}` : r.name;
        const w = txt.length * (small ? 5.6 : 6.6) + (small ? 10 : 14);
        const ry = y - R - 8 - (k + 1) * PH + (small ? 4 : 2);
        let fill, stroke, tc;
        if (r.head || r.type === 'head') { fill = 'var(--accent)'; stroke = 'var(--accent)'; tc = '#fff'; }
        else if (r.type === 'branch') { fill = color; stroke = color; tc = '#0d1117'; }
        else if (r.type === 'remote') { fill = 'var(--bg)'; stroke = 'var(--red)'; tc = 'var(--red)'; }
        else if (r.type === 'stash') { fill = 'var(--bg)'; stroke = 'var(--muted)'; tc = 'var(--muted)'; }
        else { fill = 'var(--bg)'; stroke = 'var(--yellow)'; tc = 'var(--yellow)'; }
        labels += `<g><rect x="${x - w / 2}" y="${ry}" width="${w}" height="${PH - 3}" rx="${(PH - 3) / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.3" ${r.type === 'stash' ? 'stroke-dasharray="3 2"' : ''}/>` +
          `<text x="${x}" y="${ry + PH / 2 + (small ? 1 : 2)}" text-anchor="middle" font-size="${small ? 9.5 : 11}" font-weight="700" fill="${tc}">${esc(txt)}</text></g>`;
      });
    });
    box.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${edges}${nodes}${labels}</svg>`;
    box.scrollLeft = box.scrollWidth;
    if (opts.onNode) box.querySelectorAll('.g-node').forEach(n => n.addEventListener('click', () => opts.onNode(n.dataset.hash)));
  }

  /* ---------------- Simulator component ---------------- */
  const BADGE = {
    '??': ['U', 'Untracked — Git sees it but is not tracking it'],
    '!!': ['I', 'Ignored by .gitignore'],
    UU: ['X', 'Conflict — fix the file then git add'],
    M: ['M', 'Modified since last staged'],
    D: ['D', 'Deleted'],
    A: ['A', 'Added (new file staged)'],
    clean: ['✓', 'Committed — unchanged since last commit']
  };

  function createSim(container, opts = {}) {
    const sim = new GitSim();
    let lab = opts.lab || null;
    const el = document.createElement('div');
    el.className = 'sim';
    el.innerHTML = `
      <div class="sim-bar">
        <span class="sim-title">${esc(opts.title || (lab ? '🧪 Lab: ' + lab.title : '💻 Git Playground'))}</span>
        <div class="sim-actions">
          ${opts.scenarios ? '<select class="txt" data-scn></select>' : ''}
          <button class="btn small" data-act="mate" title="Simulate a teammate pushing to GitHub" hidden>👥 Teammate pushes</button>
          <button class="btn small" data-act="reset" title="Start this lab again">↺ Reset</button>
          <button class="btn small" data-act="full" title="Toggle full screen">⤢</button>
        </div>
      </div>
      <div class="sim-tasks" hidden></div>
      <div class="sim-areas">
        <div class="area" data-area="work"><h4>📁 Working Directory <button class="mini-btn" data-act="newfile" title="Create a file">+ file</button></h4><ul></ul></div>
        <div class="sim-arrow">→<small>git add</small></div>
        <div class="area" data-area="stage"><h4>📋 Staging Area</h4><ul></ul></div>
        <div class="sim-arrow">→<small>git commit</small></div>
        <div class="area" data-area="repo"><h4>🗃️ Local Repository</h4><div class="repo-info"></div></div>
        <div class="sim-arrow r-arrow" hidden>⇄<small>push / pull</small></div>
        <div class="area" data-area="remote" hidden><h4>☁️ GitHub (origin)</h4><div class="remote-info"></div></div>
      </div>
      <div class="sim-graph-wrap">
        <div class="sim-graph-head"><span>Commit graph (local)</span>
          <span class="legend"><span>● commit</span><span>◯ merge</span><span style="color:var(--accent)">HEAD</span><span style="color:var(--red)">origin/…</span><span>faded = orphaned</span></span></div>
        <div class="sim-graph"></div>
      </div>
      <div class="sim-term">
        <div class="term-out"></div>
        <div class="term-in"><span class="prompt"></span><input spellcheck="false" autocomplete="off" placeholder="type a command… (help)"></div>
        <div class="term-quick"></div>
      </div>`;
    container.innerHTML = '';
    container.appendChild(el);

    const $ = s => el.querySelector(s);
    const out = $('.term-out'), input = $('.term-in input'), prompt = $('.prompt');
    const hist = []; let hi = 0;
    let taskIdx = 0, labDone = false;

    function print(lines) {
      const frag = document.createDocumentFragment();
      lines.forEach(l => {
        const d = document.createElement('div');
        d.className = 'term-line ' + (l.c || '');
        if (l.h !== undefined) d.innerHTML = l.h; else d.textContent = l.t;
        frag.appendChild(d);
      });
      out.appendChild(frag);
      while (out.children.length > 400) out.removeChild(out.firstChild);
      out.scrollTop = out.scrollHeight;
    }
    function sys(msg, c = 'sys') { print([{ t: msg, c }]); }

    function exec(cmd, fromUser = true) {
      cmd = cmd.trim(); if (!cmd) return;
      print([{ h: `<span class="prompt">${prompt.innerHTML}</span> ${esc(cmd)}`, c: 'cmd' }]);
      if (fromUser) { hist.push(cmd); hi = hist.length; }
      if (cmd === 'clear' || cmd === 'cls') { out.innerHTML = ''; return; }
      const res = sim.run(cmd);
      print(res);
    }

    function updatePrompt() {
      const s = sim.s;
      const br = s.init ? (sim.curBranch() || sim.short(sim.headHash())) : '';
      const st = s.merge ? '|MERGING' : '';
      prompt.innerHTML = `~${s.cwd ? '/' + esc(s.cwd) : ''}${br ? ` <span class="pb">(${esc(br)}${st})</span>` : ''} $`;
    }

    function fileLi(f, badgeKey, area) {
      const [b, tip] = BADGE[badgeKey] || [badgeKey, ''];
      const cls = { U: 'b-U', I: 'b-I', X: 'b-X', M: 'b-M', D: 'b-D', A: 'b-A', '✓': 'b-C' }[b];
      let acts = '';
      if (area === 'work') {
        if (badgeKey === 'UU') acts = `<button data-run="resolve ${f} ours" title="Keep current (HEAD) version">ours</button><button data-run="resolve ${f} theirs" title="Keep incoming version">theirs</button><button data-run="resolve ${f} both">both</button>`;
        else if (badgeKey !== 'D') acts = `<button data-run="edit ${f}" title="Modify this file">✎</button>`;
        if (badgeKey !== 'clean' && badgeKey !== '!!' && badgeKey !== 'UU') acts += `<button data-run="git add ${f}" title="git add ${f}">+ add</button>`;
      } else if (area === 'stage') acts = `<button data-run="git restore --staged ${f}" title="Unstage">− unstage</button>`;
      return `<li title="${esc(tip)}"><span class="badge ${cls}">${b}</span><span class="fname" data-cat="${esc(f)}">${esc(f)}</span><span class="acts">${acts}</span></li>`;
    }

    function render() {
      const s = sim.s;
      updatePrompt();
      const E = sim.entries();
      // working directory
      const W = Object.keys(s.work).sort();
      const work = $('[data-area="work"] ul');
      if (!W.length && !Object.keys(s.dirs).length) work.innerHTML = '<div class="empty">empty folder</div>';
      else {
        const rows = W.map(f => {
          const es = E.filter(e => e.f === f);
          let key = 'clean';
          if (es.some(e => e.x === 'U')) key = 'UU';
          else if (es.some(e => e.x === '?')) key = '??';
          else if (es.some(e => e.ignored)) key = '!!';
          else if (es.some(e => e.y === 'M')) key = 'M';
          else if (!s.init) key = '??';
          return fileLi(f, key, 'work');
        });
        Object.keys(s.dirs).forEach(d => rows.push(`<li title="Empty folder — Git does not track empty directories"><span class="badge b-I">∅</span><span class="fname">${esc(d)}/</span></li>`));
        const deleted = E.filter(e => e.y === 'D');
        deleted.forEach(e => rows.push(fileLi(e.f, 'D', 'work')));
        work.innerHTML = rows.join('');
      }
      // staging
      const stage = $('[data-area="stage"] ul');
      const staged = E.filter(e => ['A', 'M', 'D'].includes(e.x));
      stage.innerHTML = !s.init ? '<div class="empty">no repository yet (git init)</div>'
        : staged.length ? staged.map(e => fileLi(e.f, e.x, 'stage')).join('') : '<div class="empty">nothing staged</div>';
      // repo info
      const head = sim.headHash();
      const ncommits = head ? sim.ancestors(head).size : 0;
      $('.repo-info').innerHTML = !s.init ? '<div class="empty">Not a Git repository.<br>Run <code>git init</code></div>' : `
        <div class="kv"><span>HEAD →</span><b>${esc(sim.curBranch() || 'detached @ ' + sim.short(head))}</b></div>
        <div class="kv"><span>commits on branch</span><b>${ncommits}</b></div>
        <div class="kv"><span>branches</span><b title="${esc(Object.keys(s.branches).join(', '))}">${Object.keys(s.branches).length || '—'}</b></div>
        ${s.stash.length ? `<div class="kv"><span>stash</span><b>${s.stash.length} saved</b></div>` : ''}
        ${s.merge ? '<div class="kv" style="color:var(--pink)"><span>⚠ merging</span><b style="color:var(--pink)">conflict</b></div>' : ''}
        ${Object.keys(s.tags).length ? `<div class="kv"><span>tags</span><b>${esc(Object.keys(s.tags).join(', '))}</b></div>` : ''}`;
      $('[data-area="repo"]').classList.toggle('ghost', !s.init);
      // remote
      const hasRemote = !!s.remote;
      $('[data-area="remote"]').hidden = !hasRemote;
      $('.r-arrow').hidden = !hasRemote;
      $('.sim-areas').classList.toggle('has-remote', hasRemote);
      $('[data-act="mate"]').hidden = !hasRemote;
      if (hasRemote) {
        const R = s.remote, names = Object.keys(R.branches);
        const prBtns = names.filter(b => b !== 'main' && b !== 'master' && R.branches.main && !sim.isAncestor(R.branches[b], R.branches.main))
          .map(b => `<div class="area-foot"><span class="muted" style="font-size:11px">PR: ${esc(b)} → main</span><button class="mini-btn" data-pr="${esc(b)}">Merge PR</button><button class="mini-btn" data-pr="${esc(b)}" data-squash="1">Squash & merge</button></div>`).join('');
        $('.remote-info').innerHTML = (names.length ? names.map(b => `<div class="kv"><span>${esc(b)}</span><b>${sim.short(R.branches[b])}</b></div>`).join('')
          : '<div class="empty">empty repository — git push -u origin main</div>') + '<div class="remote-graph"></div>' + prBtns;
        renderGraph($('.remote-graph'), sim.graphModel('remote'), { small: true, empty: '' });
      }
      renderGraph($('.sim-graph'), sim.graphModel('local'), {
        empty: s.init ? undefined : 'No repository yet. Run git init (or git clone &lt;url&gt;).',
        onNode: h => exec(`git show ${h.slice(0, 7)}`)
      });
      checkTasks();
    }

    /* ---- lab tasks ---- */
    function renderTasks() {
      const box = $('.sim-tasks');
      if (!lab) { box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = `${lab.intro ? `<p class="intro">${MD.inline(lab.intro)}</p>` : ''}<ol>${lab.tasks.map((t, i) =>
        `<li class="${i < taskIdx ? 'done' : i === taskIdx ? 'cur' : ''}"><span>${MD.inline(t.t)}${t.hint ? ` <a class="hint" data-hint="${esc(t.hint)}" title="Click to put this command in the terminal">${esc(t.hint)}</a>` : ''}</span></li>`).join('')}</ol>` +
        (labDone ? `<div class="lab-done">🎉 Lab complete! ${esc(lab.done || 'Great work.')}</div>` : '');
    }
    function checkTasks() {
      if (!lab || labDone) return;
      let advanced = false;
      while (taskIdx < lab.tasks.length) {
        let ok = false;
        try { ok = lab.tasks[taskIdx].c(sim); } catch (e) { ok = false; }
        if (!ok) break;
        taskIdx++; advanced = true;
      }
      if (taskIdx >= lab.tasks.length) {
        labDone = true;
        if (opts.onComplete) opts.onComplete(lab);
        if (global.App) App.celebrate('Lab complete: ' + lab.title);
      }
      if (advanced || labDone) renderTasks();
    }

    function loadLab(newLab) {
      sim.listeners = [];
      sim.restart(true);
      if (newLab !== undefined) opts.lab = newLab;
      const L = lab = opts.lab || null;
      taskIdx = 0; labDone = false;
      out.innerHTML = '';
      $('.sim-title').textContent = L ? '🧪 Lab: ' + L.title : (opts.title || '💻 Git Playground');
      if (L && L.setup) sim.setup(L.setup);
      sim.on(render);
      $('.term-quick').innerHTML = ((L && L.quick) || opts.quick || ['git status', 'git log --oneline --graph --all', 'ls', 'help'])
        .map(q => `<button data-fill="${esc(q)}">${esc(q)}</button>`).join('');
      sys(L ? `Lab loaded: ${L.title}. Follow the numbered steps above. Type 'help' anytime.` : 'Welcome to the Git playground! Everything here is simulated in your browser — experiment freely. Type help.');
      render(); renderTasks();
    }

    /* ---- events ---- */
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { exec(input.value); input.value = ''; }
      else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; input.value = hist[hi]; } e.preventDefault(); }
      else if (e.key === 'ArrowDown') { if (hi < hist.length - 1) { hi++; input.value = hist[hi]; } else { hi = hist.length; input.value = ''; } e.preventDefault(); }
      else if (e.key === 'Tab') { e.preventDefault(); complete(); }
      else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
    });
    function complete() {
      const v = input.value, toks = v.split(/\s+/), last = toks[toks.length - 1];
      let cands;
      if (toks.length === 1) cands = ['git', 'ls', 'cat', 'touch', 'echo', 'rm', 'edit', 'resolve', 'clear', 'help', 'mkdir', 'restart'];
      else if (toks[0] === 'git' && toks.length === 2) cands = GIT_SUBS;
      else cands = [...Object.keys(sim.s.work), ...Object.keys(sim.s.branches), ...Object.keys(sim.s.tracking), ...Object.keys(sim.s.tags), 'origin', 'HEAD', 'HEAD~1', '--staged', '--oneline', '--graph', '--all', '--soft', '--hard'];
      const m = [...new Set(cands)].filter(c => c.startsWith(last));
      if (m.length === 1) { toks[toks.length - 1] = m[0]; input.value = toks.join(' ') + ' '; }
      else if (m.length > 1) {
        let p = m[0]; m.forEach(x => { while (!x.startsWith(p)) p = p.slice(0, -1); });
        if (p.length > last.length) { toks[toks.length - 1] = p; input.value = toks.join(' '); }
        else print([{ t: m.join('   '), c: 'muted' }]);
      }
    }
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-run],[data-fill],[data-hint],[data-act],[data-pr],[data-cat]');
      if (!t) { if (e.target.closest('.sim-term')) input.focus(); return; }
      if (t.dataset.run) return exec(t.dataset.run);
      if (t.dataset.fill || t.dataset.hint) { input.value = t.dataset.fill || t.dataset.hint; input.focus(); return; }
      if (t.dataset.cat) return exec('cat ' + t.dataset.cat);
      if (t.dataset.pr) {
        const r = sim.mergePR(t.dataset.pr, !!t.dataset.squash);
        return sys(r.err || r.msg, r.err ? 'err' : 'sys');
      }
      const act = t.dataset.act;
      if (act === 'reset') loadLab();
      else if (act === 'full') { el.classList.toggle('fullscreen'); document.body.style.overflow = el.classList.contains('fullscreen') ? 'hidden' : ''; }
      else if (act === 'mate') { const r = sim.teammatePush(); sys(r.err || r.msg, r.err ? 'err' : 'sys'); sim.log.push({ cmd: '__teammate__', ok: !r.err }); checkTasks(); }
      else if (act === 'newfile') {
        const name = prompt_('New file name:', 'notes.txt');
        if (name) exec(`touch ${name}`);
      }
    });
    function prompt_(q, d) { return window.prompt(q, d); }
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('fullscreen')) { el.classList.remove('fullscreen'); document.body.style.overflow = ''; } });

    if (opts.scenarios) {
      const sel = $('[data-scn]');
      sel.innerHTML = opts.scenarios.map((sc, i) => `<option value="${i}">${esc(sc.label)}</option>`).join('');
      sel.addEventListener('change', () => { const sc = opts.scenarios[+sel.value]; loadLab(sc.lab || null); });
    }

    loadLab();
    return { sim, el, exec, loadLab };
  }

  global.SimUI = { createSim, renderGraph };
})(window);
