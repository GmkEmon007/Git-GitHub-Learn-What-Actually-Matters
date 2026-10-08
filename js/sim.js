/* =========================================================
   GitSim — a small in-memory model of Git used by the
   playground and labs. It is intentionally simplified
   (file-level merges, no real hashing) but behaves like
   real Git for all the commands taught in the playbook.
   ========================================================= */
(function (global) {
  'use strict';

  class GitError extends Error {}

  const hex = () => Array.from({ length: 7 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  const union = (...objs) => [...new Set(objs.flatMap(o => Object.keys(o || {})))].sort();
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const span = (cls, t) => `<span class="${cls}">${esc(t)}</span>`;
  const VAGUE = /^(changes?|update[sd]?|fix(es|ed)?|wip|stuff|asdf|test|commit|edit[s]?|misc|final|done|work|code|.)$/i;

  /* ---------- tokenizer: handles "quoted strings" ---------- */
  function tokenize(line) {
    const out = []; let cur = '', q = null, has = false;
    for (const ch of line) {
      if (q) { if (ch === q) q = null; else cur += ch; continue; }
      if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
      if (/\s/.test(ch)) { if (cur || has) { out.push(cur); cur = ''; has = false; } continue; }
      cur += ch;
    }
    if (cur || has) out.push(cur);
    return out;
  }

  /* ---------- .gitignore matching ---------- */
  function globRe(p) {
    let r = '';
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === '*') {
        if (p[i + 1] === '*') {
          if (p[i + 2] === '/') { r += '(?:.*/)?'; i += 2; } else { r += '.*'; i++; }
        } else r += '[^/]*';
      } else if (c === '?') r += '[^/]';
      else r += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + r + '$');
  }
  function parseIgnore(text) {
    return String(text || '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(raw => {
      let l = raw, neg = false, dir = false;
      if (l.startsWith('!')) { neg = true; l = l.slice(1); }
      if (l.endsWith('/')) { dir = true; l = l.slice(0, -1); }
      const anchored = l.includes('/');
      if (l.startsWith('/')) l = l.slice(1);
      return { raw, neg, dir, anchored, re: globRe(l) };
    });
  }
  /** returns the matching rule if the path is ignored, otherwise null */
  function ignoredBy(path, rules) {
    const parts = path.split('/');
    let hitRule = null;
    for (const r of rules) {
      let hit = false;
      for (let k = 1; k <= parts.length; k++) {
        const isFile = k === parts.length;
        if (isFile && r.dir) continue;
        const sub = parts.slice(0, k).join('/');
        if (r.anchored ? r.re.test(sub) : r.re.test(parts[k - 1])) { hit = true; break; }
      }
      if (hit) hitRule = r.neg ? null : r;
    }
    return hitRule;
  }

  /* ---------- line diff (LCS) ---------- */
  function diffLines(a, b) {
    const A = a ? a.split('\n') : [], B = b ? b.split('\n') : [];
    const n = A.length, m = B.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const ops = []; let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { ops.push([' ', A[i]]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push(['-', A[i++]]);
      else ops.push(['+', B[j++]]);
    }
    while (i < n) ops.push(['-', A[i++]]);
    while (j < m) ops.push(['+', B[j++]]);
    return ops;
  }

  const GIT_SUBS = ['init', 'status', 'add', 'commit', 'log', 'branch', 'switch', 'checkout', 'merge', 'rebase', 'reset', 'restore',
    'revert', 'cherry-pick', 'stash', 'diff', 'show', 'tag', 'remote', 'push', 'fetch', 'pull', 'clone', 'config', 'rm', 'help'];

  const HELP = [
    ['Git', 'git init | status [-s] | add <file|.> | commit -m "msg" [-a] [--amend]'],
    ['', 'git log [--oneline --graph --all] | diff [--staged] | show [ref]'],
    ['', 'git branch [name|-d|-D|-M|-r|-a] | switch [-c] <branch> | checkout [-b]'],
    ['', 'git merge <branch> [--no-ff|--squash|--abort] | rebase <branch>'],
    ['', 'git reset [--soft|--mixed|--hard] <ref> | restore [--staged] <file>'],
    ['', 'git revert <hash> | cherry-pick <hash> | stash [list|pop|apply|drop|clear]'],
    ['', 'git remote add origin <url> | remote -v | push [-u] origin <branch> | fetch | pull'],
    ['', 'git clone <url> | tag <name> | config --global user.name "You" | rm [--cached]'],
    ['Shell', 'ls | cat <file> | touch <file> | echo "text" > file | echo "text" >> file'],
    ['', 'rm <file> | mkdir <dir> | edit <file> (adds a line) | resolve <file> ours|theirs|both'],
    ['', 'clear | restart (reset the simulator) | help'],
    ['Refs', 'HEAD, HEAD~1, HEAD~2, HEAD^, branch names, origin/main, tags, short hashes']
  ];

  class GitSim {
    constructor() { this.listeners = []; this.restart(true); }

    restart(silent) {
      this.s = {
        init: false, work: {}, dirs: {}, index: {}, commits: {}, n: 0,
        branches: {}, head: { type: 'branch', name: 'main' }, stash: [], tags: {},
        remotes: {}, remote: null, tracking: {}, upstream: {}, merge: null,
        config: { 'user.name': 'You', 'user.email': 'you@example.com' },
        cwd: 'my-project', mate: 0, pr: 0, editN: 0
      };
      this.log = [];
      this.events = [];
      if (!silent) this.emit();
    }
    on(fn) { this.listeners.push(fn); }
    emit() { this.listeners.forEach(f => f(this)); }

    /* ======= running commands ======= */
    run(line, quiet) {
      line = String(line).trim();
      if (!line) return [];
      const out = []; this._out = out;
      let ok = true;
      try {
        for (const part of line.split(/\s*&&\s*/)) this.exec(part);
      } catch (e) {
        ok = false;
        if (e instanceof GitError) this.p(e.message, 'err');
        else { this.p('Simulator error: ' + e.message, 'err'); console.error(e); }
      }
      this.log.push({ cmd: line, ok });
      if (!quiet) this.emit();
      return out;
    }
    /** run silently (used by lab setups) */
    setup(cmds) { cmds.forEach(c => { if (typeof c === 'function') c(this); else this.run(c, true); }); this.log = []; this.emit(); }
    ran(re) { return this.log.some(l => l.ok && re.test(l.cmd)); }

    p(t, c = '') { String(t).split('\n').forEach(x => this._out.push({ t: x, c })); }
    h(html, c = '') { this._out.push({ h: html, c }); }
    err(msg) { throw new GitError(msg); }

    exec(line) {
      const tok = tokenize(line);
      if (!tok.length) return;
      const [cmd, ...a] = tok;
      switch (cmd) {
        case 'git': return this.git(a);
        case 'ls': return this.sh_ls(a);
        case 'cat': return this.sh_cat(a);
        case 'touch': return a.forEach(f => this.writeFile(f, this.s.work[f] ?? ''));
        case 'echo': return this.sh_echo(a);
        case 'rm': return this.sh_rm(a);
        case 'mkdir': return a.filter(x => !x.startsWith('-')).forEach(d => { this.s.dirs[d.replace(/\/$/, '')] = true; });
        case 'edit': return this.sh_edit(a);
        case 'resolve': return this.sh_resolve(a);
        case 'cd': if (a[0] && a[0] !== '..' && a[0] !== '~') this.s.cwd = a[0].replace(/\/$/, ''); return;
        case 'pwd': return this.p('/home/you/' + this.s.cwd);
        case 'help': return this.help();
        case 'restart': this.restart(true); return this.p('Simulator reset. Fresh empty folder.', 'sys');
        case 'ssh':
          if (a.includes('-T')) return this.p(`Hi ${this.s.config['user.name']}! You've successfully authenticated, but GitHub does not provide shell access. (simulated)`, 'ok');
          return this.err('ssh: only "ssh -T git@github.com" is simulated');
        case 'ssh-keygen':
          return this.p('Generating public/private ed25519 key pair...\nYour public key has been saved in ~/.ssh/id_ed25519.pub (simulated)\nNext: add the public key to GitHub → Settings → SSH and GPG keys.', 'muted');
        case 'code': case 'nano': case 'vim': case 'notepad':
          return a[0] ? this.sh_edit([a[0]]) : this.err(`${cmd}: missing file name`);
        default: this.err(`${cmd}: command not found. Type 'help' to see what this simulator understands.`);
      }
    }

    help() {
      this.p('Commands understood by this simulator:', 'info');
      HELP.forEach(([k, v]) => this.h(`${span('t-y', (k || '').padEnd(6))} ${esc(v)}`));
    }

    /* ======= helpers ======= */
    headHash() { const h = this.s.head; return h.type === 'branch' ? (this.s.branches[h.name] || null) : h.hash; }
    curBranch() { return this.s.head.type === 'branch' ? this.s.head.name : null; }
    commit(h) { return this.s.commits[h]; }
    tree(h) { return h ? this.s.commits[h].tree : {}; }
    headTree() { return this.tree(this.headHash()); }
    short(h) { return h ? h.slice(0, 7) : '0000000'; }

    mk(msg, parents, tree, extra = {}) {
      let h; do { h = hex(); } while (this.s.commits[h]);
      this.s.commits[h] = { hash: h, msg, parents: parents.filter(Boolean), tree: { ...tree }, n: ++this.s.n, author: this.s.config['user.name'], local: true, ...extra };
      return h;
    }
    advance(h) { if (this.s.head.type === 'branch') this.s.branches[this.s.head.name] = h; else this.s.head.hash = h; }

    ancestors(h) {
      const seen = new Set(), st = h ? [h] : [];
      while (st.length) { const c = st.pop(); if (!c || seen.has(c)) continue; seen.add(c); (this.s.commits[c]?.parents || []).forEach(p => st.push(p)); }
      return seen;
    }
    isAncestor(a, b) { return !!a && this.ancestors(b).has(a); }
    mergeBase(a, b) {
      const A = this.ancestors(a); let best = null;
      for (const c of this.ancestors(b)) if (A.has(c) && (!best || this.s.commits[c].n > this.s.commits[best].n)) best = c;
      return best;
    }
    aheadBehind(a, b) {
      const A = this.ancestors(a), B = this.ancestors(b);
      return [[...A].filter(x => !B.has(x)).length, [...B].filter(x => !A.has(x)).length];
    }

    resolve(ref, quiet) {
      const s = this.s;
      if (!ref) return null;
      const m = ref.match(/^(.+?)((?:[~^]\d*)*)$/);
      let base = m ? m[1] : ref; const suffix = m ? m[2] : '';
      let h = null;
      if (base === 'HEAD' || base === '@') h = this.headHash();
      else if (s.branches[base] !== undefined) h = s.branches[base];
      else if (s.tracking[base]) h = s.tracking[base];
      else if (s.tracking['origin/' + base] && base.startsWith('remotes/')) h = s.tracking[base.slice(8)];
      else if (s.tags[base]) h = s.tags[base];
      else if (/^[0-9a-f]{4,40}$/.test(base)) {
        const found = Object.keys(s.commits).filter(k => k.startsWith(base) && s.commits[k].local);
        if (found.length === 1) h = found[0];
      }
      if (!h) { if (quiet) return null; this.err(`fatal: ambiguous argument '${ref}': unknown revision or path not in the working tree.`); }
      const re = /([~^])(\d*)/g; let mm;
      while ((mm = re.exec(suffix))) {
        const num = mm[2] === '' ? 1 : parseInt(mm[2], 10);
        if (mm[1] === '~') { for (let i = 0; i < num; i++) { h = this.s.commits[h]?.parents[0]; if (!h) break; } }
        else h = num === 0 ? h : this.s.commits[h]?.parents[num - 1];
        if (!h) { if (quiet) return null; this.err(`fatal: ambiguous argument '${ref}': that commit does not exist (not enough history).`); }
      }
      return h;
    }

    rules() { return parseIgnore(this.s.work['.gitignore']); }

    /** status entries {f, x, y} — x = staging column, y = working-tree column */
    entries() {
      const H = this.headTree(), I = this.s.index, W = this.s.work, rules = this.rules();
      const conflicts = this.s.merge ? this.s.merge.conflicts : [];
      const res = [];
      for (const f of union(H, I, W)) {
        if (conflicts.includes(f)) { res.push({ f, x: 'U', y: 'U' }); continue; }
        const h = H[f], i = I[f], w = W[f];
        if (i === undefined && h === undefined) {
          if (w !== undefined) res.push(ignoredBy(f, rules) ? { f, x: '!', y: '!', ignored: true } : { f, x: '?', y: '?' });
          continue;
        }
        if (i === undefined) { // staged deletion
          res.push({ f, x: 'D', y: ' ' });
          if (w !== undefined) res.push({ f, x: '?', y: '?' });
          continue;
        }
        const x = i === h ? ' ' : (h === undefined ? 'A' : 'M');
        const y = w === undefined ? 'D' : (w !== i ? 'M' : ' ');
        res.push({ f, x, y, clean: x === ' ' && y === ' ' });
      }
      return res;
    }
    trackedDirty() { return this.entries().some(e => !e.clean && !e.ignored && !(e.x === '?')); }
    requireClean(action) {
      if (this.trackedDirty()) this.err(`error: Your local changes would be overwritten by ${action}.\nhint: Please commit your changes or stash them (git stash) before you ${action}.`);
    }

    writeFile(f, content) {
      if (!f) this.err('missing file name');
      if (f.includes('/')) { const d = f.split('/').slice(0, -1).join('/'); delete this.s.dirs[d]; }
      this.s.work[f] = content;
    }

    /* ======= shell commands ======= */
    sh_ls(a) {
      const all = a.some(x => /^-\w*a/.test(x));
      const items = [];
      if (all && this.s.init) items.push(span('t-b', '.git/'));
      const top = new Set();
      Object.keys(this.s.work).forEach(f => {
        if (!all && f.split('/').pop().startsWith('.') && !f.includes('/')) return;
        if (f.includes('/')) top.add(f.split('/')[0] + '/'); else top.add(f);
      });
      Object.keys(this.s.dirs).forEach(d => top.add(d.split('/')[0] + '/'));
      [...top].sort().forEach(f => items.push(f.endsWith('/') ? span('t-b', f) : esc(f)));
      if (!items.length) return this.p('(empty folder)', 'muted');
      this.h(items.join('   '));
      if (Object.keys(this.s.dirs).length) this.p('note: empty folders exist on disk, but Git does not track empty directories.', 'muted');
    }
    sh_cat(a) {
      if (!a[0]) this.err('cat: missing file name');
      const c = this.s.work[a[0]];
      if (c === undefined) this.err(`cat: ${a[0]}: No such file or directory`);
      if (c === '') return this.p('(empty file)', 'muted');
      c.split('\n').forEach(l => {
        if (/^(<{7}|={7}|>{7})/.test(l)) this.p(l, 'hint'); else this.p(l);
      });
    }
    sh_echo(a) {
      const gi = a.findIndex(x => x === '>' || x === '>>');
      if (gi === -1) return this.p(a.join(' '));
      const text = a.slice(0, gi).join(' '), f = a[gi + 1];
      if (!f) this.err('syntax error: missing file after redirection');
      if (a[gi] === '>') this.writeFile(f, text);
      else { const old = this.s.work[f]; this.writeFile(f, old ? old + '\n' + text : text); }
    }
    sh_rm(a) {
      const files = a.filter(x => !x.startsWith('-'));
      files.forEach(f => {
        const under = Object.keys(this.s.work).filter(k => k === f || k.startsWith(f.replace(/\/$/, '') + '/'));
        if (!under.length && !this.s.dirs[f.replace(/\/$/, '')]) this.err(`rm: cannot remove '${f}': No such file or directory`);
        under.forEach(k => delete this.s.work[k]);
        delete this.s.dirs[f.replace(/\/$/, '')];
      });
    }
    sh_edit(a) {
      const f = a[0];
      if (!f) this.err('edit: missing file name. Usage: edit <file> ["new line"]');
      const n = ++this.s.editN;
      const line = a.slice(1).join(' ') || this.sampleLine(f, n);
      const old = this.s.work[f];
      this.writeFile(f, old ? old + '\n' + line : line);
      this.p(`✎ edited ${f} (added: ${line})`, 'muted');
    }
    sampleLine(f, n) {
      if (f.endsWith('.html')) return `<p>Section ${n}</p>`;
      if (f.endsWith('.css')) return `.box-${n} { padding: ${n * 4}px; }`;
      if (f.endsWith('.js')) return `console.log("step ${n}");`;
      if (f.endsWith('.py')) return `print("step ${n}")`;
      if (f.endsWith('.md')) return `- Note ${n}`;
      return `line ${n}`;
    }
    sh_resolve(a) {
      const [f, how = 'ours'] = a;
      const c = this.s.work[f];
      if (c === undefined) this.err(`resolve: ${f}: no such file`);
      if (!/^<{7}/m.test(c)) this.err(`resolve: ${f} has no conflict markers`);
      const out = []; let mode = null, ours = [], theirs = [];
      c.split('\n').forEach(l => {
        if (/^<{7}/.test(l)) { mode = 'o'; ours = []; theirs = []; }
        else if (/^={7}/.test(l) && mode) mode = 't';
        else if (/^>{7}/.test(l) && mode) {
          if (how === 'ours') out.push(...ours); else if (how === 'theirs') out.push(...theirs); else out.push(...ours, ...theirs);
          mode = null;
        } else if (mode === 'o') ours.push(l); else if (mode === 't') theirs.push(l); else out.push(l);
      });
      this.s.work[f] = out.filter((l, i, arr) => !(l === '' && arr.length > 1)).join('\n');
      this.p(`✔ resolved ${f} using ${how === 'both' ? 'both versions' : how === 'ours' ? 'current (HEAD) version' : 'incoming version'}. Now run: git add ${f}`, 'ok');
    }

    /* ======= git ======= */
    git(a) {
      const sub = a[0], r = a.slice(1);
      if (!sub || sub === 'help' || sub === '--help') return this.help();
      if (sub === '--version' || sub === 'version') return this.p('git version 2.47.0 (playbook simulator)');
      const fn = this['g_' + sub.replace('-', '_')];
      if (!fn) this.err(`git: '${sub}' is not a git command (in this simulator). See 'help'.`);
      if (!['init', 'clone', 'config'].includes(sub) && !this.s.init)
        this.err("fatal: not a git repository (or any of the parent directories): .git\nhint: run 'git init' first (or 'git clone <url>').");
      return fn.call(this, r);
    }

    g_init() {
      if (this.s.init) return this.p(`Reinitialized existing Git repository in /home/you/${this.s.cwd}/.git/`);
      this.s.init = true;
      this.p(`Initialized empty Git repository in /home/you/${this.s.cwd}/.git/`, 'ok');
    }

    g_config(a) {
      const args = a.filter(x => !['--global', '--local', '--system'].includes(x));
      if (args[0] === '--list' || args[0] === '-l') return Object.entries(this.s.config).forEach(([k, v]) => this.p(`${k}=${v}`));
      if (!args[0]) this.err('usage: git config [--global] <key> [<value>]');
      if (args.length === 1) { const v = this.s.config[args[0]]; return v !== undefined ? this.p(v) : undefined; }
      this.s.config[args[0]] = args.slice(1).join(' ');
    }

    /* ---- status ---- */
    g_status(a) {
      const E = this.entries().filter(e => !e.clean && !e.ignored);
      if (a.includes('-s') || a.includes('--short')) {
        const b = a.includes('-b') || a.includes('-sb');
        if (b) this.h(span('t-g', '## ' + (this.curBranch() || 'HEAD (no branch)')));
        if (!E.length) return this.p('(nothing to show — working tree clean)', 'muted');
        E.forEach(e => {
          if (e.x === '?') return this.h(`${span('t-r', '??')} ${esc(e.f)}`);
          this.h(`${span('t-g', e.x)}${span('t-r', e.y)} ${esc(e.f)}`);
        });
        return;
      }
      const br = this.curBranch();
      this.p(br ? `On branch ${br}` : `HEAD detached at ${this.short(this.headHash())}`);
      const up = br && this.s.upstream[br];
      if (up && this.s.tracking[up] !== undefined) {
        const [ah, be] = this.aheadBehind(this.headHash(), this.s.tracking[up]);
        if (!ah && !be) this.p(`Your branch is up to date with '${up}'.`);
        else if (ah && !be) this.p(`Your branch is ahead of '${up}' by ${ah} commit${ah > 1 ? 's' : ''}.\n  (use "git push" to publish your local commits)`);
        else if (be && !ah) this.p(`Your branch is behind '${up}' by ${be} commit${be > 1 ? 's' : ''}, and can be fast-forwarded.\n  (use "git pull" to update your local branch)`);
        else this.p(`Your branch and '${up}' have diverged,\nand have ${ah} and ${be} different commits each, respectively.\n  (use "git pull" to merge the remote branch into yours)`);
      }
      if (!this.headHash()) this.p('\nNo commits yet');
      if (this.s.merge) this.p(this.s.merge.conflicts.length
        ? '\nYou have unmerged paths.\n  (fix conflicts and run "git commit")\n  (use "git merge --abort" to abort the merge)'
        : '\nAll conflicts fixed but you are still merging.\n  (use "git commit" to conclude merge)');
      const staged = E.filter(e => e.x !== ' ' && e.x !== '?' && e.x !== 'U');
      const unmerged = E.filter(e => e.x === 'U');
      const unstaged = E.filter(e => e.y !== ' ' && e.y !== '?' && e.x !== 'U');
      const untracked = E.filter(e => e.x === '?');
      const lbl = { A: 'new file:   ', M: 'modified:   ', D: 'deleted:    ' };
      if (staged.length) {
        this.p('\nChanges to be committed:\n  (use "git restore --staged <file>..." to unstage)');
        staged.forEach(e => this.h('        ' + span('t-g', lbl[e.x] + e.f)));
      }
      if (unmerged.length) {
        this.p('\nUnmerged paths:\n  (use "git add <file>..." to mark resolution)');
        unmerged.forEach(e => this.h('        ' + span('t-r', 'both modified:   ' + e.f)));
      }
      if (unstaged.length) {
        this.p('\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n  (use "git restore <file>..." to discard changes in working directory)');
        unstaged.forEach(e => this.h('        ' + span('t-r', lbl[e.y] + e.f)));
      }
      if (untracked.length) {
        this.p('\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)');
        untracked.forEach(e => this.h('        ' + span('t-r', e.f)));
      }
      if (!E.length) this.p(this.headHash() ? '\nnothing to commit, working tree clean' : '\nnothing to commit (create/copy files and use "git add" to track)');
      else if (!staged.length && !unmerged.length) this.p(untracked.length && !unstaged.length
        ? '\nnothing added to commit but untracked files present (use "git add" to track)'
        : '\nno changes added to commit (use "git add" and/or "git commit -a")');
    }

    /* ---- add / rm ---- */
    expandPaths(specs, includeIgnored) {
      const all = union(this.s.work, this.s.index);
      const rules = this.rules();
      const res = new Set();
      for (const sp of specs) {
        let matched;
        if (sp === '.' || sp === '-A' || sp === '--all' || sp === '*') {
          matched = all.filter(f => includeIgnored || this.s.index[f] !== undefined || this.headTree()[f] !== undefined || !ignoredBy(f, rules));
        } else if (/[*?]/.test(sp)) {
          const re = globRe(sp); matched = all.filter(f => re.test(f) || re.test(f.split('/').pop()));
          matched = matched.filter(f => includeIgnored || this.s.index[f] !== undefined || !ignoredBy(f, rules));
        } else {
          const d = sp.replace(/\/$/, '');
          matched = all.filter(f => f === d || f.startsWith(d + '/'));
          if (!includeIgnored) {
            const ign = matched.filter(f => this.s.index[f] === undefined && this.headTree()[f] === undefined && ignoredBy(f, rules));
            if (ign.length && ign.length === matched.length)
              this.err(`The following paths are ignored by one of your .gitignore files:\n${sp}\nhint: Use -f if you really want to add them.`);
            matched = matched.filter(f => !ign.includes(f));
          }
        }
        if (!matched.length && !['.', '-A', '--all'].includes(sp)) this.err(`fatal: pathspec '${sp}' did not match any files`);
        matched.forEach(f => res.add(f));
      }
      return [...res];
    }
    g_add(a) {
      const force = a.includes('-f') || a.includes('--force');
      const specs = a.filter(x => !['-f', '--force', '-v'].includes(x));
      if (!specs.length) this.err("Nothing specified, nothing added.\nhint: Maybe you wanted to say 'git add .'?");
      const files = this.expandPaths(specs, force);
      const staged = [];
      for (const f of files) {
        const w = this.s.work[f];
        if (this.s.merge && this.s.merge.conflicts.includes(f) && /^<{7}/m.test(w || ''))
          this.err(`error: '${f}' still contains conflict markers (<<<<<<< ======= >>>>>>>).\nhint: edit the file first, or use: resolve ${f} ours|theirs|both`);
        if (w === undefined) { if (this.s.index[f] !== undefined) { delete this.s.index[f]; staged.push(f); } }
        else if (this.s.index[f] !== w || (this.s.merge && this.s.merge.conflicts.includes(f))) { this.s.index[f] = w; staged.push(f); }
        if (this.s.merge) this.s.merge.conflicts = this.s.merge.conflicts.filter(x => x !== f);
      }
      if (staged.length) this.p(`✓ staged: ${staged.join(', ')}`, 'muted');
      else this.p('(nothing new to stage)', 'muted');
    }
    g_rm(a) {
      const cached = a.includes('--cached');
      const files = this.expandPaths(a.filter(x => !x.startsWith('-')), true);
      files.forEach(f => {
        if (this.s.index[f] === undefined) this.err(`fatal: pathspec '${f}' did not match any tracked files`);
        delete this.s.index[f]; if (!cached) delete this.s.work[f];
        this.p(`rm '${f}'`);
      });
      if (cached) this.p('(file removed from Git tracking but kept on disk)', 'muted');
    }

    /* ---- commit ---- */
    g_commit(a) {
      let msgs = [], all = false, amend = false;
      for (let i = 0; i < a.length; i++) {
        const x = a[i];
        if (x === '-m' || x === '--message') msgs.push(a[++i] ?? '');
        else if (x === '-am' || x === '-a' || x === '--all') { all = true; if (x === '-am') msgs.push(a[++i] ?? ''); }
        else if (x === '--amend') amend = true;
        else if (x.startsWith('-m')) msgs.push(x.slice(2));
      }
      const s = this.s;
      if (all) union(s.index).forEach(f => { if (s.work[f] === undefined) delete s.index[f]; else s.index[f] = s.work[f]; });
      if (s.merge && s.merge.conflicts.length) this.err('error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use \'git add <file>\'.');
      let msg = msgs.filter(Boolean).join('\n\n');
      const head = this.headHash();
      if (amend) {
        if (!head) this.err('fatal: You have nothing to amend.');
        const old = s.commits[head];
        const h = this.mk(msg || old.msg, old.parents, s.index);
        this.advance(h);
        return this.p(`[${this.curBranch() || 'detached HEAD'} ${this.short(h)}] ${msg || old.msg}\n(amended: the old commit ${this.short(head)} was replaced by a new one)`, 'ok');
      }
      if (!msg && s.merge) msg = `Merge branch '${s.merge.name}'`;
      if (!msg) this.err('Aborting commit due to empty commit message.\nhint: in this simulator always pass a message: git commit -m "Describe your change"');
      const same = JSON.stringify(Object.entries(s.index).sort()) === JSON.stringify(Object.entries(this.headTree()).sort());
      if (same && !s.merge) {
        const E = this.entries().filter(e => !e.clean && !e.ignored);
        this.err(E.length ? 'nothing added to commit (use "git add" to stage changes first)\nhint: Working → git add → Staging → git commit' : 'On branch ' + (this.curBranch() || 'HEAD') + '\nnothing to commit, working tree clean');
      }
      const parents = [head]; if (s.merge) parents.push(s.merge.theirs);
      const changed = union(s.index, this.headTree()).filter(f => s.index[f] !== this.headTree()[f]);
      const h = this.mk(msg, parents, s.index);
      this.advance(h);
      const wasMerge = !!s.merge; s.merge = null;
      this.p(`[${this.curBranch() || 'detached HEAD'}${head ? '' : ' (root-commit)'} ${this.short(h)}] ${msg.split('\n')[0]}`, 'ok');
      this.p(` ${changed.length} file${changed.length === 1 ? '' : 's'} changed${wasMerge ? ' (merge commit with 2 parents)' : ''}`);
      if (VAGUE.test(msg.trim())) this.p(`💡 Tip: "${msg}" is vague. Good messages say WHAT changed, e.g. "Add responsive navbar".`, 'hint');
    }

    /* ---- log ---- */
    refsAt() {
      const s = this.s, m = {};
      const add = (h, r) => { if (h) (m[h] = m[h] || []).push(r); };
      const hb = this.curBranch();
      if (!hb) add(this.headHash(), { type: 'head', name: 'HEAD' });
      Object.entries(s.branches).forEach(([b, h]) => add(h, { type: 'branch', name: b, head: b === hb }));
      Object.entries(s.tracking).forEach(([b, h]) => add(h, { type: 'remote', name: b }));
      Object.entries(s.tags).forEach(([t, h]) => add(h, { type: 'tag', name: t }));
      Object.values(m).forEach(arr => arr.sort((a, b) => (b.head ? 1 : 0) - (a.head ? 1 : 0)));
      return m;
    }
    deco(h, refs) {
      const r = refs[h]; if (!r) return '';
      const parts = r.map(x => x.type === 'head' ? span('t-c', 'HEAD') : x.head ? span('t-c', 'HEAD -> ') + span('t-g', x.name)
        : x.type === 'branch' ? span('t-g', x.name) : x.type === 'remote' ? span('t-r', x.name) : span('t-y', 'tag: ' + x.name));
      return ` ${span('t-y', '(')}${parts.join(span('t-y', ', '))}${span('t-y', ')')}`;
    }
    g_log(a) {
      const one = a.includes('--oneline'), graph = a.includes('--graph'), all = a.includes('--all');
      let limit = Infinity;
      a.forEach((x, i) => { if (/^-\d+$/.test(x)) limit = +x.slice(1); if (x === '-n') limit = +a[i + 1]; });
      const range = a.find(x => x.includes('..'));
      const s = this.s;
      if (!this.headHash() && !all) this.err(`fatal: your current branch '${this.curBranch()}' does not have any commits yet`);
      let set;
      if (range) {
        const [x, y] = range.split('..'); const X = this.ancestors(this.resolve(x || 'HEAD')); set = [...this.ancestors(this.resolve(y || 'HEAD'))].filter(c => !X.has(c));
      } else {
        const tips = all ? [this.headHash(), ...Object.values(s.branches), ...Object.values(s.tracking), ...Object.values(s.tags)] : [this.headHash()];
        set = new Set(); tips.forEach(t => this.ancestors(t).forEach(c => set.add(c))); set = [...set];
      }
      const list = set.map(h => s.commits[h]).sort((x, y) => y.n - x.n).slice(0, limit);
      const refs = this.refsAt();
      if (!list.length) return this.p('(no commits in this range)', 'muted');
      list.forEach(c => {
        const g = graph ? span('t-r', c.parents.length > 1 ? '*   ' : '* ') : '';
        if (one) this.h(`${g}${span('t-y', this.short(c.hash))}${this.deco(c.hash, refs)} ${esc(c.msg.split('\n')[0])}`);
        else {
          this.h(`${g}${span('t-y', 'commit ' + c.hash + 'f3a9c1d0e2b4a6c8d0e1f2a3b4c5d6e7f8a9b0'.slice(0, 33))}${this.deco(c.hash, refs)}`);
          if (c.parents.length > 1) this.p(`${graph ? '| ' : ''}Merge: ${c.parents.map(p => this.short(p)).join(' ')}`);
          this.p(`${graph ? '| ' : ''}Author: ${c.author} <${c.author === this.s.config['user.name'] ? this.s.config['user.email'] : 'teammate@example.com'}>`);
          this.p(`${graph ? '| ' : ''}\n${graph ? '| ' : ''}    ${c.msg.split('\n')[0]}\n${graph ? '| ' : ''}`);
        }
      });
      if (graph) this.p('(the visual graph above shows the branch shape more clearly)', 'muted');
    }

    /* ---- branch ---- */
    g_branch(a) {
      const s = this.s, flags = a.filter(x => x.startsWith('-')), args = a.filter(x => !x.startsWith('-'));
      const has = f => flags.includes(f);
      const listLocal = () => Object.keys(s.branches).sort().forEach(b => {
        const cur = b === this.curBranch();
        const v = has('-v') || has('-vv') ? `  ${this.short(s.branches[b])} ${s.commits[s.branches[b]].msg.split('\n')[0]}` : '';
        this.h(cur ? span('t-g', '* ' + b) + esc(v) : '  ' + esc(b + v));
      });
      if (has('-d') || has('-D') || has('--delete')) {
        if (!args.length) this.err('fatal: branch name required');
        return args.forEach(b => {
          if (s.branches[b] === undefined) this.err(`error: branch '${b}' not found.`);
          if (b === this.curBranch()) this.err(`error: cannot delete branch '${b}' used by worktree (you are on it).\nhint: switch to another branch first: git switch main`);
          if (has('-d') && !this.isAncestor(s.branches[b], this.headHash()) && !Object.values(s.tracking).some(t => this.isAncestor(s.branches[b], t)))
            this.err(`error: the branch '${b}' is not fully merged.\nhint: If you are sure you want to delete it, run 'git branch -D ${b}'.`);
          this.p(`Deleted branch ${b} (was ${this.short(s.branches[b])}).`);
          delete s.branches[b]; delete s.upstream[b];
        });
      }
      if (has('-m') || has('-M')) {
        let [oldN, newN] = args.length === 1 ? [this.curBranch(), args[0]] : args;
        if (!newN) this.err('fatal: new branch name required');
        if (s.branches[newN] !== undefined && !has('-M')) this.err(`fatal: a branch named '${newN}' already exists`);
        if (s.branches[oldN] !== undefined) { s.branches[newN] = s.branches[oldN]; if (oldN !== newN) delete s.branches[oldN]; }
        if (s.upstream[oldN]) { s.upstream[newN] = s.upstream[oldN]; delete s.upstream[oldN]; }
        if (s.head.type === 'branch' && s.head.name === oldN) s.head.name = newN;
        return this.p(`(renamed branch '${oldN}' → '${newN}')`, 'muted');
      }
      if (has('-r')) { const t = Object.keys(s.tracking).sort(); if (!t.length) this.p('(no remote-tracking branches — try git fetch)', 'muted'); return t.forEach(b => this.h('  ' + span('t-r', b))); }
      if (has('-a')) { listLocal(); return Object.keys(s.tracking).sort().forEach(b => this.h('  ' + span('t-r', 'remotes/' + b))); }
      if (!args.length) {
        if (!Object.keys(s.branches).length) return this.p(`(no branches yet — '${this.curBranch()}' will be created by your first commit)`, 'muted');
        return listLocal();
      }
      const [name, start] = args;
      this.createBranch(name, start);
    }
    createBranch(name, start) {
      const s = this.s;
      if (!/^[\w./-]+$/.test(name) || name.endsWith('/') || name.includes('..')) this.err(`fatal: '${name}' is not a valid branch name.`);
      if (s.branches[name] !== undefined) this.err(`fatal: a branch named '${name}' already exists`);
      const h = start ? this.resolve(start) : this.headHash();
      if (!h) this.err(`fatal: not a valid object name: '${this.curBranch()}'.\nhint: make your first commit before creating branches.`);
      s.branches[name] = h;
    }

    /* ---- switch / checkout ---- */
    checkoutTree(target) {
      const s = this.s, cur = this.headTree(), tgt = this.tree(target), I = s.index, W = s.work;
      const bad = [];
      for (const f of union(cur, tgt, I, W)) {
        const changed = I[f] !== cur[f] || W[f] !== cur[f];
        if (changed && cur[f] !== tgt[f]) {
          const untrackedSame = I[f] === undefined && cur[f] === undefined && tgt[f] === undefined;
          if (!untrackedSame) bad.push(f);
        }
      }
      if (bad.length) this.err(`error: Your local changes to the following files would be overwritten by checkout:\n\t${bad.join('\n\t')}\nPlease commit your changes or stash them before you switch branches.\nhint: git stash  → switch → git stash pop`);
      const nI = { ...tgt }, nW = { ...tgt };
      for (const f of union(cur, I, W)) {
        if (I[f] !== cur[f]) { if (I[f] === undefined) delete nI[f]; else nI[f] = I[f]; }
        if (W[f] !== cur[f]) { if (W[f] === undefined) delete nW[f]; else nW[f] = W[f]; }
      }
      s.index = nI; s.work = nW;
    }
    switchBranch(name) {
      const s = this.s;
      if (s.merge) this.err('error: you need to resolve your current index first (merge in progress).\nhint: finish the merge or run git merge --abort');
      if (this.curBranch() === name) return this.p(`Already on '${name}'`);
      this.checkoutTree(s.branches[name]);
      s.head = { type: 'branch', name };
      this.p(`Switched to branch '${name}'`, 'ok');
      const up = s.upstream[name];
      if (up && s.tracking[up]) {
        const [ah, be] = this.aheadBehind(s.branches[name], s.tracking[up]);
        if (!ah && !be) this.p(`Your branch is up to date with '${up}'.`);
        else if (be && !ah) this.p(`Your branch is behind '${up}' by ${be} commit(s). (use "git pull")`);
        else if (ah && !be) this.p(`Your branch is ahead of '${up}' by ${ah} commit(s). (use "git push")`);
      }
    }
    g_switch(a) {
      const s = this.s;
      const ci = a.findIndex(x => x === '-c' || x === '-C' || x === '--create');
      if (ci !== -1) {
        const name = a[ci + 1]; const start = a.filter((x, i) => i !== ci && i !== ci + 1 && !x.startsWith('-'))[0];
        if (!name) this.err("error: switch '-c' requires a branch name");
        if (s.merge) this.err('error: merge in progress — finish or abort it first.');
        if (!this.headHash() && !start) {
          if (s.branches[name] !== undefined) this.err(`fatal: a branch named '${name}' already exists`);
          s.head = { type: 'branch', name }; return this.p(`Switched to a new branch '${name}'`, 'ok');
        }
        if (a[ci] === '-C' && s.branches[name] !== undefined) delete s.branches[name];
        const target = start ? this.resolve(start) : this.headHash();
        this.checkoutTree(target);
        this.createBranch(name, start);
        s.head = { type: 'branch', name };
        return this.p(`Switched to a new branch '${name}'`, 'ok');
      }
      if (a.includes('--detach') || a.includes('-d')) {
        const ref = a.find(x => !x.startsWith('-')) || 'HEAD';
        return this.detach(this.resolve(ref));
      }
      let name = a.find(x => !x.startsWith('-'));
      if (!name) this.err('fatal: missing branch or commit argument');
      if (name === '-') { name = this.prevBranch; if (!name) this.err('fatal: no previous branch'); }
      const prev = this.curBranch();
      if (s.branches[name] === undefined) {
        if (s.tracking['origin/' + name]) {
          this.checkoutTree(s.tracking['origin/' + name]);
          s.branches[name] = s.tracking['origin/' + name]; s.upstream[name] = 'origin/' + name;
          s.head = { type: 'branch', name };
          this.p(`branch '${name}' set up to track 'origin/${name}'.`);
          this.prevBranch = prev;
          return this.p(`Switched to a new branch '${name}'`, 'ok');
        }
        if (!this.headHash() && !Object.keys(s.branches).length) this.err(`fatal: invalid reference: ${name}\nhint: there are no commits yet. Use 'git switch -c ${name}' to start on a new branch.`);
        if (this.resolve(name, true)) this.err(`fatal: a branch is expected, got commit '${name}'\nhint: to look at an old commit use: git switch --detach ${name}`);
        this.err(`fatal: invalid reference: ${name}\nhint: create it with: git switch -c ${name}`);
      }
      this.switchBranch(name);
      if (prev && prev !== name) this.prevBranch = prev;
    }
    detach(h) {
      this.checkoutTree(h);
      this.s.head = { type: 'detached', hash: h };
      this.p(`HEAD is now at ${this.short(h)} ${this.s.commits[h].msg.split('\n')[0]}`);
      this.p("You are in 'detached HEAD' state. You can look around and make experimental commits.\nTo get back: git switch main   |   To keep work: git switch -c <new-branch>", 'hint');
    }
    g_checkout(a) {
      const bi = a.findIndex(x => x === '-b' || x === '-B');
      if (bi !== -1) return this.g_switch(a.map((x, i) => i === bi ? (x === '-b' ? '-c' : '-C') : x));
      const dd = a.indexOf('--');
      if (dd !== -1) return this.g_restore(a.slice(dd + 1));
      const name = a.find(x => !x.startsWith('-'));
      if (!name) this.err('error: checkout needs a branch, commit, or file');
      if (this.s.branches[name] !== undefined || this.s.tracking['origin/' + name]) {
        this.g_switch([name]);
        return this.p("💡 Modern Git: 'git switch' changes branches, 'git restore' restores files.", 'hint');
      }
      if ((this.s.index[name] !== undefined) && !this.resolve(name, true)) return this.g_restore([name]);
      const h = this.resolve(name, true);
      if (h) return this.detach(h);
      this.err(`error: pathspec '${name}' did not match any file(s) known to git`);
    }

    /* ---- merge machinery ---- */
    merge3(B, O, T, oLabel, tLabel) {
      const tree = {}, conflicts = [];
      for (const f of union(B, O, T)) {
        const b = B[f], o = O[f], t = T[f];
        let r;
        if (o === t) r = o;
        else if (o === b) r = t;
        else if (t === b) r = o;
        else { conflicts.push(f); r = `<<<<<<< ${oLabel}\n${o ?? '(deleted)'}\n=======\n${t ?? '(deleted)'}\n>>>>>>> ${tLabel}`; }
        if (r !== undefined) tree[f] = r;
      }
      return { tree, conflicts };
    }
    applyTree(tree) {
      // replace tracked content with tree, keep untracked files
      const s = this.s, oldTracked = union(s.index, this.headTree());
      const nW = {};
      Object.keys(s.work).forEach(f => { if (!oldTracked.includes(f)) nW[f] = s.work[f]; });
      Object.assign(nW, tree);
      s.work = nW; s.index = { ...tree };
    }
    g_merge(a) {
      const s = this.s;
      if (a.includes('--abort')) {
        if (!s.merge) this.err('fatal: There is no merge to abort (MERGE_HEAD missing).');
        this.applyTree(this.headTree()); s.merge = null;
        return this.p('Merge aborted. Your branch is back to how it was before the merge.', 'ok');
      }
      if (a.includes('--continue')) return this.g_commit([]);
      const noff = a.includes('--no-ff'), squash = a.includes('--squash');
      const mi = a.indexOf('-m'); const customMsg = mi !== -1 ? a[mi + 1] : null;
      const name = a.find((x, i) => !x.startsWith('-') && i !== mi + 1 || (mi === -1 && !x.startsWith('-')));
      if (!name) this.err('fatal: No remote for the current branch / nothing to merge. Usage: git merge <branch>');
      if (s.merge) this.err('error: Merging is not possible because you have unmerged files.\nhint: resolve conflicts, git add, git commit — or git merge --abort');
      const theirs = this.resolve(name);
      const ours = this.headHash();
      this.requireClean('merge');
      if (ours && this.isAncestor(theirs, ours)) return this.p('Already up to date.');
      if (squash) {
        const base = this.mergeBase(ours, theirs);
        const r = this.merge3(this.tree(base), this.headTree(), this.tree(theirs), 'HEAD', name);
        if (r.conflicts.length) this.err(`CONFLICT in ${r.conflicts.join(', ')} — (simulator) squash aborted. Resolve conflicts with a normal merge first.`);
        this.applyTree(r.tree);
        // keep HEAD tree in place: index holds squashed result
        return this.p(`Squash commit -- not updating HEAD\nAll changes from '${name}' are now STAGED as one change.\nNext: git commit -m "Add complete ${name.split('/').pop()} feature"`, 'ok');
      }
      if (!ours || (this.isAncestor(ours, theirs) && !noff)) {
        this.checkoutTree(theirs); this.advance(theirs);
        this.p(`Updating ${this.short(ours)}..${this.short(theirs)}\nFast-forward`, 'ok');
        return this.p(`(fast-forward: '${this.curBranch()}' simply moved forward to ${this.short(theirs)} — no merge commit needed)`, 'muted');
      }
      const base = this.mergeBase(ours, theirs);
      const r = this.merge3(this.tree(base), this.headTree(), this.tree(theirs), 'HEAD', name);
      if (r.conflicts.length) {
        this.applyTree(r.tree);
        // conflicted files: index keeps "ours" until resolved
        r.conflicts.forEach(f => { const o = this.headTree()[f]; if (o === undefined) delete s.index[f]; else s.index[f] = o; });
        s.merge = { theirs, name, conflicts: [...r.conflicts] };
        r.conflicts.forEach(f => this.p(`Auto-merging ${f}\nCONFLICT (content): Merge conflict in ${f}`, 'err'));
        return this.p('Automatic merge failed; fix conflicts and then commit the result.\nhint: cat the file, then: resolve <file> ours|theirs|both → git add <file> → git commit\nhint: or cancel with: git merge --abort', 'hint');
      }
      this.applyTree(r.tree);
      const h = this.mk(customMsg || `Merge branch '${name}'${this.curBranch() && this.curBranch() !== 'main' ? ' into ' + this.curBranch() : ''}`, [ours, theirs], r.tree);
      this.advance(h);
      this.p("Merge made by the 'ort' strategy. (three-way merge)", 'ok');
      this.p(`(created merge commit ${this.short(h)} with two parents: ${this.short(ours)} + ${this.short(theirs)}; common ancestor was ${this.short(base)})`, 'muted');
    }
    g_rebase(a) {
      const s = this.s;
      if (a.includes('--abort') || a.includes('--continue')) return this.p('No rebase in progress? (the simulator auto-aborts conflicting rebases)', 'muted');
      const name = a.find(x => !x.startsWith('-'));
      if (!name) this.err('usage: git rebase <branch>');
      if (!this.curBranch()) this.err('fatal: rebase needs you to be on a branch');
      this.requireClean('rebase');
      const onto = this.resolve(name), ours = this.headHash();
      if (this.isAncestor(onto, ours)) return this.p(`Current branch ${this.curBranch()} is up to date.`);
      if (this.isAncestor(ours, onto)) { this.checkoutTree(onto); this.advance(onto); return this.p(`Successfully rebased and updated refs/heads/${this.curBranch()}. (fast-forwarded)`, 'ok'); }
      const base = this.mergeBase(ours, onto);
      const chain = []; let c = ours;
      while (c && c !== base && !this.isAncestor(c, onto)) { chain.unshift(c); c = s.commits[c].parents[0]; }
      let nb = onto; const made = [];
      for (const h of chain) {
        const cm = s.commits[h];
        if (cm.parents.length > 1) continue;
        const r = this.merge3(this.tree(cm.parents[0]), this.tree(nb), cm.tree, 'HEAD', this.short(h));
        if (r.conflicts.length) this.err(`CONFLICT (content): Merge conflict in ${r.conflicts.join(', ')} while replaying "${cm.msg}".\n(simulator) rebase aborted — your branch is unchanged. Practise conflicts with git merge.`);
        nb = this.mk(cm.msg, [nb], r.tree, { rebasedFrom: h, author: cm.author }); made.push([h, nb]);
      }
      this.checkoutTree(ours); // no-op safety
      this.applyTree(this.tree(nb)); this.advance(nb);
      this.p(`Successfully rebased and updated refs/heads/${this.curBranch()}.`, 'ok');
      made.forEach(([o, n]) => this.p(`  ${this.short(o)} → ${this.short(n)}  (rewritten as a NEW commit: ${s.commits[n].msg})`, 'muted'));
      this.p('⚠ Rebase rewrites history: never rebase commits others already pulled.', 'hint');
    }

    /* ---- reset / restore ---- */
    g_reset(a) {
      const s = this.s;
      const mode = a.includes('--soft') ? 'soft' : a.includes('--hard') ? 'hard' : 'mixed';
      const args = a.filter(x => !x.startsWith('--') && x !== '--');
      const ref = args[0];
      if (ref && !this.resolve(ref, true) && union(s.index, s.work, this.headTree()).some(f => f === ref || f.startsWith(ref + '/'))) {
        return this.g_restore(['--staged', ...args]);
      }
      const target = ref ? this.resolve(ref) : this.headHash();
      if (!target) { s.index = {}; return this.p('(unstaged everything)', 'muted'); }
      const old = this.headHash();
      if (mode === 'hard') {
        const keep = {}; const oldTracked = union(s.index, this.headTree());
        Object.keys(s.work).forEach(f => { if (!oldTracked.includes(f)) keep[f] = s.work[f]; });
        this.advance(target);
        s.index = { ...this.tree(target) }; s.work = { ...keep, ...this.tree(target) }; s.merge = null;
        this.p(`HEAD is now at ${this.short(target)} ${s.commits[target].msg.split('\n')[0]}`);
        if (old !== target) this.p('⚠ --hard discarded staged + working changes. Commits after this point are no longer on any branch (faded in the graph).', 'hint');
        return;
      }
      this.advance(target);
      if (mode === 'mixed') {
        s.index = { ...this.tree(target) }; s.merge = null;
        const E = this.entries().filter(e => !e.clean && !e.ignored && e.x !== '?');
        if (E.length) { this.p('Unstaged changes after reset:'); E.forEach(e => this.p(`${e.y === ' ' ? 'M' : e.y}\t${e.f}`)); }
        return this.p(`(mixed: HEAD moved to ${this.short(target)}; changes are kept in your files but UNSTAGED)`, 'muted');
      }
      this.p(`(soft: HEAD moved to ${this.short(target)}; the undone changes are still STAGED — ready to re-commit)`, 'muted');
    }
    g_restore(a) {
      const s = this.s;
      const staged = a.includes('--staged') || a.includes('-S');
      const si = a.findIndex(x => x === '--source' || x.startsWith('--source='));
      let src = null;
      if (si !== -1) src = a[si].includes('=') ? a[si].split('=')[1] : a[si + 1];
      const files0 = a.filter((x, i) => !x.startsWith('-') && !(si !== -1 && i === si + 1));
      if (!files0.length) this.err('fatal: you must specify path(s) to restore');
      const H = this.headTree();
      const files = files0.includes('.') ? union(s.index, H, staged ? {} : s.work).filter(f => s.index[f] !== undefined || H[f] !== undefined) : files0;
      files.forEach(f => {
        if (staged) {
          if (s.index[f] === undefined && H[f] === undefined) this.err(`error: pathspec '${f}' did not match any file(s) known to git`);
          if (H[f] === undefined) delete s.index[f]; else s.index[f] = H[f];
        } else {
          const from = src ? this.tree(this.resolve(src)) : s.index;
          if (from[f] === undefined) this.err(`error: pathspec '${f}' did not match any file(s) known to git${s.work[f] !== undefined ? '\nhint: untracked files are not known to Git — delete it with rm if you want it gone' : ''}`);
          s.work[f] = from[f];
        }
      });
      this.p(staged ? `✓ unstaged: ${files.join(', ')} (your edits are still in the file)` : `✓ restored: ${files.join(', ')} (local changes discarded)`, 'muted');
    }

    /* ---- revert / cherry-pick ---- */
    g_revert(a) {
      const ref = a.find(x => !x.startsWith('-'));
      if (!ref) this.err('usage: git revert <commit>');
      const h = this.resolve(ref), c = this.s.commits[h];
      if (c.parents.length > 1 && !a.includes('-m')) this.err(`error: commit ${this.short(h)} is a merge but no -m option was given.`);
      if (!c.parents.length) this.err('error: cannot revert the root commit in this simulator');
      this.requireClean('revert');
      const r = this.merge3(c.tree, this.headTree(), this.tree(c.parents[0]), 'HEAD', 'parent of ' + this.short(h));
      if (r.conflicts.length) this.err(`CONFLICT in ${r.conflicts.join(', ')} — (simulator) revert aborted. Later commits changed the same file.`);
      this.applyTree(r.tree);
      const nh = this.mk(`Revert "${c.msg.split('\n')[0]}"`, [this.headHash()], r.tree);
      this.advance(nh);
      this.p(`[${this.curBranch()} ${this.short(nh)}] Revert "${c.msg.split('\n')[0]}"`, 'ok');
      this.p(`(a NEW commit that undoes ${this.short(h)} — history is preserved, safe for shared branches)`, 'muted');
    }
    g_cherry_pick(a) {
      const ref = a.find(x => !x.startsWith('-'));
      if (!ref) this.err('usage: git cherry-pick <commit>');
      const h = this.resolve(ref), c = this.s.commits[h];
      if (!c.parents.length) this.err('error: cannot cherry-pick a root commit in this simulator');
      if (c.parents.length > 1) this.err('error: cherry-picking merge commits needs -m (not simulated)');
      this.requireClean('cherry-pick');
      const r = this.merge3(this.tree(c.parents[0]), this.headTree(), c.tree, 'HEAD', this.short(h));
      if (r.conflicts.length) this.err(`CONFLICT in ${r.conflicts.join(', ')} — (simulator) cherry-pick aborted.`);
      if (JSON.stringify(r.tree) === JSON.stringify(this.headTree())) this.err('The previous cherry-pick is now empty — that change is already on this branch.');
      this.applyTree(r.tree);
      const nh = this.mk(c.msg, [this.headHash()], r.tree, { pickedFrom: h });
      this.advance(nh);
      this.p(`[${this.curBranch()} ${this.short(nh)}] ${c.msg.split('\n')[0]}`, 'ok');
      this.p(`(copied the change from ${this.short(h)} as a new commit ${this.short(nh)})`, 'muted');
    }

    /* ---- stash ---- */
    g_stash(a) {
      const s = this.s, sub = a[0] && !a[0].startsWith('-') ? a[0] : 'push';
      const idx = () => { const m = (a[1] || '').match(/\{(\d+)\}/); return m ? +m[1] : 0; };
      if (sub === 'push' || sub === 'save') {
        const E = this.entries().filter(e => !e.clean && !e.ignored && e.x !== '?');
        if (!E.length) return this.p('No local changes to save');
        const H = this.headTree();
        const tracked = union(s.index, H);
        const work = {}; tracked.forEach(f => { if (s.work[f] !== undefined) work[f] = s.work[f]; });
        const mi = a.indexOf('-m');
        const head = this.headHash();
        const label = mi !== -1 ? `On ${this.curBranch()}: ${a[mi + 1]}` : `WIP on ${this.curBranch()}: ${this.short(head)} ${s.commits[head]?.msg.split('\n')[0] || ''}`;
        s.stash.unshift({ base: head, index: { ...s.index }, work, tracked, label });
        const keep = {}; Object.keys(s.work).forEach(f => { if (!tracked.includes(f)) keep[f] = s.work[f]; });
        s.index = { ...H }; s.work = { ...keep, ...H };
        return this.p(`Saved working directory and index state ${label}`, 'ok');
      }
      if (sub === 'list') { if (!s.stash.length) return this.p('(stash is empty)', 'muted'); return s.stash.forEach((e, i) => this.p(`stash@{${i}}: ${e.label}`)); }
      if (sub === 'clear') { s.stash = []; return this.p('(all stashes deleted)', 'muted'); }
      if (sub === 'drop') { const i = idx(); if (!s.stash[i]) this.err(`error: stash@{${i}} does not exist`); s.stash.splice(i, 1); return this.p(`Dropped stash@{${i}}`); }
      if (sub === 'show') { const e = s.stash[idx()]; if (!e) this.err('error: no stash entries'); return union(e.work, this.tree(e.base)).filter(f => e.work[f] !== this.tree(e.base)[f]).forEach(f => this.p(` ${f} | changed`)); }
      if (sub === 'pop' || sub === 'apply') {
        const i = idx(), e = s.stash[i];
        if (!e) this.err('error: No stash entries found.');
        const B = this.tree(e.base), H = this.headTree();
        const conflicts = [];
        union(e.work, B).forEach(f => { if (e.work[f] !== B[f] && s.work[f] !== H[f]) conflicts.push(f); });
        if (conflicts.length) this.err(`error: Your local changes to ${conflicts.join(', ')} would be overwritten. Commit or stash them first.`);
        union(e.work, B, e.index).forEach(f => {
          if (!e.tracked.includes(f)) return;
          if (e.work[f] !== B[f]) { if (e.work[f] === undefined) delete s.work[f]; else s.work[f] = e.work[f]; }
          if (B[f] === undefined && e.index[f] !== undefined) s.index[f] = e.index[f]; // new files stay staged
        });
        if (sub === 'pop') { s.stash.splice(i, 1); this.p(`✓ Applied and dropped stash@{${i}} (${e.label})`, 'ok'); }
        else this.p(`✓ Applied stash@{${i}} — it is still saved in the stash list (git stash drop to remove)`, 'ok');
        return;
      }
      this.err(`unknown stash subcommand '${sub}'`);
    }

    /* ---- diff / show ---- */
    printDiff(A, B, onlyFiles) {
      let any = false;
      union(A, B).forEach(f => {
        if (onlyFiles && !onlyFiles.includes(f)) return;
        if (A[f] === B[f]) return;
        any = true;
        this.h(`<b>diff --git a/${esc(f)} b/${esc(f)}</b>`);
        if (A[f] === undefined) this.p('new file');
        if (B[f] === undefined) this.p('deleted file');
        this.p(`--- ${A[f] === undefined ? '/dev/null' : 'a/' + f}\n+++ ${B[f] === undefined ? '/dev/null' : 'b/' + f}`);
        this.p('@@', 'info');
        diffLines(A[f], B[f]).forEach(([t, l]) => this.p(t + l, t === '+' ? 'add' : t === '-' ? 'del' : ''));
      });
      return any;
    }
    g_diff(a) {
      const s = this.s, args = a.filter(x => !x.startsWith('-'));
      const staged = a.includes('--staged') || a.includes('--cached');
      let any;
      if (args[0] && args[0].includes('..')) {
        const [x, y] = args[0].split('..'); any = this.printDiff(this.tree(this.resolve(x || 'HEAD')), this.tree(this.resolve(y || 'HEAD')));
      } else if (args.length === 2 && this.resolve(args[0], true) && this.resolve(args[1], true)) {
        any = this.printDiff(this.tree(this.resolve(args[0])), this.tree(this.resolve(args[1])));
      } else if (staged) any = this.printDiff(this.headTree(), s.index, args.length ? args : null);
      else if (args[0] && this.resolve(args[0], true)) {
        const W = {}; union(s.index, this.headTree()).forEach(f => { if (s.work[f] !== undefined) W[f] = s.work[f]; });
        any = this.printDiff(this.tree(this.resolve(args[0])), W);
      } else {
        const W = {}; Object.keys(s.index).forEach(f => { if (s.work[f] !== undefined) W[f] = s.work[f]; });
        any = this.printDiff(s.index, W, args.length ? args : null);
      }
      if (!any) this.p(staged ? '(no staged changes — nothing would be committed)' : '(no differences)' + (!staged && Object.keys(s.index).some(f => s.index[f] !== this.headTree()[f]) ? ' — your changes are staged; try git diff --staged' : ''), 'muted');
    }
    g_show(a) {
      const h = this.resolve(a.find(x => !x.startsWith('-')) || 'HEAD');
      const c = this.s.commits[h];
      this.h(`${span('t-y', 'commit ' + h)}${this.deco(h, this.refsAt())}`);
      if (c.parents.length > 1) this.p(`Merge: ${c.parents.map(p => this.short(p)).join(' ')}`);
      this.p(`Author: ${c.author}\n\n    ${c.msg}\n`);
      if (c.parents.length <= 1) this.printDiff(this.tree(c.parents[0]), c.tree);
    }

    /* ---- tag ---- */
    g_tag(a) {
      const s = this.s, args = a.filter(x => !x.startsWith('-'));
      const mi = a.indexOf('-m'); if (mi !== -1) args.splice(args.indexOf(a[mi + 1]), 1);
      if (a.includes('-d')) { args.forEach(t => { if (!s.tags[t]) this.err(`error: tag '${t}' not found.`); this.p(`Deleted tag '${t}' (was ${this.short(s.tags[t])})`); delete s.tags[t]; }); return; }
      if (!args.length) { const t = Object.keys(s.tags).sort(); if (!t.length) this.p('(no tags yet)', 'muted'); return t.forEach(x => this.p(x)); }
      const [name, ref] = args;
      if (s.tags[name]) this.err(`fatal: tag '${name}' already exists`);
      const h = this.resolve(ref || 'HEAD');
      if (!h) this.err('fatal: Failed to resolve HEAD as a valid ref (make a commit first).');
      s.tags[name] = h;
      this.p(`🏷  tagged ${this.short(h)} as ${name}. Share it with: git push origin ${name}`, 'muted');
    }

    /* ---- remotes ---- */
    g_remote(a) {
      const s = this.s;
      if (!a.length) return Object.keys(s.remotes).forEach(r => this.p(r));
      if (a[0] === '-v') {
        if (!Object.keys(s.remotes).length) return this.p('(no remotes yet — git remote add origin <url>)', 'muted');
        return Object.entries(s.remotes).forEach(([r, u]) => { this.p(`${r}\t${u} (fetch)`); this.p(`${r}\t${u} (push)`); });
      }
      if (a[0] === 'add') {
        const [, name, url] = a;
        if (!name || !url) this.err('usage: git remote add <name> <url>');
        if (s.remotes[name]) this.err(`error: remote ${name} already exists.`);
        s.remotes[name] = url;
        if (name === 'origin' && !s.remote) s.remote = { branches: {}, tags: {} };
        return this.p(`(remote '${name}' → ${url} added${name === 'upstream' ? ' — upstream usually means the ORIGINAL project you forked' : ''})`, 'muted');
      }
      if (a[0] === 'remove' || a[0] === 'rm') { delete s.remotes[a[1]]; if (a[1] === 'origin') { s.remote = null; s.tracking = {}; s.upstream = {}; } return; }
      if (a[0] === 'set-url') { if (!s.remotes[a[1]]) this.err(`error: No such remote '${a[1]}'`); s.remotes[a[1]] = a[2]; return; }
      this.err(`unknown remote subcommand '${a[0]}'`);
    }
    needRemote(name = 'origin') {
      if (!this.s.remotes[name]) this.err(`fatal: '${name}' does not appear to be a git repository\nfatal: Could not read from remote repository.\nhint: connect one first: git remote add origin https://github.com/you/project.git`);
    }
    markLocal(h) { this.ancestors(h).forEach(c => { this.s.commits[c].local = true; }); }

    g_push(a) {
      const s = this.s;
      const u = a.includes('-u') || a.includes('--set-upstream'), force = a.includes('-f') || a.includes('--force') || a.includes('--force-with-lease');
      const del = a.includes('--delete') || a.includes('-d');
      const pos = a.filter(x => !x.startsWith('-'));
      const cur = this.curBranch();
      let remote = pos[0], ref = pos[1];
      if (!remote) {
        const up = cur && s.upstream[cur];
        if (!up) {
          if (!s.remotes.origin) this.needRemote();
          this.err(`fatal: The current branch ${cur} has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream origin ${cur}\n\nhint: or the short form: git push -u origin ${cur}`);
        }
        remote = up.split('/')[0]; ref = up.split('/').slice(1).join('/');
      }
      this.needRemote(remote);
      const url = s.remotes[remote];
      if (remote !== 'origin') this.err(`remote: Permission to ${url.replace(/^.*github\.com[/:]/, '')} denied to you.\nfatal: unable to access '${url}': The requested URL returned error: 403\nhint: '${remote}' is someone else's repo. Push to your fork (origin) and open a Pull Request instead.`);
      const R = s.remote;
      if (a.includes('--tags')) {
        Object.entries(s.tags).forEach(([t, h]) => { if (R.tags[t] !== h) { R.tags[t] = h; this.p(` * [new tag]         ${t} -> ${t}`); } });
        return;
      }
      ref = ref || cur;
      if (!ref) this.err('fatal: You are not currently on a branch.');
      if (del) {
        if (R.branches[ref] === undefined) this.err(`error: unable to delete '${ref}': remote ref does not exist`);
        delete R.branches[ref]; delete s.tracking['origin/' + ref];
        return this.p(`To ${url}\n - [deleted]         ${ref}`, 'ok');
      }
      if (s.tags[ref] && s.branches[ref] === undefined) {
        R.tags[ref] = s.tags[ref]; this.markLocal(s.tags[ref]);
        return this.p(`To ${url}\n * [new tag]         ${ref} -> ${ref}`, 'ok');
      }
      const [src, dst] = ref.includes(':') ? ref.split(':') : [ref, ref];
      const L = s.branches[src];
      if (L === undefined) this.err(`error: src refspec ${src} does not match any\nerror: failed to push some refs to '${url}'${!this.headHash() ? '\nhint: you have no commits yet — commit something first.' : ''}`);
      const old = R.branches[dst];
      if (old === L) { if (u) { s.upstream[src] = 'origin/' + dst; this.p(`branch '${src}' set up to track 'origin/${dst}'.`); } return this.p('Everything up-to-date'); }
      if (old && !this.isAncestor(old, L) && !force) {
        this.err(`To ${url}\n ! [rejected]        ${src} -> ${dst} (fetch first)\nerror: failed to push some refs to '${url}'\nhint: Updates were rejected because the remote contains work that you do not\nhint: have locally. Integrate the remote changes first:  git pull\nhint: then push again.`);
      }
      R.branches[dst] = L; s.tracking['origin/' + dst] = L;
      const n = old ? this.aheadBehind(L, old)[0] : this.ancestors(L).size;
      this.p(`Enumerating objects... done.\nWriting objects: 100% (${n * 3}/${n * 3}), done.\nTo ${url}`);
      this.p(old ? `   ${this.short(old)}..${this.short(L)}  ${src} -> ${dst}${force && !this.isAncestor(old, L) ? '  (forced update)' : ''}` : ` * [new branch]      ${src} -> ${dst}`, 'ok');
      if (force && old && !this.isAncestor(old, L)) this.p('⚠ force-push overwrote remote history. Teammates may lose work — avoid on shared branches!', 'hint');
      if (u) { s.upstream[src] = 'origin/' + dst; this.p(`branch '${src}' set up to track 'origin/${dst}'.`); }
      if (!old && dst !== 'main' && dst !== 'master') this.p(`remote:\nremote: Create a pull request for '${dst}' on GitHub by visiting:\nremote:   ${url.replace(/\.git$/, '')}/pull/new/${dst}\nremote:`, 'info');
    }
    g_fetch(a) {
      const s = this.s, remote = a.find(x => !x.startsWith('-')) || 'origin';
      this.needRemote(remote);
      if (remote !== 'origin') return this.p(`From ${s.remotes[remote]}\n(simulated: '${remote}' has no new commits)`, 'muted');
      const R = s.remote; let any = false;
      Object.entries(R.branches).forEach(([b, h]) => {
        const old = s.tracking['origin/' + b];
        if (old === h) return;
        if (!any) this.p(`From ${s.remotes.origin}`); any = true;
        this.markLocal(h); s.tracking['origin/' + b] = h;
        this.p(old ? `   ${this.short(old)}..${this.short(h)}  ${b.padEnd(10)} -> origin/${b}` : ` * [new branch]      ${b.padEnd(10)} -> origin/${b}`, 'ok');
      });
      if (a.includes('--prune') || a.includes('-p')) Object.keys(s.tracking).forEach(t => { if (R.branches[t.slice(7)] === undefined) { delete s.tracking[t]; this.p(` - [deleted]         (none) -> ${t}`); } });
      Object.entries(R.tags).forEach(([t, h]) => { if (!s.tags[t]) { s.tags[t] = h; this.markLocal(h); this.p(` * [new tag]         ${t} -> ${t}`); any = true; } });
      if (!any) this.p('(nothing new on the remote)', 'muted');
      else this.p('(fetch only downloaded — your branches and files are unchanged. Inspect with git log --oneline --all, then merge.)', 'muted');
    }
    g_pull(a) {
      const s = this.s, pos = a.filter(x => !x.startsWith('-'));
      const remote = pos[0] || 'origin';
      this.needRemote(remote);
      const cur = this.curBranch();
      if (!cur) this.err('fatal: You are not currently on a branch.');
      this.g_fetch([remote]);
      const target = pos[1] ? `origin/${pos[1]}` : (s.upstream[cur] || (s.tracking['origin/' + cur] ? 'origin/' + cur : null));
      if (!target || !s.tracking[target]) this.err(`There is no tracking information for the current branch.\nhint: git pull origin main   or   git branch --set-upstream-to=origin/${cur} ${cur}`);
      if (a.includes('--rebase')) return this.g_rebase([target]);
      this.g_merge([target]);
    }
    g_clone(a) {
      const url = a.find(x => !x.startsWith('-'));
      if (!url) this.err('fatal: You must specify a repository to clone.');
      const name = (a.filter(x => !x.startsWith('-'))[1]) || url.replace(/\/$/, '').split('/').pop().replace(/\.git$/, '') || 'project';
      const cfg = { ...this.s.config };
      this.restart(true); this.s.config = cfg;
      const s = this.s;
      s.init = true; s.cwd = '';
      const c1 = this.mk('Initial commit', [], { 'README.md': `# ${name}\nA team project.` }, { author: 'Team Lead' });
      const c2 = this.mk('Add homepage', [c1], { 'README.md': `# ${name}\nA team project.`, 'index.html': '<h1>Hello</h1>' }, { author: 'Team Lead' });
      const c3 = this.mk('Add styles', [c2], { 'README.md': `# ${name}\nA team project.`, 'index.html': '<h1>Hello</h1>', 'style.css': 'h1 { color: teal; }' }, { author: 'Team Lead' });
      s.branches.main = c3; s.head = { type: 'branch', name: 'main' };
      s.index = { ...s.commits[c3].tree }; s.work = { ...s.commits[c3].tree };
      s.remotes.origin = url; s.remote = { branches: { main: c3 }, tags: {} };
      s.tracking['origin/main'] = c3; s.upstream.main = 'origin/main';
      this.p(`Cloning into '${name}'...\nremote: Enumerating objects: 9, done.\nReceiving objects: 100% (9/9), done.`, 'ok');
      this.p(`(you now have the full history + a remote called 'origin'. Next: cd ${name})`, 'muted');
    }

    /* ======= GitHub-side actions (buttons in the UI) ======= */
    teammatePush() {
      const s = this.s, R = s.remote;
      if (!R || !R.branches.main) return { err: 'GitHub has no main branch yet. Push yours first: git push -u origin main' };
      const base = R.branches.main, tree = { ...this.tree(base) }, n = ++s.mate;
      tree['team-notes.md'] = (tree['team-notes.md'] ? tree['team-notes.md'] + '\n' : '# Team notes') + `\n- Idea #${n} from Alex`;
      const h = this.mk(`Add team note #${n}`, [base], tree, { author: 'Alex (teammate)', local: false });
      R.branches.main = h;
      this.emit();
      return { msg: `👥 Alex pushed "Add team note #${n}" to GitHub main. Your local repo doesn't know yet → try git fetch / git pull` };
    }
    mergePR(branch, squash) {
      const s = this.s, R = s.remote;
      if (!R || R.branches[branch] === undefined || R.branches.main === undefined) return { err: 'Push the branch and main to GitHub first.' };
      const M = R.branches.main, B = R.branches[branch];
      if (this.isAncestor(B, M)) return { err: `Nothing to merge — main already contains ${branch}.` };
      const base = this.mergeBase(M, B);
      const r = this.merge3(this.tree(base), this.tree(M), this.tree(B), 'main', branch);
      if (r.conflicts.length) return { err: `This branch has conflicts that must be resolved (${r.conflicts.join(', ')}). Locally: git merge origin/main, fix, push again.` };
      const n = ++s.pr + 22;
      const h = squash
        ? this.mk(`${s.commits[B].msg.split('\n')[0]} (#${n})`, [M], r.tree, { author: 'GitHub', local: false })
        : this.mk(`Merge pull request #${n} from you/${branch}`, [M, B], r.tree, { author: 'GitHub', local: false });
      R.branches.main = h;
      this.emit();
      return { msg: `✅ Pull Request #${n} (${branch} → main) was reviewed, approved and ${squash ? 'squash-merged' : 'merged'} on GitHub. Update your local main: git switch main && git pull` };
    }

    /* ======= data for the visual graph ======= */
    graphModel(kind = 'local') {
      const s = this.s;
      let tips = [], refs = {}, headHash = null;
      const add = (h, r) => { if (h) (refs[h] = refs[h] || []).push(r); };
      if (kind === 'local') {
        const hb = this.curBranch(); headHash = this.headHash();
        const names = Object.keys(s.branches).sort((a, b) => (b === 'main' || b === 'master') - (a === 'main' || a === 'master') || (b === hb) - (a === hb) || a.localeCompare(b));
        names.forEach(b => { tips.push(s.branches[b]); add(s.branches[b], { type: 'branch', name: b, head: b === hb }); });
        if (!hb && headHash) { tips.unshift(headHash); add(headHash, { type: 'head', name: 'HEAD' }); }
        Object.keys(s.tracking).sort().forEach(t => { tips.push(s.tracking[t]); add(s.tracking[t], { type: 'remote', name: t }); });
        Object.keys(s.tags).forEach(t => { tips.push(s.tags[t]); add(s.tags[t], { type: 'tag', name: t }); });
        s.stash.forEach((e, i) => { if (e.base) add(e.base, { type: 'stash', name: `stash@{${i}}` }); });
      } else {
        if (!s.remote) return null;
        const names = Object.keys(s.remote.branches).sort((a, b) => (b === 'main') - (a === 'main') || a.localeCompare(b));
        names.forEach(b => { tips.push(s.remote.branches[b]); add(s.remote.branches[b], { type: 'branch', name: b }); });
        Object.keys(s.remote.tags).forEach(t => { tips.push(s.remote.tags[t]); add(s.remote.tags[t], { type: 'tag', name: t }); });
      }
      const reach = new Set(); tips.forEach(t => this.ancestors(t).forEach(c => reach.add(c)));
      let nodes = Object.values(s.commits).filter(c => kind === 'local' ? (c.local || reach.has(c.hash)) : reach.has(c.hash));
      nodes.sort((a, b) => a.n - b.n);
      const byHash = {}; nodes.forEach(c => { byHash[c.hash] = c; });
      const lane = {}; let L = 0;
      const walk = tip => { let c = tip, any = false; while (c && byHash[c] && lane[c] === undefined) { lane[c] = L; any = true; c = byHash[c].parents[0]; } if (any) L++; };
      tips.forEach(walk);
      [...nodes].reverse().forEach(c => { if (lane[c.hash] === undefined) walk(c.hash); });
      return { nodes, lane, lanes: L, refs, headHash, reach, kind };
    }
  }

  global.GitSim = GitSim;
  global.GitSimUtil = { tokenize, parseIgnore, ignoredBy, diffLines, esc, GIT_SUBS };
})(window);
