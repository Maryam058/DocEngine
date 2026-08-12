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
        VERSIONS: "docengine_versions",
        INSTANT_PUBLISHED: "docengine_instant_published",
    },

    WORKFLOW: {
        DRAFT: "draft",
        APPROVED: "approved",
        PUBLISHED: "published",
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

    elements.forEach(element => {

        if (element) {

            element.textContent =
                message;

        }

    });

}

/* ==========================================================
   Instant Published Content
========================================================== */

function saveInstantPublishedContent(page, content) {

    try {

        localStorage.setItem(
            CONFIG.STORAGE.INSTANT_PUBLISHED,
            JSON.stringify({
                page: page,
                content: content,
                publishedAt: Date.now()
            })
        );

    } catch (error) {

        console.error(
            "Could not save instant published content:",
            error
        );

    }

}

function renderInstantPublishedContent() {

    try {

        const stored =
            localStorage.getItem(
                CONFIG.STORAGE.INSTANT_PUBLISHED
            );

        if (!stored) {
            return false;
        }

        const data =
            JSON.parse(stored);

        const currentPage =
            window.location.pathname;

        if (
            !data ||
            data.page !== currentPage ||
            !data.content
        ) {
            return false;
        }

        const contentRoot =
            document.querySelector(
                ".md-content__inner"
            );

        if (!contentRoot) {
            return false;
        }

        /* Preserve existing Edit Page button */
        const editButton =
            contentRoot.querySelector(
                ".edit-page-button"
            );

        /* Render latest published content */
        contentRoot.innerHTML =
            data.content;

        /* Restore Edit Page button */
        if (editButton) {

            contentRoot.appendChild(
                editButton
            );

        }

        console.log(
            "Instant published content restored after refresh."
        );

        return true;

    } catch (error) {

        console.error(
            "Instant published content render error:",
            error
        );

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

            action:
                action,

            message:
                message,

            time:
                Time.now(),

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

            action:
                action,

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

/*
 * Checks whether the newly published content
 * is actually visible on the live Vercel site.
 *
 * This runs in the background so the user
 * does NOT have to wait for deployment.
 */

async function waitForPublishedPage(page, content) {

    const MAX_ATTEMPTS = 60;

    const CHECK_INTERVAL = 2000;


    /* ======================================================
       Extract Expected Text
    ====================================================== */

    const temp =
        document.createElement("div");


    temp.innerHTML =
        content || "";


    const expectedText =
        (
            temp.textContent ||
            temp.innerText ||
            ""
        )
            .replace(/\s+/g, " ")
            .trim();


    /*
     * If there is no text to verify,
     * consider the deployment check complete.
     */

    if (!expectedText) {

        return true;

    }


    /*
     * Only use the first 100 characters
     * for deployment verification.
     */

    const verificationText =
        expectedText.substring(0, 100);


    /* ======================================================
       Build Live Page URL
    ====================================================== */

    let pagePath =
        page ||
        window.location.pathname;


    if (!pagePath.startsWith("/")) {

        pagePath =
            "/" + pagePath;

    }


    /*
     * Remove query parameters and hash.
     */

    pagePath =
        pagePath
            .split("?")[0]
            .split("#")[0];


    const liveURL =
        CONFIG.PRODUCTION_URL.replace(/\/$/, "") +
        pagePath;


    console.log(
        "Background deployment check:",
        liveURL
    );


    /* ======================================================
       Deployment Verification Loop
    ====================================================== */

    for (

        let attempt = 1;

        attempt <= MAX_ATTEMPTS;

        attempt++

    ) {

        try {

            console.log(
                `Deployment verification attempt ${attempt}/${MAX_ATTEMPTS}`
            );


            /*
             * Cache buster prevents browser/CDN
             * from returning an old page.
             */

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
                                "no-cache",

                            "Pragma":
                                "no-cache"

                        }

                    }

                );


            /* ==================================================
               Check HTTP Response
            ================================================== */

            if (response.ok) {

                const html =
                    await response.text();


                /*
                 * Parse the live HTML.
                 */

                const liveDocument =
                    new DOMParser()
                        .parseFromString(
                            html,
                            "text/html"
                        );


                /*
                 * Extract visible text.
                 */

                const liveText =
                    (
                        liveDocument
                            .body
                            ?.textContent ||
                        ""
                    )
                        .replace(/\s+/g, " ")
                        .trim();


                /* ==================================================
                   Confirm New Content
                ================================================== */

                if (
                    liveText.includes(
                        verificationText
                    )
                ) {

                    console.log(
                        "Deployment confirmed."
                    );

                    return true;

                }

            }


        } catch (error) {

            console.warn(
                "Deployment verification error:",
                error
            );

        }


        /* ======================================================
           Wait Before Next Attempt
        ====================================================== */

        await new Promise(

            resolve =>

                setTimeout(
                    resolve,
                    CHECK_INTERVAL
                )

        );

    }


    /* ==========================================================
       Verification Timeout
    ========================================================== */

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
             * Increase version after creating
             * the approved version snapshot.
             */

            AppState.currentVersion++;


            /* ----------------------------------------------
               Save Current Document
            ---------------------------------------------- */

            DraftManager.save();


            /* ----------------------------------------------
               Refresh UI
            ---------------------------------------------- */

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


            /* ==================================================
               Publishing Requires Approval
            ================================================== */

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

                            method: "POST",

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
                 * Increase version after creating
                 * the published snapshot.
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
                    "Published ✓ Deploying..."
                );


                /* ==================================================
                   Show Published Content Immediately

                   The just-published HTML is already in memory,
                   so the live documentation page can be updated
                   right now instead of waiting for GitHub/Vercel.
                ================================================== */

                if (AppState.inlineMode) {

                    const contentRoot =
                        document.querySelector(
                            ".md-content__inner"
                        );

                    if (contentRoot) {

                        contentRoot.innerHTML =
                            content;

                    }

                    AppState.editor =
                        null;

                    AppState.inlineMode =
                        false;

                }


                /* ==================================================
                   Background Deployment Verification
                   
                   IMPORTANT:
                   Do NOT await this function.

                   Vercel deployment can take several
                   seconds, but the user should not have
                   to wait for the deployment check.
                ================================================== */

                waitForPublishedPage(
                    page,
                    content
                ).then(

                    liveUpdated => {

                        if (liveUpdated) {

                            console.log(
                                "Live deployment confirmed."
                            );


                            updateSaveStatus(
                                "Published ✓ Live"
                            );


                            UIManager.refresh();

                        } else {

                            console.warn(
                                "Deployment is still processing."
                            );


                            updateSaveStatus(
                                "Published — deployment still processing"
                            );

                        }

                    }

                );


                /* ==================================================
                   Publishing Completed

                   DO NOT immediately reload here.

                   Otherwise the page may reload before Vercel
                   deployment has reached the live documentation.
                ================================================== */

                alert(

                    "✅ Published successfully!\n\n" +
                    "Your changes are now visible."
                );
                window.location.reload();

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


                alert(

                    "❌ Publish failed:\n\n" +

                    error.message

                );


                return false;

            }

        }


        /* ==================================================
           Unknown Workflow Status
        ================================================== */

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
            document.querySelector("#workflow-status"),
            document.querySelector("#inline-workflow-status")
        ];

        const versionElements = [
            document.querySelector("#version-label"),
            document.querySelector("#inline-version-label")
        ];

        statusElements.forEach(element => {
            if (element) {
                element.textContent =
                    AppState.statusText;
            }
        });

        versionElements.forEach(element => {
            if (element) {
                element.textContent =
                    AppState.currentVersion;
            }
        });

        if (
            AppState.lastSaved &&
            !AppState.draftChanged
        ) {

            updateSaveStatus(
                "Saved " +
                Time.format(
                    new Date(AppState.lastSaved)
                )
            );

        }

        const approveButton =
            document.querySelector("#inline-approve");

        const publishButton =
            document.querySelector("#inline-publish");

        const saveButton =
            document.querySelector("#inline-save");

        if (saveButton) {
            saveButton.disabled = false;
        }

        if (approveButton) {
            approveButton.disabled = false;
        }

        if (publishButton) {
            publishButton.disabled = false;
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

        AppState.currentDocument =
            localStorage.getItem("currentDoc") ||
            window.location.pathname;

        this.cacheDOM();

        renderInstantPublishedContent();

        this.initStandaloneEditor();

        this.bindEvents();

        if (AppState.editor) {
            registerDraftEvents();
        }

        startAutoSave();

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
                document.querySelector("#editor"),

            save:
                document.querySelector("#btn-save"),

            approve:
                document.querySelector("#btn-approve"),

            publish:
                document.querySelector("#btn-publish")

        };

    },


    /* ======================================================
       Standalone Quill Editor
    ====================================================== */

    initStandaloneEditor() {

        if (!this.ui.editor) {
            return;
        }

        if (typeof Quill === "undefined") {

            console.error(
                "Quill is not loaded."
            );

            return;

        }

        AppState.editor = new Quill(
            "#editor",
            {
                theme: "snow",

                modules: {

                    toolbar: [

                        [
                            {
                                header: [1, 2, 3, false]
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

        this.ui.save?.addEventListener(
            "click",
            () => {

                DraftManager.save();

                UIManager.refresh();

            }
        );


        this.ui.approve?.addEventListener(
            "click",
            async () => {

                await WorkflowManager.changeStatus(
                    CONFIG.WORKFLOW.APPROVED
                );

            }
        );


        this.ui.publish?.addEventListener(
            "click",
            async () => {

                await WorkflowManager.changeStatus(
                    CONFIG.WORKFLOW.PUBLISHED
                );

            }
        );


        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    (
                        event.ctrlKey ||
                        event.metaKey
                    ) &&
                    event.key.toLowerCase() === "s"
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
   Draft Change Events
========================================================== */

function registerDraftEvents() {

    if (!AppState.editor) {
        return;
    }

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

            AppState.draftChanged = true;

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
   Make openEditor() globally available
========================================================== */

window.openEditor = openEditor;
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
           Save Original Rendered Content
        ================================================== */

        const originalContent =
            contentRoot.innerHTML;


        /* ==================================================
           Check Existing Local Draft
        ================================================== */

        const savedDocument =
            DocumentStore.get(
                AppState.currentDocument
            );


        /* ==================================================
           Restore Saved Document State
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
           Remove Edit Buttons
        ================================================== */

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
           Quill Editor Container
        ================================================== */

        const editorContainer =
            document.createElement(
                "div"
            );


        editorContainer.id =
            "inline-editor";


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
            ) || "You";


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

            <span
                class="inline-editor-meta-icon"
                title="Listen"
            >
                🔊
            </span>

            <span
                class="inline-editor-meta-icon"
                title="Reactions"
            >
                🙂
            </span>

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

        contentRoot.innerHTML = "";


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


        /* ==================================================
           Register Change Events
        ================================================== */

        registerDraftEvents();


        /* ==================================================
           Inline Editor Active
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
         * Reload restores the normal
         * MkDocs documentation page.
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
