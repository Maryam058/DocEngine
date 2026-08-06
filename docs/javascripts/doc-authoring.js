/* ==========================================================
   DocEngine Editor
   Part 1
========================================================== */

const CONFIG = {

    AUTOSAVE_DELAY: 5000,

    STORAGE: {

        DOCUMENTS: "docengine_documents",

        HISTORY: "docengine_history",

        VERSIONS: "docengine_versions"

    },

    WORKFLOW: {

        DRAFT: "draft",

        REVIEW: "review",

        APPROVED: "approved",

        REJECTED: "rejected",

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

    statusText: "Draft"

};


/* ==========================================================
   Storage
========================================================== */

const Storage = {

    load(key, defaultValue = null) {

        try {

            const value = localStorage.getItem(key);

            return value
                ? JSON.parse(value)
                : defaultValue;

        }

        catch (error) {

            console.error(error);

            return defaultValue;

        }

    },

    save(key, value) {

        localStorage.setItem(

            key,

            JSON.stringify(value)

        );

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

        const docs = this.getAll();

        return docs[page] || null;

    },

    save(page, data) {

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

function updateSaveStatus(message){

    const el = document.querySelector(

        "#save-status"

    );

    if(el){

        el.textContent = message;

    }

}


/* ==========================================================
   Draft Manager
========================================================== */

const DraftManager = {

    getContent(){

        if(!AppState.editor){

            return "";

        }

        return AppState.editor.root.innerHTML;

    },

    setContent(html){

        if(!AppState.editor){

            return;

        }

        AppState.editor.root.innerHTML = html;

    },

    load(){

        const page = AppState.currentDocument;

        if(!page){

            return;

        }

        const doc = DocumentStore.get(page);

        if(!doc){

            return;

        }

        this.setContent(

            doc.content

        );

        AppState.currentStatus =

            doc.status;

        AppState.currentVersion =

            doc.version;

        AppState.statusText =

            doc.status.charAt(0).toUpperCase() +

            doc.status.slice(1);

        AppState.lastSaved =

            doc.updatedAt;

    },

    save(){

        const page =

            AppState.currentDocument;

        if(!page){

            return;

        }

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

                    Time.now()

            }

        );

        AppState.lastSaved =

            Time.now();

        AppState.draftChanged = false;

        updateSaveStatus(

            "Saved " +

            Time.format()

        );

    }

};


/* ==========================================================
   Autosave
========================================================== */

let autoSave = null;

function startAutoSave(){

    clearInterval(autoSave);

    autoSave = setInterval(()=>{

        if(

            AppState.draftChanged

        ){

            DraftManager.save();

        }

    },

    CONFIG.AUTOSAVE_DELAY);

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

        const history = this.getAll();

        history.unshift({

            action,

            message,

            time: Time.now(),

            document: AppState.currentDocument

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

        const versions = this.getAll();

        versions.unshift({

            document: AppState.currentDocument,

            version: AppState.currentVersion,

            action: action,

            content: DraftManager.getContent(),

            createdAt: Time.now()

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

    changeStatus(status) {

        AppState.currentStatus = status;

        switch (status) {

            case CONFIG.WORKFLOW.DRAFT:

                AppState.statusText = "Draft";

                break;

            case CONFIG.WORKFLOW.REVIEW:

                AppState.statusText = "Under Review";

                HistoryManager.add(

                    "review",

                    "Submitted for Review"

                );

                VersionManager.create(

                    "review"

                );

                break;

            case CONFIG.WORKFLOW.APPROVED:

                AppState.statusText = "Approved";

                HistoryManager.add(

                    "approve",

                    "Document Approved"

                );

                VersionManager.create(

                    "approve"

                );

                break;

            case CONFIG.WORKFLOW.REJECTED:

                AppState.statusText = "Rejected";

                HistoryManager.add(

                    "reject",

                    "Document Rejected"

                );

                VersionManager.create(

                    "reject"

                );

                break;

            case CONFIG.WORKFLOW.PUBLISHED:

                AppState.statusText = "Published";

                HistoryManager.add(

                    "publish",

                    "Document Published"

                );

                VersionManager.create(

                    "publish"

                );

                AppState.currentVersion++;

                break;

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

        const status = document.querySelector(

            "#workflow-status"

        );

        const version = document.querySelector(

            "#version-label"

        );

        if (status) {

            status.textContent =

                AppState.statusText;

        }

        if (version) {

            version.textContent =

                "v" +

                AppState.currentVersion;

        }

    }

};
/* ==========================================================
   Application Controller
========================================================== */

const App = {

    ui: {},

    init() {

        this.cacheDOM();

        this.initEditor();

        this.bindEvents();

        AppState.currentDocument =
            localStorage.getItem("currentDoc");

        DraftManager.load();

        registerDraftEvents();

        startAutoSave();

        UIManager.refresh();

        console.log(
            "DocEngine Ready"
        );

    },

    cacheDOM() {

        this.ui = {

            editor:
                document.querySelector("#editor"),

            save:
                document.querySelector("#btn-save"),

            review:
                document.querySelector("#btn-review"),

            approve:
                document.querySelector("#btn-approve"),

            reject:
                document.querySelector("#btn-reject"),

            publish:
                document.querySelector("#btn-publish")

        };

    },

    initEditor() {

        if (!this.ui.editor) {

            return;

        }

        AppState.editor = new Quill(

            "#editor",

            {

                theme: "snow",

                modules: {

                    toolbar: [

                        ["bold", "italic", "underline"],

                        [{ header: 1 }, { header: 2 }],

                        [{ list: "ordered" }, { list: "bullet" }],

                        ["blockquote", "code-block"],

                        ["link", "image"],

                        ["clean"]

                    ]

                }

            }

        );

    },

    bindEvents() {

        this.ui.save?.addEventListener(

            "click",

            () => DraftManager.save()

        );

        this.ui.review?.addEventListener(

            "click",

            () => WorkflowManager.changeStatus(
                CONFIG.WORKFLOW.REVIEW
            )

        );

        this.ui.approve?.addEventListener(

            "click",

            () => WorkflowManager.changeStatus(
                CONFIG.WORKFLOW.APPROVED
            )

        );

        this.ui.reject?.addEventListener(

            "click",

            () => WorkflowManager.changeStatus(
                CONFIG.WORKFLOW.REJECTED
            )

        );

        this.ui.publish?.addEventListener(

            "click",

            () => WorkflowManager.changeStatus(
                CONFIG.WORKFLOW.PUBLISHED
            )

        );

        document.addEventListener(

            "keydown",

            function (e) {

                if (

                    e.ctrlKey &&

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
   Open Editor
========================================================== */

function openEditor() {

    const page =

        window.location.pathname;

    localStorage.setItem(

        "currentDoc",

        page

    );

    window.location.href =

        "/DocEngine/editor/";

}


/* ==========================================================
   Start
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    function () {

        App.init();

    }

);