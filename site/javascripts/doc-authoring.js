(function () {
    "use strict";

    /* ======================================================
       DOCUMENT KEY
    ====================================================== */

    function getDocKey() {

        const path =
            (window.location.pathname || "/")
                .replace(/\/+$/, "") || "/";

        return "doc-authoring:" + path;

    }

    /* ======================================================
       STORAGE KEYS
    ====================================================== */

    function getStorageKeys(docKey) {

        return {

            original: docKey + ":original",

            published: docKey + ":published",

            publishedContent: docKey + ":publishedContent",

            reviewStatus: docKey + ":reviewStatus",

            history: docKey + ":history"

        };

    }

    /* ======================================================
       HISTORY
    ====================================================== */

    function getHistory(historyKey) {

        try {

            return JSON.parse(
                localStorage.getItem(historyKey) || "[]"
            );

        } catch (e) {

            return [];

        }

    }

    function saveHistory(historyKey, action, details) {

        const history =
            getHistory(historyKey);

        history.unshift({

            action,

            details,

            timestamp:
                new Date().toLocaleString()

        });

        /* Keep latest 100 records */

        if (history.length > 10) {

            history.length = 10;

        }

        localStorage.setItem(

            historyKey,

            JSON.stringify(history)

        );

    }

    /* ======================================================
       EDIT MODE
    ====================================================== */

    function enableEditing(contentRoot) {

        contentRoot.contentEditable = true;

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

    /* ======================================================
       DOM HELPERS
    ====================================================== */

    function createElement(tag, className) {

        const el =
            document.createElement(tag);

        if (className) {

            el.className = className;

        }

        return el;

    }

    function getContentRoot() {

        return (

            document.querySelector(".md-content__inner") ||

            document.querySelector(".md-content") ||

            document.querySelector("article")

        );

    }
        /* ======================================================
       REVIEW WORKSPACE
    ====================================================== */

    function createReviewWorkspace(contentRoot, historyKey) {

        const wrapper = createElement(
            "div",
            "review-workspace"
        );

        wrapper.innerHTML = `

            <div class="review-status-grid">

                <div class="review-status-card">
                    <strong>Status</strong>
                    <span id="review-status"
                          class="review-status-value">
                        Draft
                    </span>
                </div>

                <div class="review-status-card">
                    <strong>Reviewer</strong>
                    <span class="review-status-value">
                        Human
                    </span>
                </div>

                <div class="review-status-card">
                    <strong>Source</strong>
                    <span class="review-status-value">
                        AI Draft
                    </span>
                </div>

                <div class="review-status-card">
                    <strong>History</strong>
                    <span id="history-count"
                          class="review-status-value">
                        0
                    </span>
                </div>

            </div>

            <div class="review-panel">

                <h2>Human Editorial Review</h2>

                <p>
                    Review the AI-generated documentation,
                    make any required edits,
                    then approve and publish.
                </p>

                <div class="review-toolbar">

                    <button
                        id="review-save"
                        data-action="save">

                        💾 Save Review

                    </button>

                    <button
                        id="review-publish"
                        data-action="publish">

                        🚀 Approve & Publish

                    </button>

                </div>

                <h3>📝 Edit Trail</h3>

                <ul id="review-history"></ul>

            </div>

        `;

        contentRoot.insertAdjacentElement(
            "afterend",
            wrapper
        );

        return {

            wrapper,

            historyList:
                wrapper.querySelector(
                    "#review-history"
                ),

            historyCount:
                wrapper.querySelector(
                    "#history-count"
                ),

            status:
                wrapper.querySelector(
                    "#review-status"
                ),

            saveButton:
                wrapper.querySelector(
                    "#review-save"
                ),

            publishButton:
                wrapper.querySelector(
                    "#review-publish"
                )

        };

    }

    /* ======================================================
       HISTORY RENDER
    ====================================================== */

    function renderHistory(historyKey, ui) {

        const history =
            getHistory(historyKey);

        ui.historyList.innerHTML = "";

        ui.historyCount.textContent =
    Math.min(history.length,10);

        if (!history.length) {

            const li =
                document.createElement("li");

            li.textContent =
                "No review activity yet.";

            ui.historyList.appendChild(li);

            return;

        }

        history.forEach(function (item) {

            const li =
                document.createElement("li");

            li.innerHTML = `
              <div class="history-item">
              <div class="history-action">${item.action}</div>
              <div class="history-details">${item.details}</div>
              <div class="history-time">${item.timestamp}</div>
            </div>
          `;

            ui.historyList.appendChild(li);

        });

    }
        /* ======================================================
       SAVE / PUBLISH ACTIONS
    ====================================================== */

    function attachReviewActions(ui, contentRoot, keys) {

        let editTimer = null;

        /* ---------- Track edits ---------- */

        contentRoot.addEventListener("input", function () {

            clearTimeout(editTimer);

            editTimer = setTimeout(function () {

               const history = getHistory(keys.history);

const last = history[0];

if (
    !last ||
    last.action !== "Content Edited"
) {

     saveHistory(
        keys.history,
        "Content Edited",
        "Documentation updated by reviewer."
    );

      renderHistory(
        keys.history,
        ui
    );
}

            }, 800);

        });

        /* ---------- Save Review ---------- */

        ui.saveButton.addEventListener(
            "click",
            function () {

                localStorage.setItem(
                    keys.reviewStatus,
                    "Review Saved"
                );

                saveHistory(
                    keys.history,
                    "Review Saved",
                    "Human review completed."
                );

                ui.status.textContent =
                    "Review Saved";

                renderHistory(
                    keys.history,
                    ui
                );

                alert(
                    "✅ Review saved successfully."
                );

            }
        );

        /* ---------- Publish ---------- */

        ui.publishButton.addEventListener(
            "click",
            function () {

                localStorage.setItem(
                    keys.published,
                    "true"
                );

                localStorage.setItem(
                    keys.publishedContent,
                    contentRoot.innerHTML
                );

                localStorage.setItem(
                    keys.reviewStatus,
                    "Published"
                );

                saveHistory(
                    keys.history,
                    "Published",
                    "Documentation approved and published."
                );

                ui.status.textContent =
                    "Published";

                renderHistory(
                    keys.history,
                    ui
                );

                alert(
                    "🎉 Documentation published successfully."
                );

            }
        );

    }
        /* ======================================================
       INITIALIZATION
    ====================================================== */

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

        /* ---------- Show published version ---------- */

        const publishedContent =
            localStorage.getItem(
                keys.publishedContent
            );

        if (
            publishedContent &&
            mode !== "draft" &&
            mode !== "review"
        ) {

            contentRoot.innerHTML =
                publishedContent;

            return;

        }

        /* ---------- Normal page ---------- */

        if (
            mode !== "draft" &&
            mode !== "review"
        ) {

            return;

        }

        /* ---------- Enable Editing ---------- */

        enableEditing(contentRoot);

        if (
            !localStorage.getItem(
                keys.original
            )
        ) {

            localStorage.setItem(
                keys.original,
                contentRoot.innerHTML
            );

        }

        /* ---------- AI Banner ---------- */

        const banner =
            createElement(
                "div",
                "review-banner"
            );

        banner.innerHTML = `
            <strong>🤖 AI Draft Mode</strong><br>
            Review, edit and approve the AI-generated documentation before publishing.
        `;

        contentRoot.parentNode.insertBefore(
            banner,
            contentRoot
        );

        /* ---------- Create Workspace ---------- */

        const ui =
            createReviewWorkspace(
                contentRoot,
                keys.history
            );

        /* ---------- Load Existing Status ---------- */

        const status =
            localStorage.getItem(
                keys.reviewStatus
            );

        if (status) {

            ui.status.textContent =
                status;

        }

        /* ---------- First History ---------- */

        if (
            getHistory(keys.history).length === 0
        ) {

            saveHistory(
                keys.history,
                "Draft Opened",
                document.title
            );

        }

        renderHistory(
            keys.history,
            ui
        );

        attachReviewActions(
            ui,
            contentRoot,
            keys
        );

    }

    window.addEventListener(
        "load",
        init
    );

})();