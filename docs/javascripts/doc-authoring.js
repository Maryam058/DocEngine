/* ==========================================================
   DocEngine Editor
   Inline Documentation Editor
========================================================== */

/* ==========================================================
   Configuration
========================================================== */

const CONFIG = {

    AUTOSAVE_DELAY: 5000,

    PUBLISH_API:
        "https://doc-engine-nu.vercel.app/api/publish",

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

    currentStatus:
        CONFIG.WORKFLOW.DRAFT,

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

            const value =
                localStorage.getItem(key);

            return value
                ? JSON.parse(value)
                : defaultValue;

        }

        catch (error) {

            console.error(
                "Storage load error:",
                error
            );

            return defaultValue;

        }

    },


    save(key, value) {

        try {

            localStorage.setItem(
                key,
                JSON.stringify(value)
            );

        }

        catch (error) {

            console.error(
                "Storage save error:",
                error
            );

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

        return Storage.load(
            CONFIG.STORAGE.DOCUMENTS,
            {}
        );

    },


    get(page) {

        if (!page) {

            return null;

        }

        const docs =
            this.getAll();

        return docs[page] || null;

    },


    save(page, data) {

        if (!page) {

            return;

        }

        const docs =
            this.getAll();

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

        document.querySelector(
            "#save-status"
        ),

        document.querySelector(
            "#inline-save-status"
        )

    ];


    elements.forEach(
        element => {

            if (element) {

                element.textContent =
                    message;

            }

        }
    );

}
/* ==========================================================
   Draft Manager
========================================================== */

const DraftManager = {

    getContent() {

        if (!AppState.editor) {

            return "";

        }

        return AppState.editor.root.innerHTML;

    },


    setContent(html) {

        if (!AppState.editor) {

            return;

        }

        AppState.editor.root.innerHTML =
            html || "";

    },


    load() {

        const page =
            AppState.currentDocument;

        if (!page) {

            return null;

        }

        const doc =
            DocumentStore.get(page);

        if (!doc) {

            return null;

        }

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
         * Always save the latest editor content
         * before workflow action.
         */

        if (AppState.editor) {

            DraftManager.save();

        }


        /* ======================================================
           APPROVE
        ====================================================== */

        if (
            status ===
            CONFIG.WORKFLOW.APPROVED
        ) {

            AppState.currentStatus =
                CONFIG.WORKFLOW.APPROVED;

            AppState.statusText =
                "Approved";


            /*
             * Create history only for
             * actual workflow action.
             */

            HistoryManager.add(
                "approve",
                "Document Approved"
            );


            /*
             * Create a version for approval.
             */

            VersionManager.create(
                "approve"
            );


            /*
             * Increase version after
             * creating the approved version.
             */

            AppState.currentVersion++;


            DraftManager.save();

            UIManager.refresh();

            updateSaveStatus(
                "Approved"
            );

            return true;

        }


        /* ======================================================
           PUBLISH
        ====================================================== */

        if (
            status ===
            CONFIG.WORKFLOW.PUBLISHED
        ) {

            try {

                updateSaveStatus(
                    "Publishing..."
                );


                /*
                 * Current page path.
                 *
                 * Example:
                 * /DocEngine/UserGuide/Register a patient/
                 */

                const page =
                    AppState.currentDocument;


                /*
                 * Current edited HTML.
                 */

                const content =
                    DraftManager.getContent();


                console.log(
                    "Publishing document:",
                    page
                );


                /*
                 * Send ONE request to the
                 * Vercel publish API.
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


                /*
                 * Read response safely.
                 */

                let result;

                try {

                    result =
                        await response.json();

                }

                catch (jsonError) {

                    throw new Error(
                        "Publish server returned an invalid response."
                    );

                }


                console.log(
                    "Publish response:",
                    response.status,
                    result
                );


                /*
                 * Stop if API returned
                 * an error.
                 */

                if (!response.ok) {

                    throw new Error(

                        result.message ||
                        `Publish API returned ${response.status}`

                    );

                }


                if (
                    !result.success
                ) {

                    throw new Error(

                        result.message ||
                        "Publishing failed."

                    );

                }


                /* ==================================================
                   PUBLISH SUCCESS
                ================================================== */


                /*
                 * Only change status AFTER
                 * GitHub publish succeeds.
                 */

                AppState.currentStatus =
                    CONFIG.WORKFLOW.PUBLISHED;

                AppState.statusText =
                    "Published";


                /*
                 * Create history entry.
                 */

                HistoryManager.add(
                    "publish",
                    "Document Published"
                );


                /*
                 * Create published version.
                 */

                VersionManager.create(
                    "publish"
                );


                /*
                 * Increase version.
                 */

                AppState.currentVersion++;


                /*
                 * Save final state locally.
                 */

                DraftManager.save();


                updateSaveStatus(
                    "Published successfully"
                );


                UIManager.refresh();


                alert(
                    "✅ Published successfully!"
                );


                return true;

            }

            catch (error) {

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


                /*
                 * IMPORTANT:
                 * Do NOT mark document as
                 * Published when API fails.
                 */

                return false;

            }

        }


        /* ======================================================
           UNKNOWN STATUS
        ====================================================== */

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


        /* ======================================================
           Update Status
        ====================================================== */

        statusElements.forEach(
            element => {

                if (element) {

                    element.textContent =
                        AppState.statusText;

                }

            }
        );


        /* ======================================================
           Update Version
        ====================================================== */

        versionElements.forEach(
            element => {

                if (element) {

                    element.textContent =
                        AppState.currentVersion;

                }

            }
        );


        /* ======================================================
           Update Save Status
        ====================================================== */

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
         * Identify the current document.
         *
         * currentDoc is set by openEditor().
         */

        AppState.currentDocument =
            localStorage.getItem(
                "currentDoc"
            ) ||
            window.location.pathname;


        this.cacheDOM();


        /*
         * Initialize standalone editor
         * only if #editor exists.
         */

        this.initStandaloneEditor();


        /*
         * Bind standalone editor buttons.
         */

        this.bindEvents();


        /*
         * Load saved document if
         * standalone editor is active.
         */

        if (AppState.editor) {

            DraftManager.load();

            registerDraftEvents();
            const inlineSave =
    document.querySelector("#inline-save");

const inlineApprove =
    document.querySelector("#inline-approve");

const inlinePublish =
    document.querySelector("#inline-publish");

const inlineCancel =
    document.querySelector("#inline-cancel");


inlineSave?.addEventListener(
    "click",
    () => {
        DraftManager.save();
    }
);


inlineApprove?.addEventListener(
    "click",
    async () => {

        await WorkflowManager.changeStatus(
            CONFIG.WORKFLOW.APPROVED
        );

    }
);


inlinePublish?.addEventListener(
    "click",
    async () => {

        await WorkflowManager.changeStatus(
            CONFIG.WORKFLOW.PUBLISHED
        );

    }
);


inlineCancel?.addEventListener(
    "click",
    () => {

        InlineEditor.cancel();

    }
);

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

        /*
         * The standalone editor is only
         * used when #editor exists.
         *
         * Documentation pages use
         * InlineEditor instead.
         */

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

            () => {

                WorkflowManager.changeStatus(
                    CONFIG.WORKFLOW.APPROVED
                );

            }

        );


        /*
         * Publish
         */

        this.ui.publish?.addEventListener(

            "click",

            () => {

                WorkflowManager.changeStatus(
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
        AppState.editor.__draftListenerRegistered
    ) {

        return;

    }


    AppState.editor.__draftListenerRegistered =
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
     * Get the exact current documentation
     * page URL/path.
     */

    const page =
        window.location.pathname;


    /*
     * Remember which documentation page
     * is being edited.
     */

    localStorage.setItem(
        "currentDoc",
        page
    );


    /*
     * Start inline editor directly.
     *
     * Do NOT redirect to /editor/.
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
 * inline onclick="openEditor()"
 * buttons generated by MkDocs.
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
         * becomes the document key.
         */

        AppState.currentDocument =
            window.location.pathname;


        localStorage.setItem(
            "currentDoc",
            AppState.currentDocument
        );


        /*
         * Save original rendered content
         * before replacing it with editor.
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

        }

        else {

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
         *
         * This lets us remove the Edit button
         * from the content before putting it
         * inside Quill.
         */

        const tempContent =
            document.createElement(
                "div"
            );


        tempContent.innerHTML =
            originalContent;


        /*
         * Remove Edit Page buttons from
         * the editable document.
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


        /* ======================================================
           Editor Workspace
        ====================================================== */

        const workspace =
            document.createElement(
                "div"
            );


        workspace.className =
            "inline-editor-workspace";


        /* ======================================================
           Toolbar
        ====================================================== */

        const toolbar =
            document.createElement(
                "div"
            );


        toolbar.id =
            "inline-editor-toolbar";


        /* ======================================================
           Quill Editor Container
        ====================================================== */

        const editorContainer =
            document.createElement(
                "div"
            );


        editorContainer.id =
            "inline-editor";


        /* ======================================================
           Status Area
        ====================================================== */

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


        /* ======================================================
           Workflow Actions
        ====================================================== */

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


        /* ======================================================
           Build Workspace
        ====================================================== */

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


        /* ======================================================
           Initialize Quill
        ====================================================== */

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


        /* ======================================================
           Move Quill Toolbar
        ====================================================== */

        const quillToolbar =
            workspace.querySelector(
                ".ql-toolbar"
            );


        if (quillToolbar) {

            toolbar.appendChild(
                quillToolbar
            );

        }


        /* ======================================================
           Load Content
        ====================================================== */

        if (
            savedDocument &&
            savedDocument.content
        ) {

            AppState.editor.root.innerHTML =
                savedDocument.content;

        }

        else {

            AppState.editor.root.innerHTML =
                tempContent.innerHTML;

        }


        /*
         * Register editor change events.
         */
        if (AppState.editor) {

    DraftManager.load();
            registerDraftEvents();


        /* ======================================================
           Inline Workflow Button Events
        ====================================================== */

        const inlineSave =
            document.querySelector("#inline-save");

        const inlineApprove =
            document.querySelector("#inline-approve");

        const inlinePublish =
            document.querySelector("#inline-publish");

        const inlineCancel =
            document.querySelector("#inline-cancel");


        inlineSave?.addEventListener(
            "click",
            function () {

                console.log("Save Draft clicked");

                DraftManager.save();

            }
        );


        inlineApprove?.addEventListener(
            "click",
            async function () {

                console.log("Approve clicked");

                await WorkflowManager.changeStatus(
                    CONFIG.WORKFLOW.APPROVED
                );

            }
        );


        inlinePublish?.addEventListener(
            "click",
            async function () {

                console.log("Publish clicked");

                await WorkflowManager.changeStatus(
                    CONFIG.WORKFLOW.PUBLISHED
                );

            }
        );


        inlineCancel?.addEventListener(
            "click",
            function () {

                console.log("Cancel clicked");

                InlineEditor.cancel();

            }
        );


        /*
         * Editor is now active.
         */

        AppState.inlineMode =
            true;


        AppState.draftChanged =
            false;
    }

        /*
         * Refresh status/version UI.
         */

        UIManager.refresh();


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
         * Do NOT delete the saved draft.
         *
         * Cancel only exits editing mode.
         */

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