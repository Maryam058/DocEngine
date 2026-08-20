/* ==========================================================
   DocEngine Page Chrome

   Confluence-style page metadata, status badge, actions menu,
   version history, page assets, page information, copy link,
   markdown export, print support, and page feedback.

   This file is purely additive. It does not modify the
   AI Draft -> Human Edit -> Review -> Approve -> Publish
   workflow, the Quill editor, autosave, or version creation
   logic that already lives in doc-authoring.js. It reuses
   those globals directly (CONFIG, AppState, Storage, Time,
   DocumentStore, VersionManager, isHomePage,
   ensureEditPageButton) since classic <script> tags share one
   top-level scope, and doc-authoring.js loads first.

   Because the existing app freely replaces
   `.md-content__inner`'s innerHTML in several places (instant
   published content, live publish refresh, inline editor
   enter/exit), this module does not patch each of those call
   sites. Instead it watches the content root with a
   MutationObserver and rebuilds/repairs its own chrome
   idempotently whenever the content changes. It disconnects
   itself while making its own edits to avoid feedback loops.
========================================================== */

const FEEDBACK_STORAGE_KEY =
    "docengine_feedback";


const PageChrome = {

    contentRoot: null,

    observer: null,

    debounceHandle: null,

    activeAnchor: null,

    outsideClickHandler: null,


    /* ======================================================
       Init
    ====================================================== */

    init() {

        const contentRoot =
            document.querySelector(
                ".md-content__inner"
            );

        if (!contentRoot) {
            return;
        }

        this.contentRoot =
            contentRoot;

        this.seedAuthor();

        this.refresh();

        this.observer =
            new MutationObserver(() => {

                clearTimeout(
                    this.debounceHandle
                );

                this.debounceHandle =
                    setTimeout(
                        () => this.refresh(),
                        40
                    );

            });

        this.observer.observe(
            contentRoot,
            { childList: true }
        );

        document.addEventListener(
            "keydown",
            (event) => {

                if (event.key === "Escape") {
                    this.closeMenu();
                    this.closeModal();
                }

            }
        );

    },


    /* ======================================================
       Author Resolution

       Seeds the same localStorage key the inline editor
       already reads ("docengine_author") from the site's
       real mkdocs.yml `site_author`, exposed by
       overrides/main.html as window.DOCENGINE_SITE_AUTHOR.
    ====================================================== */

    seedAuthor() {

        if (
            !localStorage.getItem("docengine_author") &&
            window.DOCENGINE_SITE_AUTHOR
        ) {

            localStorage.setItem(
                "docengine_author",
                window.DOCENGINE_SITE_AUTHOR
            );

        }

    },


    getAuthor() {

        return (
            localStorage.getItem("docengine_author") ||
            window.DOCENGINE_SITE_AUTHOR ||
            "Unknown"
        );

    },


    /* ======================================================
       Refresh Chrome

       Safe to call any number of times. Rebuilds nothing
       that is already correct, and removes chrome entirely
       on the home page or while the inline editor is active.
    ====================================================== */

    refresh() {

        const contentRoot =
            document.querySelector(
                ".md-content__inner"
            );

        if (!contentRoot) {
            return;
        }

        this.contentRoot =
            contentRoot;

        if (this.observer) {
            this.observer.disconnect();
        }

        try {

            if (
                isHomePage() ||
                (
                    typeof AppState !== "undefined" &&
                    AppState.inlineMode
                )
            ) {

                /*
                 * ensureEditPageButton already removes any
                 * edit button on the home page. Our own
                 * chrome elements are removed here.
                 */

                ensureEditPageButton(
                    contentRoot
                );

                contentRoot
                    .querySelectorAll(
                        ".docengine-page-toolbar, .docengine-meta-bar, .docengine-feedback"
                    )
                    .forEach(element => element.remove());

                this.closeMenu();

                return;

            }

            ensureEditPageButton(
                contentRoot
            );

            this.buildToolbar(
                contentRoot
            );

            this.buildMetaBar(
                contentRoot
            );

            this.buildFeedback(
                contentRoot
            );

        } finally {

            if (this.observer) {

                this.observer.observe(
                    contentRoot,
                    { childList: true }
                );

            }

        }

    },


    /* ======================================================
       Toolbar (Edit Page + Actions Menu)
    ====================================================== */

    buildToolbar(contentRoot) {

        const editButton =
            contentRoot.querySelector(
                ".edit-page-button, .edit-btn"
            );

        if (!editButton) {
            return;
        }

        let toolbar =
            contentRoot.querySelector(
                ":scope > .docengine-page-toolbar"
            );

        if (!toolbar) {

            toolbar =
                document.createElement("div");

            toolbar.className =
                "docengine-page-toolbar";

        }

        contentRoot.prepend(
            toolbar
        );

        toolbar.appendChild(
            editButton
        );

        /*
         * The server-rendered ".doc-actions" wrapper (from
         * overrides/main.html) is only ever a single-use shell
         * around the edit button. Once the button is adopted
         * into our toolbar, drop the now-empty wrapper so it
         * does not leave stray blank space behind.
         */

        contentRoot
            .querySelectorAll(".doc-actions")
            .forEach(element => {

                if (!element.children.length) {
                    element.remove();
                }

            });

        let menuButton =
            toolbar.querySelector(
                ".docengine-menu-button"
            );

        if (!menuButton) {

            menuButton =
                document.createElement("button");

            menuButton.type =
                "button";

            menuButton.className =
                "docengine-menu-button";

            menuButton.setAttribute(
                "aria-label",
                "Page actions"
            );

            menuButton.setAttribute(
                "aria-haspopup",
                "true"
            );

            menuButton.setAttribute(
                "aria-expanded",
                "false"
            );

            menuButton.textContent =
                "⋮";

            menuButton.addEventListener(
                "click",
                (event) => {

                    event.preventDefault();
                    event.stopPropagation();

                    this.toggleMenu(
                        menuButton
                    );

                }
            );

        }

        toolbar.appendChild(
            menuButton
        );

    },


    /* ======================================================
       Metadata Bar (below the page title)
    ====================================================== */

    buildMetaBar(contentRoot) {

        let metaBar =
            contentRoot.querySelector(
                ".docengine-meta-bar"
            );

        if (!metaBar) {

            metaBar =
                document.createElement("div");

            metaBar.className =
                "docengine-meta-bar";

        }

        const page =
            window.location.pathname;

        const doc =
            DocumentStore.get(page);

        const badge =
            this.computeStatusBadge(
                doc,
                page
            );

        const author =
            this.getAuthor();

        let updatedText;
        let exactTimestamp =
            "";

        if (doc && doc.updatedAt) {

            const updatedDate =
                new Date(doc.updatedAt);

            updatedText =
                `Updated ${this.relativeTime(updatedDate)} by ${this.escape(author)}`;

            exactTimestamp =
                Time.format(updatedDate);

        } else {

            updatedText =
                "Live from the published site";

        }

        const version =
            doc && doc.version
                ? doc.version
                : 1;

        metaBar.innerHTML = `
            <span class="docengine-status-badge docengine-status-badge--${badge.tone}">${this.escape(badge.label)}</span>
            <span class="docengine-meta-text"${exactTimestamp ? ` title="${this.escape(exactTimestamp)}"` : ""}>${this.escape(updatedText)}</span>
            <span class="docengine-meta-dot">•</span>
            <span class="docengine-meta-text">Version ${version}</span>
        `;

        const heading =
            contentRoot.querySelector("h1");

        if (heading) {

            if (heading.nextElementSibling !== metaBar) {

                heading.insertAdjacentElement(
                    "afterend",
                    metaBar
                );

            }

        } else {

            const toolbar =
                contentRoot.querySelector(
                    ":scope > .docengine-page-toolbar"
                );

            if (toolbar && toolbar.nextElementSibling !== metaBar) {

                toolbar.insertAdjacentElement(
                    "afterend",
                    metaBar
                );

            } else if (!toolbar && !contentRoot.contains(metaBar)) {

                contentRoot.prepend(
                    metaBar
                );

            }

        }

    },


    /* ======================================================
       Status Badge

       Derived entirely from the existing 3-state client-side
       workflow (CONFIG.WORKFLOW.DRAFT/APPROVED/PUBLISHED) plus
       whether this page has ever had a "publish" version
       snapshot. No second, independent status system.
    ====================================================== */

    computeStatusBadge(doc, page) {

        if (!doc || !doc.status) {

            return {
                label: "Published",
                tone: "published"
            };

        }

        if (doc.status === CONFIG.WORKFLOW.PUBLISHED) {

            return {
                label: "Published",
                tone: "published"
            };

        }

        if (doc.status === CONFIG.WORKFLOW.APPROVED) {

            return {
                label: "Approved",
                tone: "approved"
            };

        }

        const hasPublishedBefore =
            VersionManager.getAll().some(
                v => v.document === page && v.action === "publish"
            );

        return hasPublishedBefore
            ? { label: "Changes Pending", tone: "pending" }
            : { label: "AI Draft", tone: "draft" };

    },


    /* ======================================================
       Feedback Widget
    ====================================================== */

    buildFeedback(contentRoot) {

        if (
            contentRoot.querySelector(".docengine-feedback")
        ) {
            return;
        }

        const page =
            window.location.pathname;

        const stored =
            Storage.load(FEEDBACK_STORAGE_KEY, {})[page];

        const widget =
            document.createElement("div");

        widget.className =
            "docengine-feedback";

        widget.innerHTML = `
            <div class="docengine-feedback-question">Was this page helpful?</div>
            <div class="docengine-feedback-buttons">
                <button type="button" class="docengine-feedback-btn" data-vote="yes" aria-pressed="${stored && stored.vote === "yes"}">👍 Yes</button>
                <button type="button" class="docengine-feedback-btn" data-vote="no" aria-pressed="${stored && stored.vote === "no"}">👎 No</button>
            </div>
            <div class="docengine-feedback-thanks"${stored && stored.vote ? "" : " hidden"}>Thanks for your feedback!</div>
        `;

        widget.querySelectorAll(".docengine-feedback-btn").forEach(button => {

            button.addEventListener("click", () => {

                const all =
                    Storage.load(FEEDBACK_STORAGE_KEY, {});

                all[page] = {
                    ...(all[page] || {}),
                    vote: button.dataset.vote,
                    votedAt: Time.now()
                };

                Storage.save(
                    FEEDBACK_STORAGE_KEY,
                    all
                );

                widget
                    .querySelectorAll(".docengine-feedback-btn")
                    .forEach(b => b.setAttribute(
                        "aria-pressed",
                        String(b === button)
                    ));

                widget.querySelector(".docengine-feedback-thanks").hidden = false;

            });

        });

        widget.querySelector(".docengine-feedback-suggest")
            .addEventListener("click", () => {
                this.openSuggestionPrompt(page);
            });

        contentRoot.appendChild(
            widget
        );

    },
           


    /* ======================================================
       Actions Menu (⋮)
    ====================================================== */

    buildMenu() {

        let menu =
            document.getElementById(
                "docengine-actions-menu"
            );

        if (menu) {
            return menu;
        }

        menu =
            document.createElement("div");

        menu.id =
            "docengine-actions-menu";

        menu.className =
            "docengine-actions-menu";

        menu.setAttribute(
            "role",
            "menu"
        );

        const items =
            this.menuItems();

        menu.innerHTML =
            items
                .map((item, index) => `
                    <button
                        type="button"
                        role="menuitem"
                        class="docengine-menu-item"
                        data-index="${index}"
                        ${item.disabled ? "disabled aria-disabled=\"true\"" : ""}
                        ${item.note ? `title="${this.escape(item.note)}"` : ""}
                    >${this.escape(item.label)}</button>
                `)
                .join("");

        menu.querySelectorAll(".docengine-menu-item")
            .forEach((button, index) => {

                if (items[index].disabled) {
                    return;
                }

                button.addEventListener("click", () => {
                    this.closeMenu();
                    items[index].action();
                });

            });

        menu.addEventListener("keydown", (event) => {

            const focusable =
                Array.from(
                    menu.querySelectorAll(
                        ".docengine-menu-item:not([disabled])"
                    )
                );

            const currentIndex =
                focusable.indexOf(document.activeElement);

            if (event.key === "ArrowDown") {

                event.preventDefault();

                focusable[
                    (currentIndex + 1) % focusable.length
                ]?.focus();

            } else if (event.key === "ArrowUp") {

                event.preventDefault();

                focusable[
                    (currentIndex - 1 + focusable.length) % focusable.length
                ]?.focus();

            } else if (event.key === "Home") {

                event.preventDefault();
                focusable[0]?.focus();

            } else if (event.key === "End") {

                event.preventDefault();
                focusable[focusable.length - 1]?.focus();

            }

        });

        document.body.appendChild(
            menu
        );

        return menu;

    },


    menuItems() {

        return [
            {
                label: "Version History",
                action: () => this.openVersionHistory()
            },
            {
                label: "Page Assets",
                action: () => this.openPageAssets()
            },
            {
                label: "Page Information",
                action: () => this.openPageInformation()
            },
            {
                label: "Copy Page Link",
                action: () => this.copyPageLink()
            },
            {
                label: "Download Markdown",
                action: () => this.downloadMarkdown()
            },
            {
                label: "Print Page",
                action: () => window.print()
            },
            {
                label: "Archive Page",
                action: null,
                disabled: true,
                note: "Not available yet — no archive backend is connected."
            }
        ];

    },


    toggleMenu(anchorButton) {

        const menu =
            document.getElementById(
                "docengine-actions-menu"
            );

        const wasOpen =
            menu && menu.classList.contains("open");

        this.closeMenu();

        if (wasOpen) {
            return;
        }

        const openedMenu =
            this.buildMenu();

        this.positionMenu(
            openedMenu,
            anchorButton
        );

        openedMenu.classList.add("open");

        anchorButton.setAttribute(
            "aria-expanded",
            "true"
        );

        this.activeAnchor =
            anchorButton;

        openedMenu.querySelector(
            ".docengine-menu-item:not([disabled])"
        )?.focus();

        this.outsideClickHandler =
            (event) => {

                if (
                    !openedMenu.contains(event.target) &&
                    event.target !== anchorButton
                ) {
                    this.closeMenu();
                }

            };

        setTimeout(() => {
            document.addEventListener(
                "click",
                this.outsideClickHandler
            );
        });

    },


    closeMenu() {

        const menu =
            document.getElementById(
                "docengine-actions-menu"
            );

        if (menu) {
            menu.classList.remove("open");
        }

        if (this.activeAnchor) {
            this.activeAnchor.setAttribute("aria-expanded", "false");
        }

        this.activeAnchor =
            null;

        if (this.outsideClickHandler) {
            document.removeEventListener("click", this.outsideClickHandler);
        }

        this.outsideClickHandler =
            null;

    },


    positionMenu(menu, anchor) {

        const rect =
            anchor.getBoundingClientRect();

        const menuWidth =
            240;

        let left =
            rect.right - menuWidth;

        left =
            Math.max(
                8,
                Math.min(left, window.innerWidth - menuWidth - 8)
            );

        const top =
            rect.bottom + 6;

        menu.style.left =
            `${left + window.scrollX}px`;

        menu.style.top =
            `${top + window.scrollY}px`;

    },


    /* ======================================================
       Version History
    ====================================================== */

    openVersionHistory() {

        const page =
            window.location.pathname;

        const versions =
            VersionManager.getAll()
                .filter(v => v.document === page)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        let bodyHTML;

        if (!versions.length) {

            bodyHTML = `
                <p class="docengine-empty">No version history yet for this page. A version is recorded whenever a draft is approved or published.</p>
            `;

        } else {

            bodyHTML = `
                <div class="docengine-version-toolbar">
                    <button type="button" id="docengine-compare-btn" class="docengine-secondary-btn" disabled>Compare Selected</button>
                    <span class="docengine-hint">Select two versions to compare</span>
                </div>
                <ul class="docengine-version-list">
                    ${versions.map((v, index) => `
                        <li class="docengine-version-item">
                            <label class="docengine-version-select">
                                <input type="checkbox" class="docengine-version-checkbox" data-index="${index}" aria-label="Select version ${v.version} for comparison">
                            </label>
                            <div class="docengine-version-main">
                                <div class="docengine-version-head">
                                    <span class="docengine-version-num">v${v.version}</span>
                                    <span class="docengine-version-date">${this.escape(Time.format(new Date(v.createdAt)))}</span>
                                    <span class="docengine-version-author">${this.escape(v.author || this.getAuthor())}</span>
                                </div>
                                <div class="docengine-version-action">${v.action === "publish" ? "Published" : "Approved"}</div>
                            </div>
                            <button type="button" class="docengine-secondary-btn docengine-version-view" data-index="${index}">View</button>
                        </li>
                    `).join("")}
                </ul>
            `;

        }

        const panel =
            this.showPanel({
                title: "Version History",
                size: "medium",
                bodyHTML
            });

        panel.querySelectorAll(".docengine-version-view")
            .forEach(button => {

                button.addEventListener("click", () => {
                    this.viewVersion(
                        versions[Number(button.dataset.index)]
                    );
                });

            });

        const checkboxes =
            Array.from(
                panel.querySelectorAll(".docengine-version-checkbox")
            );

        const compareButton =
            panel.querySelector("#docengine-compare-btn");

        checkboxes.forEach(checkbox => {

            checkbox.addEventListener("change", () => {

                const checked =
                    checkboxes.filter(c => c.checked);

                if (checked.length > 2) {
                    checkbox.checked = false;
                }

                if (compareButton) {

                    compareButton.disabled =
                        checkboxes.filter(c => c.checked).length !== 2;

                }

            });

        });

        compareButton?.addEventListener("click", () => {

            const checked =
                checkboxes
                    .filter(c => c.checked)
                    .map(c => versions[Number(c.dataset.index)]);

            this.compareVersions(
                checked[0],
                checked[1]
            );

        });

    },


    /*
     * Read-only preview. Never touches AppState, DocumentStore,
     * or the currently rendered page content.
     */

    viewVersion(version) {

        if (!version) {
            return;
        }

        this.showPanel({
            title: `Version v${version.version} · ${Time.format(new Date(version.createdAt))}`,
            size: "large",
            bodyHTML: `<div class="docengine-version-preview md-typeset">${version.content}</div>`
        });

    },


    compareVersions(a, b) {

        if (!a || !b) {
            return;
        }

        const [older, newer] =
            new Date(a.createdAt) <= new Date(b.createdAt)
                ? [a, b]
                : [b, a];

        const oldText =
            this.htmlToText(older.content);

        const newText =
            this.htmlToText(newer.content);

        const diffHTML =
            this.renderWordDiff(oldText, newText);

        const oldImages =
            this.extractImageSrcs(older.content);

        const newImages =
            this.extractImageSrcs(newer.content);

        const addedImages =
            newImages.filter(src => !oldImages.includes(src));

        const removedImages =
            oldImages.filter(src => !newImages.includes(src));

        let imageSummary;

        if (addedImages.length || removedImages.length) {

            imageSummary = `
                <div class="docengine-diff-images">
                    <h4>Image changes</h4>
                    ${addedImages.map(src => `<div class="docengine-diff-image-added">+ ${this.escape(this.filenameFromUrl(src))}</div>`).join("")}
                    ${removedImages.map(src => `<div class="docengine-diff-image-removed">− ${this.escape(this.filenameFromUrl(src))}</div>`).join("")}
                </div>
            `;

        } else {

            imageSummary =
                `<p class="docengine-empty">No image changes.</p>`;

        }

        this.showPanel({
            title: `Compare v${older.version} → v${newer.version}`,
            size: "large",
            bodyHTML: `
                <div class="docengine-diff-legend">
                    <span class="docengine-diff-added-swatch"></span> Added
                    <span class="docengine-diff-removed-swatch"></span> Removed
                </div>
                <div class="docengine-diff-text">${diffHTML}</div>
                ${imageSummary}
            `
        });

    },


    /* ======================================================
       Word Diff (LCS-based, capped for performance)
    ====================================================== */

    renderWordDiff(oldText, newText) {

        const oldWords =
            oldText.split(/(\s+)/).filter(Boolean);

        const newWords =
            newText.split(/(\s+)/).filter(Boolean);

        const n =
            oldWords.length;

        const m =
            newWords.length;

        if (n * m > 4000000) {

            return `<p class="docengine-empty">This page is too large for an inline diff. Use "View" on each version to compare manually.</p>`;

        }

        const dp =
            Array.from(
                { length: n + 1 },
                () => new Uint32Array(m + 1)
            );

        for (let i = n - 1; i >= 0; i--) {

            for (let j = m - 1; j >= 0; j--) {

                dp[i][j] =
                    oldWords[i] === newWords[j]
                        ? dp[i + 1][j + 1] + 1
                        : Math.max(dp[i + 1][j], dp[i][j + 1]);

            }

        }

        let i = 0;
        let j = 0;

        const out = [];

        while (i < n && j < m) {

            if (oldWords[i] === newWords[j]) {

                out.push(this.escape(oldWords[i]));
                i++;
                j++;

            } else if (dp[i + 1][j] >= dp[i][j + 1]) {

                out.push(`<del>${this.escape(oldWords[i])}</del>`);
                i++;

            } else {

                out.push(`<ins>${this.escape(newWords[j])}</ins>`);
                j++;

            }

        }

        while (i < n) {
            out.push(`<del>${this.escape(oldWords[i])}</del>`);
            i++;
        }

        while (j < m) {
            out.push(`<ins>${this.escape(newWords[j])}</ins>`);
            j++;
        }

        return out.join("");

    },


    /* ======================================================
       Page Assets
    ====================================================== */

    async openPageAssets() {

        const contentRoot =
            document.querySelector(".md-content__inner");

        const images =
            Array.from(
                contentRoot.querySelectorAll("img")
            );

        if (!images.length) {

            this.showPanel({
                title: "Page Assets",
                size: "medium",
                bodyHTML: `<p class="docengine-empty">This page has no images.</p>`
            });

            return;

        }

        const panel =
            this.showPanel({
                title: "Page Assets",
                size: "large",
                bodyHTML: `
                    <ul class="docengine-asset-list">
                        ${images.map((img, index) => `
                            <li class="docengine-asset-item">
                                <button type="button" class="docengine-asset-thumb-btn" data-index="${index}" aria-label="Preview ${this.escape(this.filenameFromUrl(img.src))}">
                                    <img src="${img.src}" alt="" class="docengine-asset-thumb">
                                </button>
                                <div class="docengine-asset-info">
                                    <div class="docengine-asset-name">${this.escape(this.filenameFromUrl(img.src))}</div>
                                    <div class="docengine-asset-meta" id="docengine-asset-meta-${index}">Loading details…</div>
                                </div>
                                <a class="docengine-secondary-btn" href="${img.src}" target="_blank" rel="noopener">Open</a>
                            </li>
                        `).join("")}
                    </ul>
                    <div class="docengine-asset-summary" id="docengine-asset-summary">Loading…</div>
                `
            });

        panel.querySelectorAll(".docengine-asset-thumb-btn")
            .forEach(button => {

                button.addEventListener("click", () => {
                    this.openLightbox(
                        images[Number(button.dataset.index)].src
                    );
                });

            });

        let totalBytes = 0;
        let knownCount = 0;

        await Promise.all(
            images.map(async (img, index) => {

                const metaElement =
                    panel.querySelector(`#docengine-asset-meta-${index}`);

                const dimensions =
                    img.naturalWidth
                        ? `${img.naturalWidth}×${img.naturalHeight}`
                        : "";

                let sizeLabel = "";

                try {

                    const response =
                        await fetch(img.src, { method: "HEAD" });

                    const length =
                        response.headers.get("content-length");

                    if (length) {

                        totalBytes +=
                            Number(length);

                        knownCount++;

                        sizeLabel =
                            this.formatBytes(Number(length));

                    }

                } catch (error) {

                    /*
                     * Best-effort metadata only. A failed HEAD
                     * request (e.g. cross-origin image) is not
                     * an error condition for this panel.
                     */

                }

                if (metaElement) {

                    metaElement.textContent =
                        [dimensions, sizeLabel].filter(Boolean).join(" • ") ||
                        "Details unavailable";

                }

            })
        );

        const summaryElement =
            panel.querySelector("#docengine-asset-summary");

        if (summaryElement) {

            const countLabel =
                `${images.length} image${images.length === 1 ? "" : "s"}`;

            const sizeSuffix =
                knownCount
                    ? ` • ${this.formatBytes(totalBytes)}${knownCount < images.length ? " (partial)" : ""}`
                    : "";

            summaryElement.textContent =
                countLabel + sizeSuffix;

        }

    },


    openLightbox(src) {

        const overlay =
            document.createElement("div");

        overlay.className =
            "docengine-lightbox-overlay";

        overlay.innerHTML =
            `<img src="${src}" class="docengine-lightbox-img" alt="">`;

        overlay.addEventListener("click", () => overlay.remove());

        document.addEventListener(
            "keydown",
            function onKey(event) {

                if (event.key === "Escape") {
                    overlay.remove();
                    document.removeEventListener("keydown", onKey);
                }

            }
        );

        document.body.appendChild(
            overlay
        );

    },


    /* ======================================================
       Page Information
    ====================================================== */

    openPageInformation() {

        const page =
            window.location.pathname;

        const doc =
            DocumentStore.get(page);

        const badge =
            this.computeStatusBadge(doc, page);

        const contentRoot =
            document.querySelector(".md-content__inner");

        const clone =
            contentRoot.cloneNode(true);

        clone
            .querySelectorAll(
                ".docengine-page-toolbar, .docengine-meta-bar, .docengine-feedback"
            )
            .forEach(element => element.remove());

        const text =
            (clone.textContent || "").trim();

        const wordCount =
            text
                ? text.split(/\s+/).filter(Boolean).length
                : 0;

        const imageCount =
            contentRoot.querySelectorAll("img").length;

        const title =
            window.DOCENGINE_PAGE_TITLE ||
            document.title;

        const rows = [
            ["Title", this.escape(title)],
            ["Created", doc && doc.createdAt ? this.escape(Time.format(new Date(doc.createdAt))) : "Not tracked yet in this browser"],
            ["Last Updated", doc && doc.updatedAt ? this.escape(Time.format(new Date(doc.updatedAt))) : "Not tracked yet in this browser"],
            ["Author", this.escape(this.getAuthor())],
            ["Current Version", String(doc && doc.version ? doc.version : 1)],
            ["Status", this.escape(badge.label)],
            ["Images", String(imageCount)],
            ["Word Count", String(wordCount)]
        ];

        this.showPanel({
            title: "Page Information",
            size: "medium",
            bodyHTML: `
                <dl class="docengine-info-grid">
                    ${rows.map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`).join("")}
                </dl>
            `
        });

    },


    /* ======================================================
       Copy Page Link
    ====================================================== */

    async copyPageLink() {

        const url =
            window.location.href;

        try {

            await navigator.clipboard.writeText(url);

            this.toast("✓ Link copied");

        } catch (error) {

            const textarea =
                document.createElement("textarea");

            textarea.value =
                url;

            textarea.style.position =
                "fixed";

            textarea.style.opacity =
                "0";

            document.body.appendChild(textarea);
            textarea.select();

            try {

                document.execCommand("copy");
                this.toast("✓ Link copied");

            } catch (fallbackError) {

                this.toast(
                    "Could not copy automatically — the link is in your address bar.",
                    true
                );

            }

            textarea.remove();

        }

    },


    /* ======================================================
       Download Markdown
    ====================================================== */

    downloadMarkdown() {

        const contentRoot =
            document.querySelector(".md-content__inner");

        const clone =
            contentRoot.cloneNode(true);

        clone
            .querySelectorAll(
                ".docengine-page-toolbar, .docengine-meta-bar, .docengine-feedback"
            )
            .forEach(element => element.remove());

        const markdown =
            this.htmlToMarkdown(clone);

        const blob =
            new Blob([markdown], { type: "text/markdown" });

        const url =
            URL.createObjectURL(blob);

        const page =
            window.location.pathname;

        const slug =
            page.replace(/\/+$/, "").split("/").pop() || "page";

        const anchor =
            document.createElement("a");

        anchor.href =
            url;

        anchor.download =
            `${slug}.md`;

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);

    },


    htmlToMarkdown(node) {

        const walk = (element) => {

            if (element.nodeType === Node.TEXT_NODE) {
                return element.textContent;
            }

            if (element.nodeType !== Node.ELEMENT_NODE) {
                return "";
            }

            const tag =
                element.tagName.toLowerCase();

            const inner =
                () => Array.from(element.childNodes).map(walk).join("");

            switch (tag) {

                case "h1": return `# ${inner().trim()}\n\n`;
                case "h2": return `## ${inner().trim()}\n\n`;
                case "h3": return `### ${inner().trim()}\n\n`;
                case "h4": return `#### ${inner().trim()}\n\n`;
                case "h5": return `##### ${inner().trim()}\n\n`;
                case "h6": return `###### ${inner().trim()}\n\n`;
                case "p": return `${inner().trim()}\n\n`;
                case "strong": case "b": return `**${inner()}**`;
                case "em": case "i": return `*${inner()}*`;
                case "a": return `[${inner()}](${element.getAttribute("href") || ""})`;
                case "img": return `![${element.getAttribute("alt") || ""}](${element.getAttribute("src") || ""})\n\n`;
                case "blockquote": return `> ${inner().trim().replace(/\n/g, "\n> ")}\n\n`;
                case "pre": return `\`\`\`\n${inner().trim()}\n\`\`\`\n\n`;
                case "code": return element.parentElement?.tagName.toLowerCase() === "pre" ? inner() : `\`${inner()}\``;
                case "ul": return Array.from(element.children).map(li => `- ${walk(li).trim()}\n`).join("") + "\n";
                case "ol": return Array.from(element.children).map((li, index) => `${index + 1}. ${walk(li).trim()}\n`).join("") + "\n";
                case "li": return inner();
                case "br": return "\n";
                case "hr": return "---\n\n";
                case "tr": return `${Array.from(element.children).map(walk).join(" | ")}\n`;
                case "td": case "th": return inner().trim();
                default: return inner();

            }

        };

        return (
            Array.from(node.childNodes)
                .map(walk)
                .join("")
                .replace(/\n{3,}/g, "\n\n")
                .trim() + "\n"
        );

    },


    /* ======================================================
       Generic Panel Modal
    ====================================================== */

    showPanel({ title, bodyHTML, footerHTML = "", size = "medium" }) {

        this.closeModal();

        const overlay =
            document.createElement("div");

        overlay.id =
            "docengine-panel-overlay";

        overlay.className =
            "docengine-panel-overlay";

        const panel =
            document.createElement("div");

        panel.className =
            `docengine-panel docengine-panel--${size}`;

        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.setAttribute("aria-label", title);

        panel.innerHTML = `
            <div class="docengine-panel-header">
                <h3 class="docengine-panel-title">${this.escape(title)}</h3>
                <button type="button" class="docengine-panel-close" aria-label="Close">✕</button>
            </div>
            <div class="docengine-panel-body">${bodyHTML}</div>
            ${footerHTML ? `<div class="docengine-panel-footer">${footerHTML}</div>` : ""}
        `;

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        panel.querySelector(".docengine-panel-close")
            .addEventListener("click", () => this.closeModal());

        panel.querySelectorAll("[data-close]")
            .forEach(button => button.addEventListener("click", () => this.closeModal()));

        overlay.addEventListener("click", (event) => {

            if (event.target === overlay) {
                this.closeModal();
            }

        });

        panel.querySelector(".docengine-panel-close").focus();

        return panel;

    },


    closeModal() {

        document.getElementById("docengine-panel-overlay")?.remove();

    },


    /* ======================================================
       Toast
    ====================================================== */

    toast(message, isError = false) {

        const existing =
            document.getElementById("docengine-toast");

        existing?.remove();

        const toastElement =
            document.createElement("div");

        toastElement.id =
            "docengine-toast";

        toastElement.className =
            `docengine-toast${isError ? " docengine-toast--error" : ""}`;

        toastElement.textContent =
            message;

        document.body.appendChild(toastElement);

        requestAnimationFrame(() => toastElement.classList.add("visible"));

        setTimeout(() => {

            toastElement.classList.remove("visible");
            setTimeout(() => toastElement.remove(), 250);

        }, 2200);

    },


    /* ======================================================
       Small Helpers
    ====================================================== */

    escape(value) {

        const div =
            document.createElement("div");

        div.textContent =
            value === null || value === undefined ? "" : String(value);

        return div.innerHTML;

    },


    filenameFromUrl(url) {

        try {

            const clean =
                url.split("?")[0].split("#")[0];

            return decodeURIComponent(clean.split("/").pop());

        } catch (error) {

            return url;

        }

    },


    formatBytes(bytes) {

        if (!bytes) {
            return "0 B";
        }

        const units =
            ["B", "KB", "MB", "GB"];

        let value = bytes;
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }

        const decimals =
            (value >= 10 || unitIndex === 0) ? 0 : 1;

        return `${value.toFixed(decimals)} ${units[unitIndex]}`;

    },


    relativeTime(date) {

        const diffMs =
            Date.now() - date.getTime();

        const seconds =
            Math.round(diffMs / 1000);

        if (seconds < 60) {
            return "just now";
        }

        const minutes =
            Math.round(seconds / 60);

        if (minutes < 60) {
            return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
        }

        const hours =
            Math.round(minutes / 60);

        if (hours < 24) {
            return `${hours} hour${hours === 1 ? "" : "s"} ago`;
        }

        const days =
            Math.round(hours / 24);

        if (days < 30) {
            return `${days} day${days === 1 ? "" : "s"} ago`;
        }

        return Time.format(date);

    },


    htmlToText(html) {

        const div =
            document.createElement("div");

        div.innerHTML =
            html;

        return (div.textContent || "").replace(/\s+/g, " ").trim();

    },


    extractImageSrcs(html) {

        const div =
            document.createElement("div");

        div.innerHTML =
            html;

        return Array.from(div.querySelectorAll("img")).map(img => img.getAttribute("src"));

    }

};


/* ==========================================================
   Startup
========================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {
        PageChrome.init();
    }
);


window.PageChrome =
    PageChrome;
