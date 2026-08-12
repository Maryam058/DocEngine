/* ==========================================================
   Configuration
   ========================================================== */

const CONFIG = {
    AUTOSAVE_DELAY: 5000,

    PUBLISH_API:
        "https://doc-engine-nu.vercel.app/api/publish",

    PRODUCTION_URL:
         "https://doc-engine-nu.vercel.app",

    STORAGE: {
        DOCUMENTS: "docengine_documents",
        HISTORY: "docengine_history",
        VERSIONS: "docengine_versions"
    },

    WORKFLOW: {
        DRAFT: "draft",
        APPROVED: "approved",
        PUBLISHED: "published"
    }
};

/* ==========================================================
   Application State
   ========================================================== */

const AppState = {
    editor: null,
    currentDocument: null,
    currentStatus: CONFIG.WORKFLOW.DRAFT,
    currentVersion: 1,
    draftChanged: false,
    lastSaved: null,
    statusText: "Draft",
    inlineMode: false
};

/* ==========================================================
   Storage
   ========================================================== */

const Storage = {
    load(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.error("Storage load error:", error);
            return defaultValue;
        }
    },

    save(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error("Storage save error:", error);
        }
    }
};

/* ==========================================================
   Time Helper
   ========================================================== */

const Time = {
    now() {
        return new Date().toISOString();
    },

    format(date = new Date()) {
        return date.toLocaleString();
    }
};

/* ==========================================================
   Document Store
   ========================================================== */

const DocumentStore = {
    getAll() {
        return Storage.load(CONFIG.STORAGE.DOCUMENTS, {});
    },

    get(page) {
        if (!page) return null;

        const docs = this.getAll();

        return docs[page] || null;
    },

    save(page, data) {
        if (!page) return;

        const docs = this.getAll();

        docs[page] = data;

        Storage.save(
            CONFIG.STORAGE.DOCUMENTS,
            docs
        );
    }
};

/* ==========================================================
   Save Status
   ========================================================== */

function updateSaveStatus(message) {
    const elements = [
        document.querySelector("#save-status"),
        document.querySelector("#inline-save-status")
    ];

    elements.forEach(element => {
        if (element) {
            element.textContent = message;
        }
    });
}

/* ==========================================================
   Draft Manager
   ========================================================== */

const DraftManager = {

    getContent() {
        if (!AppState.editor) return "";

        return AppState.editor.root.innerHTML;
    },

    setContent(html) {
        if (!AppState.editor) return;

        AppState.editor.root.innerHTML =
            html || "";
    },

    load() {
        const page =
            AppState.currentDocument;

        if (!page) return null;

        const doc =
            DocumentStore.get(page);

        if (!doc) return null;

        this.setContent(
            doc.content
        );

        AppState.currentStatus =
            doc.status ||
            CONFIG.WORKFLOW.DRAFT;

        AppState.currentVersion =
            doc.version || 1;

        AppState.statusText =
            this.getStatusText(
                AppState.currentStatus
            );

        AppState.lastSaved =
            doc.updatedAt || null;

        AppState.draftChanged =
            false;

        return doc;
    },
        save() {
        const page =
            AppState.currentDocument;

        if (!page) {
            console.warn(
                "No current document selected."
            );
            return;
        }

        if (!AppState.editor) {
            console.warn(
                "Editor is not initialized."
            );
            return;
        }

        const now =
            Time.now();

        DocumentStore.save(
            page,
            {
                content:
                    this.getContent(),

                status:
                    AppState.currentStatus,

                version:
                    AppState.currentVersion,

                updatedAt:
                    now
            }
        );

        AppState.lastSaved =
            now;

        AppState.draftChanged =
            false;

        updateSaveStatus(
            "Saved " +
            Time.format()
        );
    },

    getStatusText(status) {
        switch (status) {

            case CONFIG.WORKFLOW.APPROVED:
                return "Approved";

            case CONFIG.WORKFLOW.PUBLISHED:
                return "Published";

            default:
                return "Draft";
        }
    }
};

/* ==========================================================
   Autosave
   ========================================================== */

let autoSave = null;

function startAutoSave() {

    clearInterval(autoSave);

    autoSave = setInterval(
        () => {

            if (
                AppState.draftChanged &&
                AppState.editor &&
                AppState.currentDocument
            ) {
                DraftManager.save();
            }

        },
        CONFIG.AUTOSAVE_DELAY
    );
}

/* ==========================================================
   History Manager
   ========================================================== */

const HistoryManager = {

    getAll() {
        return Storage.load(
            CONFIG.STORAGE.HISTORY,
            []
        );
    },

    add(action, message) {

        const history =
            this.getAll();

        history.unshift({
            action: action,
            message: message,
            time: Time.now(),
            document:
                AppState.currentDocument
        });

        if (history.length > 100) {
            history.length = 100;
        }

        Storage.save(
            CONFIG.STORAGE.HISTORY,
            history
        );
    }
};

/* ==========================================================
   Version Manager
   ========================================================== */

const VersionManager = {

    getAll() {
        return Storage.load(
            CONFIG.STORAGE.VERSIONS,
            []
        );
    },

    create(action) {

        const versions =
            this.getAll();

        versions.unshift({

            document:
                AppState.currentDocument,

            version:
                AppState.currentVersion,

            action: action,

            content:
                DraftManager.getContent(),

            createdAt:
                Time.now()
        });

        if (versions.length > 50) {
            versions.length = 50;
        }

        Storage.save(
            CONFIG.STORAGE.VERSIONS,
            versions
        );
    }
};

/* ==========================================================
   Wait For Published Documentation
   ========================================================== */

async function waitForPublishedPage(page, content) {

    const MAX_ATTEMPTS = 40;
    const CHECK_INTERVAL = 3000;

    /*
     * Convert editor HTML into plain text.
     * This gives us a unique piece of content
     * to check on the live documentation page.
     */

    const temp = document.createElement("div");

    temp.innerHTML = content || "";

    const expectedText =
        (temp.textContent || temp.innerText || "")
            .replace(/\s+/g, " ")
            .trim();

    /*
     * If there is no text, we cannot verify
     * the published page reliably.
     */

    if (!expectedText) {
        console.warn(
            "No text available for publish verification."
        );

        return true;
    }

    /*
     * Use a reasonably unique section of the
     * published content.
     */

    const verificationText =
        expectedText.substring(0, 100);

    /*
     * Current documentation path.
     */

    let pagePath = page || window.location.pathname;

    if (!pagePath.startsWith("/")) {
        pagePath = "/" + pagePath;
    }

    /*
     * Remove query/hash from the path.
     */

    pagePath =
        pagePath.split("?")[0]
            .split("#")[0];

    const liveURL =
        CONFIG.PRODUCTION_URL.replace(/\/$/, "") +
        pagePath;

    updateSaveStatus(
        "Waiting for live site update..."
    );

    console.log(
        "Checking published page:",
        liveURL
    );

    /*
     * Poll the live site until the newly
     * published content appears.
     */

    for (
        let attempt = 1;
        attempt <= MAX_ATTEMPTS;
        attempt++
    ) {

        try {

            const cacheBuster =
                `_docengine_publish=${Date.now()}`;

            const separator =
                liveURL.includes("?")
                    ? "&"
                    : "?";

            const response =
                await fetch(
                    liveURL +
                    separator +
                    cacheBuster,
                    {
                        method: "GET",

                        cache: "no-store",

                        headers: {
                            "Cache-Control":
                                "no-cache"
                        }
                    }
                );

            if (response.ok) {

                const html =
                    await response.text();

                const liveDocument =
                    new DOMParser()
                        .parseFromString(
                            html,
                            "text/html"
                        );

                const liveText =
                    (
                        liveDocument.body
                            ?.textContent || ""
                    )
                        .replace(/\s+/g, " ")
                        .trim();

                /*
                 * New content is now visible
                 * on the live site.
                 */

                if (
                    liveText.includes(
                        verificationText
                    )
                ) {

                    console.log(
                        "Published content detected on live site."
                    );

                    updateSaveStatus(
                        "Live site updated ✓"
                    );

                    return true;
                }
            }

        } catch (error) {

            console.warn(
                "Live site check failed:",
                error
            );
        }

        /*
         * Still deploying.
         */

        updateSaveStatus(
            `Publishing... ${attempt}/${MAX_ATTEMPTS}`
        );

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    CHECK_INTERVAL
                )
        );
    }

    /*
     * Deployment took longer than expected.
     */

    console.warn(
        "Live site was not verified within timeout."
    );

    updateSaveStatus(
        "Deployment is taking longer than expected."
    );

    return false;
}
/* ==========================================================
   Workflow Manager
   ========================================================== */

const WorkflowManager = {

    async changeStatus(status) {

        if (!AppState.currentDocument) {

            console.warn(
                "No current document selected."
            );

            return false;
        }

        /*
         * Always save latest editor content
         * before workflow action.
         */

        if (AppState.editor) {
            DraftManager.save();
        }

        /* ==================================================
           APPROVE
           ================================================== */

        if (
            status ===
            CONFIG.WORKFLOW.APPROVED
        ) {

            AppState.currentStatus =
                CONFIG.WORKFLOW.APPROVED;

            AppState.statusText =
                "Approved";

            HistoryManager.add(
                "approve",
                "Document Approved"
            );

            VersionManager.create(
                "approve"
            );

            AppState.currentVersion++;

            DraftManager.save();

            UIManager.refresh();

            updateSaveStatus(
                "Approved"
            );

            alert(
                "✅ Document approved successfully!"
            );

            return true;
        }

        /* ==================================================
           PUBLISH
           ================================================== */

        if (
            status ===
            CONFIG.WORKFLOW.PUBLISHED
        ) {

            /*
             * Publishing is only allowed
             * after approval.
             */

            if (
                AppState.currentStatus !==
                CONFIG.WORKFLOW.APPROVED
            ) {

                alert(
                    "Please approve the document before publishing."
                );

                return false;
            }

            try {

                updateSaveStatus(
                    "Publishing..."
                );

                const page =
                    AppState.currentDocument;

                const content =
                    DraftManager.getContent();

                console.log(
                    "Publishing document:",
                    page
                );

                /*
                 * Encode the page path.
                 *
                 * This prevents spaces and other
                 * characters from breaking the
                 * GitHub API URL.
                 */

                const response =
                    await fetch(
                        CONFIG.PUBLISH_API,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    page: page,
                                    content: content
                                })
                        }
                    );

                let result;

                try {

                    result =
                        await response.json();

                } catch (jsonError) {

                    throw new Error(
                        "Publish server returned an invalid response."
                    );
                }

                console.log(
                    "Publish response:",
                    response.status,
                    result
                );

                if (!response.ok) {

                    throw new Error(
                        result.message ||
                        `Publish API returned ${response.status}`
                    );
                }

                if (!result.success) {

                    throw new Error(
                        result.message ||
                        "Publishing failed."
                    );
                }

                /* ==========================================
                   PUBLISH SUCCESS
                   ========================================== */
                   /*Wait until Vercel deployment has completed
                    * and the new content is actually visible
                    * on the live documentation page.
                    */

                const liveUpdated =
                    await waitForPublishedPage(
                        page,
                        content
                        );

                AppState.currentStatus =
                    CONFIG.WORKFLOW.PUBLISHED;

                AppState.statusText =
                    "Published";

                HistoryManager.add(
                    "publish",
                    "Document Published"
                );

                VersionManager.create(
                    "publish"
                );

                AppState.currentVersion++;

                DraftManager.save();

                if (liveUpdated) {

            updateSaveStatus(
                "Published and live ✓"
            );

            UIManager.refresh();

            alert(
                "✅ Published successfully!\n\n" +
                "The live documentation has been updated."
            );

            /*
            * Automatically refresh the documentation page
            * after the new content is confirmed live.
            */

            window.location.reload();

        } else {

            updateSaveStatus(
                "Published — deployment still processing"
            );

            UIManager.refresh();

            alert(
                "✅ Published successfully!\n\n" +
                "The deployment is taking longer than expected."
            );
        }

        return true;
            } catch (error) {

                console.error(
                    "Publish error:",
                    error
                );

                updateSaveStatus(
                    "Publish failed"
                );

                alert(
                    "❌ Publish failed:\n\n" +
                    error.message
                );

                return false;
            }
        }

        console.warn(
            "Unknown workflow status:",
            status
        );

        return false;
    }
};

/* ==========================================================
   UI Manager
   ========================================================== */

const UIManager = {

    refresh() {

        const statusElements = [

            document.querySelector(
                "#workflow-status"
            ),

            document.querySelector(
                "#inline-workflow-status"
            )

        ];

        const versionElements = [

            document.querySelector(
                "#version-label"
            ),

            document.querySelector(
                "#inline-version-label"
            )

        ];

        /* ================================================
           Update Status
           ================================================ */

        statusElements.forEach(
            element => {

                if (element) {

                    element.textContent =
                        AppState.statusText;
                }
            }
        );

        /* ================================================
           Update Version
           ================================================ */

        versionElements.forEach(
            element => {

                if (element) {

                    element.textContent =
                        AppState.currentVersion;
                }
            }
        );

        /* ================================================
           Update Save Status
           ================================================ */

        if (
            AppState.lastSaved &&
            !AppState.draftChanged
        ) {

            updateSaveStatus(
                "Saved " +
                Time.format(
                    new Date(
                        AppState.lastSaved
                    )
                )
            );
        }

        /* ================================================
           Inline Workflow Buttons
           ================================================ */

        const approveButton =
            document.querySelector(
                "#inline-approve"
            );

        const publishButton =
            document.querySelector(
                "#inline-publish"
            );

        const saveButton =
            document.querySelector(
                "#inline-save"
            );

        /*
         * IMPORTANT:
         * Buttons remain enabled while editing.
         *
         * Publish itself checks approval.
         */

        if (approveButton) {
            approveButton.disabled = false;
        }

        if (publishButton) {
            publishButton.disabled = false;
        }

        if (saveButton) {
            saveButton.disabled = false;
        }
    }
};
/* ==========================================================
   Application Controller
   ========================================================== */

const App = {

    ui: {},

    /* ======================================================
       Initialize Application
       ====================================================== */

    init() {

        /*
         * Identify current documentation page.
         */

        AppState.currentDocument =
            localStorage.getItem(
                "currentDoc"
            ) ||
            window.location.pathname;

        this.cacheDOM();

        /*
         * Initialize standalone editor
         * only when #editor exists.
         */

        this.initStandaloneEditor();

        /*
         * Bind standalone buttons.
         */

        this.bindEvents();

        /*
         * Load saved document.
         */

        if (AppState.editor) {
            registerDraftEvents();
        }

        /*
         * Start autosave.
         */

        startAutoSave();

        /*
         * Refresh UI.
         */

        UIManager.refresh();

        console.log(
            "DocEngine Ready"
        );
    },

    /* ======================================================
       Cache DOM
       ====================================================== */

    cacheDOM() {

        this.ui = {

            editor:
                document.querySelector(
                    "#editor"
                ),

            save:
                document.querySelector(
                    "#btn-save"
                ),

            approve:
                document.querySelector(
                    "#btn-approve"
                ),

            publish:
                document.querySelector(
                    "#btn-publish"
                )
        };
    },

    /* ======================================================
       Standalone Quill Editor
       ====================================================== */

    initStandaloneEditor() {

        if (!this.ui.editor) {
            return;
        }

        if (
            typeof Quill ===
            "undefined"
        ) {

            console.error(
                "Quill is not loaded."
            );

            return;
        }

        AppState.editor =
            new Quill(
                "#editor",
                {
                    theme: "snow",

                    modules: {
                        toolbar: [

                            [
                                "bold",
                                "italic",
                                "underline",
                                "strike"
                            ],

                            [
                                {
                                    header: 1
                                },
                                {
                                    header: 2
                                },
                                {
                                    header: 3
                                }
                            ],

                            [
                                {
                                    list: "ordered"
                                },
                                {
                                    list: "bullet"
                                }
                            ],

                            [
                                {
                                    align: []
                                }
                            ],

                            [
                                "blockquote",
                                "code-block"
                            ],

                            [
                                "link",
                                "image"
                            ],

                            [
                                "clean"
                            ]
                        ]
                    }
                }
            );
    },

    /* ======================================================
       Bind Standalone Events
       ====================================================== */

    bindEvents() {

        /*
         * Save
         */

        this.ui.save?.addEventListener(
            "click",
            () => {

                DraftManager.save();

            }
        );

        /*
         * Approve
         */

        this.ui.approve?.addEventListener(
            "click",
            async () => {

                await WorkflowManager.changeStatus(
                    CONFIG.WORKFLOW.APPROVED
                );

            }
        );

        /*
         * Publish
         */

        this.ui.publish?.addEventListener(
            "click",
            async () => {

                await WorkflowManager.changeStatus(
                    CONFIG.WORKFLOW.PUBLISHED
                );

            }
        );

        /*
         * Ctrl + S
         */

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    (
                        event.ctrlKey ||
                        event.metaKey
                    ) &&
                    event.key.toLowerCase() ===
                    "s"
                ) {

                    event.preventDefault();

                    DraftManager.save();
                }
            }
        );
    }
};

/* ==========================================================
   Draft Change Events
   ========================================================== */

function registerDraftEvents() {

    if (!AppState.editor) {
        return;
    }

    /*
     * Prevent duplicate listeners.
     */

    if (
        AppState.editor
            .__draftListenerRegistered
    ) {

        return;
    }

    AppState.editor
        .__draftListenerRegistered =
        true;

    AppState.editor.on(
        "text-change",
        function () {

            AppState.draftChanged =
                true;

            updateSaveStatus(
                "Unsaved Changes"
            );
        }
    );
}

/* ==========================================================
   Open Inline Editor
   ========================================================== */

function openEditor() {

    /*
     * Get exact current documentation
     * page URL/path.
     */

    const page =
        window.location.pathname;

    /*
     * Remember current page.
     */

    localStorage.setItem(
        "currentDoc",
        page
    );

    /*
     * Start inline editor directly.
     */

    if (
        typeof InlineEditor ===
        "undefined"
    ) {

        console.error(
            "InlineEditor is not available."
        );

        return;
    }

    InlineEditor.start();
}

/*
 * Make openEditor() available to
 * MkDocs inline buttons.
 */

window.openEditor =
    openEditor;
    /* ==========================================================
   Inline Editor
   ========================================================== */

const InlineEditor = {

    start() {

        /*
         * Prevent duplicate editor creation.
         */

        if (
            document.querySelector(
                "#inline-editor"
            )
        ) {

            return;
        }

        /*
         * Find MkDocs content area.
         */

        const contentRoot =
            document.querySelector(
                ".md-content__inner"
            );

        if (!contentRoot) {

            console.error(
                "Documentation content area not found."
            );

            return;
        }

        /*
         * Current documentation page
         * becomes document key.
         */

        AppState.currentDocument =
            window.location.pathname;

        localStorage.setItem(
            "currentDoc",
            AppState.currentDocument
        );

        /*
         * Save original rendered content.
         */

        const originalContent =
            contentRoot.innerHTML;

        /*
         * Check for existing local draft.
         */

        const savedDocument =
            DocumentStore.get(
                AppState.currentDocument
            );

        /*
         * Restore saved document state.
         */

        if (savedDocument) {

            AppState.currentStatus =
                savedDocument.status ||
                CONFIG.WORKFLOW.DRAFT;

            AppState.currentVersion =
                savedDocument.version ||
                1;

            AppState.statusText =
                DraftManager.getStatusText(
                    AppState.currentStatus
                );

            AppState.lastSaved =
                savedDocument.updatedAt ||
                null;

        } else {

            AppState.currentStatus =
                CONFIG.WORKFLOW.DRAFT;

            AppState.currentVersion =
                1;

            AppState.statusText =
                "Draft";

            AppState.lastSaved =
                null;
        }

        /*
         * Create temporary content container.
         */

        const tempContent =
            document.createElement(
                "div"
            );

        tempContent.innerHTML =
            originalContent;

        /*
         * Remove Edit buttons from
         * editable document content.
         */

        tempContent
            .querySelectorAll(
                ".edit-page-button"
            )
            .forEach(
                element => {
                    element.remove();
                }
            );

        /* ==================================================
           Editor Workspace
           ================================================== */

        const workspace =
            document.createElement(
                "div"
            );

        workspace.className =
            "inline-editor-workspace";

        /* ==================================================
           Toolbar
           ================================================== */

        const toolbar =
            document.createElement(
                "div"
            );

        toolbar.id =
            "inline-editor-toolbar";

        /* ==================================================
           Quill Editor Container
           ================================================== */

        const editorContainer =
            document.createElement(
                "div"
            );

        editorContainer.id =
            "inline-editor";

        /* ==================================================
           Status Area
           ================================================== */

        const status =
            document.createElement(
                "div"
            );

        status.className =
            "inline-editor-status";

        status.innerHTML = `

            <span>
                Status:
                <strong id="inline-workflow-status">
                    ${AppState.statusText}
                </strong>
            </span>

            <span id="inline-save-status">
                ${
                    AppState.lastSaved
                        ? "Saved " +
                          Time.format(
                              new Date(
                                  AppState.lastSaved
                              )
                          )
                        : "Ready to edit"
                }
            </span>

            <span>
                v<span id="inline-version-label">
                    ${AppState.currentVersion}
                </span>
            </span>

        `;

        /* ==================================================
           Workflow Actions
           ================================================== */

        const actions =
            document.createElement(
                "div"
            );

        actions.className =
            "inline-editor-actions";

        actions.innerHTML = `

            <button
                type="button"
                id="inline-save"
            >
                💾 Save Draft
            </button>

            <button
                type="button"
                id="inline-approve"
            >
                ✅ Approve
            </button>

            <button
                type="button"
                id="inline-publish"
            >
                🚀 Publish
            </button>

            <button
                type="button"
                id="inline-cancel"
            >
                ✖ Cancel
            </button>

        `;

        /* ==================================================
           Build Workspace
           ================================================== */

        workspace.appendChild(
            toolbar
        );

        workspace.appendChild(
            editorContainer
        );

        workspace.appendChild(
            status
        );

        workspace.appendChild(
            actions
        );

        /*
         * Replace documentation content
         * with editor workspace.
         */

        contentRoot.innerHTML = "";

        contentRoot.appendChild(
            workspace
        );

        /* ==================================================
           Initialize Quill
           ================================================== */

        if (
            typeof Quill ===
            "undefined"
        ) {

            console.error(
                "Quill is not loaded."
            );

            contentRoot.innerHTML =
                originalContent;

            return;
        }

        AppState.editor =
            new Quill(
                "#inline-editor",
                {
                    theme: "snow",

                    modules: {

                        toolbar: [

                            [
                                "bold",
                                "italic",
                                "underline",
                                "strike"
                            ],

                            [
                                {
                                    header: 1
                                },
                                {
                                    header: 2
                                },
                                {
                                    header: 3
                                }
                            ],

                            [
                                {
                                    list: "ordered"
                                },
                                {
                                    list: "bullet"
                                }
                            ],

                            [
                                {
                                    align: []
                                }
                            ],

                            [
                                "blockquote",
                                "code-block"
                            ],

                            [
                                "link",
                                "image"
                            ],

                            [
                                "clean"
                            ]

                        ]
                    }
                }
            );

        /* ==================================================
           Move Quill Toolbar
           ================================================== */

        const quillToolbar =
            workspace.querySelector(
                ".ql-toolbar"
            );

        if (quillToolbar) {

            toolbar.appendChild(
                quillToolbar
            );
        }

        /* ==================================================
           Load Content
           ================================================== */

        if (
            savedDocument &&
            savedDocument.content
        ) {

            AppState.editor.root.innerHTML =
                savedDocument.content;

        } else {

            AppState.editor.root.innerHTML =
                tempContent.innerHTML;
        }

        /*
         * Register editor change events.
         */

        registerDraftEvents();

        /*
         * Inline editor is active.
         */

        AppState.inlineMode =
            true;

        AppState.draftChanged =
            false;

        /*
         * Refresh UI before binding
         * workflow buttons.
         */

        UIManager.refresh();

        /* ==================================================
           Inline Workflow Buttons
           ================================================== */

        const inlineSave =
            document.querySelector(
                "#inline-save"
            );

        const inlineApprove =
            document.querySelector(
                "#inline-approve"
            );

        const inlinePublish =
            document.querySelector(
                "#inline-publish"
            );

        const inlineCancel =
            document.querySelector(
                "#inline-cancel"
            );

        /* ==================================================
           SAVE
           ================================================== */

        inlineSave?.addEventListener(
            "click",
            function () {

                console.log(
                    "Save Draft clicked"
                );

                DraftManager.save();

                UIManager.refresh();
            }
        );

        /* ==================================================
           APPROVE
           ================================================== */

        inlineApprove?.addEventListener(
            "click",
            async function () {

                console.log(
                    "Approve clicked"
                );

                const success =
                    await WorkflowManager.changeStatus(
                        CONFIG.WORKFLOW.APPROVED
                    );

                if (success) {

                    UIManager.refresh();
                }
            }
        );

        /* ==================================================
           PUBLISH
           ================================================== */

        inlinePublish?.addEventListener(
            "click",
            async function () {

                console.log(
                    "Publish clicked"
                );

                const success =
                    await WorkflowManager.changeStatus(
                        CONFIG.WORKFLOW.PUBLISHED
                    );

                if (success) {

                    UIManager.refresh();
                }
            }
        );

        /* ==================================================
           CANCEL
           ================================================== */

        inlineCancel?.addEventListener(
            "click",
            function () {

                console.log(
                    "Cancel clicked"
                );

                InlineEditor.cancel();
            }
        );

        /*
         * Move user to top of editor.
         */

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    },

    /* ======================================================
       Cancel Inline Editing
       ====================================================== */

    cancel() {

        /*
         * Cancel exits editing mode.
         *
         * Saved draft is NOT deleted.
         */

        AppState.editor =
            null;

        AppState.inlineMode =
            false;

        window.location.reload();
    }
};
/* ==========================================================
   DocEngine Application Startup
   ========================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        App.init();

    }
);