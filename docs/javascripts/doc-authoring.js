(function () {
  "use strict";

  const QUILL_CSS_URL =
    "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css";
  const QUILL_JS_URL =
    "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js";
  const TURNDOWN_JS_URL =
    "https://cdn.jsdelivr.net/npm/turndown@7.2.0/dist/turndown.min.js";
  const TURNDOWN_GFM_JS_URL =
    "https://cdn.jsdelivr.net/npm/turndown-plugin-gfm@1.0.2/dist/turndown-plugin-gfm.min.js";
  const AUTOSAVE_DELAY = 1200;
  const VERSION_LIMIT = 20;
  const WORDS_PER_MINUTE = 200;
  const SAVE_STATUS = {
    SAVED: "Saved",
    UNSAVED: "Unsaved changes",
    SAVING: "Saving",
    AUTOSAVED: "Autosaved"
  };
  const DOCUMENT_STATUS = {
    DRAFT: "Draft",
    IN_REVIEW: "In Review",
    APPROVED: "Approved",
    PUBLISHED: "Published"
  };
  const CI_STAGES = ["Commit", "Build", "Deploy", "Published"];

  function showAlert(options) {
    return window.Swal.fire(options);
  }

  function showSuccess(message) {
    if (
      message ===
      "The documentation has been published successfully."
    ) {
      return showAlert({
        icon: "success",
        title: "Documentation Published",
        text: message,
        confirmButtonText: "Close",
        confirmButtonColor: "#3085d6"
      });
    }

    return showAlert({
      toast: true,
      icon: "success",
      title: message,
      position: "top-end",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  }

  function showError(message) {
    return showAlert({
      icon: "error",
      title: "Error",
      text: message,
      confirmButtonColor: "#d33"
    });
  }

  function showWarning(message) {
    return showAlert({
      icon: "warning",
      title: "Warning",
      text: message,
      confirmButtonColor: "#e0a800"
    });
  }

  function showConfirm(title, message, confirmButtonText) {
    return showAlert({
      title: title,
      text: message,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: confirmButtonText || "Publish",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#6c757d"
    });
  }

  function getDocKey() {
    const path =
      (window.location.pathname || "/")
        .replace(/\/+$/, "") || "/";

    return "doc-authoring:" + path;
  }

  function getStorageKeys(docKey) {
    return {
      original: docKey + ":original",
      draftContent: docKey + ":draftContent",
      review: docKey + ":review",
      published: docKey + ":published",
      publishedContent: docKey + ":publishedContent",
      history: docKey + ":history",
      autosave: docKey + ":autosave",
      versions: docKey + ":versions",
      dismissedSuggestions: docKey + ":dismissedSuggestions",
      workflowStatus: docKey + ":workflowStatus",
      commitId: docKey + ":commitId",
      ciStage: docKey + ":ciStage"
    };
  }

  function getDocumentStatus(keys) {
    const storedStatus = localStorage.getItem(keys.workflowStatus);

    if (localStorage.getItem(keys.published) === "true") {
      return DOCUMENT_STATUS.PUBLISHED;
    }

    if (
      storedStatus === DOCUMENT_STATUS.DRAFT ||
      storedStatus === DOCUMENT_STATUS.IN_REVIEW ||
      storedStatus === DOCUMENT_STATUS.APPROVED ||
      storedStatus === DOCUMENT_STATUS.PUBLISHED
    ) {
      return storedStatus;
    }

    return DOCUMENT_STATUS.DRAFT;
  }

  function setDocumentStatus(keys, status) {
    localStorage.setItem(keys.workflowStatus, status);
  }

  function generateFakeCommitId() {
    return (
      "doc" +
      Date.now().toString(16) +
      Math.random().toString(16).slice(2, 8)
    ).slice(0, 14);
  }

  function inferAuditActor(action) {
    if (!action) {
      return "System";
    }

    if (action.indexOf("ci-") === 0 || action === "published") {
      return "CI";
    }

    if (
      action.indexOf("review-") === 0 ||
      action.indexOf("content-") === 0 ||
      action.indexOf("heading-") === 0 ||
      action.indexOf("suggestion-") === 0 ||
      action.indexOf("alt-text-") === 0 ||
      action.indexOf("autosave-") === 0 ||
      action.indexOf("original-") === 0 ||
      action.indexOf("markdown-") === 0 ||
      action.indexOf("comparison-") === 0 ||
      action.indexOf("version-") === 0
    ) {
      return "Human";
    }

    return "AI";
  }

  function inferAuditStatus(action) {
    if (action === "review-submitted") {
      return DOCUMENT_STATUS.IN_REVIEW;
    }

    if (action === "review-approved") {
      return DOCUMENT_STATUS.APPROVED;
    }

    if (action === "review-rejected") {
      return DOCUMENT_STATUS.DRAFT;
    }

    if (action === "published") {
      return DOCUMENT_STATUS.PUBLISHED;
    }

    return "Recorded";
  }

  function createAuditEntry(action, details, actor, status) {
    return {
      action: action,
      details: details,
      actor: actor || inferAuditActor(action),
      status: status || inferAuditStatus(action),
      timestamp: new Date().toLocaleString()
    };
  }

  function getHistory(historyKey) {
    try {
      return JSON.parse(
        localStorage.getItem(historyKey) || "[]"
      );
    } catch (e) {
      return [];
    }
  }

  function saveHistory(historyKey, entry) {
    const history = getHistory(historyKey);

    history.unshift(entry);

    localStorage.setItem(
      historyKey,
      JSON.stringify(history)
    );
  }

  function getDismissedSuggestions(dismissedSuggestionsKey) {
    const dismissed = safeParseJSON(
      localStorage.getItem(dismissedSuggestionsKey),
      []
    );

    return Array.isArray(dismissed) ? dismissed : [];
  }

  function saveDismissedSuggestions(dismissedSuggestionsKey, dismissedIds) {
    localStorage.setItem(
      dismissedSuggestionsKey,
      JSON.stringify(dismissedIds)
    );
  }

  function dismissSuggestion(dismissedSuggestionsKey, suggestionId) {
    if (!suggestionId) {
      return;
    }

    const dismissed = getDismissedSuggestions(dismissedSuggestionsKey);

    if (dismissed.indexOf(suggestionId) > -1) {
      return;
    }

    dismissed.push(suggestionId);
    saveDismissedSuggestions(dismissedSuggestionsKey, dismissed);
  }

  function clearDismissedSuggestion(dismissedSuggestionsKey, suggestionId) {
    const dismissed = getDismissedSuggestions(dismissedSuggestionsKey);
    const next = dismissed.filter(function (id) {
      return id !== suggestionId;
    });

    if (next.length === dismissed.length) {
      return;
    }

    saveDismissedSuggestions(dismissedSuggestionsKey, next);
  }

  function ensureStylesheet(href) {
    if (
      document.querySelector(
        'link[data-doc-authoring="quill-css"]'
      )
    ) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-doc-authoring", "quill-css");
    document.head.appendChild(link);
  }

  function ensureScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.Quill) {
        resolve();
        return;
      }

      const existing = document.querySelector(
        'script[data-doc-authoring="quill-js"]'
      );

      if (existing) {
        existing.addEventListener("load", resolve);
        existing.addEventListener("error", reject);
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.setAttribute("data-doc-authoring", "quill-js");
      script.addEventListener("load", resolve);
      script.addEventListener("error", reject);
      document.head.appendChild(script);
    });
  }

  function loadQuillAssets() {
    ensureStylesheet(QUILL_CSS_URL);
    return ensureScript(QUILL_JS_URL);
  }

  function loadMarkdownAssets() {
    return ensureScript(TURNDOWN_JS_URL).then(function () {
      return ensureScript(TURNDOWN_GFM_JS_URL);
    });
  }

  function safeParseJSON(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  }

  function getPlainText(html) {
    const container = document.createElement("div");
    container.innerHTML = html || "";
    return (container.textContent || container.innerText || "").replace(/\s+/g, " ").trim();
  }

  function countWords(text) {
    const trimmed = (text || "").trim();

    if (!trimmed) {
      return 0;
    }

    return trimmed.split(/\s+/).filter(Boolean).length;
  }

  function formatReadingTime(wordCount) {
    const minutes = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
    return minutes + (minutes === 1 ? " min read" : " mins read");
  }

  function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  function formatStatusTimestamp(timestamp) {
    return timestamp ? formatTimestamp(timestamp) : "Never";
  }

  function updateSaveStatusMeta(ui) {
    if (!ui || !ui.autosaveStatus || !ui.saveState) {
      return;
    }

    ui.autosaveStatus.textContent =
      "Last saved: " +
      formatStatusTimestamp(ui.saveState.lastSavedAt) +
      " | Autosave: " +
      formatStatusTimestamp(ui.saveState.lastAutosaveAt);
  }

  function applySaveStatusTone(statusNode, state) {
    if (!statusNode) {
      return;
    }

    statusNode.classList.remove(
      "review-chip--primary",
      "review-chip--muted",
      "review-chip--success",
      "review-chip--warning"
    );

    if (state === SAVE_STATUS.SAVED) {
      statusNode.classList.add("review-chip--success");
      return;
    }

    if (state === SAVE_STATUS.UNSAVED) {
      statusNode.classList.add("review-chip--warning");
      return;
    }

    if (state === SAVE_STATUS.AUTOSAVED) {
      statusNode.classList.add("review-chip--muted");
      return;
    }

    statusNode.classList.add("review-chip--primary");
  }

  function setSaveStatus(ui, state, options) {
    const config = options || {};
    const previousState = ui.saveState ? ui.saveState.state : "";

    ui.saveState = ui.saveState || {
      state: SAVE_STATUS.SAVED,
      lastSavedAt: null,
      lastAutosaveAt: null
    };

    if (config.lastSavedAt) {
      ui.saveState.lastSavedAt = config.lastSavedAt;
    }

    if (config.lastAutosaveAt) {
      ui.saveState.lastAutosaveAt = config.lastAutosaveAt;
    }

    ui.saveState.state = state;
    ui.draftStatus.textContent = state;
    applySaveStatusTone(ui.draftStatus, state);
    updateSaveStatusMeta(ui);

    if (
      config.historyKey &&
      config.historyList &&
      config.log !== false &&
      previousState !== state
    ) {
      saveHistory(
        config.historyKey,
        createAuditEntry(
          "status-changed",
          "Save status changed to " + state
        )
      );
      renderHistory(config.historyKey, config.historyList);
    }
  }

  function applyDocumentStatusTone(statusNode, status) {
    if (!statusNode) {
      return;
    }

    statusNode.classList.remove(
      "review-chip--primary",
      "review-chip--muted",
      "review-chip--success",
      "review-chip--warning"
    );

    if (status === DOCUMENT_STATUS.PUBLISHED) {
      statusNode.classList.add("review-chip--success");
      return;
    }

    if (status === DOCUMENT_STATUS.APPROVED) {
      statusNode.classList.add("review-chip--primary");
      return;
    }

    if (status === DOCUMENT_STATUS.IN_REVIEW) {
      statusNode.classList.add("review-chip--warning");
      return;
    }

    statusNode.classList.add("review-chip--muted");
  }

  function renderDocumentWorkflow(ui, status, commitId, ciStage) {
    const ciStageIndex = CI_STAGES.indexOf(ciStage);
    const stageMarkup = CI_STAGES.map(function (stage, index) {
      let cls = "review-ci-step";

      if (ciStageIndex > -1 && index < ciStageIndex) {
        cls += " is-done";
      } else if (ciStageIndex === index) {
        cls += " is-active";
      }

      return '<span class="' + cls + '">' + stage + "</span>";
    }).join('<span class="review-ci-separator">→</span>');

    if (ui.documentStatus) {
      ui.documentStatus.textContent = "Status: " + status;
      applyDocumentStatusTone(ui.documentStatus, status);
    }

    if (ui.commitMeta) {
      ui.commitMeta.textContent = commitId
        ? "Commit ID: " + commitId
        : "Commit ID: Not created";
    }

    if (ui.ciProgress) {
      ui.ciProgress.innerHTML = stageMarkup;
      ui.ciProgress.hidden = !ciStage;
    }

    if (ui.publishButton) {
      ui.publishButton.disabled =
        status !== DOCUMENT_STATUS.DRAFT &&
        status !== DOCUMENT_STATUS.IN_REVIEW;
      ui.publishButton.textContent =
        status === DOCUMENT_STATUS.IN_REVIEW
          ? "Submitted for Review"
          : "Submit for Review";
    }

    if (ui.approveButton) {
      ui.approveButton.disabled = status !== DOCUMENT_STATUS.IN_REVIEW;
    }

    if (ui.rejectButton) {
      ui.rejectButton.disabled = status !== DOCUMENT_STATUS.IN_REVIEW;
    }

    if (ui.commitButton) {
      ui.commitButton.hidden =
        status !== DOCUMENT_STATUS.APPROVED &&
        status !== DOCUMENT_STATUS.PUBLISHED;
      ui.commitButton.disabled =
        status !== DOCUMENT_STATUS.APPROVED ||
        Boolean(ciStage) ||
        status === DOCUMENT_STATUS.PUBLISHED;
    }
  }

  function runCiPipeline(ui, keys, quill, initialHtml, historyKey) {
    const stages = ["Build", "Deploy", "Published"];
    const stageAuditAction = {
      Build: "ci-build",
      Deploy: "ci-deploy",
      Published: "published"
    };
    const stageAuditMessage = {
      Build: "CI build completed",
      Deploy: "CI deploy completed",
      Published: "Documentation published"
    };

    function processStage(index) {
      if (index >= stages.length) {
        return;
      }

      const stage = stages[index];

      window.setTimeout(function () {
        localStorage.setItem(keys.ciStage, stage);

        if (stage === "Published") {
          const currentHtml = quill.root.innerHTML;

          localStorage.setItem(keys.published, "true");
          localStorage.setItem(keys.publishedContent, currentHtml);
          setDocumentStatus(keys, DOCUMENT_STATUS.PUBLISHED);
        }

        saveHistory(
          historyKey,
          createAuditEntry(
            stageAuditAction[stage],
            stageAuditMessage[stage]
          )
        );
        renderHistory(historyKey, ui.historyList);

        syncEditorState(ui, quill, keys, initialHtml, historyKey);

        if (stage === "Published") {
          showSuccess("The documentation has been published successfully.");
          return;
        }

        processStage(index + 1);
      }, 850);
    }

    processStage(0);
  }

  function getPreviewMarkdown(html) {
    if (!window.TurndownService) {
      return getPlainText(html);
    }

    const service = new window.TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-"
    });

    if (window.turndownPluginGfm && window.turndownPluginGfm.gfm) {
      service.use(window.turndownPluginGfm.gfm);
    }

    return service.turndown(html || "");
  }

  function getVersionHistory(versionKey) {
    const versions = safeParseJSON(localStorage.getItem(versionKey), []);
    return Array.isArray(versions) ? versions : [];
  }

  function saveVersionHistory(versionKey, version) {
    const versions = getVersionHistory(versionKey);

    if (versions.length > 0 && versions[0].html === version.html) {
      return;
    }

    versions.unshift(version);

    if (versions.length > VERSION_LIMIT) {
      versions.length = VERSION_LIMIT;
    }

    localStorage.setItem(versionKey, JSON.stringify(versions));
  }

  function snapshotEditor(quill, label, kind) {
    const html = quill.root.innerHTML;
    return {
      id: Date.now() + Math.random().toString(16).slice(2),
      label: label,
      kind: kind,
      html: html,
      wordCount: countWords(getPlainText(html)),
      timestamp: Date.now()
    };
  }

  function renderPreview(previewNode, markdown) {
    previewNode.textContent = markdown || "No content yet.";
  }

  function renderRenderedPreview(renderedNode, html) {
    if (!renderedNode) {
      return;
    }

    if (!getPlainText(html)) {
      renderedNode.innerHTML = '<p class="review-rendered-preview-empty">No content yet.</p>';
      return;
    }

    renderedNode.innerHTML = html || "";
  }

  function setPreviewMode(ui, mode) {
    const isRendered = mode === "rendered";

    ui.previewMode = isRendered ? "rendered" : "markdown";
    ui.markdownPreview.hidden = isRendered;
    ui.renderedPreview.hidden = !isRendered;
    ui.previewMarkdownButton.classList.toggle("is-active", !isRendered);
    ui.previewRenderedButton.classList.toggle("is-active", isRendered);
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      const tempInput = document.createElement("textarea");
      tempInput.value = text;
      tempInput.setAttribute("readonly", "readonly");
      tempInput.style.position = "absolute";
      tempInput.style.left = "-9999px";
      document.body.appendChild(tempInput);
      tempInput.select();

      try {
        const success = document.execCommand("copy");
        document.body.removeChild(tempInput);

        if (success) {
          resolve();
          return;
        }

        reject(new Error("Copy command failed."));
      } catch (error) {
        document.body.removeChild(tempInput);
        reject(error);
      }
    });
  }

  function renderStats(statsNodes, html) {
    const wordCount = countWords(getPlainText(html));

    statsNodes.wordCount.textContent = wordCount + (wordCount === 1 ? " word" : " words");
    statsNodes.readingTime.textContent = formatReadingTime(wordCount);
  }

  function collectStyleGuideIssues(quillRoot) {
    const issues = [];
    const headings = Array.prototype.slice.call(
      quillRoot.querySelectorAll("h1, h2, h3, h4, h5, h6")
    );
    const images = Array.prototype.slice.call(quillRoot.querySelectorAll("img"));
    let lastHeadingLevel = 0;
    let h1Count = 0;

    headings.forEach(function (heading) {
      const level = Number(heading.tagName.slice(1));

      if (level === 1) {
        h1Count += 1;
      }

      if (lastHeadingLevel && level > lastHeadingLevel + 1) {
        issues.push(
          "Heading order skips from H" + lastHeadingLevel + " to H" + level + "."
        );
      }

      lastHeadingLevel = level;
    });

    if (h1Count > 1) {
      issues.push("Use a single H1 title at the top of the document.");
    }

    images.forEach(function (image, index) {
      if (!(image.getAttribute("alt") || "").trim()) {
        issues.push("Image " + (index + 1) + " is missing alt text.");
      }
    });

    Array.prototype.slice.call(quillRoot.querySelectorAll("p")).forEach(function (paragraph) {
      if ((paragraph.textContent || "").trim().length > 240) {
        issues.push("Break up long paragraphs for easier scanning.");
      }
    });

    if (issues.length === 0) {
      issues.push("No style guide issues detected.");
    }

    return issues;
  }

  function renderIssues(issueListNode, issues) {
    issueListNode.innerHTML = "";

    issues.forEach(function (issue) {
      const item = document.createElement("li");
      item.textContent = issue;
      issueListNode.appendChild(item);
    });
  }

  function collectAiSuggestions(quillRoot) {
    const suggestions = [];
    const headings = Array.prototype.slice.call(
      quillRoot.querySelectorAll("h1, h2, h3, h4, h5, h6")
    );
    const images = Array.prototype.slice.call(quillRoot.querySelectorAll("img"));
    const paragraphs = Array.prototype.slice.call(quillRoot.querySelectorAll("p"));
    const weakWordingPattern = /\b(very|really|just|basically|simply|obviously|clearly|somehow|kind of|sort of)\b/i;
    let lastHeadingLevel = 0;

    headings.forEach(function (heading, index) {
      const level = Number(heading.tagName.slice(1));

      if (lastHeadingLevel && level > lastHeadingLevel + 1) {
        suggestions.push({
          id: "heading-skip-" + index,
          type: "heading",
          title: "Fix heading hierarchy",
          issue:
            "Heading level skips from H" +
            lastHeadingLevel +
            " to H" +
            level +
            ".",
          reason: "Skipped heading levels reduce document scanability and structural clarity.",
          recommendation:
            "Change this heading to H" +
            (lastHeadingLevel + 1) +
            " or add an intermediate heading.",
          summary:
            "Heading order skips from H" +
            lastHeadingLevel +
            " to H" +
            level +
            ".",
          action: "Change this heading to H" + (lastHeadingLevel + 1) + " or add an intermediate heading.",
          safeFix: "adjust-heading-level",
          target: {
            group: "heading",
            index: index,
            recommendedLevel: lastHeadingLevel + 1
          }
        });
      }

      lastHeadingLevel = level;
    });

    paragraphs.forEach(function (paragraph, index) {
      const text = (paragraph.textContent || "").trim();
      const weakMatch = text.match(weakWordingPattern);

      if (text.length > 240) {
        suggestions.push({
          id: "long-paragraph-" + index,
          type: "readability",
          title: "Split long paragraph",
          issue: "Paragraph " + (index + 1) + " is long and harder to scan.",
          reason: "Very long paragraphs increase reading effort and reduce comprehension.",
          recommendation: "Break this paragraph into shorter chunks (2-4 sentences).",
          summary: "Paragraph " + (index + 1) + " is long and harder to scan.",
          action: "Break this paragraph into shorter chunks (2-4 sentences).",
          safeFix: "highlight-only",
          target: {
            group: "paragraph",
            index: index
          }
        });
      }

      if (weakMatch) {
        suggestions.push({
          id: "weak-wording-" + index + "-" + weakMatch[0].toLowerCase(),
          type: "clarity",
          title: "Strengthen wording",
          issue:
            'Paragraph ' +
            (index + 1) +
            ' uses "' +
            weakMatch[0] +
            '".',
          reason: "Weak qualifiers can reduce precision and confidence in technical content.",
          recommendation: "Replace it with specific, direct wording.",
          summary:
            'Paragraph ' +
            (index + 1) +
            ' uses "' +
            weakMatch[0] +
            '", which can weaken clarity.',
          action: "Replace it with specific, direct wording.",
          safeFix: "highlight-only",
          target: {
            group: "paragraph",
            index: index
          }
        });
      }
    });

    images.forEach(function (image, index) {
      if (!(image.getAttribute("alt") || "").trim()) {
        suggestions.push({
          id: "missing-alt-" + index,
          type: "accessibility",
          title: "Add image alt text",
          issue: "Image " + (index + 1) + " is missing alt text.",
          reason: "Screen readers need alt text to describe non-text content.",
          recommendation: "Add concise alt text that describes the image purpose.",
          summary: "Image " + (index + 1) + " is missing alt text.",
          action: "Add concise alt text that describes the image purpose.",
          safeFix: "prompt-alt-text",
          target: {
            group: "image",
            index: index
          }
        });
      }
    });

    return suggestions.slice(0, 12);
  }

  function getSuggestionBadgeClass(type) {
    if (type === "accessibility") {
      return "review-suggestion-tag review-suggestion-tag--accessibility";
    }

    if (type === "heading") {
      return "review-suggestion-tag review-suggestion-tag--heading";
    }

    if (type === "clarity") {
      return "review-suggestion-tag review-suggestion-tag--clarity";
    }

    return "review-suggestion-tag review-suggestion-tag--readability";
  }

  function flashSuggestionTarget(quillRoot, suggestion) {
    if (!suggestion || !suggestion.target) {
      return;
    }

    let selector = "";

    if (suggestion.target.group === "paragraph") {
      selector = "p";
    } else if (suggestion.target.group === "heading") {
      selector = "h1, h2, h3, h4, h5, h6";
    } else if (suggestion.target.group === "image") {
      selector = "img";
    }

    if (!selector) {
      return;
    }

    const nodes = quillRoot.querySelectorAll(selector);
    const node = nodes[suggestion.target.index];

    if (!node) {
      return;
    }

    node.classList.add("review-suggestion-target");
    node.scrollIntoView({ behavior: "smooth", block: "center" });

    window.setTimeout(function () {
      node.classList.remove("review-suggestion-target");
    }, 1600);
  }

  function applyHeadingLevelFix(quill, suggestion) {
    if (!suggestion || !suggestion.target || !suggestion.target.recommendedLevel) {
      return false;
    }

    const headingNodes = quill.root.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const targetHeading = headingNodes[suggestion.target.index];

    if (!targetHeading) {
      return false;
    }

    const level = Math.max(1, Math.min(6, Number(suggestion.target.recommendedLevel)));
    const replacement = document.createElement("h" + level);

    Array.prototype.slice.call(targetHeading.attributes).forEach(function (attribute) {
      replacement.setAttribute(attribute.name, attribute.value);
    });

    replacement.innerHTML = targetHeading.innerHTML;
    targetHeading.parentNode.replaceChild(replacement, targetHeading);
    quill.update("user");
    return true;
  }

  function collectHeadingNavigatorData(quillRoot) {
    const headings = [];
    const issues = [];
    const headingNodes = Array.prototype.slice.call(
      quillRoot.querySelectorAll("h1, h2, h3")
    );
    let lastLevel = 0;
    let h1Count = 0;

    headingNodes.forEach(function (headingNode, index) {
      const level = Number(headingNode.tagName.slice(1));
      const text = (headingNode.textContent || "").trim() || "Untitled heading";

      headings.push({
        index: index,
        level: level,
        text: text
      });

      if (level === 1) {
        h1Count += 1;
      }

      if (lastLevel && level > lastLevel + 1) {
        issues.push("Heading order skips from H" + lastLevel + " to H" + level + ".");
      }

      lastLevel = level;
    });

    if (h1Count === 0) {
      issues.push("Add a document H1 heading.");
    }

    if (h1Count > 1) {
      issues.push("Use a single H1 heading.");
    }

    return {
      headings: headings,
      issues: issues
    };
  }

  function renderHeadingNavigator(listNode, issuesNode, navigatorData, onJump) {
    listNode.innerHTML = "";
    issuesNode.innerHTML = "";

    if (!navigatorData.headings.length) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "review-heading-empty";
      emptyItem.textContent = "No H1-H3 headings found in the editor content.";
      listNode.appendChild(emptyItem);
    } else {
      navigatorData.headings.forEach(function (heading) {
        const item = document.createElement("li");
        const jumpButton = document.createElement("button");

        item.className = "review-heading-item review-heading-level-" + heading.level;

        jumpButton.type = "button";
        jumpButton.className = "review-heading-jump";
        jumpButton.textContent = "H" + heading.level + " - " + heading.text;
        jumpButton.addEventListener("click", function () {
          onJump(heading);
        });

        item.appendChild(jumpButton);
        listNode.appendChild(item);
      });
    }

    if (!navigatorData.issues.length) {
      const good = document.createElement("li");
      good.className = "review-heading-issue review-heading-issue--ok";
      good.textContent = "No heading hierarchy issues detected.";
      issuesNode.appendChild(good);
      return;
    }

    navigatorData.issues.forEach(function (issue) {
      const issueItem = document.createElement("li");
      issueItem.className = "review-heading-issue";
      issueItem.textContent = issue;
      issuesNode.appendChild(issueItem);
    });
  }

  function collectImageAltData(quillRoot) {
    return Array.prototype.slice.call(quillRoot.querySelectorAll("img")).map(function (imageNode, index) {
      const alt = (imageNode.getAttribute("alt") || "").trim();

      return {
        index: index,
        alt: alt,
        missing: !alt,
        source: imageNode.getAttribute("src") || ""
      };
    });
  }

  function renderImageAltManager(listNode, imageItems, handlers) {
    listNode.innerHTML = "";

    if (!imageItems.length) {
      const empty = document.createElement("li");
      empty.className = "review-image-alt-empty";
      empty.textContent = "No images found in the current editor content.";
      listNode.appendChild(empty);
      return;
    }

    imageItems.forEach(function (item) {
      const row = document.createElement("li");
      const meta = document.createElement("div");
      const title = document.createElement("strong");
      const status = document.createElement("span");
      const editRow = document.createElement("div");
      const input = document.createElement("input");
      const button = document.createElement("button");

      row.className = "review-image-alt-item" + (item.missing ? " is-missing" : "");
      meta.className = "review-image-alt-meta";
      editRow.className = "review-image-alt-edit";

      title.textContent = "Image " + (item.index + 1);
      status.className = "review-image-alt-status" + (item.missing ? " is-missing" : "");
      status.textContent = item.missing ? "Missing alt text" : "Alt text set";

      input.type = "text";
      input.className = "review-image-alt-input";
      input.value = item.alt;
      input.placeholder = "Describe this image for screen readers";
      input.setAttribute("aria-label", "Alt text for image " + (item.index + 1));

      button.type = "button";
      button.className = "review-image-alt-save";
      button.textContent = "Update Alt";
      button.addEventListener("click", function () {
        handlers.onUpdate(item, input.value || "");
      });

      meta.appendChild(title);
      meta.appendChild(status);
      editRow.appendChild(input);
      editRow.appendChild(button);
      row.appendChild(meta);
      row.appendChild(editRow);
      listNode.appendChild(row);
    });
  }

  function renderAiSuggestions(listNode, suggestions, handlers) {
    listNode.innerHTML = "";

    if (!suggestions.length) {
      const empty = document.createElement("li");
      empty.className = "review-suggestion-empty";
      empty.textContent = "No AI suggestions right now.";
      listNode.appendChild(empty);
      return;
    }

    suggestions.forEach(function (suggestion) {
      const item = document.createElement("li");
      const head = document.createElement("div");
      const issue = document.createElement("p");
      const reason = document.createElement("p");
      const recommendation = document.createElement("p");
      const controls = document.createElement("div");
      const acceptButton = document.createElement("button");
      const rejectButton = document.createElement("button");
      const title = document.createElement("strong");
      const tag = document.createElement("span");

      function fillSuggestionLine(node, label, value) {
        const heading = document.createElement("strong");
        heading.textContent = label + ": ";
        node.appendChild(heading);
        node.appendChild(document.createTextNode(value));
      }

      item.className = "review-suggestion-card";
      head.className = "review-suggestion-head";
      issue.className = "review-suggestion-summary";
      reason.className = "review-suggestion-reason";
      recommendation.className = "review-suggestion-action";
      controls.className = "review-suggestion-controls";
      tag.className = getSuggestionBadgeClass(suggestion.type);

      tag.textContent = suggestion.type;
      title.textContent = suggestion.title;
      fillSuggestionLine(issue, "Issue", suggestion.issue || suggestion.summary || "");
      fillSuggestionLine(reason, "Reason", suggestion.reason || "Review to improve editorial quality.");
      fillSuggestionLine(
        recommendation,
        "Recommended action",
        suggestion.recommendation || suggestion.action || ""
      );

      acceptButton.type = "button";
      acceptButton.className = "review-suggestion-accept";
      acceptButton.textContent = "Apply Suggestion";
      acceptButton.addEventListener("click", function () {
        handlers.onAccept(suggestion);
      });

      rejectButton.type = "button";
      rejectButton.className = "review-suggestion-reject";
      rejectButton.textContent = "Dismiss";
      rejectButton.addEventListener("click", function () {
        handlers.onReject(suggestion);
      });

      head.appendChild(title);
      head.appendChild(tag);
      controls.appendChild(acceptButton);
      controls.appendChild(rejectButton);
      item.appendChild(head);
      item.appendChild(issue);
      item.appendChild(reason);
      item.appendChild(recommendation);
      item.appendChild(controls);
      listNode.appendChild(item);
    });
  }

  function renderVersionHistory(versionsNode, versions, onRestore) {
    versionsNode.innerHTML = "";

    if (versions.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No saved versions yet.";
      versionsNode.appendChild(item);
      return;
    }

    versions.forEach(function (version, index) {
      const item = document.createElement("li");
      const meta = document.createElement("div");
      const label = document.createElement("strong");
      const details = document.createElement("span");
      const button = document.createElement("button");

      label.textContent = version.label;
      details.textContent =
        formatTimestamp(version.timestamp) +
        " • " +
        version.wordCount +
        " words";

      button.type = "button";
      button.textContent = "Restore";
      button.addEventListener("click", function () {
        onRestore(version, index);
      });

      meta.appendChild(label);
      meta.appendChild(document.createElement("br"));
      meta.appendChild(details);
      item.appendChild(meta);
      item.appendChild(button);
      versionsNode.appendChild(item);
    });
  }

  function createMarkdownSerializer() {
    if (!window.TurndownService) {
      return null;
    }

    const service = new window.TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-"
    });

    if (window.turndownPluginGfm && window.turndownPluginGfm.gfm) {
      service.use(window.turndownPluginGfm.gfm);
    }

    return service;
  }

  function getContentRoot() {
    return (
      document.querySelector(".md-content__inner") ||
      document.querySelector(".md-content") ||
      document.querySelector("article")
    );
  }

  function createReviewWorkspace(contentRoot) {
    const wrapper = document.createElement("div");
    wrapper.className = "review-workspace";

    wrapper.innerHTML = `
      <header class="review-header">
        <div class="review-heading-block">
          <p class="review-kicker">Human + AI workflow</p>
          <h2>Human Editorial Review</h2>
          <p class="review-lead">
            Refine the AI draft in a focused editor, preview the Markdown output, and approve the final documentation with a clear version trail.
          </p>
        </div>

        <div class="review-status-strip" aria-label="Document status summary">
          <span id="review-document-status" class="review-chip review-chip--muted">Status: Draft</span>
          <span id="review-draft-status" class="review-chip review-chip--success">Saved</span>
          <span id="review-autosave-status" class="review-chip review-chip--muted">Last saved: Never | Autosave: Never</span>
          <span id="review-word-count" class="review-chip">0 words</span>
          <span id="review-reading-time" class="review-chip">0 min read</span>
        </div>
      </header>

      <div class="review-layout">
        <section class="review-main-column">
          <div class="review-panel review-panel--hero">
            <div class="review-editor-host">
              <div id="review-editor-toolbar">
                <span class="ql-formats">
                  <select class="ql-header">
                    <option selected></option>
                    <option value="1"></option>
                    <option value="2"></option>
                    <option value="3"></option>
                  </select>
                  <select class="ql-font">
                    <option value="sans-serif" selected>Sans</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Mono</option>
                  </select>
                  <select class="ql-size">
                    <option value="12px">12</option>
                    <option value="14px">14</option>
                    <option value="16px" selected>16</option>
                    <option value="18px">18</option>
                    <option value="24px">24</option>
                  </select>
                </span>

                <span class="ql-formats">
                  <button class="ql-bold"></button>
                  <button class="ql-italic"></button>
                  <button class="ql-underline"></button>
                  <button class="ql-strike"></button>
                </span>

                <span class="ql-formats">
                  <select class="ql-color"></select>
                  <select class="ql-background"></select>
                </span>

                <span class="ql-formats">
                  <button class="ql-list" value="ordered"></button>
                  <button class="ql-list" value="bullet"></button>
                  <button class="ql-blockquote"></button>
                  <button class="ql-code-block"></button>
                </span>

                <span class="ql-formats">
                  <button class="ql-link"></button>
                  <button class="ql-image"></button>
                  <select class="ql-align"></select>
                </span>

                <span class="ql-formats">
                  <button class="ql-undo" type="button" title="Undo">
                    Undo
                  </button>
                  <button class="ql-redo" type="button" title="Redo">
                    Redo
                  </button>
                  <button class="ql-clean"></button>
                </span>
              </div>

              <div id="review-quill-editor"></div>
            </div>

            <div class="review-actions">
              <button id="review-save">Save Review</button>
              <button id="review-publish">Submit for Review</button>
              <button id="review-approve" type="button">Approve</button>
              <button id="review-reject" type="button">Reject</button>
              <button id="review-commit" type="button" hidden>Commit Documentation</button>
            </div>
            <div class="review-workflow-meta" aria-live="polite">
              <p id="review-commit-id" class="review-workflow-text">Commit ID: Not created</p>
              <div id="review-ci-progress" class="review-ci-progress" hidden></div>
            </div>
          </div>
        </section>

        <aside class="review-side-column">
          <section class="review-panel review-panel--stacked">
            <div class="review-panel-heading">
              <h3>Markdown Preview</h3>
              <p>Live Markdown generated from the current editor content.</p>
            </div>
            <div class="review-preview-controls" role="group" aria-label="Preview mode">
              <button id="review-preview-markdown" class="review-preview-toggle is-active" type="button">Markdown View</button>
              <button id="review-preview-rendered" class="review-preview-toggle" type="button">Rendered Preview</button>
              <button id="review-copy-markdown" class="review-preview-copy" type="button">Copy Markdown</button>
            </div>
            <pre id="review-markdown-preview" class="review-markdown-preview"></pre>
            <div id="review-rendered-preview" class="review-rendered-preview" hidden></div>
          </section>

          <section class="review-panel review-panel--stacked">
            <div class="review-panel-heading">
              <h3>Original vs Edited</h3>
              <p>Compare the AI draft against the human-edited version.</p>
            </div>
            <div id="review-comparison-summary" class="review-comparison-summary"></div>
            <div id="review-comparison-details" class="review-comparison-details"></div>
            <div class="review-actions review-actions--compact">
              <button id="review-restore-original" type="button">Restore Original Draft</button>
            </div>
          </section>

          <section class="review-panel review-panel--stacked">
            <div class="review-panel-heading">
              <h3>Style Guide Checks</h3>
              <p>Automatic checks for editorial consistency and accessibility.</p>
            </div>
            <ul id="review-style-checks" class="review-checklist"></ul>
          </section>

          <section class="review-panel review-panel--stacked">
            <div class="review-panel-heading">
              <h3>Heading Navigator</h3>
              <p>Jump to H1-H3 sections and review hierarchy quality.</p>
            </div>
            <ul id="review-heading-navigator" class="review-heading-navigator"></ul>
            <ul id="review-heading-issues" class="review-heading-issues"></ul>
          </section>

          <section class="review-panel review-panel--stacked">
            <div class="review-panel-heading">
              <h3>Image Alt Text Manager</h3>
              <p>Review missing alt text and update descriptions inline.</p>
            </div>
            <ul id="review-image-alt-manager" class="review-image-alt-manager"></ul>
          </section>

          <section class="review-panel review-panel--stacked">
            <div class="review-panel-heading">
              <h3>AI Suggestions</h3>
              <p>Rule-based recommendations to improve clarity, structure, and accessibility.</p>
            </div>
            <ul id="review-ai-suggestions" class="review-suggestions"></ul>
          </section>

          <section class="review-panel review-panel--stacked">
            <div class="review-panel-heading">
              <h3>Version History</h3>
              <p>Restore a saved snapshot or the latest autosave.</p>
            </div>
            <div class="review-actions review-actions--compact">
              <button id="review-restore-autosave" type="button">Restore Autosave</button>
            </div>
            <ul id="review-versions" class="review-versions"></ul>
          </section>

          <section class="review-panel review-panel--stacked">
            <div class="review-panel-heading">
              <h3>Edit Trail</h3>
              <p>Audit history preserved from the existing review workflow.</p>
            </div>
            <ul id="review-history" class="review-history"></ul>
          </section>
        </aside>
      </div>
    `;

    contentRoot.insertAdjacentElement(
      "afterend",
      wrapper
    );

    return {
      wrapper: wrapper,
      historyList: wrapper.querySelector("#review-history"),
      saveButton: wrapper.querySelector("#review-save"),
      publishButton: wrapper.querySelector("#review-publish"),
      approveButton: wrapper.querySelector("#review-approve"),
      rejectButton: wrapper.querySelector("#review-reject"),
      commitButton: wrapper.querySelector("#review-commit"),
      restoreOriginalButton: wrapper.querySelector("#review-restore-original"),
      restoreAutosaveButton: wrapper.querySelector("#review-restore-autosave"),
      toolbar: wrapper.querySelector("#review-editor-toolbar"),
      editor: wrapper.querySelector("#review-quill-editor"),
      documentStatus: wrapper.querySelector("#review-document-status"),
      draftStatus: wrapper.querySelector("#review-draft-status"),
      autosaveStatus: wrapper.querySelector("#review-autosave-status"),
      wordCount: wrapper.querySelector("#review-word-count"),
      readingTime: wrapper.querySelector("#review-reading-time"),
      previewMarkdownButton: wrapper.querySelector("#review-preview-markdown"),
      previewRenderedButton: wrapper.querySelector("#review-preview-rendered"),
      copyMarkdownButton: wrapper.querySelector("#review-copy-markdown"),
      markdownPreview: wrapper.querySelector("#review-markdown-preview"),
      renderedPreview: wrapper.querySelector("#review-rendered-preview"),
      comparisonSummary: wrapper.querySelector("#review-comparison-summary"),
      comparisonDetails: wrapper.querySelector("#review-comparison-details"),
      styleChecks: wrapper.querySelector("#review-style-checks"),
      headingNavigator: wrapper.querySelector("#review-heading-navigator"),
      headingIssues: wrapper.querySelector("#review-heading-issues"),
      imageAltManager: wrapper.querySelector("#review-image-alt-manager"),
      aiSuggestions: wrapper.querySelector("#review-ai-suggestions"),
      versionsList: wrapper.querySelector("#review-versions"),
      commitMeta: wrapper.querySelector("#review-commit-id"),
      ciProgress: wrapper.querySelector("#review-ci-progress")
    };
  }

  function createBanner(contentRoot) {
    const banner = document.createElement("div");

    banner.className = "review-banner";

    banner.innerHTML = `
      <strong>AI Draft Mode</strong><br>
      This page is editable. Review AI-generated documentation before publishing.
    `;

    contentRoot.parentNode.insertBefore(
      banner,
      contentRoot
    );
  }

  function renderHistory(historyKey, historyList) {
    const history = getHistory(historyKey);
    historyList.innerHTML = "";

    if (history.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No review activity yet.";
      historyList.appendChild(li);
      return;
    }

    history.forEach(function (item) {
      const li = document.createElement("li");
      const actor = item.actor || inferAuditActor(item.action);
      const status = item.status || inferAuditStatus(item.action);

      li.textContent =
        item.timestamp +
        " | Actor: " +
        actor +
        " | Action: " +
        item.action +
        " | Status: " +
        status +
        " | " +
        item.details;

      historyList.appendChild(li);
    });
  }

  function configureQuillFormats() {
    const FontStyle = window.Quill.import("attributors/style/font");
    FontStyle.whitelist = [
      "sans-serif",
      "serif",
      "monospace"
    ];

    const SizeStyle = window.Quill.import("attributors/style/size");
    SizeStyle.whitelist = [
      "12px",
      "14px",
      "16px",
      "18px",
      "24px"
    ];

    window.Quill.register(FontStyle, true);
    window.Quill.register(SizeStyle, true);

    const BaseImage = window.Quill.import("formats/image");

    class ImageWithAlt extends BaseImage {
      static create(value) {
        const payload =
          typeof value === "object" && value !== null
            ? value
            : { src: value };

        const node = super.create(payload.src || "");
        node.setAttribute("alt", payload.alt || "");

        if (payload.title) {
          node.setAttribute("title", payload.title);
        } else if (payload.alt) {
          node.setAttribute("title", payload.alt);
        }

        return node;
      }

      static value(node) {
        return {
          src: node.getAttribute("src"),
          alt: node.getAttribute("alt") || "",
          title: node.getAttribute("title") || ""
        };
      }
    }

    ImageWithAlt.blotName = "image";
    ImageWithAlt.tagName = "IMG";

    window.Quill.register(ImageWithAlt, true);
  }

  function createImageUploadHandler(quill) {
    return function () {
      const input = document.createElement("input");
      input.setAttribute("type", "file");
      input.setAttribute("accept", "image/*");
      input.click();

      input.addEventListener("change", function () {
        const file = input.files && input.files[0];
        if (!file) {
          return;
        }

        const reader = new FileReader();

        reader.addEventListener("load", function (evt) {
          const range = quill.getSelection(true);
          const index = range ? range.index : quill.getLength();

          showAlert({
            title: "Image alt text",
            input: "text",
            inputLabel: "Describe the image for screen readers",
            inputValue: file.name.replace(/\.[^.]+$/, ""),
            inputPlaceholder: "Add a concise alt description",
            showCancelButton: true,
            confirmButtonText: "Insert image",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#6c757d"
          }).then(function (result) {
            if (!result.isConfirmed) {
              return;
            }

            quill.insertEmbed(
              index,
              "image",
              {
                src: evt.target.result,
                alt: (result.value || "").trim(),
                title: (result.value || "").trim()
              },
              "user"
            );

            quill.setSelection(index + 1, 0, "silent");
          });
        });

        reader.readAsDataURL(file);
      });
    };
  }

  function createQuillEditor(ui, initialHtml) {
    configureQuillFormats();

    const quill = new window.Quill(ui.editor, {
      theme: "snow",
      modules: {
        toolbar: {
          container: ui.toolbar,
          handlers: {
            image: null,
            undo: function () {
              this.quill.history.undo();
            },
            redo: function () {
              this.quill.history.redo();
            }
          }
        },
        history: {
          delay: 500,
          maxStack: 200,
          userOnly: true
        }
      },
      formats: [
        "header",
        "font",
        "size",
        "bold",
        "italic",
        "underline",
        "strike",
        "color",
        "background",
        "list",
        "blockquote",
        "code-block",
        "link",
        "image",
        "align"
      ]
    });

    quill.getModule("toolbar").addHandler(
      "image",
      createImageUploadHandler(quill)
    );

    quill.clipboard.dangerouslyPasteHTML(initialHtml);
    return quill;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeComparisonText(value) {
    return (value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getComparisonSections(html) {
    const container = document.createElement("div");
    container.innerHTML = html || "";

    const nodes = container.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, td, th"
    );
    const sections = [];

    nodes.forEach(function (node, index) {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();

      if (!text) {
        return;
      }

      sections.push({
        id: index,
        text: text,
        normalized: normalizeComparisonText(text)
      });
    });

    if (sections.length === 0) {
      const fallback = (container.textContent || container.innerText || "")
        .replace(/\s+/g, " ")
        .trim();

      if (fallback) {
        sections.push({
          id: 0,
          text: fallback,
          normalized: normalizeComparisonText(fallback)
        });
      }
    }

    return sections;
  }

  function getLcsPairs(originalSections, currentSections) {
    const originalCount = originalSections.length;
    const currentCount = currentSections.length;
    const matrix = [];
    let i = 0;

    for (i = 0; i <= originalCount; i += 1) {
      matrix.push(new Array(currentCount + 1).fill(0));
    }

    for (i = originalCount - 1; i >= 0; i -= 1) {
      for (let j = currentCount - 1; j >= 0; j -= 1) {
        if (
          originalSections[i].normalized &&
          originalSections[i].normalized === currentSections[j].normalized
        ) {
          matrix[i][j] = matrix[i + 1][j + 1] + 1;
        } else {
          matrix[i][j] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
        }
      }
    }

    const pairs = [];
    i = 0;
    let j = 0;

    while (i < originalCount && j < currentCount) {
      if (
        originalSections[i].normalized &&
        originalSections[i].normalized === currentSections[j].normalized
      ) {
        pairs.push({
          originalIndex: i,
          currentIndex: j
        });
        i += 1;
        j += 1;
      } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
        i += 1;
      } else {
        j += 1;
      }
    }

    return pairs;
  }

  function toComparisonTokens(text) {
    const trimmed = (text || "").trim();
    return trimmed ? trimmed.split(/\s+/) : [];
  }

  function getWordSimilarity(beforeText, afterText) {
    const beforeTokens = toComparisonTokens(normalizeComparisonText(beforeText));
    const afterTokens = toComparisonTokens(normalizeComparisonText(afterText));
    const beforeSet = new Set(beforeTokens);
    const afterSet = new Set(afterTokens);
    const union = new Set(beforeTokens.concat(afterTokens));
    let intersection = 0;

    beforeSet.forEach(function (token) {
      if (afterSet.has(token)) {
        intersection += 1;
      }
    });

    if (union.size === 0) {
      return 0;
    }

    return intersection / union.size;
  }

  function getTokenDiff(beforeText, afterText) {
    const beforeTokens = toComparisonTokens(beforeText);
    const afterTokens = toComparisonTokens(afterText);
    const beforeCount = beforeTokens.length;
    const afterCount = afterTokens.length;
    const matrix = [];
    let i = 0;

    for (i = 0; i <= beforeCount; i += 1) {
      matrix.push(new Array(afterCount + 1).fill(0));
    }

    for (i = beforeCount - 1; i >= 0; i -= 1) {
      for (let j = afterCount - 1; j >= 0; j -= 1) {
        if (
          normalizeComparisonText(beforeTokens[i]) &&
          normalizeComparisonText(beforeTokens[i]) === normalizeComparisonText(afterTokens[j])
        ) {
          matrix[i][j] = matrix[i + 1][j + 1] + 1;
        } else {
          matrix[i][j] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
        }
      }
    }

    const beforeMatched = new Set();
    const afterMatched = new Set();
    i = 0;
    let j = 0;

    while (i < beforeCount && j < afterCount) {
      if (
        normalizeComparisonText(beforeTokens[i]) &&
        normalizeComparisonText(beforeTokens[i]) === normalizeComparisonText(afterTokens[j])
      ) {
        beforeMatched.add(i);
        afterMatched.add(j);
        i += 1;
        j += 1;
      } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
        i += 1;
      } else {
        j += 1;
      }
    }

    return {
      beforeHtml: beforeTokens
        .map(function (token, index) {
          if (beforeMatched.has(index)) {
            return escapeHtml(token);
          }
          return '<span class="review-diff-token review-diff-token--removed">' + escapeHtml(token) + "</span>";
        })
        .join(" "),
      afterHtml: afterTokens
        .map(function (token, index) {
          if (afterMatched.has(index)) {
            return escapeHtml(token);
          }
          return '<span class="review-diff-token review-diff-token--added">' + escapeHtml(token) + "</span>";
        })
        .join(" ")
    };
  }

  function buildComparison(originalHtml, currentHtml) {
    const originalSections = getComparisonSections(originalHtml);
    const currentSections = getComparisonSections(currentHtml);
    const lcsPairs = getLcsPairs(originalSections, currentSections);
    const matchedOriginal = new Set();
    const matchedCurrent = new Set();
    const removed = [];
    const added = [];
    const modified = [];

    lcsPairs.forEach(function (pair) {
      matchedOriginal.add(pair.originalIndex);
      matchedCurrent.add(pair.currentIndex);
    });

    originalSections.forEach(function (section, index) {
      if (!matchedOriginal.has(index)) {
        removed.push(section);
      }
    });

    currentSections.forEach(function (section, index) {
      if (!matchedCurrent.has(index)) {
        added.push(section);
      }
    });

    const usedAddedIndexes = new Set();
    const retainedRemoved = [];

    removed.forEach(function (removedSection) {
      let bestIndex = -1;
      let bestScore = 0;

      added.forEach(function (addedSection, addedIndex) {
        if (usedAddedIndexes.has(addedIndex)) {
          return;
        }

        const similarity = getWordSimilarity(
          removedSection.text,
          addedSection.text
        );

        if (similarity > bestScore) {
          bestScore = similarity;
          bestIndex = addedIndex;
        }
      });

      if (bestIndex !== -1 && bestScore >= 0.4) {
        usedAddedIndexes.add(bestIndex);
        modified.push({
          before: removedSection.text,
          after: added[bestIndex].text,
          diff: getTokenDiff(removedSection.text, added[bestIndex].text)
        });
      } else {
        retainedRemoved.push(removedSection);
      }
    });

    const retainedAdded = added.filter(function (section, index) {
      return !usedAddedIndexes.has(index);
    });

    return {
      added: retainedAdded,
      removed: retainedRemoved,
      modified: modified
    };
  }

  function createComparisonSection(title, variant, items, renderItem, onView) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const body = document.createElement("div");
    const list = document.createElement("ul");

    details.className = "review-comparison-section review-comparison-section--" + variant;
    summary.textContent = title + " (" + items.length + ")";
    body.className = "review-comparison-body";
    list.className = "review-diff-list";

    if (items.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "review-diff-empty";
      emptyItem.textContent = "No " + title.toLowerCase() + " changes.";
      list.appendChild(emptyItem);
    } else {
      items.forEach(function (item) {
        list.appendChild(renderItem(item));
      });
    }

    details.addEventListener("toggle", function () {
      if (details.open && onView) {
        onView(title, items.length);
      }
    });

    body.appendChild(list);
    details.appendChild(summary);
    details.appendChild(body);

    return details;
  }

  function renderComparisonDetails(detailsNode, comparison, onView) {
    detailsNode.innerHTML = "";

    detailsNode.appendChild(
      createComparisonSection(
        "Added",
        "added",
        comparison.added,
        function (item) {
          const row = document.createElement("li");
          const text = document.createElement("p");
          row.className = "review-diff-item";
          text.className = "review-diff-content review-diff-content--added";
          text.innerHTML = '<span class="review-diff-token review-diff-token--added">' + escapeHtml(item.text) + "</span>";
          row.appendChild(text);
          return row;
        },
        onView
      )
    );

    detailsNode.appendChild(
      createComparisonSection(
        "Removed",
        "removed",
        comparison.removed,
        function (item) {
          const row = document.createElement("li");
          const text = document.createElement("p");
          row.className = "review-diff-item";
          text.className = "review-diff-content review-diff-content--removed";
          text.innerHTML = '<span class="review-diff-token review-diff-token--removed">' + escapeHtml(item.text) + "</span>";
          row.appendChild(text);
          return row;
        },
        onView
      )
    );

    detailsNode.appendChild(
      createComparisonSection(
        "Modified",
        "modified",
        comparison.modified,
        function (item) {
          const row = document.createElement("li");
          const before = document.createElement("p");
          const after = document.createElement("p");

          row.className = "review-diff-item review-diff-item--modified";

          before.className = "review-diff-line review-diff-line--before";
          before.innerHTML = "<strong>Before:</strong> " + item.diff.beforeHtml;

          after.className = "review-diff-line review-diff-line--after";
          after.innerHTML = "<strong>After:</strong> " + item.diff.afterHtml;

          row.appendChild(before);
          row.appendChild(after);

          return row;
        },
        onView
      )
    );
  }

  function updateComparisonSummary(summaryNode, detailsNode, originalHtml, currentHtml, onComparisonView) {
    const originalWords = countWords(getPlainText(originalHtml));
    const currentWords = countWords(getPlainText(currentHtml));
    const comparison = buildComparison(originalHtml, currentHtml);
    const sectionDelta =
      comparison.added.length +
      comparison.removed.length +
      comparison.modified.length;
    const delta = currentWords - originalWords;
    const deltaLabel = delta === 0 ? "no word change" : (delta > 0 ? "+" : "") + delta + " words";

    summaryNode.innerHTML =
      '<div class="review-metric"><strong>Original</strong><span>' +
      originalWords +
      ' words</span></div>' +
      '<div class="review-metric"><strong>Edited</strong><span>' +
      currentWords +
      ' words</span></div>' +
      '<div class="review-metric"><strong>Delta</strong><span>' +
      deltaLabel +
      '</span></div>' +
      '<div class="review-metric"><strong>Changed Sections</strong><span>' +
      sectionDelta +
      '</span></div>';

    if (detailsNode) {
      renderComparisonDetails(detailsNode, comparison, onComparisonView);
    }
  }

  function saveAutosave(keys, quill) {
    const snapshot = snapshotEditor(quill, "Autosaved draft", "autosave");
    localStorage.setItem(
      keys.autosave,
      JSON.stringify(snapshot)
    );
    return snapshot;
  }

  function loadAutosave(keys) {
    return safeParseJSON(localStorage.getItem(keys.autosave), null);
  }

  function applySnapshot(quill, snapshot) {
    if (!snapshot || !snapshot.html) {
      return;
    }

    quill.setContents(quill.clipboard.convert(snapshot.html || ""));
    quill.history.clear();
  }

  function syncEditorState(ui, quill, keys, originalHtml, historyKey) {
    const currentHtml = quill.root.innerHTML;
    const previewMarkdown = getPreviewMarkdown(currentHtml);
    const versions = getVersionHistory(keys.versions);
    const allSuggestions = collectAiSuggestions(quill.root);
    const dismissedIds = getDismissedSuggestions(keys.dismissedSuggestions);
    const suggestions = allSuggestions.filter(function (suggestion) {
      return dismissedIds.indexOf(suggestion.id) === -1;
    });
    const headingNavigatorData = collectHeadingNavigatorData(quill.root);
    const imageAltData = collectImageAltData(quill.root);
    const documentStatus = getDocumentStatus(keys);
    const commitId = localStorage.getItem(keys.commitId) || "";
    const ciStage = localStorage.getItem(keys.ciStage) || "";

    renderStats(ui, currentHtml);
    renderDocumentWorkflow(ui, documentStatus, commitId, ciStage);
    renderPreview(ui.markdownPreview, previewMarkdown);
    renderRenderedPreview(ui.renderedPreview, currentHtml);
    renderIssues(ui.styleChecks, collectStyleGuideIssues(quill.root));
    renderHeadingNavigator(
      ui.headingNavigator,
      ui.headingIssues,
      headingNavigatorData,
      function (heading) {
        const headingNodes = quill.root.querySelectorAll("h1, h2, h3");
        const targetHeading = headingNodes[heading.index];

        if (!targetHeading) {
          return;
        }

        targetHeading.classList.add("review-suggestion-target");
        targetHeading.scrollIntoView({ behavior: "smooth", block: "center" });

        window.setTimeout(function () {
          targetHeading.classList.remove("review-suggestion-target");
        }, 1200);

        saveHistory(
          historyKey,
          createAuditEntry(
            "heading-navigated",
            "Jumped to H" + heading.level + ": " + heading.text
          )
        );
        renderHistory(historyKey, ui.historyList);
      }
    );
    renderImageAltManager(ui.imageAltManager, imageAltData, {
      onUpdate: function (imageItem, altText) {
        const imageNodes = quill.root.querySelectorAll("img");
        const targetImage = imageNodes[imageItem.index];

        if (!targetImage) {
          showWarning("Could not find that image in the editor.");
          return;
        }

        const trimmedAlt = (altText || "").trim();

        targetImage.setAttribute("alt", trimmedAlt);
        targetImage.setAttribute("title", trimmedAlt);
        quill.update("user");

        clearDismissedSuggestion(
          keys.dismissedSuggestions,
          "missing-alt-" + imageItem.index
        );

        saveHistory(
          historyKey,
          createAuditEntry(
            "alt-text-updated",
            "Image " + (imageItem.index + 1) + " alt text updated"
          )
        );
        renderHistory(historyKey, ui.historyList);
        syncEditorState(ui, quill, keys, originalHtml, historyKey);
        showSuccess("Image alt text updated.");
      }
    });
    renderAiSuggestions(ui.aiSuggestions, suggestions, {
      onAccept: function (suggestion) {
        if (suggestion.safeFix === "adjust-heading-level") {
          const appliedHeadingFix = applyHeadingLevelFix(quill, suggestion);

          if (appliedHeadingFix) {
            clearDismissedSuggestion(keys.dismissedSuggestions, suggestion.id);
            saveHistory(
              historyKey,
              createAuditEntry(
                "suggestion-applied",
                suggestion.title + " applied safely"
              )
            );
            renderHistory(historyKey, ui.historyList);
            syncEditorState(ui, quill, keys, originalHtml, historyKey);
            showSuccess("Suggestion applied safely.");
            return;
          }
        }

        if (suggestion.type === "accessibility") {
          const imageNodes = quill.root.querySelectorAll("img");
          const targetImage = imageNodes[suggestion.target.index];

          if (targetImage) {
            showAlert({
              title: "Add image alt text",
              input: "text",
              inputLabel: "Describe the image for screen readers",
              inputValue: targetImage.getAttribute("alt") || "",
              inputPlaceholder: "Add a concise alt description",
              showCancelButton: true,
              confirmButtonText: "Apply",
              cancelButtonText: "Cancel",
              confirmButtonColor: "#3085d6",
              cancelButtonColor: "#6c757d"
            }).then(function (result) {
              if (!result.isConfirmed) {
                return;
              }

              targetImage.setAttribute("alt", (result.value || "").trim());
              targetImage.setAttribute("title", (result.value || "").trim());
              quill.update("user");
              clearDismissedSuggestion(keys.dismissedSuggestions, suggestion.id);

              saveHistory(
                historyKey,
                createAuditEntry(
                  "suggestion-applied",
                  suggestion.title + " applied safely"
                )
              );
              renderHistory(historyKey, ui.historyList);
              syncEditorState(ui, quill, keys, originalHtml, historyKey);
            });
            return;
          }
        }

        flashSuggestionTarget(quill.root, suggestion);
        saveHistory(
          historyKey,
          createAuditEntry(
            "suggestion-highlighted",
            suggestion.title + " requires manual editing"
          )
        );
        renderHistory(historyKey, ui.historyList);
        showSuccess("Suggestion highlighted for manual editor decision.");
      },
      onReject: function (suggestion) {
        dismissSuggestion(keys.dismissedSuggestions, suggestion.id);
        saveHistory(
          historyKey,
          createAuditEntry(
            "suggestion-dismissed",
            suggestion.title
          )
        );
        renderHistory(historyKey, ui.historyList);
        syncEditorState(ui, quill, keys, originalHtml, historyKey);
        showWarning("Suggestion dismissed.");
      }
    });
    ui.comparisonViewLog = ui.comparisonViewLog || {};
    updateComparisonSummary(
      ui.comparisonSummary,
      ui.comparisonDetails,
      originalHtml,
      currentHtml,
      function (sectionName, changeCount) {
        const sectionKey = sectionName.toLowerCase();

        if (ui.comparisonViewLog[sectionKey]) {
          return;
        }

        ui.comparisonViewLog[sectionKey] = true;
        saveHistory(
          historyKey,
          createAuditEntry(
            "comparison-viewed",
            sectionName + " section opened (" + changeCount + " changes)"
          )
        );
        renderHistory(historyKey, ui.historyList);
      }
    );
    renderVersionHistory(ui.versionsList, versions, function (version) {
      applySnapshot(quill, version);
      saveHistory(
        keys.history,
        createAuditEntry("version-restored", version.label)
      );
      renderHistory(keys.history, ui.historyList);
      syncEditorState(
        ui,
        quill,
        keys,
        originalHtml,
        historyKey
      );
      if (ui.beforeUnloadToggle) {
        ui.beforeUnloadToggle(false);
      }
      setSaveStatus(ui, SAVE_STATUS.SAVED, {
        historyKey: historyKey,
        historyList: ui.historyList
      });
    });
  }

  function storeVersionSnapshot(keys, quill, label, kind) {
    const snapshot = snapshotEditor(quill, label, kind);

    saveVersionHistory(keys.versions, snapshot);
    localStorage.setItem(
      keys.autosave,
      JSON.stringify(snapshot)
    );

    return snapshot;
  }

  function init() {
    const params = new URLSearchParams(
      window.location.search
    );

    const mode = params.get("mode");
    const docKey = getDocKey();
    const keys = getStorageKeys(docKey);
    const contentRoot = getContentRoot();

    if (!contentRoot) {
      return;
    }

    const publishedContent = localStorage.getItem(keys.publishedContent);
    const isPublished = localStorage.getItem(keys.published) === "true";

    if (
      isPublished &&
      publishedContent &&
      mode !== "draft" &&
      mode !== "review"
    ) {
      contentRoot.innerHTML = publishedContent;
      return;
    }

    if (
      mode !== "draft" &&
      mode !== "review"
    ) {
      return;
    }

    if (!localStorage.getItem(keys.original)) {
      localStorage.setItem(
        keys.original,
        contentRoot.innerHTML
      );
    }

    const historyKey = keys.history;
    const title =
      document.querySelector("h1")
        ? document.querySelector("h1").innerText.trim()
        : "Documentation";

    saveHistory(
      historyKey,
      createAuditEntry("draft-opened", title)
    );

    createBanner(contentRoot);

    const initialHtml = localStorage.getItem(keys.draftContent) || contentRoot.innerHTML;
    contentRoot.classList.add("review-editable-page");
    contentRoot.setAttribute("hidden", "hidden");

    const ui = createReviewWorkspace(contentRoot);
    renderHistory(historyKey, ui.historyList);

    Promise.all([
      loadQuillAssets(),
      loadMarkdownAssets()
    ])
      .then(function () {
        const quill = createQuillEditor(
          ui,
          initialHtml
        );
        const autosave = loadAutosave(keys);
        let editTimer = null;
        let autosaveTimer = null;
        let hasUnsavedChanges = false;

        function handleBeforeUnload(event) {
          if (!hasUnsavedChanges) {
            return;
          }

          event.preventDefault();
          event.returnValue = "You have unsaved changes.";
          return event.returnValue;
        }

        function toggleBeforeUnload(enable) {
          if (enable === hasUnsavedChanges) {
            return;
          }

          hasUnsavedChanges = enable;

          if (enable) {
            window.addEventListener("beforeunload", handleBeforeUnload);
            return;
          }

          window.removeEventListener("beforeunload", handleBeforeUnload);
        }

        ui.beforeUnloadToggle = toggleBeforeUnload;
        ui.saveState = {
          state: SAVE_STATUS.SAVED,
          lastSavedAt: null,
          lastAutosaveAt: autosave && autosave.timestamp ? autosave.timestamp : null
        };

        if (autosave && autosave.html) {
          applySnapshot(quill, autosave);
          setSaveStatus(ui, SAVE_STATUS.AUTOSAVED, {
            historyKey: historyKey,
            historyList: ui.historyList,
            lastAutosaveAt: autosave.timestamp,
            log: false
          });
        }

        setSaveStatus(ui, SAVE_STATUS.SAVED, {
          historyKey: historyKey,
          historyList: ui.historyList,
          log: false
        });

        syncEditorState(ui, quill, keys, initialHtml, historyKey);
        setPreviewMode(ui, "markdown");

        ui.previewMarkdownButton.addEventListener("click", function () {
          setPreviewMode(ui, "markdown");
        });

        ui.previewRenderedButton.addEventListener("click", function () {
          const previousMode = ui.previewMode;

          setPreviewMode(ui, "rendered");

          if (previousMode !== "rendered") {
            saveHistory(
              historyKey,
              createAuditEntry(
                "preview-opened",
                "Rendered preview opened"
              )
            );
            renderHistory(historyKey, ui.historyList);
          }
        });

        ui.copyMarkdownButton.addEventListener("click", function () {
          const markdown = getPreviewMarkdown(quill.root.innerHTML) || "";

          copyTextToClipboard(markdown)
            .then(function () {
              const originalText = ui.copyMarkdownButton.textContent;

              ui.copyMarkdownButton.textContent = "Copied";
              ui.copyMarkdownButton.classList.add("is-success");
              window.setTimeout(function () {
                ui.copyMarkdownButton.textContent = originalText;
                ui.copyMarkdownButton.classList.remove("is-success");
              }, 1400);

              saveHistory(
                historyKey,
                createAuditEntry(
                  "markdown-copied",
                  "Markdown copied from preview"
                )
              );
              renderHistory(historyKey, ui.historyList);
              showSuccess("Markdown copied.");
            })
            .catch(function () {
              showError("Unable to copy Markdown. Please copy manually.");
            });
        });

        ui.restoreOriginalButton.addEventListener("click", function () {
          applySnapshot(quill, {
            html: initialHtml
          });
          saveHistory(
            historyKey,
            createAuditEntry(
              "original-restored",
              "Original draft restored"
            )
          );
          renderHistory(historyKey, ui.historyList);
          storeVersionSnapshot(
            keys,
            quill,
            "Original draft restored",
            "restore"
          );
          toggleBeforeUnload(false);
          setSaveStatus(ui, SAVE_STATUS.SAVED, {
            historyKey: historyKey,
            historyList: ui.historyList
          });
          syncEditorState(ui, quill, keys, initialHtml, historyKey);
        });

        ui.restoreAutosaveButton.addEventListener("click", function () {
          const latestAutosave = loadAutosave(keys);

          if (!latestAutosave || !latestAutosave.html) {
            showWarning("No autosave is available yet.");
            return;
          }

          applySnapshot(quill, latestAutosave);
          saveHistory(
            historyKey,
            createAuditEntry(
              "autosave-restored",
              "Latest autosave restored"
            )
          );
          renderHistory(historyKey, ui.historyList);
          storeVersionSnapshot(
            keys,
            quill,
            "Restored autosave",
            "restore"
          );
          toggleBeforeUnload(false);
          setSaveStatus(ui, SAVE_STATUS.SAVED, {
            historyKey: historyKey,
            historyList: ui.historyList
          });
          syncEditorState(ui, quill, keys, initialHtml, historyKey);
        });

        quill.on("text-change", function (delta, oldDelta, source) {
          if (source !== "user") {
            return;
          }

          clearTimeout(editTimer);
          clearTimeout(autosaveTimer);
          toggleBeforeUnload(true);
          setSaveStatus(ui, SAVE_STATUS.UNSAVED, {
            historyKey: historyKey,
            historyList: ui.historyList
          });

          editTimer = setTimeout(function () {
            saveHistory(
              historyKey,
              createAuditEntry(
                "content-edited",
                "Human edited documentation"
              )
            );

            renderHistory(historyKey, ui.historyList);

            syncEditorState(ui, quill, keys, initialHtml, historyKey);
          }, 700);

          autosaveTimer = setTimeout(function () {
            const snapshot = saveAutosave(keys, quill);
            storeVersionSnapshot(
              keys,
              quill,
              "Autosaved " + formatTimestamp(snapshot.timestamp),
              "autosave"
            );
            setSaveStatus(ui, SAVE_STATUS.AUTOSAVED, {
              historyKey: historyKey,
              historyList: ui.historyList,
              lastAutosaveAt: snapshot.timestamp
            });
            syncEditorState(ui, quill, keys, initialHtml, historyKey);
          }, AUTOSAVE_DELAY);
        });

        ui.saveButton.addEventListener("click", function () {
          setSaveStatus(ui, SAVE_STATUS.SAVING, {
            historyKey: historyKey,
            historyList: ui.historyList
          });
          const currentHtml = quill.root.innerHTML;

          localStorage.setItem(keys.review, "completed");
          localStorage.setItem(keys.draftContent, currentHtml);

          saveHistory(
            historyKey,
            createAuditEntry(
              "review-saved",
              "Draft saved in review workspace",
              "Human",
              DOCUMENT_STATUS.DRAFT
            )
          );

          storeVersionSnapshot(
            keys,
            quill,
            "Review saved " + formatTimestamp(Date.now()),
            "save"
          );

          renderHistory(historyKey, ui.historyList);
          toggleBeforeUnload(false);
          setSaveStatus(ui, SAVE_STATUS.SAVED, {
            historyKey: historyKey,
            historyList: ui.historyList,
            lastSavedAt: Date.now()
          });
          syncEditorState(ui, quill, keys, initialHtml, historyKey);
          showSuccess("Review saved successfully.");
        });

        ui.publishButton.addEventListener("click", function () {
          const status = getDocumentStatus(keys);

          if (status === DOCUMENT_STATUS.IN_REVIEW) {
            showWarning("This document is already in review.");
            return;
          }

          showConfirm(
            "Submit for Review",
            "Send this documentation for human approval?",
            "Submit"
          ).then(function (result) {
            if (!result.isConfirmed) {
              return;
            }

            localStorage.setItem(keys.published, "false");
            localStorage.setItem(keys.draftContent, quill.root.innerHTML);
            localStorage.removeItem(keys.commitId);
            localStorage.removeItem(keys.ciStage);
            setDocumentStatus(keys, DOCUMENT_STATUS.IN_REVIEW);

            saveHistory(
              historyKey,
              createAuditEntry(
                "review-submitted",
                "Documentation submitted for review"
              )
            );

            renderHistory(historyKey, ui.historyList);
            syncEditorState(ui, quill, keys, initialHtml, historyKey);
            showSuccess("Submitted for review.");
          });
        });

        ui.approveButton.addEventListener("click", function () {
          if (getDocumentStatus(keys) !== DOCUMENT_STATUS.IN_REVIEW) {
            showWarning("Submit for review before approval.");
            return;
          }

          setDocumentStatus(keys, DOCUMENT_STATUS.APPROVED);
          localStorage.setItem(keys.draftContent, quill.root.innerHTML);
          saveHistory(
            historyKey,
            createAuditEntry(
              "review-approved",
              "Documentation approved"
            )
          );
          renderHistory(historyKey, ui.historyList);
          syncEditorState(ui, quill, keys, initialHtml, historyKey);
          showSuccess("Documentation approved.");
        });

        ui.rejectButton.addEventListener("click", function () {
          if (getDocumentStatus(keys) !== DOCUMENT_STATUS.IN_REVIEW) {
            showWarning("Only in-review documents can be rejected.");
            return;
          }

          showConfirm(
            "Reject Documentation",
            "Reject and move this document back to Draft status?",
            "Reject"
          ).then(function (result) {
            if (!result.isConfirmed) {
              return;
            }

            localStorage.removeItem(keys.commitId);
            localStorage.removeItem(keys.ciStage);
            localStorage.setItem(keys.published, "false");
            setDocumentStatus(keys, DOCUMENT_STATUS.DRAFT);

            saveHistory(
              historyKey,
              createAuditEntry(
                "review-rejected",
                "Documentation rejected and returned to draft"
              )
            );

            renderHistory(historyKey, ui.historyList);
            syncEditorState(ui, quill, keys, initialHtml, historyKey);
            showWarning("Documentation rejected.");
          });
        });

        ui.commitButton.addEventListener("click", function () {
          if (getDocumentStatus(keys) !== DOCUMENT_STATUS.APPROVED) {
            showWarning("Approve the document before committing.");
            return;
          }

          const commitId = generateFakeCommitId();
          const currentHtml = quill.root.innerHTML;

          localStorage.setItem(keys.commitId, commitId);
          localStorage.setItem(keys.ciStage, "Commit");
          localStorage.setItem(keys.review, "completed");
          localStorage.setItem(keys.draftContent, currentHtml);

          saveHistory(
            historyKey,
            createAuditEntry(
              "commit-created",
              "Documentation commit created: " + commitId
            )
          );
          saveHistory(
            historyKey,
            createAuditEntry(
              "ci-commit",
              "CI commit stage completed"
            )
          );

          renderHistory(historyKey, ui.historyList);
          syncEditorState(ui, quill, keys, initialHtml, historyKey);
          runCiPipeline(ui, keys, quill, initialHtml, historyKey);
          storeVersionSnapshot(
            keys,
            quill,
            "Committed " + formatTimestamp(Date.now()),
            "publish"
          );
        });
      })
      .catch(function () {
        contentRoot.removeAttribute("hidden");
        ui.wrapper.remove();
        showError(
          "Unable to load Quill editor. Please check network access and reload the page."
        );
      });
  }

  window.addEventListener("load", init);
})();