/* ==========================================================
   Configuration
========================================================== */

const CONFIG = {

    AUTOSAVE_DELAY: 5000,

    PUBLISH_API:
        "https://doc-engine-nu.vercel.app/api/publish",

    AI_SUGGEST_API:
        "https://doc-engine-nu.vercel.app/api/ai-suggest",

    AI_REQUEST_TIMEOUT: 30000,

    PRODUCTION_URL:
        "https://doc-engine-nu.vercel.app",

    STORAGE: {
        DOCUMENTS: "docengine_documents",
        HISTORY: "docengine_history",
        VERSIONS: "docengine_versions",
        INSTANT_PUBLISHED: "docengine_instant_published"
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

    originalEditButton: null,

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

        } catch (error) {

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

        } catch (error) {

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

        /*
         * Preserve the original createdAt across saves.
         * Only the first save for a page establishes it.
         */

        const existing =
            docs[page];

        docs[page] = {
            ...data,
            createdAt:
                (existing && existing.createdAt) ||
                data.createdAt ||
                data.updatedAt ||
                Time.now()
        };

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


    elements.forEach(element => {

        if (element) {

            element.textContent =
                message;

        }

    });

}


/* ==========================================================
   Page Check
========================================================== */

function isHomePage() {

    const path =
        window.location.pathname
            .replace(/\/+$/, "");

    return (
        path === "" ||
        path === "/index.html"
    );

}


/* ==========================================================
   Create Edit Page Button
========================================================== */

function createEditPageButton() {

    const button =
        document.createElement("button");


    button.type =
        "button";


    button.className =
        "edit-page-button";


    button.textContent =
        "✏️ Edit Page";


    button.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            openEditor();

        }
    );


    return button;

}


/* ==========================================================
   Ensure Edit Page Button Exists
========================================================== */

function ensureEditPageButton(contentRoot) {

    /*
     * Home page must NEVER have
     * an Edit Page button.
     */

    if (isHomePage()) {

        document
            .querySelectorAll(
                ".edit-page-button, .edit-btn"
            )
            .forEach(button => {

                button.remove();

            });

        return null;

    }


    /*
     * Content area must exist.
     */

    if (!contentRoot) {

        return null;

    }


    /*
     * Find existing button.
     */

    let editButton =
        contentRoot.querySelector(
            ".edit-page-button, .edit-btn"
        );


    /*
     * Remove duplicate buttons.
     */

    const existingButtons =
        contentRoot.querySelectorAll(
            ".edit-page-button, .edit-btn"
        );


    existingButtons.forEach(
        (button, index) => {

            if (index > 0) {

                button.remove();

            }

        }
    );


    /*
     * Create button if it
     * does not already exist.
     */

    if (!editButton) {

        editButton =
            createEditPageButton();


        /*
         * Put button at the top
         * of documentation content.
         */

        contentRoot.prepend(
            editButton
        );

    }


    /*
     * Keep button visible
     * and right aligned.
     */

    editButton.style.display =
        "flex";

    editButton.style.marginLeft =
        "auto";

    editButton.style.marginRight =
        "0";


    /*
     * Make sure clicking the
     * button always opens editor.
     */

    editButton.onclick =
        function (event) {

            event.preventDefault();

            openEditor();

        };


    return editButton;

}


/* ==========================================================
   Instant Published Content Storage
========================================================== */

function saveInstantPublishedContent(
    page,
    content
) {

    try {

        localStorage.setItem(

            CONFIG.STORAGE.INSTANT_PUBLISHED,

            JSON.stringify({

                page:
                    page,

                content:
                    content,

                publishedAt:
                    Date.now()

            })

        );

    } catch (error) {

        console.error(
            "Could not save instant published content:",
            error
        );

    }

}


/* ==========================================================
   Render Instant Published Content
========================================================== */

function renderInstantPublishedContent() {

    try {

        const stored =
            localStorage.getItem(
                CONFIG.STORAGE.INSTANT_PUBLISHED
            );


        /*
         * Nothing stored.
         * Just make sure Edit button exists.
         */

        if (!stored) {

            const contentRoot =
                document.querySelector(
                    ".md-content__inner"
                );


            if (contentRoot) {

                ensureEditPageButton(
                    contentRoot
                );

            }


            return false;

        }


        const data =
            JSON.parse(stored);


        const currentPage =
            window.location.pathname;


        /*
         * Stored content belongs
         * to another page.
         */

        if (
            !data ||
            data.page !== currentPage ||
            !data.content
        ) {

            const contentRoot =
                document.querySelector(
                    ".md-content__inner"
                );


            if (contentRoot) {

                ensureEditPageButton(
                    contentRoot
                );

            }


            return false;

        }


        const contentRoot =
            document.querySelector(
                ".md-content__inner"
            );


        if (!contentRoot) {

            return false;

        }


        /*
         * Preserve current Edit button
         * before replacing content.
         */

        let editButton =
            contentRoot.querySelector(
                ".edit-page-button, .edit-btn"
            );


        /*
         * Render instant published content.
         */

        contentRoot.innerHTML =
            data.content;


        /*
         * Restore existing button.
         */

        if (editButton) {

            contentRoot.prepend(
                editButton
            );

        }


        /*
         * If button was not available,
         * create a new one.
         */

        ensureEditPageButton(
            contentRoot
        );


        console.log(
            "Instant published content rendered."
        );


        return true;

    } catch (error) {

        console.error(
            "Could not render instant published content:",
            error
        );


        const contentRoot =
            document.querySelector(
                ".md-content__inner"
            );


        if (contentRoot) {

            ensureEditPageButton(
                contentRoot
            );

        }


        return false;

    }

}
/* ==========================================================
   Draft Manager
========================================================== */

const DraftManager = {

    /* ======================================================
       Get Editor Content
    ====================================================== */

    getContent() {

        if (!AppState.editor) {

            return "";

        }

        return AppState.editor.root.innerHTML;

    },


    /* ======================================================
       Set Editor Content
    ====================================================== */

    setContent(html) {

        if (!AppState.editor) {

            return;

        }

        AppState.editor.root.innerHTML =
            html || "";

    },


    /* ======================================================
       Load Saved Document
    ====================================================== */

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


    /* ======================================================
       Save Document
    ====================================================== */

    save() {

        const page =
            AppState.currentDocument;


        if (!page) {

            console.warn(
                "No current document selected."
            );

            return false;

        }


        if (!AppState.editor) {

            console.warn(
                "Editor is not initialized."
            );

            return false;

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


        return true;

    },


    /* ======================================================
       Status Text
    ====================================================== */

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

    clearInterval(
        autoSave
    );


    autoSave =
        setInterval(

            () => {

                /*
                 * Autosave only saves the document.
                 *
                 * It does NOT create history entries.
                 * It does NOT create versions.
                 */

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

    /* ======================================================
       Get History
    ====================================================== */

    getAll() {

        return Storage.load(

            CONFIG.STORAGE.HISTORY,

            []

        );

    },


    /* ======================================================
       Add History Entry
    ====================================================== */

    add(action, message) {

        const history =
            this.getAll();


        history.unshift({

            action:
                action,

            message:
                message,

            time:
                Time.now(),

            document:
                AppState.currentDocument

        });


        /*
         * Keep maximum 100 entries.
         */

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

    /* ======================================================
       Get Versions
    ====================================================== */

    getAll() {

        return Storage.load(

            CONFIG.STORAGE.VERSIONS,

            []

        );

    },


    /* ======================================================
       Create Version Snapshot
    ====================================================== */

    create(action) {

        const versions =
            this.getAll();


        versions.unshift({

            document:
                AppState.currentDocument,

            version:
                AppState.currentVersion,

            action:
                action,

            content:
                DraftManager.getContent(),

            createdAt:
                Time.now(),

            author:
                localStorage.getItem("docengine_author") ||
                "Unknown"

        });


        /*
         * Keep maximum 50 versions.
         */

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
   Draft Change Events
========================================================== */

function registerDraftEvents() {

    if (!AppState.editor) {

        return;

    }


    /*
     * Prevent duplicate event listeners.
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
   Load Latest Published Content
========================================================== */

async function loadLatestPublishedContent(page) {

    try {

        const contentRoot =
            document.querySelector(
                ".md-content__inner"
            );


        if (!contentRoot) {

            console.warn(
                "Documentation content area not found."
            );

            return false;

        }


        /* ==================================================
           Build Publish API URL
        ================================================== */

        const cacheBuster =
            `_docengine_live=${Date.now()}`;


        const separator =
            CONFIG.PUBLISH_API.includes("?")
                ? "&"
                : "?";


        const apiURL =
            CONFIG.PUBLISH_API +
            separator +
            cacheBuster;


        console.log(
            "Loading latest published content:",
            page
        );


        /* ==================================================
           Request Latest Published Content
        ================================================== */

        const response =
            await fetch(

                apiURL,

                {

                    method: "GET",

                    cache: "no-store",

                    headers: {

                        "Cache-Control":
                            "no-cache",

                        "Pragma":
                            "no-cache"

                    }

                }

            );


        /* ==================================================
           Read API Response
        ================================================== */

        const data =
            await response.json();


        console.log(
            "Latest published content response:",
            response.status,
            data
        );


        if (
            !response.ok ||
            !data.success ||
            !data.content
        ) {

            console.warn(
                "Latest published content could not be loaded."
            );

            return false;

        }


        /* ==================================================
           Preserve Edit Page Button
        ================================================== */

        let editButton =
            contentRoot.querySelector(
                ".edit-page-button, .edit-btn"
            );


        /*
         * If the button is not currently available,
         * use the original saved button.
         */

        if (!editButton) {

            editButton =
                AppState.originalEditButton;

        }


        /* ==================================================
           Render Latest Published Content
        ================================================== */

        contentRoot.innerHTML =
            data.content;


        /* ==================================================
           Restore Edit Page Button
        ================================================== */

        if (editButton) {

            contentRoot.prepend(
                editButton
            );

        }


        /*
         * Final safety check.
         *
         * If button was not available,
         * create it automatically.
         */

        ensureEditPageButton(
            contentRoot
        );


        /* ==================================================
           Save Instant Published Content
        ================================================== */

        saveInstantPublishedContent(
            page,
            data.content
        );


        console.log(
            "Latest published content rendered successfully."
        );


        return true;


    } catch (error) {

        console.error(
            "Could not load latest published content:",
            error
        );


        /*
         * Even if API rendering fails,
         * keep Edit Page button available.
         */

        const contentRoot =
            document.querySelector(
                ".md-content__inner"
            );


        if (contentRoot) {

            ensureEditPageButton(
                contentRoot
            );

        }


        return false;

    }

}

/* ==========================================================
   Workflow Modal
========================================================== */

function showWorkflowModal(options = {}) {

    const {
        title = "DocEngine",
        message = "",
        type = "info",
        confirmText = "OK",
        cancelText = null,
        onConfirm = null
    } = options;


    /* ======================================================
       Remove Existing Modal
    ====================================================== */

    const existingModal =
        document.querySelector(
            "#docengine-workflow-modal"
        );


    if (existingModal) {

        existingModal.remove();

    }


    /* ======================================================
       Modal Overlay
    ====================================================== */

    const overlay =
        document.createElement("div");


    overlay.id =
        "docengine-workflow-modal";


    overlay.className =
        "docengine-modal-overlay";


    /* ======================================================
       Modal Box
    ====================================================== */

    const modal =
        document.createElement("div");


    modal.className =
        "docengine-modal";


    /* ======================================================
       Icon
    ====================================================== */

    let icon = "ℹ️";


    if (type === "success") {

        icon = "✅";

    }

    else if (type === "warning") {

        icon = "⚠️";

    }

    else if (type === "error") {

        icon = "❌";

    }


    /* ======================================================
       Modal Content
    ====================================================== */

    modal.innerHTML = `

        <div class="docengine-modal-icon">
            ${icon}
        </div>

        <div class="docengine-modal-title">
            ${title}
        </div>

        <div class="docengine-modal-message">
            ${message}
        </div>

        <div class="docengine-modal-actions">

            ${
                cancelText
                    ? `
                        <button
                            type="button"
                            class="docengine-modal-cancel"
                            id="docengine-modal-cancel"
                        >
                            ${cancelText}
                        </button>
                    `
                    : ""
            }

            <button
                type="button"
                class="docengine-modal-confirm"
                id="docengine-modal-confirm"
            >
                ${confirmText}
            </button>

        </div>

    `;


    /* ======================================================
       Add Modal To Page
    ====================================================== */

    overlay.appendChild(
        modal
    );


    document.body.appendChild(
        overlay
    );


    /* ======================================================
       Confirm Button
    ====================================================== */

    const confirmButton =
        document.querySelector(
            "#docengine-modal-confirm"
        );


    confirmButton?.addEventListener(

        "click",

        async function () {

            overlay.remove();


            if (typeof onConfirm === "function") {

                try {

                    await onConfirm();

                }

                catch (error) {

                    console.error(
                        "Workflow confirmation error:",
                        error
                    );

                }

            }

        }

    );


    /* ======================================================
       Cancel Button
    ====================================================== */

    const cancelButton =
        document.querySelector(
            "#docengine-modal-cancel"
        );


    cancelButton?.addEventListener(

        "click",

        function () {

            overlay.remove();

        }

    );


    /* ======================================================
       Close On Background Click
    ====================================================== */

    overlay.addEventListener(

        "click",

        function (event) {

            if (
                event.target === overlay
            ) {

                overlay.remove();

            }

        }

    );

}

/* ==========================================================
   Workflow Manager
========================================================== */

const WorkflowManager = {

    /* ======================================================
       Change Document Status
    ====================================================== */

    async changeStatus(status) {

        /* ==================================================
           Validate Current Document
        ================================================== */

        if (!AppState.currentDocument) {

            console.warn(
                "No current document selected."
            );

            return false;

        }


        /* ==================================================
           Always Save Latest Editor Content
           Before Workflow Action
        ================================================== */

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


            /* ----------------------------------------------
               History
            ---------------------------------------------- */

            HistoryManager.add(

                "approve",

                "Document Approved"

            );


            /* ----------------------------------------------
               Version
            ---------------------------------------------- */

            VersionManager.create(
                "approve"
            );


            /*
             * Increase version after
             * approved snapshot.
             */

            AppState.currentVersion++;


            /* ----------------------------------------------
               Save Document
            ---------------------------------------------- */

            DraftManager.save();


            /* ----------------------------------------------
               Refresh UI
            ---------------------------------------------- */

            UIManager.refresh();


            updateSaveStatus(
                "Approved"
            );


            /* ----------------------------------------------
               Professional Success Modal
            ---------------------------------------------- */

            showWorkflowModal({

                title:
                    "Document Approved",

                message:
                    "The document has been approved successfully and is ready to be published.",

                type:
                    "success",

                confirmText:
                    "OK"

            });


            return true;

        }


        /* ==================================================
           PUBLISH
        ================================================== */

        if (
            status ===
            CONFIG.WORKFLOW.PUBLISHED
        ) {

            /* ==================================================
               Publishing Requires Approval
            ================================================== */

            if (
                AppState.currentStatus !==
                CONFIG.WORKFLOW.APPROVED
            ) {

                showWorkflowModal({

                    title:
                        "Approval Required",

                    message:
                        "Please approve the document before publishing it.",

                    type:
                        "warning",

                    confirmText:
                        "OK"

                });


                return false;

            }


            /* ==================================================
               Publish Confirmation Modal
            ================================================== */

            showWorkflowModal({

                title:
                    "Publish Document",

                message:
                    "This will make the current approved version live on your documentation site.",

                type:
                    "info",

                confirmText:
                    "Publish",

                cancelText:
                    "Cancel",

                onConfirm:
                    async () => {

                        await this.publishDocument();

                    }

            });


            /*
             * Do not continue into the actual
             * publishing process yet.
             *
             * The modal confirmation will
             * call publishDocument().
             */

            return false;

        }


        /* ==================================================
           Unknown Workflow Status
        ================================================== */

        console.warn(
            "Unknown workflow status:",
            status
        );


        return false;

    },


    /* ======================================================
       Actual Publish Operation
    ====================================================== */

    async publishDocument() {

        try {

            /* ==================================================
               Publishing Started
            ================================================== */

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


            /* ==================================================
               Call Vercel Publish API
            ================================================== */

            const response =
                await fetch(

                    CONFIG.PUBLISH_API,

                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body:
                            JSON.stringify({

                                page:
                                    page,

                                content:
                                    content

                            })

                    }

                );


            /* ==================================================
               Read API Response
            ================================================== */

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


            /* ==================================================
               HTTP Error
            ================================================== */

            if (!response.ok) {

                throw new Error(

                    result.message ||

                    `Publish API returned ${response.status}`

                );

            }


            /* ==================================================
               API-Level Error
            ================================================== */

            if (!result.success) {

                throw new Error(

                    result.message ||

                    "Publishing failed."

                );

            }


            /* ==================================================
               PUBLISH SUCCESS
            ================================================== */

            console.log(
                "Publish API completed successfully."
            );


            /* ==================================================
               Save Instant Content
            ================================================== */

            saveInstantPublishedContent(

                page,

                content

            );


            /* ==================================================
               Update Application State
            ================================================== */

            AppState.currentStatus =
                CONFIG.WORKFLOW.PUBLISHED;


            AppState.statusText =
                "Published";


            /* ==================================================
               History
            ================================================== */

            HistoryManager.add(

                "publish",

                "Document Published"

            );


            /* ==================================================
               Version
            ================================================== */

            VersionManager.create(
                "publish"
            );


            /*
             * Increase version after
             * published snapshot.
             */

            AppState.currentVersion++;


            /* ==================================================
               Save Published State
            ================================================== */

            DraftManager.save();


            /* ==================================================
               Refresh UI
            ================================================== */

            UIManager.refresh();


            updateSaveStatus(
                "Published ✓ Loading latest content..."
            );


            /* ==================================================
               INLINE MODE
               
               Render latest content immediately.
            ================================================== */

            if (AppState.inlineMode) {

                const contentRoot =
                    document.querySelector(
                        ".md-content__inner"
                    );


                if (contentRoot) {

                    /*
                     * Preserve Edit Page button.
                     */

                    let editButton =
                        contentRoot.querySelector(
                            ".edit-page-button, .edit-btn"
                        );


                    if (!editButton) {

                        editButton =
                            AppState.originalEditButton;

                    }


                    /*
                     * Show the content that
                     * was just published.
                     */

                    contentRoot.innerHTML =
                        content;


                    /*
                     * Restore button.
                     */

                    if (editButton) {

                        contentRoot.prepend(
                            editButton
                        );

                    }


                    ensureEditPageButton(
                        contentRoot
                    );

                }


                /*
                 * Exit inline editor mode.
                 */

                AIAssistant.reset();

                ImageEditor.reset();


                AppState.editor =
                    null;


                AppState.inlineMode =
                    false;


                AppState.originalEditButton =
                    null;

            }


            /* ==================================================
               Load Latest Published Content
               
               This replaces the old
               waitForPublishedPage() logic.
            ================================================== */

            const liveUpdated =
                await loadLatestPublishedContent(
                    page
                );


            /* ==================================================
               Update Publish Status
            ================================================== */

            if (liveUpdated) {

                updateSaveStatus(
                    "Published ✓ Live"
                );

            } else {

                updateSaveStatus(
                    "Published ✓"
                );

            }


            /* ==================================================
               Final Edit Page Button Safety Check
            ================================================== */

            const contentRoot =
                document.querySelector(
                    ".md-content__inner"
                );


            if (contentRoot) {

                ensureEditPageButton(
                    contentRoot
                );

            }


            UIManager.refresh();


            /* ==================================================
               Publishing Completed
            ================================================== */

            showWorkflowModal({

                title:
                    "Published Successfully",

                message:
                    liveUpdated

                        ? "Your changes have been published successfully and are now live."

                        : "Your changes were published successfully. The live page may take a moment to update.",

                type:
                    "success",

                confirmText:
                    "Done"

            });


            return true;


        } catch (error) {

            /* ==================================================
               Publish Error
            ================================================== */

            console.error(
                "Publish error:",
                error
            );


            updateSaveStatus(
                "Publish failed"
            );


            /* ==================================================
               Professional Error Modal
            ================================================== */

            showWorkflowModal({

                title:
                    "Publish Failed",

                message:
                    error.message ||
                    "Something went wrong while publishing the document.",

                type:
                    "error",

                confirmText:
                    "OK"

            });


            return false;

        }

    }

};

/* ==========================================================
   UI Manager
========================================================== */

const UIManager = {

    refresh() {

        /* ==================================================
           Status Elements
        ================================================== */

        const statusElements = [

            document.querySelector(
                "#workflow-status"
            ),

            document.querySelector(
                "#inline-workflow-status"
            )

        ];


        /* ==================================================
           Version Elements
        ================================================== */

        const versionElements = [

            document.querySelector(
                "#version-label"
            ),

            document.querySelector(
                "#inline-version-label"
            )

        ];


        /* ==================================================
           Update Status
        ================================================== */

        statusElements.forEach(element => {

            if (element) {

                element.textContent =
                    AppState.statusText;

            }

        });


        /* ==================================================
           Update Version
        ================================================== */

        versionElements.forEach(element => {

            if (element) {

                element.textContent =
                    AppState.currentVersion;

            }

        });


        /* ==================================================
           Update Save Status
        ================================================== */

        if (

            AppState.lastSaved &&

            !AppState.draftChanged &&

            AppState.currentStatus !==
                CONFIG.WORKFLOW.PUBLISHED

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


        /* ==================================================
           Inline Buttons
        ================================================== */

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


        if (saveButton) {

            saveButton.disabled =
                false;

        }


        if (approveButton) {

            approveButton.disabled =
                false;

        }


        if (publishButton) {

            publishButton.disabled =
                false;

        }


        /* ==================================================
           Restore Edit Page Button
        ================================================== */

        if (!AppState.inlineMode) {

            const contentRoot =
                document.querySelector(
                    ".md-content__inner"
                );


            if (contentRoot) {

                ensureEditPageButton(
                    contentRoot
                );

            }

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
         * Current document is based
         * on current URL.
         */

        AppState.currentDocument =
            localStorage.getItem(
                "currentDoc"
            ) ||
            window.location.pathname;


        /* ==================================================
           Cache DOM
        ================================================== */

        this.cacheDOM();


        /* ==================================================
           Render Instant Published Content
           
           This must happen before
           editor initialization.
        ================================================== */

        renderInstantPublishedContent();


        /* ==================================================
           Initialize Standalone Editor
        ================================================== */

        this.initStandaloneEditor();


        /* ==================================================
           Bind Events
        ================================================== */

        this.bindEvents();


        /* ==================================================
           Register Draft Events
        ================================================== */

        if (AppState.editor) {

            registerDraftEvents();

        }


        /* ==================================================
           Start Autosave
        ================================================== */

        startAutoSave();


        /* ==================================================
           Refresh UI
        ================================================== */

        UIManager.refresh();


        /* ==================================================
           Final Edit Button Safety Check
        ================================================== */

        const contentRoot =
            document.querySelector(
                ".md-content__inner"
            );


        if (

            contentRoot &&

            !AppState.inlineMode

        ) {

            ensureEditPageButton(
                contentRoot
            );

        }


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
                ),

            cancel:
                document.querySelector(
                    "#cancel-btn"
                ),

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

                                {

                                    header:
                                        [
                                            1,
                                            2,
                                            3,
                                            false
                                        ]

                                }

                            ],

                            [

                                "bold",
                                "italic",
                                "underline",
                                "strike"

                            ],

                            [

                                {
                                    list:
                                        "ordered"
                                },

                                {
                                    list:
                                        "bullet"
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


        AIAssistant.attach(
            AppState.editor
        );

        ImageEditor.attach(
            AppState.editor
        );

    },


    /* ======================================================
       Bind Standalone Events
    ====================================================== */

    bindEvents() {

        /* ==================================================
           Save
        ================================================== */

        this.ui.save?.addEventListener(

            "click",

            () => {

                DraftManager.save();

                UIManager.refresh();

            }

        );


        /* ==================================================
           Approve
        ================================================== */

        this.ui.approve?.addEventListener(

            "click",

            async () => {

                await WorkflowManager.changeStatus(

                    CONFIG.WORKFLOW.APPROVED

                );

            }

        );


        /* ==================================================
           Publish
        ================================================== */

        this.ui.publish?.addEventListener(

            "click",

            async () => {

                await WorkflowManager.changeStatus(

                    CONFIG.WORKFLOW.PUBLISHED

                );

            }

        );


        /* ==================================================
           Ctrl + S / Cmd + S
        ================================================== */

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


                    UIManager.refresh();

                }

            }

        );

    }

};
/* ==========================================================
   Open Inline Editor
========================================================== */

function openEditor() {

    const page =
        window.location.pathname;


    localStorage.setItem(
        "currentDoc",
        page
    );


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


/* ==========================================================
   Make openEditor() Globally Available
========================================================== */

window.openEditor =
    openEditor;


/* ==========================================================
   Inline Editor
========================================================== */

const InlineEditor = {


    /* ======================================================
       Start Inline Editing
    ====================================================== */

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


        /* ==================================================
           Find MkDocs Content Area
        ================================================== */

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


        /* ==================================================
           Set Current Document
        ================================================== */

        AppState.currentDocument =
            window.location.pathname;


        localStorage.setItem(
            "currentDoc",
            AppState.currentDocument
        );


        /* ==================================================
           Save Original Content
        ================================================== */

        const originalContent =
            contentRoot.innerHTML;


        /* ==================================================
           Save Original Edit Button
        ================================================== */

        AppState.originalEditButton =
            contentRoot.querySelector(
                ".edit-page-button, .edit-btn"
            );


        /*
         * If button does not exist,
         * create one before entering editor.
         */

        if (!AppState.originalEditButton) {

            AppState.originalEditButton =
                ensureEditPageButton(
                    contentRoot
                );

        }


        /* ==================================================
           Check Existing Local Draft
        ================================================== */

        const savedDocument =
            DocumentStore.get(
                AppState.currentDocument
            );


        /* ==================================================
           Restore Saved State
        ================================================== */

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


        /* ==================================================
           Temporary Content Container
        ================================================== */

        const tempContent =
            document.createElement(
                "div"
            );


        tempContent.innerHTML =
            originalContent;


        /* ==================================================
           Remove Edit Buttons From Editor Content
        ================================================== */

        tempContent
            .querySelectorAll(
                ".edit-page-button, .edit-btn"
            )
            .forEach(
                element => {

                    element.remove();

                }
            );


        /* ==================================================
           Create Workspace
        ================================================== */

        const workspace =
            document.createElement(
                "div"
            );


        workspace.className =
            "inline-editor-workspace editor-frame";


        /* ==================================================
           Toolbar Container
        ================================================== */

        const toolbar =
            document.createElement(
                "div"
            );


        toolbar.id =
            "inline-editor-toolbar";


        /* ==================================================
           Metadata Row
        ================================================== */

        const meta =
            document.createElement(
                "div"
            );


        meta.className =
            "inline-editor-meta";


        const authorName =
            localStorage.getItem(
                "docengine_author"
            ) ||
            "You";


        const wordCount =
            (
                tempContent.textContent ||
                ""
            )
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .length;


        const readTime =
            Math.max(

                1,

                Math.round(
                    wordCount / 200
                )

            );


        meta.innerHTML = `

            <span class="inline-editor-avatar">
                ${authorName.charAt(0).toUpperCase()}
            </span>

            <span class="inline-editor-author">
                ${authorName}
            </span>

            <span class="inline-editor-meta-dot">
                •
            </span>

            <span>
                ${readTime} min read
            </span>

            <span class="inline-editor-meta-spacer"></span>
        `;


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

                <strong
                    id="inline-workflow-status"
                >
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
            meta
        );


        /*
         * Editor container.
         */

        const editorContainer =
            document.createElement(
                "div"
            );


        editorContainer.id =
            "inline-editor";


        workspace.appendChild(
            editorContainer
        );


        workspace.appendChild(
            status
        );


        workspace.appendChild(
            actions
        );


        /* ==================================================
           Replace Documentation Content
        ================================================== */

        contentRoot.innerHTML =
            "";


        contentRoot.appendChild(
            workspace
        );


        /* ==================================================
           Check Quill
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


            ensureEditPageButton(
                contentRoot
            );


            return;

        }


        /* ==================================================
           Initialize Quill
        ================================================== */

        AppState.editor =
            new Quill(

                "#inline-editor",

                {

                    theme: "snow",

                    modules: {

                        toolbar: [

                            [

                                {

                                    header: [

                                        1,
                                        2,
                                        3,
                                        false

                                    ]

                                }

                            ],

                            [

                                "bold",
                                "italic",
                                "underline",
                                "strike"

                            ],

                            [

                                {
                                    list:
                                        "ordered"
                                },

                                {
                                    list:
                                        "bullet"
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


        /* ==================================================
           Register Draft Events
        ================================================== */

        registerDraftEvents();


        AIAssistant.attach(
            AppState.editor
        );

        ImageEditor.attach(
            AppState.editor
        );


        /* ==================================================
           Inline Mode Active
        ================================================== */

        AppState.inlineMode =
            true;


        AppState.draftChanged =
            false;


        /* ==================================================
           Refresh UI
        ================================================== */

        UIManager.refresh();


        /* ==================================================
           Get Inline Buttons
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


        /* ==================================================
           Scroll To Editor
        ================================================== */

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
         * Existing saved draft is NOT deleted.
         */

        AppState.editor =
            null;


        AppState.inlineMode =
            false;


        /*
         * Reload restores the
         * normal documentation page.
         */

        window.location.reload();

    }

};


/* ==========================================================
   AI Suggestion Assistant

   Selection-based AI assistance for the Human Editor.

   The AI only ever runs against text the human explicitly
   selects. It never reads or rewrites the whole document,
   never auto-applies a change, and never touches workflow
   status (Save / Approve / Publish are untouched by this
   module).
========================================================== */

const AIAssistant = {

    toolbarEl: null,

    popoverEl: null,

    /*
     * Selection snapshot, captured the moment the human clicks
     * an AI action. This — not window.getSelection() — is what
     * Accept/Reject act on, because clicking into the popover
     * collapses the live browser selection.
     */

    pendingSelection: null,

    isRequesting: false,

    requestToken: 0,

    popoverOpen: false,

    boundReposition: null,


    /* ======================================================
       Attach To A Quill Instance

       Called once per editor instance (standalone editor.md
       page and the inline in-page editor both call this
       right after their Quill instance is created).
    ====================================================== */

    attach(quill) {

        if (!quill || quill.__aiAssistantAttached) {

            return;

        }

        quill.__aiAssistantAttached = true;


        quill.on(
            "selection-change",
            (range) => {

                /*
                 * While the popover is open, ignore selection
                 * changes caused by clicking into the popover
                 * itself (that collapses Quill's selection).
                 */

                if (this.popoverOpen) {

                    return;

                }

                if (range && range.length > 0) {

                    this.showToolbar(
                        quill,
                        range
                    );

                } else {

                    this.hideToolbar();

                }

            }
        );

    },


    /* ======================================================
       Reset

       Called when an editor instance is torn down (e.g. after
       a successful publish exits inline editing mode).
    ====================================================== */

    reset() {

        this.hideToolbar();

        this.closePopover();

        this.activeQuill = null;

        this.activeRange = null;

    },


    /* ======================================================
       Selection → Viewport Position
    ====================================================== */

    getViewportBounds(quill, range) {

        const bounds =
            quill.getBounds(
                range.index,
                range.length
            );

        const editorRect =
            quill.root.getBoundingClientRect();

        const scrollTop =
            quill.root.scrollTop || 0;

        const scrollLeft =
            quill.root.scrollLeft || 0;

        return {

            top:
                editorRect.top +
                bounds.top -
                scrollTop,

            bottom:
                editorRect.top +
                bounds.bottom -
                scrollTop,

            left:
                editorRect.left +
                bounds.left -
                scrollLeft,

            right:
                editorRect.left +
                bounds.right -
                scrollLeft

        };

    },


    /* ======================================================
       Floating Toolbar
    ====================================================== */

    ensureToolbar() {

        if (this.toolbarEl) {

            return this.toolbarEl;

        }

        const toolbar =
            document.createElement("div");

        toolbar.className =
            "ai-suggest-toolbar";

        toolbar.innerHTML = `
            <button type="button" class="ai-suggest-toolbar-btn" data-ai-mode="suggest" aria-label="AI Suggestion for selected text">
                ✨ AI Suggestion
            </button>
            <button type="button" class="ai-suggest-toolbar-btn ai-suggest-toolbar-btn--ghost" data-ai-mode="ask" aria-label="Ask AI about selected text">
                💬 Ask AI
            </button>
        `;

        toolbar.addEventListener(
            "mousedown",

            /*
             * mousedown (not click) + preventDefault stops the
             * browser from collapsing the Quill selection before
             * the click handler below can snapshot it.
             */

            (event) => {

                event.preventDefault();

            }
        );

        toolbar.addEventListener(
            "click",

            (event) => {

                const button =
                    event.target.closest(
                        "[data-ai-mode]"
                    );

                if (!button) {

                    return;

                }

                this.openPopover(
                    button.dataset.aiMode
                );

            }
        );

        document.body.appendChild(
            toolbar
        );

        this.toolbarEl = toolbar;

        return toolbar;

    },


    showToolbar(quill, range) {

        const toolbar =
            this.ensureToolbar();

        this.activeQuill =
            quill;

        this.activeRange =
            range;

        const position =
            this.getViewportBounds(
                quill,
                range
            );

        toolbar.style.display =
            "flex";

        this.positionToolbar(
            position
        );


        if (!this.boundReposition) {

            this.boundReposition =
                () => {

                    if (
                        toolbar.style.display ===
                            "flex" &&
                        this.activeQuill &&
                        this.activeRange
                    ) {

                        this.positionToolbar(
                            this.getViewportBounds(
                                this.activeQuill,
                                this.activeRange
                            )
                        );

                    }

                };

            window.addEventListener(
                "resize",
                this.boundReposition
            );

            window.addEventListener(
                "scroll",
                this.boundReposition,
                true
            );

        }

    },


    positionToolbar(position) {

        if (!this.toolbarEl) {

            return;

        }

        const toolbarWidth =
            this.toolbarEl.offsetWidth ||
            260;

        let left =
            position.left;

        const maxLeft =
            window.innerWidth -
            toolbarWidth -
            12;

        if (left > maxLeft) {

            left = Math.max(
                12,
                maxLeft
            );

        }

        if (left < 12) {

            left = 12;

        }

        let top =
            position.top - 46;

        if (top < 8) {

            top =
                position.bottom + 8;

        }

        this.toolbarEl.style.left =
            `${left}px`;

        this.toolbarEl.style.top =
            `${top}px`;

    },


    hideToolbar() {

        /*
         * Only hides the toolbar visually. activeQuill/activeRange
         * are intentionally left in place — they are the snapshot
         * openPopover() reads from, and clicking the toolbar itself
         * triggers a blur (range → null) just before the click
         * handler runs, which would otherwise wipe the selection
         * out from under the click.
         */

        if (this.toolbarEl) {

            this.toolbarEl.style.display =
                "none";

        }

    },


    /* ======================================================
       Popover
    ====================================================== */

    ensurePopover() {

        if (this.popoverEl) {

            return this.popoverEl;

        }

        const popover =
            document.createElement("div");

        popover.className =
            "ai-suggest-popover";

        popover.setAttribute(
            "role",
            "dialog"
        );

        popover.setAttribute(
            "aria-label",
            "AI writing assistant"
        );

        popover.style.display =
            "none";

        document.body.appendChild(
            popover
        );

        this.popoverEl =
            popover;

        return popover;

    },


    positionPopover(position) {

        const popover =
            this.popoverEl;

        if (!popover) {

            return;

        }

        const width =
            Math.min(
                380,
                window.innerWidth - 24
            );

        popover.style.width =
            `${width}px`;

        let left =
            position.left;

        const maxLeft =
            window.innerWidth -
            width -
            12;

        left =
            Math.min(
                Math.max(
                    left,
                    12
                ),
                Math.max(
                    maxLeft,
                    12
                )
            );

        let top =
            position.bottom + 10;

        const estimatedHeight = 220;

        if (
            top + estimatedHeight >
            window.innerHeight
        ) {

            top =
                Math.max(
                    12,
                    position.top - estimatedHeight - 10
                );

        }

        popover.style.left =
            `${left}px`;

        popover.style.top =
            `${top}px`;

    },


    openPopover(mode) {

        if (
            !this.activeQuill ||
            !this.activeRange ||
            this.activeRange.length === 0
        ) {

            return;

        }

        const quill =
            this.activeQuill;

        const range =
            this.activeRange;

        this.pendingSelection = {

            quill,

            index:
                range.index,

            length:
                range.length,

            text:
                quill.getText(
                    range.index,
                    range.length
                ),

            format:
                quill.getFormat(
                    range.index,
                    range.length
                )

        };

        const position =
            this.getViewportBounds(
                quill,
                range
            );

        this.hideToolbar();

        const popover =
            this.ensurePopover();

        popover.style.display =
            "block";

        this.popoverOpen =
            true;

        this.positionPopover(
            position
        );

        if (mode === "ask") {

            this.renderAskForm();

        } else {

            this.renderLoading();

            this.requestCompletion(
                "suggest"
            );

        }


        if (!this.boundKeydown) {

            this.boundKeydown =
                (event) => {

                    if (
                        event.key === "Escape" &&
                        this.popoverOpen
                    ) {

                        this.closePopover();

                    }

                };

            document.addEventListener(
                "keydown",
                this.boundKeydown
            );

        }

        if (!this.boundOutsideClick) {

            this.boundOutsideClick =
                (event) => {

                    if (
                        this.popoverOpen &&
                        this.popoverEl &&
                        !this.popoverEl.contains(
                            event.target
                        )
                    ) {

                        this.closePopover();

                    }

                };

            document.addEventListener(
                "mousedown",
                this.boundOutsideClick
            );

        }

    },


    closePopover() {

        this.popoverOpen =
            false;

        this.isRequesting =
            false;

        this.requestToken++;

        this.pendingSelection =
            null;

        if (this.popoverEl) {

            this.popoverEl.style.display =
                "none";

            this.popoverEl.innerHTML =
                "";

        }

    },


    /* ======================================================
       Popover Content — States
    ====================================================== */

    renderLoading() {

        if (!this.popoverEl) {

            return;

        }

        this.popoverEl.innerHTML = `
            <div class="ai-suggest-header">
                <span class="ai-suggest-title">✨ AI Suggestion</span>
                <button type="button" class="ai-suggest-close" aria-label="Close">✖</button>
            </div>
            <div class="ai-suggest-loading">
                ✨ Generating suggestion...
            </div>
        `;

        this.bindCloseButton();

    },


    renderError(message, options = {}) {

        if (!this.popoverEl) {

            return;

        }

        const retryLabel =
            options.retryMode
                ? "Retry"
                : "";

        this.popoverEl.innerHTML = `
            <div class="ai-suggest-header">
                <span class="ai-suggest-title">✨ AI Suggestion</span>
                <button type="button" class="ai-suggest-close" aria-label="Close">✖</button>
            </div>
            <p class="ai-suggest-error"></p>
            <div class="ai-suggest-actions">
                ${
                    options.retryMode
                        ? `<button type="button" class="ai-suggest-btn ai-suggest-btn--primary" data-action="retry">${retryLabel}</button>`
                        : ""
                }
                <button type="button" class="ai-suggest-btn" data-action="close">Close</button>
            </div>
        `;

        this.popoverEl.querySelector(
            ".ai-suggest-error"
        ).textContent =
            message;

        this.bindCloseButton();

        const retryButton =
            this.popoverEl.querySelector(
                "[data-action='retry']"
            );

        retryButton?.addEventListener(
            "click",
            () => {

                this.renderLoading();

                this.requestCompletion(
                    options.retryMode
                );

            }
        );

        this.popoverEl
            .querySelector(
                "[data-action='close']"
            )
            ?.addEventListener(
                "click",
                () => this.closePopover()
            );

    },


    renderSuggestionResult(suggestionText) {

        if (
            !this.popoverEl ||
            !this.pendingSelection
        ) {

            return;

        }

        this.popoverEl.innerHTML = `
            <div class="ai-suggest-header">
                <span class="ai-suggest-title">✨ AI Suggestion</span>
                <button type="button" class="ai-suggest-close" aria-label="Close">✖</button>
            </div>

            <div class="ai-suggest-block">
                <span class="ai-suggest-label">Original</span>
                <p class="ai-suggest-original"></p>
            </div>

            <div class="ai-suggest-block ai-suggest-block--result">
                <span class="ai-suggest-label ai-suggest-label--ai">AI Suggestion</span>
                <p class="ai-suggest-result"></p>
                <textarea class="ai-suggest-edit-area" style="display:none;"></textarea>
            </div>

            <div class="ai-suggest-actions">
                <button type="button" class="ai-suggest-btn ai-suggest-btn--primary" data-action="accept">Accept</button>
                <button type="button" class="ai-suggest-btn" data-action="edit">Edit</button>
                <button type="button" class="ai-suggest-btn ai-suggest-btn--muted" data-action="reject">Reject</button>
            </div>
        `;

        this.popoverEl.querySelector(
            ".ai-suggest-original"
        ).textContent =
            this.pendingSelection.text;

        const resultEl =
            this.popoverEl.querySelector(
                ".ai-suggest-result"
            );

        resultEl.textContent =
            suggestionText;

        const editArea =
            this.popoverEl.querySelector(
                ".ai-suggest-edit-area"
            );

        editArea.value =
            suggestionText;

        this.bindCloseButton();

        this.popoverEl
            .querySelector(
                "[data-action='reject']"
            )
            .addEventListener(
                "click",
                () => this.closePopover()
            );

        this.popoverEl
            .querySelector(
                "[data-action='edit']"
            )
            .addEventListener(
                "click",
                (event) => {

                    const isEditing =
                        editArea.style.display !==
                        "none";

                    if (isEditing) {

                        resultEl.textContent =
                            editArea.value;

                        resultEl.style.display =
                            "block";

                        editArea.style.display =
                            "none";

                        event.target.textContent =
                            "Edit";

                    } else {

                        resultEl.style.display =
                            "none";

                        editArea.style.display =
                            "block";

                        editArea.focus();

                        event.target.textContent =
                            "Done Editing";

                    }

                }
            );

        this.popoverEl
            .querySelector(
                "[data-action='accept']"
            )
            .addEventListener(
                "click",
                () => {

                    const finalText =
                        editArea.style.display !==
                        "none"
                            ? editArea.value
                            : resultEl.textContent;

                    this.acceptSuggestion(
                        finalText
                    );

                }
            );

    },


    renderAskForm() {

        if (!this.popoverEl) {

            return;

        }

        this.popoverEl.innerHTML = `
            <div class="ai-suggest-header">
                <span class="ai-suggest-title">💬 Ask AI</span>
                <button type="button" class="ai-suggest-close" aria-label="Close">✖</button>
            </div>

            <div class="ai-suggest-block">
                <span class="ai-suggest-label">Selected Text</span>
                <p class="ai-suggest-original"></p>
            </div>

            <label class="ai-suggest-label" for="ai-ask-question">Your question</label>
            <textarea id="ai-ask-question" class="ai-suggest-ask-input" placeholder="e.g. Is this following our Style Guide?"></textarea>

            <div class="ai-suggest-actions">
                <button type="button" class="ai-suggest-btn ai-suggest-btn--primary" data-action="ask">Ask</button>
                <button type="button" class="ai-suggest-btn" data-action="close">Cancel</button>
            </div>
        `;

        this.popoverEl.querySelector(
            ".ai-suggest-original"
        ).textContent =
            this.pendingSelection.text;

        this.bindCloseButton();

        this.popoverEl
            .querySelector(
                "[data-action='close']"
            )
            .addEventListener(
                "click",
                () => this.closePopover()
            );

        const questionInput =
            this.popoverEl.querySelector(
                "#ai-ask-question"
            );

        questionInput.focus();

        this.popoverEl
            .querySelector(
                "[data-action='ask']"
            )
            .addEventListener(
                "click",
                () => {

                    const question =
                        questionInput.value.trim();

                    if (!question) {

                        questionInput.focus();

                        return;

                    }

                    this.pendingSelection.question =
                        question;

                    this.renderLoading();

                    this.requestCompletion(
                        "ask"
                    );

                }
            );

    },


    renderAskResult(answerText) {

        if (
            !this.popoverEl ||
            !this.pendingSelection
        ) {

            return;

        }

        this.popoverEl.innerHTML = `
            <div class="ai-suggest-header">
                <span class="ai-suggest-title">💬 Ask AI</span>
                <button type="button" class="ai-suggest-close" aria-label="Close">✖</button>
            </div>

            <div class="ai-suggest-block">
                <span class="ai-suggest-label ai-suggest-label--ai">Answer</span>
                <p class="ai-suggest-result"></p>
            </div>

            <div class="ai-suggest-actions">
                <button type="button" class="ai-suggest-btn" data-action="close">Close</button>
            </div>
        `;

        this.popoverEl.querySelector(
            ".ai-suggest-result"
        ).textContent =
            answerText;

        this.bindCloseButton();

        this.popoverEl
            .querySelector(
                "[data-action='close']"
            )
            .addEventListener(
                "click",
                () => this.closePopover()
            );

    },


    bindCloseButton() {

        this.popoverEl
            ?.querySelector(
                ".ai-suggest-close"
            )
            ?.addEventListener(
                "click",
                () => this.closePopover()
            );

    },


    /* ======================================================
       Accept
    ====================================================== */

    acceptSuggestion(finalText) {

        const selection =
            this.pendingSelection;

        if (
            !selection ||
            !selection.quill ||
            !finalText
        ) {

            this.closePopover();

            return;

        }

        const quill =
            selection.quill;

        quill.deleteText(
            selection.index,
            selection.length,
            "user"
        );

        quill.insertText(
            selection.index,
            finalText,
            selection.format || {},
            "user"
        );

        quill.setSelection(
            selection.index +
                finalText.length,
            0,
            "user"
        );

        this.closePopover();

    },


    /* ======================================================
       AI Request
    ====================================================== */

    gatherContext(selection) {

        const quill =
            selection.quill;

        const windowSize = 400;

        const contextStart =
            Math.max(
                0,
                selection.index - windowSize
            );

        const contextLength =
            (selection.index - contextStart) +
            selection.length +
            windowSize;

        return quill.getText(
            contextStart,
            contextLength
        );

    },


    getDocumentTitle() {

        const heading =
            document.querySelector(
                ".md-content__inner h1"
            );

        if (heading) {

            /*
             * mkdocs' toc plugin appends a permalink anchor
             * ("¶") inside h1 — strip it from the title text.
             */

            const clone =
                heading.cloneNode(true);

            clone
                .querySelectorAll(
                    ".headerlink"
                )
                .forEach(
                    (node) => node.remove()
                );

            const text =
                clone.textContent.trim();

            if (text) {

                return text;

            }

        }

        return (
            document.title ||
            "Untitled"
        );

    },


    async requestCompletion(mode) {

        if (this.isRequesting) {

            return;

        }

        const selection =
            this.pendingSelection;

        if (!selection) {

            return;

        }

        this.isRequesting =
            true;

        const token =
            ++this.requestToken;

        const body = {

            mode,

            selectedText:
                selection.text,

            context:
                this.gatherContext(
                    selection
                ),

            documentTitle:
                this.getDocumentTitle(),

            documentPath:
                AppState.currentDocument ||
                window.location.pathname

        };

        if (mode === "ask") {

            body.question =
                selection.question || "";

        }

        const controller =
            new AbortController();

        const timeoutId =
            setTimeout(
                () => controller.abort(),
                CONFIG.AI_REQUEST_TIMEOUT
            );

        try {

            const response =
                await fetch(

                    CONFIG.AI_SUGGEST_API,

                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(body),

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
                    "The AI service returned an invalid response."
                );

            }

            /*
             * Stale response — the popover was closed and/or
             * reopened while this request was in flight.
             */

            if (
                token !== this.requestToken ||
                !this.popoverOpen
            ) {

                return;

            }

            if (!response.ok || !data.success) {

                throw new Error(
                    data.message ||
                    `AI request failed (${response.status}).`
                );

            }

            if (mode === "ask") {

                if (!data.answer) {

                    throw new Error(
                        "The AI service returned an empty answer."
                    );

                }

                this.renderAskResult(
                    data.answer
                );

            } else {

                if (!data.suggestion) {

                    throw new Error(
                        "The AI service returned an empty suggestion."
                    );

                }

                this.renderSuggestionResult(
                    data.suggestion
                );

            }

        } catch (error) {

            if (
                token !== this.requestToken ||
                !this.popoverOpen
            ) {

                return;

            }

            const isAbort =
                error.name === "AbortError";

            console.error(
                "AI suggestion request failed:",
                error
            );

            this.renderError(

                isAbort
                    ? "The request timed out. Please try again."
                    : (
                        error.message ||
                        "Something went wrong while contacting the AI service."
                    ),

                { retryMode: mode }

            );

        } finally {

            clearTimeout(
                timeoutId
            );

            this.isRequesting =
                false;

        }

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