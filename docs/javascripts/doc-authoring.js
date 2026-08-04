(function () {
  "use strict";

  const QUILL_CSS_URL =
    "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css";
  const QUILL_JS_URL =
    "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js";

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
      history: docKey + ":history"
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
      <div class="review-panel">
        <h2>Human Editorial Review</h2>

        <p>
          Review the AI draft before approving it.
        </p>

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

        <h3>Edit Trail</h3>
        <ul id="review-history"></ul>
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
      toolbar: wrapper.querySelector("#review-editor-toolbar"),
      editor: wrapper.querySelector("#review-quill-editor")
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

          quill.insertEmbed(
            index,
            "image",
            evt.target.result,
            "user"
          );

          quill.setSelection(index + 1, 0, "silent");
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

    loadQuillAssets()
      .then(function () {
        const quill = createQuillEditor(
          ui,
          initialHtml
        );

        let editTimer = null;

        quill.on("text-change", function (delta, oldDelta, source) {
          if (source !== "user") {
            return;
          }

          clearTimeout(editTimer);
          editTimer = setTimeout(function () {
            saveHistory(
              historyKey,
              createAuditEntry(
                "content-edited",
                "Human edited documentation"
              )
            );

            renderHistory(historyKey, ui.historyList);
          }, 700);
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

          renderHistory(historyKey, ui.historyList);
          alert("Review saved successfully.");
        });

        ui.publishButton.addEventListener("click", function () {
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

          renderHistory(historyKey, ui.historyList);
          alert("Documentation published successfully.");
        });
      })
      .catch(function () {
        contentRoot.removeAttribute("hidden");
        ui.wrapper.remove();
        alert(
          "Unable to load Quill editor. Please check network access and reload the page."
        );
      });
  }

  window.addEventListener("load", init);
})();