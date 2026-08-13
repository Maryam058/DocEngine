# Document Editor

<div class="editor-page">

    <div class="editor-frame">

        <!-- Editor Header -->
        <div class="editor-header">

            <div class="editor-title">
                <h2>Document Editor</h2>
                <p>Edit and review your documentation content.</p>
            </div>

            <div class="editor-status">

                <span class="status-label">
                    Status:
                </span>

                <span id="workflow-status" class="status-badge">
                    Draft
                </span>

                <span id="version-label" class="version-label">
                    v1
                </span>

            </div>

        </div>


        <!-- Workflow Actions - TOP RIGHT -->
        <div class="editor-actions">

            <button id="btn-save" class="editor-btn save-btn">
                💾 Save Draft
            </button>

            <button id="btn-approve" class="editor-btn approve-btn">
                ✅ Approve
            </button>

            <button id="btn-publish" class="editor-btn publish-btn">
                🚀 Publish
            </button>

            <button id="cancel-btn" class="editor-btn">
                ✖ Cancel
            </button>

        </div>


        <!-- Quill Editor -->
        <div class="editor-container">

            <div id="editor"></div>

        </div>


        <!-- Save Information -->
        <div class="editor-footer">

            <span id="save-status">
                Ready to edit
            </span>

        </div>

    </div>

</div>