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

  function showConfirm(title, message) {
    return showAlert({
      title: title,
      text: message,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Publish",
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
      review: docKey + ":review",
      published: docKey + ":published",
      publishedContent: docKey + ":publishedContent",
      history: docKey + ":history",
      autosave: docKey + ":autosave",
      versions: docKey + ":versions"
    };
  }

  function createAuditEntry(action, details) {
    return {
      action: action,
      details: details,
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

  function renderStats(statsNodes, html, statusLabel) {
    const wordCount = countWords(getPlainText(html));

    statsNodes.wordCount.textContent = wordCount + (wordCount === 1 ? " word" : " words");
    statsNodes.readingTime.textContent = formatReadingTime(wordCount);
    statsNodes.draftStatus.textContent = statusLabel || "Draft";
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
          summary:
            "Heading order skips from H" +
            lastHeadingLevel +
            " to H" +
            level +
            ".",
          action: "Change this heading to H" + (lastHeadingLevel + 1) + " or add an intermediate heading.",
          target: {
            group: "heading",
            index: index
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
          summary: "Paragraph " + (index + 1) + " is long and harder to scan.",
          action: "Break this paragraph into shorter chunks (2-4 sentences).",
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
          summary:
            'Paragraph ' +
            (index + 1) +
            ' uses "' +
            weakMatch[0] +
            '", which can weaken clarity.',
          action: "Replace it with specific, direct wording.",
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
          summary: "Image " + (index + 1) + " is missing alt text.",
          action: "Add concise alt text that describes the image purpose.",
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
      const body = document.createElement("p");
      const action = document.createElement("p");
      const controls = document.createElement("div");
      const acceptButton = document.createElement("button");
      const rejectButton = document.createElement("button");
      const title = document.createElement("strong");
      const tag = document.createElement("span");

      item.className = "review-suggestion-card";
      head.className = "review-suggestion-head";
      body.className = "review-suggestion-summary";
      action.className = "review-suggestion-action";
      controls.className = "review-suggestion-controls";
      tag.className = getSuggestionBadgeClass(suggestion.type);

      tag.textContent = suggestion.type;
      title.textContent = suggestion.title;
      body.textContent = suggestion.summary;
      action.textContent = "Action: " + suggestion.action;

      acceptButton.type = "button";
      acceptButton.className = "review-suggestion-accept";
      acceptButton.textContent = "Accept";
      acceptButton.addEventListener("click", function () {
        handlers.onAccept(suggestion);
      });

      rejectButton.type = "button";
      rejectButton.className = "review-suggestion-reject";
      rejectButton.textContent = "Reject";
      rejectButton.addEventListener("click", function () {
        handlers.onReject(suggestion);
      });

      head.appendChild(title);
      head.appendChild(tag);
      controls.appendChild(acceptButton);
      controls.appendChild(rejectButton);
      item.appendChild(head);
      item.appendChild(body);
      item.appendChild(action);
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
          <span id="review-draft-status" class="review-chip review-chip--primary">Draft</span>
          <span id="review-autosave-status" class="review-chip review-chip--muted">Autosave idle</span>
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
              <button id="review-publish">Approve & Publish</button>
            </div>
          </div>
        </section>

        <aside class="review-side-column">
          <section class="review-panel review-panel--stacked">
            <div class="review-panel-heading">
              <h3>Markdown Preview</h3>
              <p>Live Markdown generated from the current editor content.</p>
            </div>
            <pre id="review-markdown-preview" class="review-markdown-preview"></pre>
          </section>

          <section class="review-panel review-panel--stacked">
            <div class="review-panel-heading">
              <h3>Original vs Edited</h3>
              <p>Compare the AI draft against the human-edited version.</p>
            </div>
            <div id="review-comparison-summary" class="review-comparison-summary"></div>
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
      restoreOriginalButton: wrapper.querySelector("#review-restore-original"),
      restoreAutosaveButton: wrapper.querySelector("#review-restore-autosave"),
      toolbar: wrapper.querySelector("#review-editor-toolbar"),
      editor: wrapper.querySelector("#review-quill-editor"),
      draftStatus: wrapper.querySelector("#review-draft-status"),
      autosaveStatus: wrapper.querySelector("#review-autosave-status"),
      wordCount: wrapper.querySelector("#review-word-count"),
      readingTime: wrapper.querySelector("#review-reading-time"),
      markdownPreview: wrapper.querySelector("#review-markdown-preview"),
      comparisonSummary: wrapper.querySelector("#review-comparison-summary"),
      styleChecks: wrapper.querySelector("#review-style-checks"),
      aiSuggestions: wrapper.querySelector("#review-ai-suggestions"),
      versionsList: wrapper.querySelector("#review-versions")
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
      li.textContent =
        item.timestamp +
        " - " +
        item.action +
        " - " +
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

  function updateComparisonSummary(summaryNode, originalHtml, currentHtml) {
    const originalWords = countWords(getPlainText(originalHtml));
    const currentWords = countWords(getPlainText(currentHtml));
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
      '</span></div>';
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

  function syncEditorState(ui, quill, keys, originalHtml, historyKey, pendingAutosaveLabel, statusLabel) {
    const currentHtml = quill.root.innerHTML;
    const previewMarkdown = getPreviewMarkdown(currentHtml);
    const versions = getVersionHistory(keys.versions);
    const suggestions = collectAiSuggestions(quill.root);

    renderStats(ui, currentHtml, statusLabel);
    renderPreview(ui.markdownPreview, previewMarkdown);
    renderIssues(ui.styleChecks, collectStyleGuideIssues(quill.root));
    renderAiSuggestions(ui.aiSuggestions, suggestions, {
      onAccept: function (suggestion) {
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

              saveHistory(
                historyKey,
                createAuditEntry(
                  "suggestion-accepted",
                  suggestion.title + " applied"
                )
              );
              renderHistory(historyKey, ui.historyList);
              syncEditorState(ui, quill, keys, originalHtml, historyKey, "Suggestion applied", "Draft");
            });
            return;
          }
        }

        flashSuggestionTarget(quill.root, suggestion);
        saveHistory(
          historyKey,
          createAuditEntry(
            "suggestion-accepted",
            suggestion.title
          )
        );
        renderHistory(historyKey, ui.historyList);
        showSuccess("Suggestion accepted. Update highlighted content.");
      },
      onReject: function (suggestion) {
        saveHistory(
          historyKey,
          createAuditEntry(
            "suggestion-rejected",
            suggestion.title
          )
        );
        renderHistory(historyKey, ui.historyList);
        showWarning("Suggestion rejected.");
      }
    });
    updateComparisonSummary(ui.comparisonSummary, originalHtml, currentHtml);
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
        historyKey,
        "Version restored",
        statusLabel || "Draft"
      );
      ui.autosaveStatus.textContent = version.label + " restored";
    });

    if (pendingAutosaveLabel) {
      ui.autosaveStatus.textContent = pendingAutosaveLabel;
    }
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

    const publishedContent = localStorage.getItem(
      keys.publishedContent
    );

    if (
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

    const initialHtml = contentRoot.innerHTML;
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

        if (autosave && autosave.html) {
          applySnapshot(quill, autosave);
          ui.autosaveStatus.textContent =
            "Recovered autosave from " + formatTimestamp(autosave.timestamp);
        }

        syncEditorState(ui, quill, keys, initialHtml, historyKey);

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
          syncEditorState(ui, quill, keys, initialHtml, historyKey, "Original draft restored", "Draft");
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
          syncEditorState(ui, quill, keys, initialHtml, historyKey, "Latest autosave restored", "Draft");
        });

        quill.on("text-change", function (delta, oldDelta, source) {
          if (source !== "user") {
            return;
          }

          clearTimeout(editTimer);
          clearTimeout(autosaveTimer);

          editTimer = setTimeout(function () {
            saveHistory(
              historyKey,
              createAuditEntry(
                "content-edited",
                "Human edited documentation"
              )
            );

            renderHistory(historyKey, ui.historyList);

            syncEditorState(ui, quill, keys, initialHtml, historyKey, "Draft updated", "Draft");
          }, 700);

          autosaveTimer = setTimeout(function () {
            const snapshot = saveAutosave(keys, quill);
            storeVersionSnapshot(
              keys,
              quill,
              "Autosaved " + formatTimestamp(snapshot.timestamp),
              "autosave"
            );
            ui.autosaveStatus.textContent =
              "Autosaved at " + formatTimestamp(snapshot.timestamp);
            syncEditorState(ui, quill, keys, initialHtml, historyKey, "Autosaved at " + formatTimestamp(snapshot.timestamp), "Draft");
          }, AUTOSAVE_DELAY);
        });

        ui.saveButton.addEventListener("click", function () {
          const currentHtml = quill.root.innerHTML;

          localStorage.setItem(keys.review, "completed");
          localStorage.setItem(
            keys.publishedContent,
            currentHtml
          );

          saveHistory(
            historyKey,
            createAuditEntry(
              "review-saved",
              "Human review completed"
            )
          );

          storeVersionSnapshot(
            keys,
            quill,
            "Review saved " + formatTimestamp(Date.now()),
            "save"
          );

          renderHistory(historyKey, ui.historyList);
          syncEditorState(ui, quill, keys, initialHtml, historyKey, "Review saved", "Draft");
          showSuccess("Review saved successfully.");
        });

        ui.publishButton.addEventListener("click", function () {
          showConfirm(
            "Approve & Publish",
            "Are you sure you want to publish this documentation?"
          ).then(function (result) {
            if (!result.isConfirmed) {
              return;
            }

            const currentHtml = quill.root.innerHTML;

            localStorage.setItem(keys.published, "true");
            localStorage.setItem(
              keys.publishedContent,
              currentHtml
            );

            saveHistory(
              historyKey,
              createAuditEntry(
                "published",
                "Documentation approved"
              )
            );

            storeVersionSnapshot(
              keys,
              quill,
              "Published " + formatTimestamp(Date.now()),
              "publish"
            );

            renderHistory(historyKey, ui.historyList);
            syncEditorState(ui, quill, keys, initialHtml, historyKey, "Published", "Published");
            showSuccess(
              "The documentation has been published successfully."
            );
          });
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