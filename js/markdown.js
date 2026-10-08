/* =========================================================
   Tiny Markdown renderer for the lesson notes.
   Supports: headings, paragraphs, **bold**, *italic*, `code`,
   links, fenced code blocks, tables, lists, blockquotes,
   callouts (> [!TIP]) and widget embeds (::name arg).
   ========================================================= */
(function (global) {
  'use strict';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => u.startsWith('#')
        ? `<a href="${u}">${t}</a>` : `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
  }

  function hlBash(line) {
    if (/^\s*#/.test(line)) return `<span class="tk-cm">${esc(line)}</span>`;
    const parts = line.match(/("[^"]*"|'[^']*'|<[^>\s]+>|\s+|[^\s]+)/g) || [];
    let first = true, idx = 0;
    return parts.map(p => {
      if (/^\s+$/.test(p)) return p;
      const i = idx++;
      if (/^["']/.test(p)) return `<span class="tk-str">${esc(p)}</span>`;
      if (/^<.+>$/.test(p)) return `<span class="tk-ph">${esc(p)}</span>`;
      if (i === 0 && p === 'git') { first = false; return `<span class="tk-git">git</span>`; }
      if (i === 1 && !first) return `<span class="tk-cmd">${esc(p)}</span>`;
      if (i === 0) return `<span class="tk-cmd">${esc(p)}</span>`;
      if (/^--?[\w-]/.test(p)) return `<span class="tk-flag">${esc(p)}</span>`;
      return esc(p);
    }).join('');
  }

  function hlText(line, lang) {
    if (/^(<{7}|={7}|>{7})/.test(line)) return `<span class="tk-mark">${esc(line)}</span>`;
    if ((lang === 'gitignore' || lang === 'yaml') && /^\s*#/.test(line)) return `<span class="tk-cm">${esc(line)}</span>`;
    if (lang === 'diff') {
      if (line.startsWith('+')) return `<span class="tk-add">${esc(line)}</span>`;
      if (line.startsWith('-')) return `<span class="tk-del">${esc(line)}</span>`;
    }
    if (lang === 'yaml') return esc(line).replace(/^(\s*-?\s*)([\w-]+):/, '$1<span class="tk-cmd">$2</span>:');
    return esc(line);
  }

  function codeBlock(code, lang) {
    const lines = code.split('\n');
    let body;
    if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
      body = lines.map(l => `<span class="ln${/^\s*#/.test(l) ? ' cm' : ''}${l.trim() ? '' : ' empty'}">${hlBash(l)}</span>`).join('\n');
      lang = 'bash';
    } else body = lines.map(l => hlText(l, lang)).join('\n');
    const label = { bash: 'terminal', text: 'text', gitignore: '.gitignore', yaml: 'yaml', diff: 'diff', html: 'html' }[lang] || lang || 'text';
    return `<div class="code lang-${lang || 'text'}"><div class="code-head"><span class="dots"><i></i><i></i><i></i>&nbsp; ${label}</span>` +
      `<button class="copy-btn" data-copy>Copy</button></div><pre><code>${body}</code></pre></div>`;
  }

  function table(rows) {
    const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const head = cells(rows[0]);
    const body = rows.slice(2).map(cells);
    return `<div class="table-wrap"><table><thead><tr>${head.map(h => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>` +
      body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>';
  }

  function render(src) {
    const lines = src.replace(/\r/g, '').split('\n');
    let html = '', i = 0, m;
    const isBlockStart = l => /^(```|::\w|#{1,4}\s|>|\||\s*[*-]\s+|\s*\d+\.\s+|---+\s*$)/.test(l);
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if ((m = line.match(/^```(\w*)/))) {
        const buf = []; i++;
        while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
        i++; html += codeBlock(buf.join('\n'), m[1]); continue;
      }
      if ((m = line.match(/^::([\w-]+)\s*(.*)$/))) {
        html += `<div class="widget" data-widget="${m[1]}" data-arg="${esc(m[2].trim())}"></div>`; i++; continue;
      }
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        const lv = Math.min(m[1].length + 1, 5);
        const id = m[2].toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
        html += `<h${lv} id="h-${id}">${inline(m[2])}</h${lv}>`; i++; continue;
      }
      if (/^---+\s*$/.test(line)) { html += '<hr>'; i++; continue; }
      if (/^\|/.test(line)) {
        const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
        html += table(rows); continue;
      }
      if (/^>/.test(line)) {
        const buf = []; while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
        let type = 'quote', title = '';
        const t = buf[0].match(/^\[!(\w+)\]\s*(.*)$/);
        if (t) {
          type = t[1].toLowerCase(); buf.shift();
          title = { tip: '💡 Tip', note: 'ℹ️ Note', warning: '⚠️ Warning', danger: '🛑 Danger', important: '⭐ Important' }[type] || type;
          if (type === 'important') type = 'note';
          if (t[2]) buf.unshift(t[2]);
        }
        html += `<div class="callout ${type}">${title ? `<div class="ct">${title}</div>` : ''}${render(buf.join('\n'))}</div>`; continue;
      }
      if (/^\s*([*-]|\d+\.)\s+/.test(line)) {
        const ordered = /^\s*\d+\./.test(line);
        const items = [];
        while (i < lines.length && /^\s*([*-]|\d+\.)\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*([*-]|\d+\.)\s+/, '')); i++;
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([*-]|\d+\.)\s+/.test(lines[i])) items[items.length - 1] += ' ' + lines[i++].trim();
        }
        const tag = ordered ? 'ol' : 'ul';
        html += `<${tag}>${items.map(it => `<li>${inline(it)}</li>`).join('')}</${tag}>`; continue;
      }
      const buf = [];
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
      if (!buf.length) { buf.push(lines[i++]); }
      html += `<p>${inline(buf.join(' '))}</p>`;
    }
    return html;
  }

  global.MD = { render, inline, esc };
})(window);
