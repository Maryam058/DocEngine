(function () {
  "use strict";

  function getDocKey() {
    const path =
      (window.location.pathname || "/")
        .replace(/\/+$/, "") || "/";

    return "doc-authoring:" + path;
  }

  function createAuditEntry(action, details) {
    return {
      action: action,
      details: details,
      timestamp: new Date().toLocaleString()
    };
  }

  function getHistory(key) {
    return JSON.parse(
      localStorage.getItem(key) || "[]"
    );
  }

  function saveHistory(key, entry) {

    const history = getHistory(key);

    history.unshift(entry);

    localStorage.setItem(
      key,
      JSON.stringify(history)
    );

  }

  function enableEditing(contentRoot) {

    contentRoot.contentEditable = "true";
    contentRoot.spellcheck = true;

    contentRoot.classList.add(
      "review-editable-page"
    );

    contentRoot
      .querySelectorAll("img")
      .forEach(function (img) {

        img.draggable = false;

      });

  }

  function init() {

    const params =
      new URLSearchParams(
        window.location.search
      );

    const mode =
      params.get("mode");

    const docKey =
      getDocKey();

    const published =
      localStorage.getItem(
        docKey + ":publishedContent"
      );
          const contentRoot =
      document.querySelector(".md-content__inner") ||
      document.querySelector(".md-content") ||
      document.querySelector("article");

    if (!contentRoot) {
      return;
    }

    // Show published version on normal page
    if (
      published &&
      mode !== "draft" &&
      mode !== "review"
    ) {
      contentRoot.innerHTML = published;
      return;
    }

    // Normal page (not draft/review)
    if (
      mode !== "draft" &&
      mode !== "review"
    ) {
      return;
    }

    enableEditing(contentRoot);

    if (
      !localStorage.getItem(
        docKey + ":original"
      )
    ) {
      localStorage.setItem(
        docKey + ":original",
        contentRoot.innerHTML
      );
    }

    const historyKey =
      docKey + ":history";

    const title =
      document.querySelector("h1")
        ? document.querySelector("h1").innerText.trim()
        : "Documentation";

    saveHistory(
      historyKey,
      createAuditEntry(
        "draft-opened",
        title
      )
    );
        // Banner
    const banner =
      document.createElement("div");

    banner.className =
      "review-banner";

    banner.innerHTML = `
      <strong>AI Draft Mode</strong><br>
      This page is editable. Review AI-generated documentation before publishing.
    `;

    contentRoot.parentNode.insertBefore(
      banner,
      contentRoot
    );

    // Review Panel
    const reviewPanel =
      document.createElement("div");

    reviewPanel.className =
      "review-workspace";

    reviewPanel.innerHTML = `
      <div class="review-panel">

        <h2>Human Editorial Review</h2>

        <p>
          Review the AI draft before approving it.
        </p>

        <div class="review-actions">

          <button id="review-save">
            Save Review
          </button>

          <button id="review-publish">
            Approve & Publish
          </button>
          
        </div>

        <h3>Edit Trail</h3>

        <ul id="review-history"></ul>

      </div>
    `;

    contentRoot.insertAdjacentElement(
      "afterend",
      reviewPanel
    );

    const historyList =
      reviewPanel.querySelector(
        "#review-history"
      );
          function renderHistory() {

      const history =
        getHistory(historyKey);

      historyList.innerHTML = "";

      if (history.length === 0) {

        const li =
          document.createElement("li");

        li.textContent =
          "No review activity yet.";

        historyList.appendChild(li);

        return;
      }

      history.forEach(function (item) {

        const li =
          document.createElement("li");

        li.textContent =
          item.timestamp +
          " — " +
          item.action +
          " — " +
          item.details;

        historyList.appendChild(li);

      });

    }

    renderHistory();

    contentRoot.addEventListener(
      "input",
      function () {

        saveHistory(
          historyKey,
          createAuditEntry(
            "content-edited",
            "Human edited documentation"
          )
        );

        renderHistory();

      }
    );
        reviewPanel
      .querySelector("#review-save")
      .addEventListener(
        "click",
        function () {

          localStorage.setItem(
            docKey + ":review",
            "completed"
          );

          saveHistory(
            historyKey,
            createAuditEntry(
              "review-saved",
              "Human review completed"
            )
          );

          renderHistory();

          alert(
            "Review saved successfully."
          );

        }
      );

    reviewPanel
      .querySelector("#review-publish")
      .addEventListener(
        "click",
        function () {

          localStorage.setItem(
            docKey + ":published",
            "true"
          );

          // Save the published HTML
          localStorage.setItem(
            docKey + ":publishedContent",
            contentRoot.innerHTML
          );

          saveHistory(
            historyKey,
            createAuditEntry(
              "published",
              "Documentation approved"
            )
          );

          renderHistory();

          alert(
            "Documentation published successfully."
          );

        }
      );

  }

  window.addEventListener(
    "load",
    init
  );

})();