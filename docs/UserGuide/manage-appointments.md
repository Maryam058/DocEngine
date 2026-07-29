# Manage Appointments

This guide explains how to manage appointments in DocEngine and keep patient scheduling information accurate.

## Overview

Use the Manage Appointments area to review, update, reschedule, and cancel patient bookings. The workflow is designed to help staff keep schedules current and ensure patients receive timely updates.

## View Appointments

1. Sign in to the system.
2. Open the Appointments section.
3. Use filters to view the current day, a specific provider, or a selected date range.
4. Select an appointment to review its full details.

## Update Appointment Details

When an appointment is selected, verify the following information:

- Patient name and contact details
- Assigned provider or department
- Appointment date and time
- Visit reason or notes
- Location or virtual meeting details

Update any incorrect information before saving the record.

## Reschedule or Cancel

1. Select the appointment you want to change.
2. Choose either Reschedule or Cancel.
3. Confirm the updated status and save the change.
4. Notify the patient of any schedule update when required.

## Best Practices

- Confirm availability before making changes.
- Keep appointment notes clear and concise.
- Notify patients promptly when their visit is rescheduled or canceled.
- Review the appointment list regularly to prevent scheduling conflicts.

## Troubleshooting

- If an appointment does not appear, refresh the list or adjust the filters.
- If a time slot is unavailable, select another suitable time.
- If a patient record is missing, verify the profile before scheduling the appointment.

<div id="reviewWorkspace" style="display:none; margin-top:2rem;">
  <h2>Reviewer Workspace</h2>
  <p>This workspace is available only in draft or review mode. It is hidden from the public site after publication.</p>

  <div class="editor-shell">
    <div class="status-grid">
      <div class="status-card"><strong>AI Draft Created</strong><span id="draftStatus">Yes</span></div>
      <div class="status-card"><strong>Human Review Completed</strong><span id="reviewStatus">Pending</span></div>
      <div class="status-card"><strong>Edits Made</strong><span id="editCount">0</span></div>
      <div class="status-card"><strong>Published Successfully</strong><span id="publishStatus">No</span></div>
    </div>

    <div class="toolbar">
      <button id="reviewButton" type="button">Save Review</button>
      <button id="publishButton" type="button" disabled>Publish</button>
    </div>

    <div class="editor-grid">
      <div class="panel">
        <h3>AI Draft</h3>
        <textarea id="aiDraft" rows="24" readonly></textarea>
      </div>
      <div class="panel">
        <h3>Human Editor</h3>
        <textarea id="humanEditor" rows="24"></textarea>
      </div>
    </div>

    <div class="panel">
      <h3>Comparison</h3>
      <pre id="comparisonOutput"></pre>
    </div>

    <div class="panel">
      <h3>Edit History</h3>
      <ul id="historyList"></ul>
    </div>
  </div>
</div>

<style>
.editor-shell {
  margin-top: 1.25rem;
}
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.status-card {
  border: 1px solid var(--md-default-fg-color--lightest);
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: var(--md-default-bg-color);
}
.toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.toolbar button {
  border: none;
  border-radius: 0.3rem;
  padding: 0.5rem 0.9rem;
  background: var(--md-primary-fg-color);
  color: white;
  cursor: pointer;
}
.toolbar button[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
}
.editor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}
.panel {
  border: 1px solid var(--md-default-fg-color--lightest);
  border-radius: 0.5rem;
  padding: 0.9rem;
  background: var(--md-default-bg-color);
}
textarea, pre {
  width: 100%;
  min-height: 320px;
  font-family: Consolas, Monaco, monospace;
  font-size: 0.95rem;
  border: 1px solid var(--md-default-fg-color--lightest);
  border-radius: 0.3rem;
  padding: 0.75rem;
  background: #fff;
}
pre {
  white-space: pre-wrap;
  overflow: auto;
}
</style>

<script>
(function () {
  const workspace = document.getElementById('reviewWorkspace');
  const aiDraft = document.getElementById('aiDraft');
  const humanEditor = document.getElementById('humanEditor');
  const comparisonOutput = document.getElementById('comparisonOutput');
  const draftStatus = document.getElementById('draftStatus');
  const reviewStatus = document.getElementById('reviewStatus');
  const editCount = document.getElementById('editCount');
  const publishStatus = document.getElementById('publishStatus');
  const reviewButton = document.getElementById('reviewButton');
  const publishButton = document.getElementById('publishButton');
  const historyList = document.getElementById('historyList');

  const draftKey = 'manage-appointments-ai-draft';
  const approvedKey = 'manage-appointments-approved-markdown';
  const historyKey = 'manage-appointments-edit-history';
  const reviewDoneKey = 'manage-appointments-review-complete';
  const publishKey = 'manage-appointments-published';

  const initialDraft = `# Manage Appointments

This guide explains how to manage appointments in DocEngine.

## Overview
Use the appointment workspace to review, update, reschedule, and cancel bookings for patients.

## View Appointments
1. Sign in to the system.
2. Open the Appointments section.
3. Use filters to view today's appointments or a specific provider.
4. Select an appointment to open the details panel.

## Update Appointment Details
- Confirm patient information.
- Review date, time, and location.
- Add notes for care teams.

## Reschedule or Cancel
1. Select an appointment.
2. Choose Reschedule or Cancel.
3. Confirm the updated status.

## Best Practices
- Confirm availability before making changes.
- Notify patients of schedule updates.
- Keep visit notes clear and concise.

## Troubleshooting
- If the appointment does not appear, refresh the list.
- If a time slot is unavailable, choose another time.
- If a patient record is missing, verify the profile before scheduling.
`;

  const params = new URLSearchParams(window.location.search);
  const draftMode = params.get('mode') === 'draft';
  const published = localStorage.getItem(publishKey) === 'true';

  if (!draftMode && !published) {
    workspace.style.display = 'none';
    return;
  }

  workspace.style.display = 'block';

  const draftContent = localStorage.getItem(draftKey) || initialDraft;
  const approvedContent = localStorage.getItem(approvedKey) || draftContent;
  const reviewComplete = localStorage.getItem(reviewDoneKey) === 'true';
  let history = JSON.parse(localStorage.getItem(historyKey) || '[]');

  aiDraft.value = draftContent;
  humanEditor.value = approvedContent;
  comparisonOutput.textContent = 'No review saved yet.';
  draftStatus.textContent = 'Yes';
  reviewStatus.textContent = reviewComplete ? 'Completed' : 'Pending';
  editCount.textContent = String(history.length);
  publishStatus.textContent = published ? 'Yes' : 'No';
  publishButton.disabled = !reviewComplete;

  localStorage.setItem(draftKey, draftContent);

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

  function diffSummary(previous, current) {
    const prevLines = previous.split(/\r?\n/);
    const currLines = current.split(/\r?\n/);
    let added = 0;
    let deleted = 0;
    let modified = 0;
    const limit = Math.max(prevLines.length, currLines.length);

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

  function updateComparison() {
    const summary = diffSummary(draftContent, humanEditor.value);
    comparisonOutput.textContent = 'Added lines: ' + summary.added + '\nDeleted lines: ' + summary.deleted + '\nModified lines: ' + summary.modified;
  }

  humanEditor.addEventListener('input', function () {
    updateComparison();
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

  reviewButton.addEventListener('click', function () {
    localStorage.setItem(reviewDoneKey, 'true');
    localStorage.setItem(approvedKey, humanEditor.value);
    reviewComplete = true;
    reviewStatus.textContent = 'Completed';
    publishButton.disabled = false;
  });

  publishButton.addEventListener('click', function () {
    if (!reviewComplete) {
      return;
    }
    const approved = humanEditor.value;
    localStorage.setItem(approvedKey, approved);
    localStorage.setItem(publishKey, 'true');
    localStorage.setItem(reviewDoneKey, 'true');
    publishStatus.textContent = 'Yes';

    const audit = {
      draft: draftContent,
      approved: approved,
      history: history
    };
    const markdownBlob = new Blob([approved], { type: 'text/markdown;charset=utf-8' });
    const auditBlob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json;charset=utf-8' });

    const markdownLink = document.createElement('a');
    markdownLink.href = URL.createObjectURL(markdownBlob);
    markdownLink.download = 'manage-appointments-approved.md';
    document.body.appendChild(markdownLink);
    markdownLink.click();
    document.body.removeChild(markdownLink);
    URL.revokeObjectURL(markdownLink.href);

    const auditLink = document.createElement('a');
    auditLink.href = URL.createObjectURL(auditBlob);
    auditLink.download = 'manage-appointments-audit.json';
    document.body.appendChild(auditLink);
    auditLink.click();
    document.body.removeChild(auditLink);
    URL.revokeObjectURL(auditLink.href);

    workspace.innerHTML = '<p><strong>Publishing workflow complete.</strong> The approved Markdown has been saved for deployment. Commit and push the final content to the main branch to trigger the existing GitHub Actions workflow.</p>';
  });

  renderHistory();
  updateComparison();
})();
</script>
