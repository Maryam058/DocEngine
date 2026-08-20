/* ==========================================================
   DocEngine Image Editing

   Confluence-style click-to-select, drag-to-resize, and
   Delete/Backspace-to-remove for images inside the Quill
   editor (both the standalone /editor.md page and the inline
   in-page editor).

   Architecture notes:

   - This mirrors the existing AIAssistant module's pattern
     exactly: a single shared floating-overlay instance
     (appended to document.body, never inside the
     contenteditable root), attached to each Quill instance via
     an idempotent `attach(quill)` guarded by a
     `quill.__imageEditorAttached` flag.

   - Resizing/deleting mutate the real <img> DOM node directly
     (style.width/height, or removing the node). Since
     DraftManager.getContent() already reads
     `AppState.editor.root.innerHTML` verbatim, these DOM
     mutations are automatically captured on save/autosave with
     no changes to the persistence layer. Quill's own
     MutationObserver reconciles direct DOM edits the same way
     it reconciles native browser edits, so this does not
     require any custom Quill format/blot.

   - The selection frame, resize handles, and delete button are
     ALWAYS a separate floating overlay, never DOM children of
     the image itself. That guarantees the persisted content
     (and therefore the published page) never contains any
     selection/resize markup, even if a save happens while an
     image is mid-selection.

   - AppState.draftChanged is set explicitly (once per resize
     gesture, once per delete) rather than relied upon via
     Quill's own text-change detection, so this does not depend
     on whether Quill's MutationObserver decides a style-only
     mutation counts as a text change. No history/version entry
     is created here — those are only ever created by
     WorkflowManager on approve/publish, which this module never
     calls.
========================================================== */

const MIN_IMAGE_SIZE =
    40;


const ImageEditor = {

    selectedImage: null,

    activeQuill: null,

    overlayEl: null,

    boundReposition: null,

    outsideMouseDownHandler: null,

    globalListenersAttached: false,


    /* ======================================================
       Attach To A Quill Instance

       Called once per editor instance, immediately after
       AIAssistant.attach(AppState.editor) in both
       App.initStandaloneEditor() and InlineEditor.start().
    ====================================================== */

    attach(quill) {

        if (!quill || quill.__imageEditorAttached) {
            return;
        }

        quill.__imageEditorAttached =
            true;

        /*
         * Select on mousedown (not click) so we can
         * preventDefault the browser's own native
         * contenteditable image-resize/drag affordance
         * before it appears.
         */

        quill.root.addEventListener(
            "mousedown",
            (event) => {

                const image =
                    event.target.closest("img");

                if (image && quill.root.contains(image)) {

                    event.preventDefault();

                    this.selectImage(
                        quill,
                        image
                    );

                }

            }
        );

        quill.root.addEventListener(
            "keydown",
            (event) => {

                if (
                    this.selectedImage &&
                    this.activeQuill === quill &&
                    (event.key === "Delete" || event.key === "Backspace")
                ) {

                    event.preventDefault();

                    this.deleteSelectedImage();

                }

                /*
                 * Any other key: do nothing. Normal typing,
                 * and Delete/Backspace while no image is
                 * selected, is left completely untouched so
                 * Quill's own text editing behaves exactly
                 * as before this module existed.
                 */

            }
        );

        this.attachGlobalListeners();

    },


    /* ======================================================
       Global Listeners (registered once, shared across
       whichever single editor instance is active)
    ====================================================== */

    attachGlobalListeners() {

        if (this.globalListenersAttached) {
            return;
        }

        this.globalListenersAttached =
            true;

        this.outsideMouseDownHandler =
            (event) => {

                if (!this.selectedImage) {
                    return;
                }

                if (event.target === this.selectedImage) {
                    return;
                }

                if (this.overlayEl && this.overlayEl.contains(event.target)) {
                    return;
                }

                this.deselectImage();

            };

        document.addEventListener(
            "mousedown",
            this.outsideMouseDownHandler
        );

        document.addEventListener(
            "keydown",
            (event) => {

                if (event.key === "Escape" && this.selectedImage) {
                    this.deselectImage();
                }

            }
        );

        this.boundReposition =
            () => {

                if (this.selectedImage) {
                    this.positionOverlay();
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

    },


    /* ======================================================
       Reset

       Called when an editor instance is torn down (mirrors
       AIAssistant.reset(), called from the same places).
    ====================================================== */

    reset() {

        this.deselectImage();

        this.activeQuill =
            null;

    },


    /* ======================================================
       Select / Deselect
    ====================================================== */

    selectImage(quill, image) {

        this.selectedImage =
            image;

        this.activeQuill =
            quill;

        /*
         * Keep keyboard events (Delete/Backspace, Escape)
         * routed to this editor instance regardless of
         * whatever the mousedown above prevented.
         */

        quill.focus();

        /*
         * Belt-and-suspenders: an image click can still
         * surface a native selectionchange in some browsers,
         * which would otherwise let AIAssistant's own
         * selection-change listener show its floating AI
         * toolbar over the same spot.
         */

        if (typeof AIAssistant !== "undefined") {
            AIAssistant.hideToolbar();
        }

        this.ensureOverlay();

        this.positionOverlay();

        this.overlayEl.style.display =
            "block";

    },


    deselectImage() {

        this.selectedImage =
            null;

        if (this.overlayEl) {

            this.overlayEl.style.display =
                "none";

        }

    },


    /* ======================================================
       Floating Overlay (frame + handles + delete button)
    ====================================================== */

    ensureOverlay() {

        if (this.overlayEl) {
            return this.overlayEl;
        }

        const overlay =
            document.createElement("div");

        overlay.className =
            "image-editor-overlay";

        overlay.innerHTML = `
            <div class="image-editor-toolbar">
                <button type="button" class="image-editor-delete-btn" aria-label="Delete image">
                    🗑 Delete Image
                </button>
            </div>
            <div class="image-editor-handle image-editor-handle--nw" data-corner="nw"></div>
            <div class="image-editor-handle image-editor-handle--ne" data-corner="ne"></div>
            <div class="image-editor-handle image-editor-handle--sw" data-corner="sw"></div>
            <div class="image-editor-handle image-editor-handle--se" data-corner="se"></div>
        `;

        overlay
            .querySelectorAll(".image-editor-handle")
            .forEach(handle => {

                handle.addEventListener(
                    "mousedown",
                    (event) => this.startResize(handle, event)
                );

            });

        const deleteButton =
            overlay.querySelector(".image-editor-delete-btn");

        /*
         * mousedown + preventDefault mirrors AIAssistant's
         * own toolbar: stops the browser from doing anything
         * with the click before our handler runs.
         */

        deleteButton.addEventListener(
            "mousedown",
            (event) => event.preventDefault()
        );

        deleteButton.addEventListener(
            "click",
            () => this.deleteSelectedImage()
        );

        document.body.appendChild(
            overlay
        );

        this.overlayEl =
            overlay;

        return overlay;

    },


    positionOverlay() {

        if (!this.selectedImage || !this.overlayEl) {
            return;
        }

        const rect =
            this.selectedImage.getBoundingClientRect();

        this.overlayEl.style.left =
            `${rect.left}px`;

        this.overlayEl.style.top =
            `${rect.top}px`;

        this.overlayEl.style.width =
            `${rect.width}px`;

        this.overlayEl.style.height =
            `${rect.height}px`;

    },


    /* ======================================================
       Delete
    ====================================================== */

    deleteSelectedImage() {

        if (!this.selectedImage) {
            return;
        }

        const image =
            this.selectedImage;

        this.deselectImage();

        image.remove();

        AppState.draftChanged =
            true;

        updateSaveStatus(
            "Unsaved Changes"
        );

    },


    /* ======================================================
       Resize (aspect-ratio locked, horizontal-drag driven)
    ====================================================== */

    startResize(handle, event) {

        event.preventDefault();
        event.stopPropagation();

        const image =
            this.selectedImage;

        if (!image) {
            return;
        }

        const rect =
            image.getBoundingClientRect();

        const aspectRatio =
            rect.width / rect.height;

        const corner =
            handle.dataset.corner;

        const growsRight =
            corner === "ne" || corner === "se";

        const startX =
            event.clientX;

        const startWidth =
            rect.width;

        const maxWidth =
            (this.activeQuill && this.activeQuill.root.clientWidth) ||
            1200;

        const onMouseMove = (moveEvent) => {

            const dx =
                moveEvent.clientX - startX;

            let newWidth =
                startWidth + (growsRight ? dx : -dx);

            newWidth =
                Math.max(
                    MIN_IMAGE_SIZE,
                    Math.min(newWidth, maxWidth)
                );

            const newHeight =
                newWidth / aspectRatio;

            image.style.width =
                `${newWidth}px`;

            image.style.height =
                `${newHeight}px`;

            this.positionOverlay();

        };

        const onMouseUp = () => {

            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);

            /*
             * One meaningful edit per completed drag, not
             * per pixel of movement. No version/history
             * entry is created here — those only ever come
             * from WorkflowManager on approve/publish.
             */

            AppState.draftChanged =
                true;

            updateSaveStatus(
                "Unsaved Changes"
            );

        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);

    }

};


window.ImageEditor =
    ImageEditor;
