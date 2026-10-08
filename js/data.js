/* =========================================================
   Playbook data: parts, labs, quizzes, flows, flashcards,
   cheat-sheet. Lessons themselves live in index.html.
   ========================================================= */
(function (global) {
  'use strict';

  const PARTS = [
    { id: 1, icon: '🌱', title: 'Getting Started', desc: 'What Git & GitHub are, and turning a folder into a repository.' },
    { id: 2, icon: '⚙️', title: 'Core Workflow', desc: 'The three areas, file states, status, add, commit and log.' },
    { id: 3, icon: '⏪', title: 'Time Travel & Undo', desc: 'HEAD, reset modes, restore and .gitignore.' },
    { id: 4, icon: '🌿', title: 'Branching & Merging', desc: 'Branches, merges, conflicts, rebase, squash and stash.' },
    { id: 5, icon: '☁️', title: 'GitHub & Remotes', desc: 'Push, pull, fetch, clone, PRs, forks and team workflow.' },
    { id: 6, icon: '🔍', title: 'Inspect & Manage', desc: 'diff, show, cherry-pick, revert, branches, config & SSH.' },
    { id: 7, icon: '🚀', title: 'GitHub Features', desc: 'Issues, Projects, Actions, .gitkeep and .gitignore templates.' },
    { id: 8, icon: '🏆', title: 'Mastery', desc: 'Mental model, essential commands, real workflow, golden rules.' }
  ];

  /* ---------- helpers for lab checks ---------- */
  const ent = (s, f) => s.entries().filter(e => e.f === f);
  const headC = s => s.commit(s.headHash());
  const failed = (s, re) => s.log.some(l => !l.ok && re.test(l.cmd));
  const BASE = ['git init', 'echo "<h1>My Site</h1>" > index.html', 'git add .', 'git commit -m "Initial commit"'];

  const LABS = {
    init: {
      title: 'Create your first repository',
      intro: 'You have a normal project folder with 3 files. Git knows **nothing** about it yet.',
      setup: ['echo "<h1>Hello</h1>" > index.html', 'echo "h1 { color: teal; }" > style.css', 'echo "console.log(\'hi\')" > script.js'],
      tasks: [
        { t: 'List the files in the folder', hint: 'ls', c: s => s.ran(/^ls/) },
        { t: 'Turn the folder into a Git repository', hint: 'git init', c: s => s.s.init },
        { t: 'Check the status — notice every file is **untracked**', hint: 'git status', c: s => s.ran(/git status/) },
        { t: 'Reveal the hidden `.git` folder Git just created', hint: 'ls -a', c: s => s.ran(/^ls -a/) }
      ],
      done: 'Normal folder → git init → Git repository!'
    },
    areas: {
      title: 'Working → Staging → Repository',
      intro: 'Watch the files travel between the three areas as you run commands (or click the buttons on each file).',
      setup: ['git init', 'echo "<h1>Hello</h1>" > index.html', 'echo "h1 { color: teal; }" > style.css', 'echo "console.log(\'hi\')" > script.js'],
      tasks: [
        { t: 'Stage **only** `index.html`', hint: 'git add index.html', c: s => s.s.index['index.html'] !== undefined },
        { t: 'Check what is staged and what is not', hint: 'git status', c: s => s.ran(/git status/) },
        { t: 'Commit the staged file with a good message', hint: 'git commit -m "Add homepage"', c: s => !!s.headHash() },
        { t: 'Stage everything that is left', hint: 'git add .', c: s => s.s.index['style.css'] !== undefined && s.s.index['script.js'] !== undefined },
        { t: 'Create a second commit', hint: 'git commit -m "Add styles and script"', c: s => s.headHash() && s.ancestors(s.headHash()).size >= 2 }
      ],
      done: 'You made two snapshots. Look at the graph — two commits on main.'
    },
    status: {
      title: 'Decode git status -s',
      intro: 'Produce each status code yourself. Remember: column **X** = staging area, column **Y** = working directory.',
      setup: [...BASE, 'echo "body { margin: 0; }" > style.css', 'git add .', 'git commit -m "Add styles"'],
      quick: ['git status -s', 'git status', 'edit style.css'],
      tasks: [
        { t: 'Create a new file `test.txt` → `??` untracked', hint: 'touch test.txt', c: s => ent(s, 'test.txt').some(e => e.x === '?') },
        { t: 'Modify `index.html` without staging → ` M`', hint: 'edit index.html', c: s => ent(s, 'index.html').some(e => e.x === ' ' && e.y === 'M') },
        { t: 'Modify **and** stage `style.css` → `M `', hint: 'edit style.css && git add style.css', c: s => ent(s, 'style.css').some(e => e.x === 'M' && e.y === ' ') },
        { t: 'Edit `style.css` again (staged + modified again) → `MM`', hint: 'edit style.css', c: s => ent(s, 'style.css').some(e => e.x === 'M' && e.y === 'M') },
        { t: 'View the short status and read each code', hint: 'git status -s', c: s => s.ran(/status (-s|--short)/) }
      ],
      done: '?? untracked · " M" modified · "M " staged · MM staged + modified again.'
    },
    log: {
      title: 'Explore history with git log',
      setup: [...BASE, 'echo "nav {}" > style.css', 'git add .', 'git commit -m "Add navbar styles"', 'git switch -c feature/login', 'echo "<form></form>" > login.html', 'git add .', 'git commit -m "Add login page"', 'git switch main', 'echo "footer {}" >> style.css', 'git commit -am "Add footer styles"'],
      tasks: [
        { t: 'Show the full log of the current branch', hint: 'git log', c: s => s.ran(/^git log$/) },
        { t: 'Show it compactly — one line per commit', hint: 'git log --oneline', c: s => s.ran(/git log --oneline/) },
        { t: 'Show every branch as a graph (the most useful log!)', hint: 'git log --oneline --graph --all --decorate', c: s => s.ran(/git log.*--graph.*--all|git log.*--all.*--graph/) }
      ],
      done: 'Each commit has a unique hash. --all shows commits on every branch, including feature/login.'
    },
    reset: {
      title: 'Soft, mixed & hard reset',
      intro: 'History: Commit A → Commit B → Commit C. Watch HEAD, the staging area and your files after each reset.',
      setup: ['git init', 'echo "A" > app.txt', 'git add .', 'git commit -m "Commit A"', 'echo "B" >> app.txt', 'git commit -am "Commit B"', 'echo "C" >> app.txt', 'git commit -am "Commit C"'],
      quick: ['git status', 'git log --oneline', 'cat app.txt'],
      tasks: [
        { t: '**Soft** reset one commit back — the change stays **staged**', hint: 'git reset --soft HEAD~1', c: s => s.ran(/reset --soft/) && headC(s).msg === 'Commit B' && s.entries().some(e => e.x === 'M') },
        { t: 'Redo the commit with a better message', hint: 'git commit -m "Add line C"', c: s => headC(s).msg !== 'Commit B' && s.ran(/reset --soft/) && s.ran(/commit/) },
        { t: '**Mixed** reset (the default) — the change becomes **unstaged**', hint: 'git reset HEAD~1', c: s => s.ran(/reset (--mixed )?HEAD~1?$/) && s.entries().some(e => e.y === 'M' && e.x === ' ') },
        { t: '**Hard** reset to throw the local change away ⚠️', hint: 'git reset --hard', c: s => s.ran(/reset --hard/) && !s.trackedDirty() },
        { t: 'Confirm with `cat` — line C is gone from the file', hint: 'cat app.txt', c: s => s.ran(/cat app\.txt/) }
      ],
      done: 'soft = keep staged · mixed = keep in files · hard = discard. The faded commits are orphaned.'
    },
    restore: {
      title: 'Unstage and discard with git restore',
      setup: [...BASE, 'echo "body {}" > style.css', 'git add .', 'git commit -m "Add styles"', 'echo "<p>oops</p>" >> index.html', 'echo "p { color: red; }" >> style.css', 'git add style.css'],
      tasks: [
        { t: 'Check the status: one staged, one modified', hint: 'git status', c: s => s.ran(/git status/) },
        { t: 'Unstage `style.css` (keep the edit in the file)', hint: 'git restore --staged style.css', c: s => ent(s, 'style.css').some(e => e.x === ' ' && e.y === 'M') },
        { t: 'Discard the changes in `index.html` completely', hint: 'git restore index.html', c: s => ent(s, 'index.html').some(e => e.clean) },
        { t: 'Verify with the short status', hint: 'git status -s', c: s => s.ran(/status -s/) }
      ]
    },
    ignore: {
      title: 'Keep secrets out with .gitignore',
      intro: 'This project contains a secret `.env`, dependencies, a log file and Python cache. Only `index.html` should be committed.',
      setup: ['git init', 'echo "<h1>App</h1>" > index.html', 'echo "API_KEY=super-secret-123" > .env', 'echo "server started" > debug.log', 'echo "module.exports = {}" > node_modules/react/index.js', 'touch __pycache__/app.pyc'],
      quick: ['git status -s', 'cat .gitignore', 'ls -a'],
      tasks: [
        { t: 'See the problem — everything shows as untracked', hint: 'git status', c: s => s.ran(/git status/) },
        { t: 'Ignore the secrets file', hint: 'echo ".env" >> .gitignore', c: s => ent(s, '.env').some(e => e.ignored) },
        { t: 'Ignore the dependencies folder', hint: 'echo "node_modules/" >> .gitignore', c: s => ent(s, 'node_modules/react/index.js').some(e => e.ignored) },
        { t: 'Ignore every log file with a wildcard', hint: 'echo "*.log" >> .gitignore', c: s => ent(s, 'debug.log').some(e => e.ignored) },
        { t: 'Ignore the Python cache folder', hint: 'echo "__pycache__/" >> .gitignore', c: s => ent(s, '__pycache__/app.pyc').some(e => e.ignored) },
        { t: 'Stage and commit — only `.gitignore` and `index.html` go in', hint: 'git add . && git commit -m "Add homepage and .gitignore"', c: s => s.headHash() && s.headTree()['.gitignore'] !== undefined && s.headTree()['.env'] === undefined }
      ],
      done: 'Never commit secrets! Your .env stayed on your machine only.'
    },
    branch: {
      title: 'Work on a feature branch',
      setup: [...BASE],
      tasks: [
        { t: 'List branches (the `*` marks where you are)', hint: 'git branch', c: s => s.ran(/^git branch$/) },
        { t: 'Create **and** switch to `feature/navbar`', hint: 'git switch -c feature/navbar', c: s => s.curBranch() === 'feature/navbar' },
        { t: 'Build the navbar and commit it on the branch', hint: 'echo "<nav>Menu</nav>" > navbar.html && git add . && git commit -m "Add navbar"', c: s => s.s.branches['feature/navbar'] && s.s.branches['feature/navbar'] !== s.s.branches.main },
        { t: 'Switch back to `main` — notice `navbar.html` disappears!', hint: 'git switch main', c: s => s.curBranch() === 'main' && s.s.work['navbar.html'] === undefined },
        { t: 'Switch to the feature branch again — it comes back', hint: 'git switch feature/navbar', c: s => s.curBranch() === 'feature/navbar' && s.ran(/switch main/) }
      ],
      done: 'Branches let you work without touching main.'
    },
    ff: {
      title: 'Fast-forward merge',
      intro: '`main` has not changed since `feature/navbar` was created, so Git can simply move `main` forward.',
      setup: [...BASE, 'git switch -c feature/navbar', 'echo "<nav></nav>" > navbar.html', 'git add .', 'git commit -m "Add navbar markup"', 'echo "nav { display: flex; }" > navbar.css', 'git add .', 'git commit -m "Style navbar"'],
      tasks: [
        { t: 'Stand on the branch that should **receive** the changes', hint: 'git switch main', c: s => s.curBranch() === 'main' },
        { t: 'Merge the feature branch', hint: 'git merge feature/navbar', c: s => s.s.branches.main === s.s.branches['feature/navbar'] },
        { t: 'Look at the graph — no merge commit was needed', hint: 'git log --oneline --graph --all', c: s => s.ran(/git log/) }
      ],
      done: 'Fast-forward = main just moved forward. History stays a straight line.'
    },
    threeway: {
      title: 'Three-way merge',
      intro: 'Both branches got new commits. Git must combine them using the common ancestor.',
      setup: [...BASE, 'git switch -c feature/navbar', 'echo "<nav></nav>" > navbar.html', 'git add .', 'git commit -m "Add navbar"', 'git switch main', 'echo "<footer></footer>" > footer.html', 'git add .', 'git commit -m "Add footer"'],
      tasks: [
        { t: 'Look at the diverged history first', hint: 'git log --oneline --graph --all', c: s => s.ran(/git log/) },
        { t: 'Merge `feature/navbar` into `main`', hint: 'git merge feature/navbar', c: s => headC(s).parents.length === 2 },
        { t: 'Check that both `navbar.html` and `footer.html` exist', hint: 'ls', c: s => s.ran(/^ls/) }
      ],
      done: 'The new ◯ merge commit has two parents.'
    },
    conflict: {
      title: 'Resolve a merge conflict',
      intro: 'Both branches changed the same `<h1>` line. Git cannot decide — you must.',
      setup: [...BASE, 'git switch -c feature/navbar', 'echo "<h1>Welcome</h1>" > index.html', 'git commit -am "Change heading to Welcome"', 'git switch main', 'echo "<h1>Hello</h1>" > index.html', 'git commit -am "Change heading to Hello"'],
      quick: ['git status', 'cat index.html', 'git merge --abort'],
      tasks: [
        { t: 'Merge the feature branch into main', hint: 'git merge feature/navbar', c: s => s.s.merge && s.s.merge.conflicts.length > 0 },
        { t: 'Look at the conflict markers inside the file', hint: 'cat index.html', c: s => s.ran(/cat index\.html/) },
        { t: 'Choose a version (or click ours/theirs/both on the file)', hint: 'resolve index.html theirs', c: s => s.s.work['index.html'] && !/^<{7}/m.test(s.s.work['index.html']) },
        { t: 'Mark the conflict as resolved by staging it', hint: 'git add index.html', c: s => !s.s.merge || !s.s.merge.conflicts.length },
        { t: 'Conclude the merge with a commit', hint: 'git commit -m "Merge feature/navbar"', c: s => headC(s).parents.length === 2 }
      ],
      done: 'Conflicts are normal. Read the markers, choose, git add, git commit.'
    },
    rebase: {
      title: 'Rebase for a linear history',
      intro: 'You are on `feature/navbar`. `main` moved on with a new commit. Replay your work on top of it.',
      setup: [...BASE, 'git switch -c feature/navbar', 'echo "<nav></nav>" > navbar.html', 'git add .', 'git commit -m "Add navbar"', 'echo "nav {}" > navbar.css', 'git add .', 'git commit -m "Style navbar"', 'git switch main', 'echo "<footer></footer>" > footer.html', 'git add .', 'git commit -m "Add footer"', 'git switch feature/navbar'],
      tasks: [
        { t: 'Look at the diverged graph', hint: 'git log --oneline --graph --all', c: s => s.ran(/git log/) },
        { t: 'Rebase your branch onto main', hint: 'git rebase main', c: s => s.isAncestor(s.s.branches.main, s.s.branches['feature/navbar']) },
        { t: 'Switch to main and merge — it is now a fast-forward', hint: 'git switch main && git merge feature/navbar', c: s => s.s.branches.main === s.s.branches['feature/navbar'] }
      ],
      done: 'Linear history! The old commits (faded) were rewritten as new ones — that is why you never rebase shared commits.'
    },
    squash: {
      title: 'Squash a messy branch',
      intro: '`feature/login` has 3 tiny "work in progress" commits. Put them on main as **one** clean commit.',
      setup: [...BASE, 'git switch -c feature/login', 'echo "<form>" > login.html', 'git add .', 'git commit -m "wip"', 'echo "<input>" >> login.html', 'git commit -am "more wip"', 'echo "</form>" >> login.html', 'git commit -am "fix typo"', 'git switch main'],
      tasks: [
        { t: 'Look at the 3 messy commits', hint: 'git log --oneline --all', c: s => s.ran(/git log/) },
        { t: 'Squash-merge the branch (stages all changes as one)', hint: 'git merge --squash feature/login', c: s => s.ran(/merge --squash/) && s.entries().some(e => e.x === 'A') },
        { t: 'Commit them as a single clean commit', hint: 'git commit -m "Add complete login feature"', c: s => s.headTree()['login.html'] !== undefined && headC(s).parents.length === 1 }
      ],
      done: 'main got one tidy commit instead of three. GitHub calls this "Squash and merge".'
    },
    stash: {
      title: 'Save unfinished work with stash',
      intro: 'You are halfway through editing `login.html` on `feature/login` when an urgent bug on `main` appears.',
      setup: [...BASE, 'git switch -c feature/login', 'echo "<form></form>" > login.html', 'git add .', 'git commit -m "Add login form"', 'echo "<input type=password>" >> login.html'],
      quick: ['git status', 'git stash list'],
      tasks: [
        { t: 'Try to switch to main — Git refuses to lose your changes', hint: 'git switch main', c: s => failed(s, /switch main/) || s.ran(/switch main/) },
        { t: 'Stash the unfinished work', hint: 'git stash', c: s => s.s.stash.length > 0 },
        { t: 'Look at the stash list', hint: 'git stash list', c: s => s.ran(/stash list/) },
        { t: 'Now switching works', hint: 'git switch main', c: s => s.curBranch() === 'main' },
        { t: 'Come back to your feature branch', hint: 'git switch feature/login', c: s => s.curBranch() === 'feature/login' && s.ran(/switch main/) },
        { t: 'Bring the changes back and remove the stash', hint: 'git stash pop', c: s => !s.s.stash.length && s.trackedDirty() }
      ],
      done: 'stash = a temporary shelf. pop = apply + remove, apply = apply + keep.'
    },
    remote: {
      title: 'Push, fetch & pull',
      intro: 'Connect your local repo to GitHub, push it, then a teammate pushes a change you need to download.',
      setup: [...BASE, 'echo "body {}" > style.css', 'git add .', 'git commit -m "Add styles"'],
      quick: ['git status', 'git log --oneline --all', 'git remote -v'],
      tasks: [
        { t: 'Connect a remote called `origin`', hint: 'git remote add origin https://github.com/you/my-project.git', c: s => !!s.s.remotes.origin },
        { t: 'Check your remotes', hint: 'git remote -v', c: s => s.ran(/remote -v/) },
        { t: 'Push main for the first time and set upstream', hint: 'git push -u origin main', c: s => s.s.remote && !!s.s.remote.branches.main && !!s.s.upstream.main },
        { t: 'Click **👥 Teammate pushes** (top-right of this lab)', c: s => s.ran(/__teammate__/) },
        { t: 'Download the new commit without merging', hint: 'git fetch', c: s => s.s.tracking['origin/main'] === s.s.remote.branches.main && !s.isAncestor(s.s.tracking['origin/main'], s.s.branches.main) },
        { t: 'Check status — you are **behind** origin/main', hint: 'git status', c: s => s.ran(/git status/) },
        { t: 'Integrate it (fetch + merge)', hint: 'git pull', c: s => s.s.branches.main === s.s.remote.branches.main }
      ],
      done: 'GitHub → Local = fetch/pull · Local → GitHub = push.'
    },
    team: {
      title: 'Team workflow with a Pull Request',
      intro: 'You just joined a team. Clone, branch, commit, push and get your PR merged.',
      setup: [],
      quick: ['git status', 'git log --oneline --graph --all', 'git branch -a'],
      tasks: [
        { t: 'Clone the team repository', hint: 'git clone https://github.com/team/project.git', c: s => s.s.init && !!s.s.remote },
        { t: 'Go inside the project folder', hint: 'cd project', c: s => s.s.cwd === 'project' },
        { t: 'Create your personal feature branch', hint: 'git switch -c feature/navbar', c: s => s.curBranch() === 'feature/navbar' },
        { t: 'Write code, stage and commit', hint: 'echo "<nav>Home | About</nav>" > navbar.html && git add . && git commit -m "Add responsive navbar"', c: s => s.s.branches['feature/navbar'] && s.s.branches['feature/navbar'] !== s.s.branches.main },
        { t: 'Push the branch to GitHub', hint: 'git push -u origin feature/navbar', c: s => s.s.remote.branches['feature/navbar'] !== undefined },
        { t: 'In the ☁️ GitHub panel click **Merge PR** (review → approve → merge)', c: s => s.s.remote.branches['feature/navbar'] && s.isAncestor(s.s.remote.branches['feature/navbar'], s.s.remote.branches.main) },
        { t: 'Update your local main', hint: 'git switch main && git pull', c: s => s.curBranch() === 'main' && s.isAncestor(s.s.remote.branches['feature/navbar'], s.s.branches.main) },
        { t: 'Clean up the merged branch', hint: 'git branch -d feature/navbar', c: s => s.s.branches['feature/navbar'] === undefined }
      ],
      done: 'This is the workflow real teams use every day.'
    },
    update: {
      title: 'Keep your branch updated',
      intro: 'You are working on `feature/login`, but a teammate already pushed new work to `main` on GitHub.',
      setup: ['git clone https://github.com/team/project.git', 'cd project', 'git switch -c feature/login', 'echo "<form></form>" > login.html', 'git add .', 'git commit -m "Add login form"', s => s.teammatePush()],
      tasks: [
        { t: 'Download the latest remote state', hint: 'git fetch origin', c: s => s.s.tracking['origin/main'] === s.s.remote.branches.main },
        { t: 'See that origin/main moved ahead', hint: 'git log --oneline --graph --all', c: s => s.ran(/git log/) },
        { t: 'Merge the latest main into your branch', hint: 'git merge origin/main', c: s => s.isAncestor(s.s.tracking['origin/main'], s.s.branches['feature/login']) }
      ],
      done: 'Your branch now contains the team\'s latest work. (Teams that prefer rebase would run git rebase origin/main.)'
    },
    fork: {
      title: 'Fork workflow: origin vs upstream',
      intro: 'You forked `company/project` to `emon/project` and cloned **your fork**.',
      setup: ['git clone https://github.com/emon/project.git', 'cd project'],
      tasks: [
        { t: 'See your remotes — only `origin` (your fork)', hint: 'git remote -v', c: s => s.ran(/remote -v/) },
        { t: 'Add the original project as `upstream`', hint: 'git remote add upstream https://github.com/company/project.git', c: s => !!s.s.remotes.upstream },
        { t: 'Try pushing directly to upstream — denied!', hint: 'git push upstream main', c: s => failed(s, /push upstream/) },
        { t: 'Create a fix branch and commit', hint: 'git switch -c fix/typo && edit README.md && git commit -am "Fix typo in README"', c: s => s.s.branches['fix/typo'] && s.s.branches['fix/typo'] !== s.s.branches.main },
        { t: 'Push to **your fork** — then open a PR to upstream on GitHub', hint: 'git push -u origin fix/typo', c: s => s.s.remote.branches['fix/typo'] !== undefined }
      ],
      done: 'upstream → original project · origin → your fork.'
    },
    tags: {
      title: 'Tag a release',
      setup: [...BASE, 'git remote add origin https://github.com/you/my-project.git', 'git push -u origin main', 'echo "body {}" > style.css', 'git add .', 'git commit -m "Add styles"', 'git push'],
      tasks: [
        { t: 'Tag the current commit as version 1.0.0', hint: 'git tag v1.0.0', c: s => !!s.s.tags['v1.0.0'] },
        { t: 'List your tags', hint: 'git tag', c: s => s.ran(/^git tag$/) },
        { t: 'Tags are not pushed automatically — push it', hint: 'git push origin v1.0.0', c: s => !!s.s.remote.tags['v1.0.0'] }
      ]
    },
    diff: {
      title: 'See exactly what changed',
      setup: [...BASE, 'echo "body { margin: 0; }" > style.css', 'git add .', 'git commit -m "Add styles"', 'echo "<h1>My Awesome Site</h1>" > index.html', 'echo "h1 { color: teal; }" >> style.css'],
      tasks: [
        { t: 'Show unstaged changes (green + added, red − removed)', hint: 'git diff', c: s => s.ran(/^git diff$/) },
        { t: 'Stage `index.html`, then show only staged changes', hint: 'git add index.html && git diff --staged', c: s => s.ran(/diff --(staged|cached)/) && s.s.index['index.html'] !== s.headTree()['index.html'] },
        { t: 'Inspect the latest commit', hint: 'git show HEAD', c: s => s.ran(/git show/) }
      ]
    },
    pick: {
      title: 'Cherry-pick & revert',
      intro: '`feature/experiment` has one useful bug-fix commit you want on main — but not the experiment. Also, main has a broken commit.',
      setup: [...BASE, 'git switch -c feature/experiment', 'echo "<div>experiment</div>" > experiment.html', 'git add .', 'git commit -m "Add risky experiment"', 'echo "<footer>© 2026</footer>" > footer.html', 'git add .', 'git commit -m "Fix footer typo"', 'git switch main', 'echo "<marquee>BROKEN</marquee>" > banner.html', 'git add .', 'git commit -m "Add broken banner"'],
      tasks: [
        { t: 'Find the commit hashes', hint: 'git log --oneline --all', c: s => s.ran(/git log/) },
        { t: 'Copy **only** the footer fix to main (use its hash or the branch name)', hint: 'git cherry-pick feature/experiment', c: s => s.s.work['footer.html'] !== undefined && s.s.work['experiment.html'] === undefined },
        { t: 'Undo the broken banner safely with a NEW commit', hint: 'git revert HEAD~1', c: s => s.ran(/revert/) && s.s.work['banner.html'] === undefined },
        { t: 'Look at history — nothing was deleted, only added', hint: 'git log --oneline', c: s => s.ran(/git log/) && s.ran(/revert/) }
      ],
      done: 'cherry-pick copies one commit · revert undoes a commit without rewriting history.'
    },
    branches: {
      title: 'Manage branches',
      setup: ['git clone https://github.com/team/project.git', 'cd project', 'git switch -c feature/old', 'echo "old" > old.txt', 'git add .', 'git commit -m "Add old feature"', 'git push -u origin feature/old', 'git switch main', 'git merge feature/old', 'git push', 'git branch navbr'],
      tasks: [
        { t: 'List local **and** remote branches', hint: 'git branch -a', c: s => s.ran(/branch -a/) },
        { t: 'Delete the merged local branch', hint: 'git branch -d feature/old', c: s => s.s.branches['feature/old'] === undefined },
        { t: 'Delete it on GitHub too', hint: 'git push origin --delete feature/old', c: s => s.s.remote.branches['feature/old'] === undefined },
        { t: 'Fix the typo branch name `navbr`', hint: 'git branch -m navbr feature/navbar', c: s => s.s.branches['feature/navbar'] !== undefined && s.s.branches.navbr === undefined }
      ]
    },
    config: {
      title: 'Configure Git & test SSH',
      setup: [],
      tasks: [
        { t: 'Set your name', hint: 'git config --global user.name "Your Name"', c: s => s.s.config['user.name'] !== 'You' },
        { t: 'Set your email', hint: 'git config --global user.email "you@example.com"', c: s => s.ran(/user\.email/) },
        { t: 'Check your configuration', hint: 'git config --global --list', c: s => s.ran(/config.*--list/) },
        { t: 'Test your SSH connection to GitHub', hint: 'ssh -T git@github.com', c: s => s.ran(/ssh -T/) }
      ]
    },
    gitkeep: {
      title: 'Track an empty folder with .gitkeep',
      setup: [...BASE],
      tasks: [
        { t: 'Create an empty `data` folder', hint: 'mkdir data', c: s => s.s.dirs.data || s.s.work['data/.gitkeep'] !== undefined },
        { t: 'Check status — Git does not see it!', hint: 'git status', c: s => s.ran(/git status/) },
        { t: 'Add a placeholder file', hint: 'touch data/.gitkeep', c: s => s.s.work['data/.gitkeep'] !== undefined },
        { t: 'Commit it — now the folder is tracked', hint: 'git add . && git commit -m "Add data folder"', c: s => s.headTree()['data/.gitkeep'] !== undefined }
      ]
    },
    capstone: {
      title: 'Capstone: the complete real-world workflow',
      intro: 'Everything together: clone → branch → commit → push → PR → merge → pull → clean up → release.',
      setup: [],
      quick: ['git status', 'git log --oneline --graph --all', 'git branch -a'],
      tasks: [
        { t: 'Clone the repository', hint: 'git clone https://github.com/team/shop.git', c: s => s.s.init && !!s.s.remote },
        { t: 'Make sure main is up to date', hint: 'git pull', c: s => s.ran(/git pull/) },
        { t: 'Create a feature branch', hint: 'git switch -c feature/cart', c: s => s.curBranch() === 'feature/cart' },
        { t: 'Code + commit (small logical commit)', hint: 'echo "<div id=cart></div>" > cart.html && git add . && git commit -m "Add shopping cart"', c: s => s.s.branches['feature/cart'] && s.s.branches['feature/cart'] !== s.s.branches.main },
        { t: 'Push the branch', hint: 'git push -u origin feature/cart', c: s => s.s.remote.branches['feature/cart'] !== undefined },
        { t: 'Meanwhile a teammate pushes — click **👥 Teammate pushes**', c: s => s.ran(/__teammate__/) },
        { t: 'Open & merge the PR from the ☁️ GitHub panel', c: s => s.isAncestor(s.s.remote.branches['feature/cart'], s.s.remote.branches.main) },
        { t: 'Switch to main and pull', hint: 'git switch main && git pull', c: s => s.curBranch() === 'main' && s.s.branches.main === s.s.remote.branches.main },
        { t: 'Delete the merged branch locally', hint: 'git branch -d feature/cart', c: s => s.s.branches['feature/cart'] === undefined },
        { t: 'Tag and publish the release', hint: 'git tag v1.0.0 && git push origin v1.0.0', c: s => s.s.remote.tags['v1.0.0'] !== undefined }
      ],
      done: 'You just did what professional developers do every day. 🏆'
    }
  };
  Object.keys(LABS).forEach(k => { LABS[k].id = k; });

  /* ---------- quizzes (one per part) ---------- */
  const QUIZZES = {
    1: [
      ['What is Git?', ['An online hosting website', 'A distributed version control system', 'A programming language', 'A code editor'], 1, 'Git is a distributed VCS that runs locally. GitHub is the online hosting platform.'],
      ['Which statement is TRUE?', ['GitHub works without internet', 'Git requires GitHub to work', 'Git works locally; GitHub hosts repositories online', 'Git and GitHub are the same thing'], 2, 'You can use Git with no internet at all. GitHub adds hosting and collaboration.'],
      ['What does `git init` create?', ['A GitHub repository', 'A hidden .git folder', 'A .gitignore file', 'A first commit'], 1, 'The .git folder holds everything Git needs to track the repository.'],
      ['Right after `git init`, your existing files are…', ['Committed', 'Staged', 'Untracked', 'Ignored'], 2, 'Git can see them, but they remain untracked until you git add them.']
    ],
    2: [
      ['What is the correct order?', ['Commit → Stage → Working', 'Working → Stage → Commit', 'Stage → Working → Commit', 'Working → Commit → Stage'], 1, 'Edit files in the working directory, git add to the staging area, git commit into the repository.'],
      ['In `git status -s`, what does `?? test.txt` mean?', ['Conflict', 'Staged', 'Untracked', 'Deleted'], 2, '?? = untracked: Git sees the file but is not tracking it.'],
      ['What does `MM style.css` mean?', ['Modified twice in history', 'Staged, then modified again', 'Merged twice', 'Moved'], 1, 'First column (X) = staged change, second (Y) = new unstaged change.'],
      ['Which is the best commit message?', ['changes', 'stuff', 'Add responsive navbar', 'final final v2'], 2, 'Describe WHAT changed using a short imperative sentence.'],
      ['Which command shows all branches as a compact graph?', ['git status -s', 'git log --oneline --graph --all', 'git show --all', 'git branch --graph'], 1, 'git log --oneline --graph --all (--decorate) is the most useful log command.']
    ],
    3: [
      ['What does HEAD~1 mean?', ['The first commit ever', 'One commit before HEAD', 'The next commit', 'The remote branch'], 1, 'HEAD is your current position; ~1 means one commit back.'],
      ['`git reset --soft HEAD~1` leaves your changes…', ['Deleted', 'Unstaged in files', 'Staged', 'Pushed'], 2, 'Soft only moves HEAD; the changes stay staged, ready to re-commit.'],
      ['Which reset mode is the default?', ['--soft', '--mixed', '--hard', '--keep'], 1, 'git reset HEAD~1 = --mixed: moves HEAD and unstages, files keep their changes.'],
      ['How do you unstage `index.html` but keep your edits?', ['git restore index.html', 'git reset --hard', 'git restore --staged index.html', 'git rm index.html'], 2, 'git restore --staged removes it from the staging area only.'],
      ['Which file should go in `.gitignore`?', ['index.html', '.env', 'README.md', 'style.css'], 1, 'Never commit secrets such as .env files, API keys or passwords.']
    ],
    4: [
      ['Modern command to create AND switch to a branch?', ['git branch -s', 'git switch -c feature/x', 'git checkout feature/x', 'git new feature/x'], 1, 'git switch -c (or the older git checkout -b).'],
      ['To merge `feature/navbar` into `main`, you first…', ['stay on feature/navbar', 'git switch main', 'delete main', 'git push'], 1, 'Stand on the branch that should RECEIVE the changes.'],
      ['A fast-forward merge happens when…', ['both branches changed', 'main has not changed since the branch was created', 'there is a conflict', 'you use --squash'], 1, 'Git simply moves main forward — no merge commit needed.'],
      ['Which is the golden rule of rebase?', ['Always rebase main', 'Never rebase commits others already depend on', 'Rebase only on GitHub', 'Rebase deletes branches'], 1, 'Rebase rewrites commits; rewriting shared history breaks teammates.'],
      ['Difference between `git stash pop` and `git stash apply`?', ['None', 'pop removes the stash after applying, apply keeps it', 'apply deletes your files', 'pop only works on main'], 1, 'pop = apply + drop.']
    ],
    5: [
      ['What does `git pull` do conceptually?', ['push + merge', 'fetch + merge', 'clone + commit', 'only download'], 1, 'git pull = git fetch + integrate (merge, or rebase if configured).'],
      ['Which command downloads without changing your branch?', ['git pull', 'git push', 'git fetch', 'git merge'], 2, 'fetch only updates remote-tracking branches like origin/main.'],
      ['`origin` is…', ['a Git keyword that cannot change', 'the conventional name of your main remote', 'the first commit', 'the main branch'], 1, 'It is just a name. You could call it anything.'],
      ['In open source, `upstream` usually means…', ['your fork', 'the original project', 'your local main', 'a tag'], 1, 'upstream → original project · origin → your fork.'],
      ['First push of a new branch?', ['git push', 'git push -u origin feature/navbar', 'git pull origin', 'git commit --push'], 1, '-u sets the upstream so later you can just run git push.']
    ],
    6: [
      ['Show changes that are staged?', ['git diff', 'git diff --staged', 'git show', 'git status -s'], 1, 'Plain git diff shows unstaged changes only.'],
      ['Apply ONE specific commit from another branch?', ['git merge', 'git rebase', 'git cherry-pick <hash>', 'git revert'], 2, 'cherry-pick copies a single commit onto your current branch.'],
      ['Safest way to undo a commit that is already pushed?', ['git reset --hard', 'git revert <hash>', 'delete the repo', 'git push --force'], 1, 'revert adds a new commit that reverses the old one; history is preserved.'],
      ['Delete a remote branch?', ['git branch -d x', 'git push origin --delete x', 'git remote rm x', 'git fetch --delete'], 1, 'git branch -d only deletes the local branch.'],
      ['`.git` vs `.gitignore`?', ['Same thing', '.git = Git\'s database, .gitignore = ignore rules', '.gitignore stores commits', '.git lists ignored files'], 1, 'Never delete .git unless you want to lose all history.']
    ],
    7: [
      ['GitHub Issues are used for…', ['storing commits', 'tracking bugs, features and tasks', 'running tests', 'SSH keys'], 1, 'Issues track work; a branch + PR can close an issue.'],
      ['GitHub Actions provides…', ['code hosting', 'CI/CD automation', 'merge conflicts', 'forks'], 1, 'Run tests, linting, builds and deployments automatically.'],
      ['Why add `data/.gitkeep`?', ['It is an official Git command', 'Git does not track empty folders', 'It ignores the folder', 'It encrypts data'], 1, '.gitkeep is just a convention — any file makes the folder trackable.'],
      ['Which belongs in a Node.js .gitignore?', ['package.json', 'node_modules/', 'index.js', 'README.md'], 1, 'Dependencies can be reinstalled with npm install; never commit them.']
    ],
    8: [
      ['A commit is the same as a backup?', ['Yes, always', 'No — it is local until you push', 'Only on main', 'Only with tags'], 1, 'Push to GitHub if you need a remote copy.'],
      ['In a team project you should…', ['work directly on main', 'use feature branches + Pull Requests', 'force-push daily', 'never pull'], 1, 'Each person works on their own branch and merges via PR.'],
      ['Before starting new work you should…', ['git reset --hard', 'git switch main && git pull', 'delete .git', 'git stash clear'], 1, 'Always start from the latest main.'],
      ['Which command should you NOT use blindly?', ['git status', 'git log', 'git reset --hard', 'git diff'], 2, 'It can permanently discard local work.']
    ]
  };

  /* ---------- step-by-step flows ---------- */
  const FLOWS = {
    model: { title: 'The Git mental model', steps: [
      ['📁', 'Working Directory', 'Where you create and edit files. Changes here are not saved in Git yet.', 'edit index.html'],
      ['📋', 'Staging Area', 'You choose exactly which changes go into the next snapshot.', 'git add index.html'],
      ['🗃️', 'Local Repository', 'A permanent snapshot (commit) is saved in .git on YOUR machine.', 'git commit -m "Add homepage"'],
      ['☁️', 'GitHub Remote', 'Upload your commits so others (and future you) can get them.', 'git push'],
      ['⬇️', 'Back to Local', 'Download teammates\' work into your repository and files.', 'git pull']
    ] },
    pr: { title: 'Pull Request lifecycle', steps: [
      ['🌿', 'Feature branch', 'Work happens on its own branch, never directly on main.', 'git switch -c feature/navbar'],
      ['⬆️', 'Push', 'Publish the branch to GitHub.', 'git push -u origin feature/navbar'],
      ['📬', 'Open PR', 'On GitHub: "Compare & pull request". Describe what & why; link issues with "Closes #24".', ''],
      ['👀', 'Code review', 'Teammates read the diff, comment, and may request changes. Push more commits to update the PR.', ''],
      ['✅', 'Approve', 'Reviewers approve. Automated checks (GitHub Actions) must pass.', ''],
      ['🔀', 'Merge', 'Merge commit, Squash and merge, or Rebase and merge.', ''],
      ['🏠', 'main updated', 'Everyone updates their local main.', 'git switch main\ngit pull']
    ] },
    collab: { title: 'Team setup', steps: [
      ['👑', 'Leader creates repo', 'GitHub → New repository. Add a README and .gitignore.', ''],
      ['🤝', 'Add collaborators', 'Settings → Collaborators → invite teammates.', ''],
      ['📥', 'Members clone', 'Every member downloads the repository.', 'git clone <repo-url>\ncd project'],
      ['🌿', 'Personal branch', 'Each person works on their own feature branch.', 'git switch -c feature/navbar'],
      ['💾', 'Commit', 'Small logical commits.', 'git add .\ngit commit -m "Add responsive navbar"'],
      ['⬆️', 'Push', 'Publish your branch.', 'git push -u origin feature/navbar'],
      ['📬', 'Pull Request', 'Open a PR, get it reviewed and merged.', '']
    ] },
    fork: { title: 'Open-source fork workflow', steps: [
      ['🏢', 'Original repo', 'company/project — you have no write access.', ''],
      ['🍴', 'Fork', 'Click "Fork" on GitHub → you get emon/project.', ''],
      ['📥', 'Clone your fork', 'origin now points to YOUR fork.', 'git clone https://github.com/emon/project.git'],
      ['🔗', 'Add upstream', 'Keep a link to the original project.', 'git remote add upstream https://github.com/company/project.git'],
      ['🌿', 'Branch & code', 'Make your change on a branch.', 'git switch -c fix/typo\ngit commit -am "Fix typo"'],
      ['⬆️', 'Push to origin', 'Push to your fork, not upstream.', 'git push -u origin fix/typo'],
      ['📬', 'PR to upstream', 'Open a Pull Request from emon:fix/typo → company:main.', ''],
      ['🔄', 'Stay in sync', 'Regularly pull the original project\'s changes.', 'git fetch upstream\ngit merge upstream/main']
    ] },
    issue: { title: 'Issue → PR → Done', steps: [
      ['🐛', 'Issue #24', 'Someone reports: "Fix mobile navbar".', ''],
      ['🌿', 'Branch', 'A developer picks it up.', 'git switch -c fix/mobile-navbar'],
      ['💾', 'Commit', 'Fix the bug.', 'git commit -am "Fix mobile navbar layout"'],
      ['📬', 'PR', 'PR description says "Closes #24".', 'git push -u origin fix/mobile-navbar'],
      ['🔀', 'Merge', 'After review the PR is merged.', ''],
      ['✅', 'Auto-closed', 'GitHub closes Issue #24 automatically.', '']
    ] },
    actions: { title: 'CI/CD with GitHub Actions', steps: [
      ['⬆️', 'Push', 'You push code or open a PR.', 'git push'],
      ['⚡', 'Workflow triggers', 'GitHub reads .github/workflows/*.yml and starts a runner.', ''],
      ['📦', 'Install', 'Dependencies are installed on a fresh machine.', 'npm ci'],
      ['🧹', 'Lint', 'Code style checks.', 'npm run lint'],
      ['🧪', 'Test', 'Automated tests run. A ❌ blocks the merge.', 'npm test'],
      ['🏗️', 'Build', 'The project is built.', 'npm run build'],
      ['🚀', 'Deploy', 'On main: deploy to Vercel / a server.', '']
    ] },
    workflow: { title: 'The complete real-world workflow', steps: [
      ['📥', 'Clone', 'Get the project once.', 'git clone <repo-url>\ncd project'],
      ['🔄', 'Update main', 'Start from the latest code.', 'git switch main\ngit pull'],
      ['🌿', 'Branch', 'One branch per feature/fix.', 'git switch -c feature/navbar'],
      ['⌨️', 'Code', 'Write code. Check often.', 'git status'],
      ['📋', 'Stage', 'Choose changes.', 'git add .'],
      ['💾', 'Commit', 'Small logical commit.', 'git commit -m "Add responsive navbar"'],
      ['⬆️', 'Push', 'Publish.', 'git push -u origin feature/navbar'],
      ['📬', 'Pull Request', 'Review → request changes / approve.', ''],
      ['🔀', 'Merge', 'Merged into main on GitHub.', ''],
      ['🏠', 'Sync', 'Update local main and delete the branch.', 'git switch main\ngit pull\ngit branch -d feature/navbar']
    ] }
  };

  /* ---------- flashcards ---------- */
  const FLASHCARDS = [
    ['Git vs GitHub?', 'Git = local version-control tool. GitHub = online hosting + collaboration (PRs, issues, actions).'],
    ['`git init`', 'Turns the current folder into a Git repository (creates the hidden .git folder).'],
    ['The three areas', 'Working Directory → (git add) → Staging Area → (git commit) → Repository'],
    ['`??` in git status -s', 'Untracked file'],
    ['` M` vs `M `', '" M" = modified but not staged · "M " = staged'],
    ['`MM`', 'Staged, then modified again after staging'],
    ['`git add .`', 'Stage all changes in the current folder (respecting .gitignore)'],
    ['`git commit -m "msg"`', 'Save the staged snapshot into history with a message'],
    ['`git log --oneline --graph --all`', 'Compact history of every branch, drawn as a graph'],
    ['HEAD', 'Your current position in history (usually the tip of the current branch)'],
    ['`git reset --soft HEAD~1`', 'Undo last commit, keep changes STAGED'],
    ['`git reset HEAD~1` (mixed)', 'Undo last commit, keep changes in files but UNSTAGED'],
    ['`git reset --hard HEAD~1`', '⚠️ Undo last commit AND discard the changes'],
    ['`git restore file`', 'Discard local changes in a file'],
    ['`git restore --staged file`', 'Unstage a file (keep the edits)'],
    ['`git switch -c name`', 'Create and switch to a new branch'],
    ['Fast-forward merge', 'Target branch had no new commits, so Git just moves its pointer forward'],
    ['Three-way merge', 'Both branches changed; Git combines them using the common ancestor → merge commit'],
    ['Conflict markers', '<<<<<<< HEAD (yours) ======= (theirs) >>>>>>> branch'],
    ['`git merge --abort`', 'Cancel a merge and return to the pre-merge state'],
    ['Merge vs Rebase', 'Merge preserves history (safe for shared). Rebase rewrites for linear history (local only).'],
    ['Squash merge', 'Combine all branch commits into one commit on main'],
    ['`git stash` / `pop`', 'Shelve uncommitted work / bring it back and remove the stash'],
    ['`git fetch` vs `git pull`', 'fetch = download only · pull = fetch + merge'],
    ['`git push -u origin branch`', 'Push and set upstream so later plain git push works'],
    ['origin vs upstream', 'origin = your fork/remote · upstream = the original project'],
    ['Pull Request', 'A request to merge your branch, with code review before merging'],
    ['`git cherry-pick <hash>`', 'Copy one specific commit onto the current branch'],
    ['`git revert <hash>`', 'Create a new commit that undoes an old one (safe for shared history)'],
    ['`.gitkeep`', 'Convention file so Git tracks an otherwise empty folder'],
    ['`git tag v1.0.0`', 'Mark a commit as a release. Push with git push origin v1.0.0'],
    ['Golden rule #4', 'Never commit secrets (.env, API keys, passwords)']
  ];

  /* ---------- cheat sheet ---------- */
  const CHEATSHEET = [
    ['Setup', 'git config --global user.name "Your Name"', 'Set your name for commits'],
    ['Setup', 'git config --global user.email "you@example.com"', 'Set your email for commits'],
    ['Setup', 'git config --global --list', 'Show your configuration'],
    ['Setup', 'ssh -T git@github.com', 'Test SSH authentication with GitHub'],
    ['Start', 'git init', 'Create a repository in the current folder'],
    ['Start', 'git clone <url>', 'Download a repository with its full history'],
    ['Snapshot', 'git status', 'Show the state of files'],
    ['Snapshot', 'git status -s', 'Short status (XY codes)'],
    ['Snapshot', 'git add <file>', 'Stage one file'],
    ['Snapshot', 'git add .', 'Stage everything'],
    ['Snapshot', 'git commit -m "message"', 'Commit staged changes'],
    ['Snapshot', 'git commit -am "message"', 'Stage tracked files and commit in one step'],
    ['Snapshot', 'git commit --amend -m "new msg"', 'Replace the last (unpushed) commit'],
    ['Inspect', 'git log --oneline --graph --all --decorate', 'Visual history of all branches'],
    ['Inspect', 'git diff', 'Unstaged changes'],
    ['Inspect', 'git diff --staged', 'Staged changes'],
    ['Inspect', 'git diff main..feature/navbar', 'Compare two branches'],
    ['Inspect', 'git show <hash>', 'Details and diff of a commit'],
    ['Undo', 'git restore <file>', 'Discard changes in a file'],
    ['Undo', 'git restore --staged <file>', 'Unstage a file'],
    ['Undo', 'git reset --soft HEAD~1', 'Undo commit, keep staged'],
    ['Undo', 'git reset HEAD~1', 'Undo commit, keep changes unstaged (mixed)'],
    ['Undo', 'git reset --hard HEAD~1', '⚠️ Undo commit and discard changes'],
    ['Undo', 'git revert <hash>', 'New commit that reverses an old one'],
    ['Branch', 'git branch', 'List local branches'],
    ['Branch', 'git branch -a', 'List local + remote branches'],
    ['Branch', 'git switch -c feature/name', 'Create and switch to a branch'],
    ['Branch', 'git switch main', 'Switch branch'],
    ['Branch', 'git branch -d feature/name', 'Delete a merged branch'],
    ['Branch', 'git branch -D feature/name', 'Force-delete a branch'],
    ['Branch', 'git branch -M main', 'Rename current branch to main'],
    ['Merge', 'git merge feature/name', 'Merge a branch into the current one'],
    ['Merge', 'git merge --abort', 'Cancel a conflicted merge'],
    ['Merge', 'git merge --squash feature/name', 'Stage a branch as one change'],
    ['Merge', 'git rebase main', 'Replay current branch on top of main'],
    ['Merge', 'git cherry-pick <hash>', 'Copy one commit here'],
    ['Stash', 'git stash', 'Shelve uncommitted changes'],
    ['Stash', 'git stash list', 'List stashes'],
    ['Stash', 'git stash pop', 'Apply and remove latest stash'],
    ['Stash', 'git stash apply', 'Apply and keep the stash'],
    ['Stash', 'git stash drop', 'Delete latest stash'],
    ['Remote', 'git remote -v', 'List remotes'],
    ['Remote', 'git remote add origin <url>', 'Connect a remote'],
    ['Remote', 'git remote add upstream <url>', 'Connect the original project (forks)'],
    ['Remote', 'git push -u origin main', 'First push + set upstream'],
    ['Remote', 'git push', 'Upload commits'],
    ['Remote', 'git fetch', 'Download without merging'],
    ['Remote', 'git pull', 'Fetch + merge'],
    ['Remote', 'git push origin --delete feature/name', 'Delete a remote branch'],
    ['Remote', 'git merge origin/main', 'Bring latest main into your branch'],
    ['Release', 'git tag v1.0.0', 'Tag a release'],
    ['Release', 'git push origin v1.0.0', 'Publish a tag']
  ];

  global.PB_DATA = { PARTS, LABS, QUIZZES, FLOWS, FLASHCARDS, CHEATSHEET };
})(window);
