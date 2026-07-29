(function () {
  function getDocKey() {
    const path = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    return 'doc-authoring:' + path;
  }

  function buildDraft(pageTitle, pageText) {
    const trimmedText = (pageText || '').trim();
    if (trimmedText) {
      return trimmedText;
    }

    return ['# ' + pageTitle, '', 'This draft was generated for review and publication.', '', '## Summary', '', '- Confirm the content is accurate for readers.', '- Review structure, tone, and navigation.', '- Ensure the final page is ready for publication.'].join('\n');
  }

  function extractPageText(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll('.review-workspace, script, style, .md-content__header, .md-content__button').forEach(function (node) {
      node.remove();
    });

    const source = clone.innerHTML || '';
    return source
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function escapeHtml(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderPreview(markdown, target) {
    const lines = markdown.split(/\r?\n/);
    const html = [];
    let inList = false;

    lines.forEach(function (line) {
      if (!line.trim()) {
        if (inList) {
          html.push('</ul>');
          inList = false;
        }
        return;
      }

      if (/^#{1,3}\s+/.test(line)) {
        const level = line.match(/^#+/)[0].length;
        const text = line.replace(/^#{1,3}\s+/, '');
        html.push('<h' + level + '>' + escapeHtml(text) + '</h' + level + '>');
        return;
      }

      if (/^-\s/.test(line)) {
        if (!inList) {
          html.push('<ul>');
          inList = true;
        }
        html.push('<li>' + escapeHtml(line.replace(/^-\s/, '')) + '</li>');
        return;
      }

      if (inList) {
        html.push('</ul>');
        inList = false;
      }

      html.push('<p>' + escapeHtml(line) + '</p>');
    });

    if (inList) {
      html.push('</ul>');
    }

    target.innerHTML = html.join('');
  }

  function diffSummary(previous, current) {
    const prevLines = previous.split(/\r?\n/);
    const currLines = current.split(/\r?\n/);
    const limit = Math.max(prevLines.length, currLines.length);
    let added = 0;
    let deleted = 0;
    let modified = 0;

    for (let index = 0; index < limit; index += 1) {
      const prevLine = prevLines[index];
      const currLine = currLines[index];
      if (prevLine === undefined) {
        added += 1;
      } else if (currLine === undefined) {
        deleted += 1;
      } else if (prevLine !== currLine) {
        modified += 1;
      }
    }

    return { added: added, deleted: deleted, modified: modified };
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (!mode || (mode !== 'draft' && mode !== 'review')) {
      return;
    }

    const contentRoot = document.querySelector('.md-content__inner') || document.querySelector('.md-content') || document.querySelector('article') || document.body;
    if (!contentRoot) {
      return;
    }

    const pageTitle = document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : 'Documentation';
    const pageText = extractPageText(contentRoot);
    const docKey = getDocKey();
    const draftKey = docKey + ':draft';
    const approvedKey = docKey + ':approved';
    const historyKey = docKey + ':history';
    const reviewDoneKey = docKey + ':review-done';
    const publishKey = docKey + ':published';

    const draftContent = localStorage.getItem(draftKey) || buildDraft(pageTitle, pageText);
    const approvedContent = localStorage.getItem(approvedKey) || draftContent;
    let reviewComplete = localStorage.getItem(reviewDoneKey) === 'true';
    let published = localStorage.getItem(publishKey) === 'true';
    let history = JSON.parse(localStorage.getItem(historyKey) || '[]');

    localStorage.setItem(draftKey, draftContent);

    const workspace = document.createElement('div');
    workspace.className = 'review-workspace';
    workspace.innerHTML = [
      '<div class="review-status-grid">',
      '  <div class="review-status-card"><strong>AI Draft Created</strong><span class="review-status-value">Yes</span></div>',
      '  <div class="review-status-card"><strong>Human Review Completed</strong><span id="review-status-value" class="review-status-value">' + (reviewComplete ? 'Completed' : 'Pending') + '</span></div>',
      '  <div class="review-status-card"><strong>Edits Made</strong><span id="review-edit-count" class="review-status-value">' + history.length + '</span></div>',
      '  <div class="review-status-card"><strong>Published Successfully</strong><span id="review-publish-value" class="review-status-value">' + (published ? 'Yes' : 'No') + '</span></div>',
      '</div>',
      '<div class="review-toolbar">',
      '  <button type="button" id="review-save">Save Review</button>',
      '  <button type="button" id="review-publish" disabled>' + (published ? 'Published' : 'Publish') + '</button>',
      '</div>',
      '<div class="review-editor-grid">',
      '  <div class="review-panel">',
      '    <h3>AI Draft</h3>',
      '    <textarea id="review-ai-draft" readonly></textarea>',
      '  </div>',
      '  <div class="review-panel">',
      '    <h3>Human Editor</h3>',
      '    <textarea id="review-human-editor"></textarea>',
      '  </div>',
      '</div>',
      '<div class="review-panel">',
      '  <h3>Live Preview</h3>',
      '  <div id="review-preview" class="review-preview"></div>',
      '</div>',
      '<div class="review-panel">',
      '  <h3>Differences</h3>',
      '  <pre id="review-differences">No review saved yet.</pre>',
      '</div>',
      '<div class="review-panel">',
      '  <h3>Edit History</h3>',
      '  <ul id="review-history"></ul>',
      '</div>'
    ].join('');

    contentRoot.insertAdjacentElement('afterend', workspace);

    const aiDraft = workspace.querySelector('#review-ai-draft');
    const humanEditor = workspace.querySelector('#review-human-editor');
    const preview = workspace.querySelector('#review-preview');
    const differences = workspace.querySelector('#review-differences');
    const historyList = workspace.querySelector('#review-history');
    const reviewStatusValue = workspace.querySelector('#review-status-value');
    const editCount = workspace.querySelector('#review-edit-count');
    const publishValue = workspace.querySelector('#review-publish-value');
    const saveButton = workspace.querySelector('#review-save');
    const publishButton = workspace.querySelector('#review-publish');

    aiDraft.value = draftContent;
    humanEditor.value = approvedContent;
    renderPreview(approvedContent, preview);

    function renderHistory() {
      historyList.innerHTML = '';
      if (!history.length) {
        const item = document.createElement('li');
        item.textContent = 'No manual edits recorded yet.';
        historyList.appendChild(item);
        return;
      }
      history.forEach(function (entry) {
        const item = document.createElement('li');
        item.textContent = entry.timestamp + ' — Added ' + entry.added + ', Deleted ' + entry.deleted + ', Modified ' + entry.modified + ' lines.';
        historyList.appendChild(item);
      });
    }

    function syncSummary() {
      reviewStatusValue.textContent = reviewComplete ? 'Completed' : 'Pending';
      editCount.textContent = String(history.length);
      publishValue.textContent = published ? 'Yes' : 'No';
      publishButton.disabled = !reviewComplete;
    }

    function updateDifferences() {
      const summary = diffSummary(draftContent, humanEditor.value);
      differences.textContent = 'Added lines: ' + summary.added + '\nDeleted lines: ' + summary.deleted + '\nModified lines: ' + summary.modified;
    }

    humanEditor.addEventListener('input', function () {
      renderPreview(humanEditor.value, preview);
      updateDifferences();
      const summary = diffSummary(draftContent, humanEditor.value);
      history.unshift({
        timestamp: new Date().toLocaleString(),
        added: summary.added,
        deleted: summary.deleted,
        modified: summary.modified
      });
      localStorage.setItem(historyKey, JSON.stringify(history));
      editCount.textContent = String(history.length);
      renderHistory();
    });

    saveButton.addEventListener('click', function () {
      reviewComplete = true;
      localStorage.setItem(reviewDoneKey, 'true');
      localStorage.setItem(approvedKey, humanEditor.value);
      syncSummary();
    });

    publishButton.addEventListener('click', function () {
      if (!reviewComplete) {
        return;
      }
      const approved = humanEditor.value;
      localStorage.setItem(approvedKey, approved);
      localStorage.setItem(publishKey, 'true');
      localStorage.setItem(reviewDoneKey, 'true');
      published = true;
      syncSummary();

      const audit = {
        draft: draftContent,
        approved: approved,
        history: history
      };
      const markdownBlob = new Blob([approved], { type: 'text/markdown;charset=utf-8' });
      const auditBlob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json;charset=utf-8' });

      const markdownLink = document.createElement('a');
      markdownLink.href = URL.createObjectURL(markdownBlob);
      markdownLink.download = 'approved-document.md';
      document.body.appendChild(markdownLink);
      markdownLink.click();
      document.body.removeChild(markdownLink);
      URL.revokeObjectURL(markdownLink.href);

      const auditLink = document.createElement('a');
      auditLink.href = URL.createObjectURL(auditBlob);
      auditLink.download = 'document-audit.json';
      document.body.appendChild(auditLink);
      auditLink.click();
      document.body.removeChild(auditLink);
      URL.revokeObjectURL(auditLink.href);

      const statusMessage = document.createElement('p');
      statusMessage.className = 'review-publish-message';
      statusMessage.innerHTML = 'Publishing workflow complete. The final Markdown and audit trail have been prepared for deployment through the existing GitHub Actions workflow.';
      workspace.appendChild(statusMessage);
      publishButton.disabled = true;
    });

    renderHistory();
    updateDifferences();
    syncSummary();
  }

  window.addEventListener('load', init);
})();
