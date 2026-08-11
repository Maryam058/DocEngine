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
        "https://doc-engine-nu.vercel.app/api/publish"

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

    autoSave =
        setInterval(

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

            action,

            message,

            time:
                Time.now(),

            document:
                AppState.currentDocument

        });

        if (
            history.length > 100
        ) {

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

            action,

            content:
                DraftManager.getContent(),

            createdAt:
                Time.now()

        });

        if (
            versions.length > 50
        ) {

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

/* ==========================================================
   Workflow Manager
========================================================== */
const WorkflowManager = {

    async changeStatus(status) {

        if (!AppState.currentDocument) {
            return;
        }

        /*
         * Always save latest editor content
         * before changing workflow state.
         */
        if (AppState.editor) {
            DraftManager.save();
        }

        /*
         * Publish to GitHub through Vercel API.
         */
        if (status === CONFIG.WORKFLOW.PUBLISHED) {

            try {

                updateSaveStatus(
                    "Publishing..."
                );

                const response = await fetch(
                    CONFIG.PUBLISH_API,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            page:
                                AppState.currentDocument,

                            content:
                                DraftManager.getContent()
                        })
                    }
                );

                if (!response.ok) {

                    throw new Error(
                        `Publish API returned ${response.status}`
                    );
                }

                const result =
                    await response.json();

                if (!result.success) {

                    throw new Error(
                        result.message ||
                        "Publishing failed."
                    );
                }

                /*
                 * Only mark Published after
                 * the server confirms success.
                 */
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

                updateSaveStatus(
                    "Published successfully"
                );

                UIManager.refresh();

                alert(
                    "Published successfully!"
                );

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
                    "Published failed: " +
                    error.message
                );
            }

            return;
        }

        /*
         * Normal workflow states.
         */
        AppState.currentStatus =
            status;

        AppState.statusText =
            DraftManager.getStatusText(
                status
            );

        if (
            status ===
            CONFIG.WORKFLOW.APPROVED
        ) {

            HistoryManager.add(
                "approve",
                "Document Approved"
            );

            VersionManager.create(
                "approve"
            );
        }

        DraftManager.save();

        UIManager.refresh();
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


        statusElements.forEach(
            element => {

                if (element) {

                    element.textContent =
                        AppState.statusText;

                }

            }
        );


        versionElements.forEach(
            element => {

                if (element) {

                    element.textContent =
                        AppState.currentVersion;

                }

            }
        );


        /*
         * Update save status if a saved time exists.
         */

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


    init() {

        /*
         * Identify current document FIRST.
         */

        AppState.currentDocument =
            localStorage.getItem(
                "currentDoc"
            ) ||
            window.location.pathname;


        this.cacheDOM();

        /*
         * Keep standalone editor compatibility.
         * This only runs if #editor exists.
         */

        this.initStandaloneEditor();

        this.bindEvents();

        /*
         * Load existing saved document
         * if a standalone editor is being used.
         */

        if (AppState.editor) {

            DraftManager.load();

            registerDraftEvents();

        }

        startAutoSave();

        UIManager.refresh();

        console.log(
            "DocEngine Ready"
        );

    },


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


    initStandaloneEditor() {

        /*
         * This is only for the old
         * standalone editor page.
         *
         * Normal documentation pages
         * use InlineEditor instead.
         */

        if (!this.ui.editor) {

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


    bindEvents() {

        this.ui.save?.addEventListener(
            "click",
            () =>
                DraftManager.save()
        );


        this.ui.approve?.addEventListener(
            "click",
            () =>
                WorkflowManager.changeStatus(
                    CONFIG.WORKFLOW.APPROVED
                )
        );

        this.ui.publish?.addEventListener(
            "click",
            () =>
                WorkflowManager.changeStatus(
                    CONFIG.WORKFLOW.PUBLISHED
                )
        );


        /*
         * Ctrl + S
         */

        document.addEventListener(
            "keydown",
            function (e) {

                if (
                    (e.ctrlKey ||
                        e.metaKey) &&
                    e.key.toLowerCase() === "s"
                ) {

                    e.preventDefault();

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

    const page =
        window.location.pathname;


    /*
     * Remember exactly which page
     * the user is editing.
     */

    localStorage.setItem(
        "currentDoc",
        page
    );


    /*
     * Do NOT redirect to /editor/.
     */

    InlineEditor.start();

}


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
         * Current page becomes the document key.
         */

        AppState.currentDocument =
            window.location.pathname;

        localStorage.setItem(
            "currentDoc",
            AppState.currentDocument
        );


        /*
         * Store the original rendered page.
         * This is used only when no saved draft exists.
         */

        const originalContent =
            contentRoot.innerHTML;


        /*
         * Check whether this page already
         * has a saved draft.
         */

        const savedDocument =
            DocumentStore.get(
                AppState.currentDocument
            );


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
         * Remove Edit Page button
         * from the editable content.
         */

        const tempContent =
            document.createElement(
                "div"
            );

        tempContent.innerHTML =
            originalContent;


        tempContent
            .querySelectorAll(
                ".edit-page-button"
            )
            .forEach(
                element =>
                    element.remove()
            );


        /*
         * Create editor workspace.
         */

        const workspace =
            document.createElement(
                "div"
            );

        workspace.className =
            "inline-editor-workspace";


        /*
         * Toolbar container.
         */

        const toolbar =
            document.createElement(
                "div"
            );

        toolbar.id =
            "inline-editor-toolbar";


        /*
         * Editor container.
         */

        const editorContainer =
            document.createElement(
                "div"
            );

        editorContainer.id =
            "inline-editor";


        /*
         * Status area.
         */

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


        /*
         * Workflow actions.
         */

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
    class="editor-btn save-btn">
    💾 Save Draft
</button>

<button
    type="button"
    id="inline-approve"
    class="editor-btn approve-btn">
    ✅ Approve
</button>

<button
    type="button"
    id="inline-publish"
    class="editor-btn publish-btn">
    🚀 Publish
</button>

<button
    type="button"
    id="inline-cancel"
    class="editor-btn cancel-btn">
    ✖ Cancel
</button>
`;
        

        /*
         * Build workspace.
         */

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
         * with the editor workspace.
         */

        contentRoot.innerHTML = "";

        contentRoot.appendChild(
            workspace
        );


        /*
         * Initialize Quill.
         */

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


        /*
         * Move Quill toolbar into
         * our custom toolbar container.
         */

        const quillToolbar =
            workspace.querySelector(
                ".ql-toolbar"
            );


        if (quillToolbar) {

            toolbar.appendChild(
                quillToolbar
            );

        }


        /*
         * Load saved draft if one exists.
         * Otherwise load the current page content.
         */

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
         * Register editor changes.
         */

        registerDraftEvents();


        /*
         * Inline Save.
         */

        document
            .querySelector(
                "#inline-save"
            )
            ?.addEventListener(
                "click",
                function () {

                    DraftManager.save();

                }
            );


        /*
         * Approve.
         */

        document
            .querySelector(
                "#inline-approve"
            )
            ?.addEventListener(
                "click",
                function () {

                    WorkflowManager.changeStatus(
                        CONFIG.WORKFLOW.APPROVED
                    );

                }
            );

        /*
         * Publish.
         */

document
    .querySelector(
        "#inline-publish"
    )
    ?.addEventListener(
        "click",
        async function (event) {

            event.preventDefault();
            event.stopPropagation();

            const publishButton =
                document.querySelector(
                    "#inline-publish"
                );

            if (publishButton) {
                publishButton.disabled = true;
                publishButton.textContent =
                    "🚀 Publishing...";
            }

            try {

                console.log(
                    "Publish button clicked"
                );

                /*
                 * Save latest editor content locally.
                 */
                DraftManager.save();

                const page =
                    AppState.currentDocument;

                const html =
                    DraftManager.getContent();

                console.log(
                    "Publishing page:",
                    page
                );

                /*
                 * Send content to local
                 * Git publish server.
                 */
                const response =
                    await fetch(
    "https://doc-engine-g2cbb3gw2-doc-engine.vercel.app/api/publish",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                page: page,
                                content: html
                            })
                        }
                    );

                console.log(
                    "Publish server response:",
                    response.status
                );

                const result =
                    await response.json();

                console.log(
                    "Publish result:",
                    result
                );

                if (
                    !response.ok ||
                    !result.success
                ) {

                    throw new Error(
                        result.message ||
                        "Publishing failed."
                    );

                }

                /*
                 * Only mark Published after
                 * GitHub publish succeeds.
                 */
                WorkflowManager.changeStatus(
                    CONFIG.WORKFLOW.PUBLISHED
                );

                updateSaveStatus(
                    "Published successfully"
                );

                alert(
                    "✅ Published successfully!"
                );

            }

            catch (error) {

                console.error(
                    "Publish error:",
                    error
                );

                alert(
                    "❌ Publish failed:\n\n" +
                    error.message
                );

            }

            finally {

                if (publishButton) {

                    publishButton.disabled =
                        false;

                    publishButton.textContent =
                        "🚀 Publish";

                }

            }

        }
    );

        /*
         * Cancel.
         */

        document
            .querySelector(
                "#inline-cancel"
            )
            ?.addEventListener(
                "click",
                function () {

                    InlineEditor.cancel();

                }
            );


        /*
         * Hide any remaining Edit Page buttons.
         */

        document
            .querySelectorAll(
                ".edit-page-button"
            )
            .forEach(
                button => {

                    button.style.display =
                        "none";

                }
            );


        AppState.inlineMode =
            true;

        AppState.draftChanged =
            false;


        /*
         * Refresh status/version UI.
         */

        UIManager.refresh();


        /*
         * Move user to editor.
         */

        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    },


    cancel() {

        /*
         * Do not delete the saved draft.
         * Cancel simply exits editing mode.
         */

        window.location.reload();

    }

};


/* ==========================================================
   Start Application
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    function () {

        App.init();

    }

);