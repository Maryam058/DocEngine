/* ==========================================================
   DocEngine AI Agent Panel

   Adds a floating "AI Agent" launcher and slide-out panel that
   runs the documentation-qa Agent Skill (Claude, via
   api/agent-skill.py) against the currently viewed page.

   This file is purely additive, independent of doc-authoring.js
   and page-chrome.js:
     - It attaches its own button/panel directly to document.body,
       outside `.md-content__inner`, so it is never touched by
       PageChrome's MutationObserver-driven rebuild of that
       subtree (see page-chrome.js's own header comment).
     - It only READS the existing `AppState` global (for the
       current page path) -- it never writes to it, and never
       calls into AIAssistant, DocumentStore, or any other
       existing module.
     - All of its DOM lives under its own `.docengine-agent-*`
       class namespace, disjoint from `.ai-suggest-*` and
       `.docengine-page-*`.

   It does not change AI Suggestion, the editor, or any other
   existing DocEngine functionality.
========================================================== */

const AgentPanelConfig = {

    API:
        "https://doc-engine-nu.vercel.app/api/agent-skill",

    REQUEST_TIMEOUT:
        40000,

};


const AgentPanel = {

    panelOpen: false,
    isRunning: false,
    requestToken: 0,

    elements: {},


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

        if (document.querySelector(".docengine-agent-launcher")) {
            return;
        }

        this.renderLauncher();

    },


    /* ======================================================
       Current Page Path

       Reads (never writes) the existing AppState global set up
       by doc-authoring.js, which loads before this file. Falls
       back to the raw URL path if AppState isn't available for
       any reason.
    ====================================================== */

    getCurrentDocumentPath() {

        if (
            window.AppState &&
            window.AppState.currentDocument
        ) {
            return window.AppState.currentDocument;
        }

        return window.location.pathname;

    },


    /* ======================================================
       Launcher Button
    ====================================================== */

    renderLauncher() {

        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            "docengine-agent-launcher";

        button.setAttribute(
            "aria-label",
            "Open AI Agent panel"
        );

        button.innerHTML =
            "🤖 AI Agent";

        button.addEventListener(
            "click",
            () => this.togglePanel()
        );

        document.body.appendChild(
            button
        );

        this.elements.launcher =
            button;

    },


    /* ======================================================
       Panel
    ====================================================== */

    togglePanel() {

        if (this.panelOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }

    },

    openPanel() {

        if (!this.elements.panel) {
            this.renderPanel();
        }

        this.elements.panel.classList.add(
            "docengine-agent-panel--open"
        );

        this.panelOpen =
            true;

    },

    closePanel() {

        if (this.elements.panel) {

            this.elements.panel.classList.remove(
                "docengine-agent-panel--open"
            );

        }

        this.panelOpen =
            false;

    },

    renderPanel() {

        const panel =
            document.createElement(
                "div"
            );

        panel.className =
            "docengine-agent-panel";

        document.body.appendChild(
            panel
        );

        this.elements.panel =
            panel;

        this.renderIdleState();

    },


    /* ======================================================
       States
    ====================================================== */

    renderIdleState() {

        const panel =
            this.elements.panel;

        if (!panel) {
            return;
        }

        panel.innerHTML = `
            <div class="docengine-agent-header">
                <span class="docengine-agent-title">🤖 AI Agent</span>
                <button type="button" class="docengine-agent-close" aria-label="Close">✖</button>
            </div>
            <div class="docengine-agent-body">
                <p class="docengine-agent-description">
                    Runs the <strong>documentation-qa</strong> skill against this
                    page: deterministic link/image/heading checks, plus a
                    Claude-written review of style and terminology.
                </p>
                <button type="button" class="docengine-agent-btn docengine-agent-btn--primary" data-action="run">
                    Run Documentation QA
                </button>
            </div>
        `;

        this.bindCloseButton();

        panel
            .querySelector('[data-action="run"]')
            .addEventListener(
                "click",
                () => this.runSkill()
            );

    },

    renderRunningState() {

        const panel =
            this.elements.panel;

        if (!panel) {
            return;
        }

        panel.innerHTML = `
            <div class="docengine-agent-header">
                <span class="docengine-agent-title">🤖 AI Agent</span>
                <button type="button" class="docengine-agent-close" aria-label="Close">✖</button>
            </div>
            <div class="docengine-agent-body">
                <div class="docengine-agent-status">
                    <span class="docengine-agent-spinner"></span>
                    Running documentation-qa checks...
                </div>
            </div>
        `;

        this.bindCloseButton();

    },

    renderErrorState(message) {

        const panel =
            this.elements.panel;

        if (!panel) {
            return;
        }

        panel.innerHTML = `
            <div class="docengine-agent-header">
                <span class="docengine-agent-title">🤖 AI Agent</span>
                <button type="button" class="docengine-agent-close" aria-label="Close">✖</button>
            </div>
            <div class="docengine-agent-body">
                <p class="docengine-agent-error"></p>
                <div class="docengine-agent-actions">
                    <button type="button" class="docengine-agent-btn docengine-agent-btn--primary" data-action="retry">Retry</button>
                    <button type="button" class="docengine-agent-btn" data-action="close">Close</button>
                </div>
            </div>
        `;

        panel.querySelector(
            ".docengine-agent-error"
        ).textContent =
            message;

        this.bindCloseButton();

        panel
            .querySelector('[data-action="retry"]')
            .addEventListener(
                "click",
                () => this.runSkill()
            );

        panel
            .querySelector('[data-action="close"]')
            .addEventListener(
                "click",
                () => this.closePanel()
            );

    },

    renderResultState(data) {

        const panel =
            this.elements.panel;

        if (!panel) {
            return;
        }

        const checks =
            (data.deterministic && data.deterministic.checks) ||
            [];

        const checklistHtml =
            checks
                .map((check) => {

                    const icon =
                        check.status === "pass"
                            ? "✅"
                            : "❌";

                    return `
                        <li class="docengine-agent-check docengine-agent-check--${check.status}">
                            <span class="docengine-agent-check-icon">${icon}</span>
                            <span class="docengine-agent-check-id"></span>
                            <span class="docengine-agent-check-detail"></span>
                        </li>
                    `;

                })
                .join("");

        panel.innerHTML = `
            <div class="docengine-agent-header">
                <span class="docengine-agent-title">🤖 AI Agent</span>
                <button type="button" class="docengine-agent-close" aria-label="Close">✖</button>
            </div>
            <div class="docengine-agent-body">
                <h4 class="docengine-agent-section-title">Deterministic Findings</h4>
                <ul class="docengine-agent-checklist">
                    ${checklistHtml}
                </ul>
                <h4 class="docengine-agent-section-title">Report</h4>
                <pre class="docengine-agent-report"></pre>
                <div class="docengine-agent-actions">
                    <button type="button" class="docengine-agent-btn" data-action="rerun">Run Again</button>
                    <button type="button" class="docengine-agent-btn docengine-agent-btn--muted" data-action="close">Close</button>
                </div>
            </div>
        `;

        checks.forEach((check, index) => {

            const item =
                panel.querySelectorAll(
                    ".docengine-agent-check"
                )[index];

            item.querySelector(
                ".docengine-agent-check-id"
            ).textContent =
                check.id;

            item.querySelector(
                ".docengine-agent-check-detail"
            ).textContent =
                check.detail;

        });

        panel.querySelector(
            ".docengine-agent-report"
        ).textContent =
            data.report ||
            "(no report text returned)";

        this.bindCloseButton();

        panel
            .querySelector('[data-action="rerun"]')
            .addEventListener(
                "click",
                () => this.runSkill()
            );

        panel
            .querySelector('[data-action="close"]')
            .addEventListener(
                "click",
                () => this.closePanel()
            );

    },

    bindCloseButton() {

        const closeButton =
            this.elements.panel.querySelector(
                ".docengine-agent-close"
            );

        if (closeButton) {

            closeButton.addEventListener(
                "click",
                () => this.closePanel()
            );

        }

    },


    /* ======================================================
       Run Skill
    ====================================================== */

    async runSkill() {

        if (this.isRunning) {
            return;
        }

        this.isRunning =
            true;

        const token =
            ++this.requestToken;

        this.renderRunningState();

        const controller =
            new AbortController();

        const timeoutId =
            setTimeout(
                () => controller.abort(),
                AgentPanelConfig.REQUEST_TIMEOUT
            );

        try {

            const response =
                await fetch(

                    AgentPanelConfig.API,

                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            document_path:
                                this.getCurrentDocumentPath()
                        }),

                        signal:
                            controller.signal

                    }

                );

            let data;

            try {

                data =
                    await response.json();

            } catch (parseError) {

                throw new Error(
                    "The AI Agent service returned an invalid response."
                );

            }

            if (
                token !== this.requestToken ||
                !this.panelOpen
            ) {
                return;
            }

            if (!response.ok || !data.success) {

                throw new Error(
                    data.message ||
                    `AI Agent request failed (${response.status}).`
                );

            }

            this.renderResultState(
                data
            );

        } catch (error) {

            if (
                token !== this.requestToken ||
                !this.panelOpen
            ) {
                return;
            }

            const isAbort =
                error.name === "AbortError";

            console.error(
                "AI Agent skill run failed:",
                error
            );

            this.renderErrorState(

                isAbort
                    ? "The request timed out. Please try again."
                    : (
                        error.message ||
                        "Something went wrong while running the AI Agent skill."
                    )

            );

        } finally {

            clearTimeout(
                timeoutId
            );

            this.isRunning =
                false;

        }

    },

};


/* ==========================================================
   Init
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    function () {

        AgentPanel.init();

    }

);
