/*Configuration*/
const CONFIG = {

    AUTOSAVE_DELAY: 5000,

    STORAGE: {
        draft: "docengine_draft",
        history: "docengine_history",
        versions: "docengine_versions"
    },

    WORKFLOW: {
        DRAFT: "draft",
        REVIEW: "review",
        APPROVED: "approved",
        REJECTED: "rejected",
        PUBLISHED: "published"
    }

};
/*   Application State */
const AppState = {
    editor: null,
    currentStatus: CONFIG.WORKFLOW.DRAFT,
    currentVersion: 1,
    draftChanged: false,
    lastSaved: null,
    statusText: "Draft"
};
/*    Storage Manager */

const Storage = {
    load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        }
        catch (error) {
            console.error("Storage Load Error:", error);
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
            console.error("Storage Save Error:", error);
        }
    },
    remove(key) {
        localStorage.removeItem(key);
    }
};
/*    Time Helper */
const Time = {
    now() {
        return new Date().toISOString();
    },
    format(date = new Date()) {
        return date.toLocaleString();
    }
};
/*    Auto Save*/

let autoSaveTimer = null;
function startAutoSave() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }
    autoSaveTimer = setInterval(() => {
        if (!AppState.draftChanged) {
            return;
        }
        DraftManager.save();
        console.log(
            "Draft Autosaved",
            Time.format()
        );
    },
    CONFIG.AUTOSAVE_DELAY);
}
/*    Change Detection*/

function registerDraftEvents() {
    if (!AppState.editor) {
        return;
    }
    AppState.editor.on(
        "text-change",
        () => {
            AppState.draftChanged = true;
            updateSaveStatus(
               "Unsaved changes"
              );
        }
    );
}
/*   Save Status */

function updateSaveStatus(message) {
    const status = document.querySelector(
        "#save-status"
    );
    if (!status) {
        return;
    }
    status.textContent = message;
}
/*    Draft Manager */
const DraftManager = {
    getContent() {
        if (!AppState.editor) {
            return "";
        }
        return AppState.editor.root.innerHTML;
    },
    setContent(content) {
        if (!AppState.editor) {
            return;
        }
        AppState.editor.root.innerHTML = content;
    },
    save() {
        const draft = {
            content: this.getContent(),
            savedAt: Time.now(),
            status: AppState.currentStatus,
            version: AppState.currentVersion
        };
        Storage.save(
            CONFIG.STORAGE.draft,
            draft
        );
        AppState.lastSaved = draft.savedAt;
        AppState.draftChanged = false;
        updateSaveStatus(
        "Saved " +
        Time.format()

);
    },
    loadDocument(){

    const doc = localStorage.getItem(
        "currentDoc"
    );


    if(!doc){
        return;
    }


    const documents = Storage.load(
        "docengine_documents",
        {}
    );


    if(documents[doc]){

        this.setContent(
            documents[doc].content
        );


        AppState.currentStatus =
            documents[doc].status;


        AppState.currentVersion =
            documents[doc].version;


    }


},
    load() {

    const draft = Storage.load(

        CONFIG.STORAGE.draft,

        null

    );

    if (!draft) {

        return;

    }

    this.setContent(

        draft.content

    );

    AppState.lastSaved = draft.savedAt;

    AppState.currentStatus = draft.status;

    AppState.currentVersion = draft.version;

    AppState.statusText =

        draft.status.charAt(0).toUpperCase() +

        draft.status.slice(1);

    UIManager.refresh();

    updateSaveStatus(

        "Draft restored"
    );
    },
    clear() {

        Storage.remove(

            CONFIG.STORAGE.draft

        );

    }

};
/*    History Manager */

const HistoryManager = {

    getAll() {

        return Storage.load(

            CONFIG.STORAGE.history,

            []

        );

    },

    add(action, message) {

        // Only workflow events are stored
        const allowed = [

            "review",

            "approve",

            "reject",

            "publish"

        ];

        if (!allowed.includes(action)) {

            return;

        }

        const history = this.getAll();

        history.unshift({

            action,

            message,

            time: Time.now()

        });
        const MAX_HISTORY = 100;

if (history.length > MAX_HISTORY) {

    history.length = MAX_HISTORY;

}

        const doc =
localStorage.getItem("currentDoc");


let documents =
Storage.load(
"docengine_documents",
{}
);


documents[doc] = {

content:
this.getContent(),

status:
AppState.currentStatus,

version:
AppState.currentVersion,

savedAt:
Time.now()

};


Storage.save(
"docengine_documents",
documents
);

    },

    clear() {

        Storage.remove(

            CONFIG.STORAGE.history

        );

    }

};
/* ==========================================================
   Version Manager
========================================================== */

const VersionManager = {

    getAll() {

        return Storage.load(

            CONFIG.STORAGE.versions,

            []

        );

    },

    create(action) {

        const versions = this.getAll();

        versions.unshift({

            version: AppState.currentVersion,

            action,

            content: DraftManager.getContent(),

            createdAt: Time.now()

        });
        const MAX_VERSIONS = 20;

if (versions.length > MAX_VERSIONS) {

    versions.length = MAX_VERSIONS;

}

        Storage.save(

            CONFIG.STORAGE.versions,

            versions

        );

    },

    clear() {

        Storage.remove(

            CONFIG.STORAGE.versions

        );

    }

};
/*   Workflow Manager*/
const WorkflowManager = {

    saveWorkflow(action, message) {

        HistoryManager.add(action, message);

        VersionManager.create(action);

    },

    changeStatus(status) {

        AppState.currentStatus = status;

        switch (status) {

            case CONFIG.WORKFLOW.REVIEW:

                AppState.statusText = "Under Review";

                this.saveWorkflow(
                    "review",
                    "Submitted for review"
                );

                break;

            case CONFIG.WORKFLOW.APPROVED:

                AppState.statusText = "Approved";

                this.saveWorkflow(
                    "approve",
                    "Document approved"
                );

                break;

            case CONFIG.WORKFLOW.REJECTED:

                AppState.statusText = "Rejected";

                this.saveWorkflow(
                    "reject",
                    "Document rejected"
                );

                break;

            case CONFIG.WORKFLOW.PUBLISHED:

                AppState.statusText = "Published";

                this.saveWorkflow(
                    "publish",
                    "Document published"
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

    updateStatus() {

        if (!App.ui?.status) return;

        App.ui.status.textContent =
            AppState.statusText;

    },

    updateVersion() {

        if (!App.ui?.version) return;

        App.ui.version.textContent =
            "v" + AppState.currentVersion;

    },

    refresh() {

        this.updateStatus();

        this.updateVersion();

    }

};
/*Application Controller */
const App = {

    ui: {},

    init() {

        this.cacheDOM();

        this.initEditor();

        this.bindEvents();

        DraftManager.loadDocument();

        DraftManager.load();

      registerDraftEvents();

        startAutoSave();

        UIManager.refresh();

        console.log("DocEngine initialized.");

    },

    cacheDOM() {

        this.ui = {

            editor: document.querySelector("#editor"),

            saveDraft: document.querySelector("#btn-save"),

            review: document.querySelector("#btn-review"),

            approve: document.querySelector("#btn-approve"),

            reject: document.querySelector("#btn-reject"),

            publish: document.querySelector("#btn-publish"),

            status: document.querySelector("#workflow-status"),

            version: document.querySelector("#version-label")

        };

    },

    initEditor() {

       if(!this.ui.editor){
        return;
      }
      AppState.editor = new Quill(
      "#editor",
      {
        theme:"snow",
        modules:{
          toolbar:[
            ["bold","italic","underline"],

            [
{header:1},
{header:2}
],

[
"image",
"link"
],

[
"code-block"
],

[
"bullet",
"list"
]

]
}

});
    },

    bindEvents() {

    this.ui.saveDraft?.addEventListener("click", () => {

        DraftManager.save();

    });

    this.ui.review?.addEventListener("click", () => {

        WorkflowManager.changeStatus(
            CONFIG.WORKFLOW.REVIEW
        );

    });

    this.ui.approve?.addEventListener("click", () => {

        WorkflowManager.changeStatus(
            CONFIG.WORKFLOW.APPROVED
        );

    });

    this.ui.reject?.addEventListener("click", () => {

        WorkflowManager.changeStatus(
            CONFIG.WORKFLOW.REJECTED
        );

    });

    this.ui.publish?.addEventListener("click", () => {

        WorkflowManager.changeStatus(
            CONFIG.WORKFLOW.PUBLISHED
        );

    });

    document.addEventListener("keydown", (event) => {

        if (event.ctrlKey && event.key.toLowerCase() === "s") {

            event.preventDefault();

            DraftManager.save();

        }

    });

}

};
document.addEventListener(

    "DOMContentLoaded",

    () => {

        App.init();

    }

);
function openEditor(){

    const content = document.querySelector(
        ".md-content__inner"
    );


    if(!content){
        console.log("Content area not found");
        return;
    }


    content.contentEditable = true;


    // Toolbar
    const toolbar = document.createElement("div");

    toolbar.id = "editor-toolbar";


    toolbar.innerHTML = `

    <button data-command="bold">B</button>

    <button data-command="italic">I</button>

    <button data-command="underline">U</button>

    <button data-command="insertUnorderedList">
    • List
    </button>

    <button data-command="insertOrderedList">
    1. List
    </button>

    `;



    toolbar.querySelectorAll("button")
    .forEach(button=>{

        button.addEventListener(
            "mousedown",
            function(e){

                e.preventDefault();

                content.focus();


                document.execCommand(
                    this.dataset.command,
                    false,
                    null
                );

            }
        );

    });



    // Save Button

    const saveBtn = document.createElement("button");

    saveBtn.id = "save-page-draft";

    saveBtn.textContent =
        "💾 Save Draft";


    saveBtn.onclick = function(){


        const page =
            window.location.pathname;


        const drafts =
        JSON.parse(
            localStorage.getItem(
                "docengine_drafts"
            )
        ) || {};



        drafts[page] = {

            content:
            content.innerHTML,

            savedAt:
            new Date()

        };



        localStorage.setItem(
            "docengine_drafts",
            JSON.stringify(drafts)
        );


        alert(
            "Draft saved"
        );

    };



    // Add UI

    content.parentElement.prepend(
        saveBtn
    );


    content.parentElement.prepend(
        toolbar
    );


    console.log(
        "Editing:",
        window.location.pathname
    );
}