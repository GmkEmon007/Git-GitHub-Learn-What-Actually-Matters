# 🐙 Git & GitHub — Interactive Playbook

> A modern, zero-dependency, browser-based interactive playbook and visual simulation laboratory for learning **Git and GitHub** by doing.

[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)
[![Pure Vanilla JS](https://img.shields.io/badge/stack-HTML5%20%7C%20CSS3%20%7C%20ES6+-orange.svg)](#)
[![Curriculum](https://img.shields.io/badge/curriculum-57%20lessons%20%7C%208%20parts-blue.svg)](#)
[![Hands-on Labs](https://img.shields.io/badge/labs-20%2B%20guided%20simulations-purple.svg)](#)
[![Theme Support](https://img.shields.io/badge/theme-dark%20%7C%20light-yellow.svg)](#)

---

## 📖 Overview

The **Git & GitHub Interactive Playbook** is a comprehensive educational platform designed to build rock-solid mental models of version control. Rather than relying solely on dry theoretical documentation, it combines complete practical reference notes with an **in-memory Git simulation engine**, a **live SVG commit graph visualizer**, **interactive micro-widgets**, and **guided terminal labs**.

Everything runs directly in your web browser with **zero dependencies**, **no build steps**, and **no server required** — open `index.html` and start learning immediately.

---

## 🌟 Highlights & Key Features

### 1. 🗂️ In-Browser Git Simulator & Terminal
* **True Three-Area State Tracking**: Live visual inspection of the **Working Directory**, **Staging Area (Index)**, and **Local Repository**.
* **Full Virtual Terminal**: Simulates over 30 core Git commands (`init`, `status`, `add`, `commit`, `branch`, `switch`, `merge`, `rebase`, `reset`, `restore`, `stash`, `tag`, `cherry-pick`, `remote`, `push`, `pull`, `fetch`, etc.) with tab autocompletion and history scrolling (`↑`/`↓`).
* **Remote & GitHub Collaboration**: Add remotes (`origin`), push/pull commits, simulate incoming teammate changes with a single click, and merge simulated Pull Requests.
* **Live SVG Commit Graph**: Renders dynamic commit history trees complete with branch lanes, merge nodes, orphaned commit detection, and floating `HEAD` pointers.

### 2. 🧪 20+ Guided Hands-on Labs
* Real-time lab verification engine embedded inside the lessons and available in the standalone **Playground**.
* Step-by-step checklist of tasks that automatically inspect the virtual Git state and check off objectives as you type the correct commands.

### 3. 🧩 Interactive Visual Widgets
* **Working → Stage → Commit**: Visual stepper showing how files travel across Git's three areas.
* **Status Code Decoder**: Interactive `XY` status inspector decoding two-column short status outputs (`??`, ` M`, `M `, `MM`, `UU`, etc.).
* **Reset Modes Comparator**: Side-by-side visualizer comparing `--soft`, `--mixed`, and `--hard` resets.
* **Merge Conflict Resolver**: Interactive three-way conflict editor with `<<<<<<< HEAD`, `=======`, and `>>>>>>>` markers.
* **`.gitignore` Tester**: Live pattern matcher testing `.gitignore` rules against sample filenames.
* **Commit Message Linter**: Real-time evaluator rating commit messages against Conventional Commits standards.
* **GitHub Projects Kanban Board**: Drag-and-drop project workflow board with Backlog, In Progress, Review, and Done columns.

### 4. 📚 Spaced Repetition & Assessment Tools
* **3D Flashcards**: 32 flip cards with spaced repetition tracking and keyboard shortcuts (`Space` to flip, `←`/`→` to navigate).
* **Searchable Git Cheat Sheet**: Filterable reference catalog with category pills and one-click copy functionality.
* **Part Quizzes & Final Exam**: End-of-part assessments plus a dynamic, randomized 15-question comprehensive final exam.
* **Progress Persistence**: All completed lessons, lab checkpoints, quiz scores, and theme settings are saved locally via `localStorage`.

---

## 🎨 Modern Design & Typography System

The interface adheres strictly to modern web typography and user experience best practices:
* **Editorial Titles**: [`Playfair Display`](https://fonts.google.com/specimen/Playfair+Display) (Serif) is reserved for main headings (`h1`, `h2`, hero banner, brand logo) for elegance and distinction.
* **Effortless Readability**: [`Plus Jakarta Sans`](https://fonts.google.com/specimen/Plus+Jakarta+Sans) (Sans-Serif) is used for all body text, paragraphs, lists, card headings, buttons, and navigation controls.
* **Body Text Scale**: Calibrated to **17px** with a comfortable **1.8 line-height** and high color contrast (>14:1 in dark mode, >15:1 in light mode).
* **Monospace Code**: [`Fira Code`](https://fonts.google.com/specimen/Fira+Code) provides clear syntax highlighting and terminal realism.
* **Dual Themes**: Obsidian Glass dark mode by default, with a crisp modern slate light mode.

---

## 📚 Complete Curriculum (57 Lessons across 8 Parts)

| Part | Module Name | Topics Covered |
| :---: | :--- | :--- |
| **1** | **Git Basics** | What is Git? · Git vs GitHub · Git Repository (`git init`) · The Three Main Areas · File States · `git status` · Adding Files (`git add`) · Commits & Checkpoints |
| **2** | **History & Navigation** | `git log` & Log Graphs · `HEAD` Pointer · `git reset` (Soft vs Mixed vs Hard) · Undoing Changes (`git restore`) · `.gitignore` Best Practices |
| **3** | **Branching & Merging** | Git Branching Concepts · Switching Branches (`git switch`) · Feature Branch Workflow · Fast-Forward vs 3-Way Merges · Merge Conflicts · Rebase vs Merge · Merge vs Rebase Comparison |
| **4** | **Advanced Git Operations** | Squash Commits · Interactive Rebase (`git rebase -i`) · Cherry-Pick · Revert vs Reset · Reflog (Safety Net) · Git Submodules |
| **5** | **Stashing, Tags & Inspection** | `git stash` · Git Tags & Releases · `git diff` · `git blame` · `git bisect` (Binary Bug Hunter) · `git clean` |
| **6** | **GitHub Basics** | What is GitHub? · Setting Up GitHub & SSH/PAT · Remotes (`git remote`) · `git push` · `git fetch` vs `git pull` · Cloning Repositories · Fork vs Clone |
| **7** | **GitHub Collaboration** | Pull Requests (PRs) · Code Reviews · Merge Strategies (Merge, Squash, Rebase) · GitHub Issues · Milestones & Labels · GitHub Projects & Kanban |
| **8** | **GitHub Advanced & Best Practices** | GitHub Actions (CI/CD) · Branch Protection Rules · Forking Workflow · Git Golden Rules · Commit Message Conventions · Common Git Misconceptions & Myths |

---

## 📂 Project Structure

```text
Class GitHub/
├── index.html          # Single-Page App shell with 57 lesson scripts & widget mountpoints
├── css/
│   └── style.css       # Unified design system (typography, dark/light themes, widgets, layout)
├── js/
│   ├── sim.js          # In-memory Git simulation engine (3 areas, branches, remotes, graph)
│   ├── simui.js        # Simulator UI (terminal prompt, SVG commit graph, area status cards)
│   ├── data.js         # Course data (curriculum parts, 20+ guided labs, flashcards, cheat sheet)
│   ├── widgets.js      # Interactive widgets (Three areas, status decoder, conflict resolver, etc.)
│   ├── markdown.js     # Custom lightweight markdown parser with code token highlighting & callouts
│   └── app.js          # Client-side router, progress storage, search engine & theme coordinator
└── README.md           # Project documentation and guide
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :---: | :--- |
| `/` | Focus global search bar instantly |
| `←` / `→` | Navigate to previous / next lesson |
| `Space` | Flip active flashcard (in Flashcards mode) |
| `Tab` | Autocomplete command (inside the Git Simulator) |
| `↑` / `↓` | Cycle through command history (inside the Git Simulator) |
| `Esc` | Clear search / dismiss active filter |

---

## 🚀 How to Run

1. Clone or download the folder:
   ```bash
   git clone https://github.com/GmkEmon007/Python-Interactive-Textbook.git
   ```
2. Navigate to `f:\Class Python\Class GitHub\` (or your local clone path).
3. Open `index.html` in any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, Safari).
4. No dependencies to install (`npm`, `pip`, etc.) — it runs 100% client-side!

---

## 💡 Recommended Learning Path

1. **Start at Lesson 1**: Follow the structured curriculum sequentially from Part 1 to Part 8.
2. **Execute the Labs**: When a lesson includes an interactive lab (`::lab`), type the suggested commands in the terminal and watch the commit graph update.
3. **Experiment in the Playground**: Use the dedicated **Git Playground** (`#/playground`) to test commands, create branches, and resolve conflicts safely.
4. **Reinforce Knowledge**: Review flashcards (`#/flashcards`) and take the dynamic **Final Exam** (`#/exam`) to test your retention.

---

## 📄 License

This educational project is created for class learning and reference. Free to use, adapt, and share for educational purposes.
