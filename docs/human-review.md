# Human Review Workspace

Use this page to review all draft documents before they enter the publish workflow.

> Review actions are performed in the existing editor. Select any draft below to open it in review mode.

<div id="human-review-list" class="human-review-list" data-loading="true">
  <p>Loading drafts...</p>
</div>

<script>
(function () {
  "use strict";

  function normalizeLocation(locationValue) {
    if (!locationValue) {
      return "";
    }

    let normalized = String(locationValue).trim();

    if (!normalized) {
      return "";
    }

    if (normalized.charAt(0) === "/") {
      normalized = normalized.slice(1);
    }

    if (normalized.indexOf("#") > -1) {
      normalized = normalized.split("#")[0];
    }

    return normalized;
  }

  function isDraftLocation(locationValue) {
    return /^drafts\/.+/.test(locationValue);
  }

  function titleFromLocation(locationValue) {
    const slug = locationValue
      .replace(/^drafts\//, "")
      .replace(/\/$/, "")
      .split("/")
      .filter(Boolean)
      .pop() || "draft";

    return slug
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, function (char) {
        return char.toUpperCase();
      });
  }

  function createDraftItem(doc) {
    const locationValue = normalizeLocation(doc.location);
    const reviewUrl = "../" + locationValue + "?mode=review";
    const previewUrl = "../" + locationValue;

    const item = document.createElement("article");
    item.className = "human-review-item";

    const heading = document.createElement("h3");
    heading.textContent = doc.title || titleFromLocation(locationValue);

    const locationText = document.createElement("p");
    locationText.className = "human-review-path";
    locationText.textContent = "Draft path: docs/" + locationValue.replace(/\/$/, ".md");

    const actions = document.createElement("div");
    actions.className = "human-review-actions";

    const openReview = document.createElement("a");
    openReview.href = reviewUrl;
    openReview.className = "md-button md-button--primary";
    openReview.textContent = "Open In Review Editor";

    const openPage = document.createElement("a");
    openPage.href = previewUrl;
    openPage.className = "md-button";
    openPage.textContent = "Open Draft Page";

    actions.appendChild(openReview);
    actions.appendChild(openPage);

    item.appendChild(heading);
    item.appendChild(locationText);
    item.appendChild(actions);

    return item;
  }

  function renderDrafts(container, drafts) {
    container.innerHTML = "";
    container.dataset.loading = "false";

    if (!drafts.length) {
      container.innerHTML = "<p>No drafts were found in docs/drafts.</p>";
      return;
    }

    const fragment = document.createDocumentFragment();

    drafts.forEach(function (doc) {
      fragment.appendChild(createDraftItem(doc));
    });

    container.appendChild(fragment);
  }

  function renderError(container) {
    container.dataset.loading = "false";
    container.innerHTML = "<p>Unable to load draft list. Refresh the page or verify MkDocs search index generation.</p>";
  }

  function getDraftDocs(searchIndex) {
    if (!searchIndex || !Array.isArray(searchIndex.docs)) {
      return [];
    }

    const draftMap = new Map();

    searchIndex.docs.forEach(function (doc) {
      const locationValue = normalizeLocation(doc.location);

      if (!isDraftLocation(locationValue)) {
        return;
      }

      if (!locationValue || locationValue.indexOf("#") > -1) {
        return;
      }

      if (!draftMap.has(locationValue)) {
        draftMap.set(locationValue, {
          location: locationValue,
          title: doc.title || titleFromLocation(locationValue)
        });
      }
    });

    return Array.from(draftMap.values()).sort(function (left, right) {
      return left.title.localeCompare(right.title);
    });
  }

  function initDraftList() {
    const container = document.getElementById("human-review-list");

    if (!container) {
      return;
    }

    fetch("../search/search_index.json", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("search index request failed");
        }

        return response.json();
      })
      .then(function (searchIndex) {
        const drafts = getDraftDocs(searchIndex);
        renderDrafts(container, drafts);
      })
      .catch(function () {
        renderError(container);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDraftList);
    return;
  }

  initDraftList();
})();
</script>

<style>
.human-review-list {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.human-review-item {
  border: 1px solid var(--md-default-fg-color--lightest);
  border-radius: 0.75rem;
  padding: 1rem;
  background: var(--md-default-bg-color);
}

.human-review-item h3 {
  margin: 0 0 0.35rem;
}

.human-review-path {
  margin: 0 0 0.85rem;
  color: var(--md-default-fg-color--light);
}

.human-review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.human-review-actions .md-button {
  margin: 0;
}
</style>
