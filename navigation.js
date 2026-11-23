/* Edit this list to change the main menu across the whole site. */
(() => {
  const items = [
    ["Home", "index.html"],
    ["Research", "research.html"],
    ["Experience", "experience.html"],
    ["Publications", "publications.html"],
    ["Projects", "projects.html"],
    ["Skills", "skills.html"],
    ["Contact", "contact.html"]
  ];
  const parents = {
    "about.html": "index.html",
    "teaching.html": "experience.html",
    "conferences.html": "publications.html",
    "tricar.html": "projects.html",
    "gokart.html": "projects.html",
    "undergraduate-project.html": "projects.html"
  };
  const header = document.querySelector("[data-rlk-header]");
  if (!header) return;
  const nav = header.querySelector(".rlk-nav");
  const button = header.querySelector(".rlk-menu-button");
  const file = decodeURIComponent(location.pathname.split("/").pop() || "index.html").toLowerCase();
  const current = items.some(([, href]) => href === file) ? file : (parents[file] || "research.html");
  const links = document.createDocumentFragment();
  items.forEach(([label, href]) => {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    if (href === current) link.setAttribute("aria-current", "page");
    links.appendChild(link);
  });
  nav.replaceChildren(links);
  header.setAttribute("data-menu-ready", "");
  const setOpen = (open) => {
    button.setAttribute("aria-expanded", String(open));
    button.textContent = open ? "Close" : "Menu";
    nav.classList.toggle("is-open", open);
  };
  setOpen(false);
  button.addEventListener("click", () => setOpen(button.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (event) => { if (event.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!header.contains(event.target) && button.getAttribute("aria-expanded") === "true") setOpen(false);
  });
  matchMedia("(max-width: 980px)").addEventListener("change", () => setOpen(false));

  // Shared site search. The index is fetched only when search is opened.
  const searchIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.5 15.5 4.5 4.5"></path></svg>';
  const searchButton = document.createElement("button");
  searchButton.className = "rlk-search-button";
  searchButton.type = "button";
  searchButton.setAttribute("aria-label", "Search the site");
  searchButton.setAttribute("aria-haspopup", "dialog");
  searchButton.setAttribute("aria-controls", "rlk-site-search");
  searchButton.setAttribute("aria-expanded", "false");
  searchButton.title = "Search the site";
  searchButton.innerHTML = searchIcon;

  const actions = document.createElement("div");
  actions.className = "rlk-header-actions";
  actions.append(searchButton, button);
  header.querySelector(".rlk-header-inner").appendChild(actions);

  const dialog = document.createElement("dialog");
  dialog.id = "rlk-site-search";
  dialog.className = "rlk-search";
  dialog.setAttribute("aria-labelledby", "rlk-search-title");
  dialog.innerHTML = `
    <div class="rlk-search-top">
      <h2 id="rlk-search-title">Search This Site</h2>
      <button class="rlk-search-close" type="button">Close</button>
    </div>
    <form class="rlk-search-form" role="search">
      <label for="rlk-search-input">Search Names, Topics &amp; Documents</label>
      <input id="rlk-search-input" name="q" type="search" placeholder="Name, material, publication, grant, or keyword…" autocomplete="off" spellcheck="false" maxlength="120" aria-describedby="rlk-search-status">
    </form>
    <p class="rlk-search-status" id="rlk-search-status" role="status" aria-live="polite">Try a name, MXene, MATLAB, a grant number, or CV.</p>
    <ol class="rlk-search-results" aria-label="Search results"></ol>
    <button class="rlk-search-more" type="button" hidden>Show More Results</button>
  `;
  document.body.appendChild(dialog);
  const input = dialog.querySelector("input");
  const status = dialog.querySelector(".rlk-search-status");
  const results = dialog.querySelector(".rlk-search-results");
  const moreButton = dialog.querySelector(".rlk-search-more");
  const closeSearch = () => dialog.close();
  const indexURL = new URL("search-index.json", document.currentScript ? document.currentScript.src : document.baseURI);
  indexURL.searchParams.set("v", "20261123-full-search");
  let records = null;
  let pendingIndex = null;
  let searchTimer;
  let matches = [];
  let shown = 0;
  let fuzzyOnly = false;
  const batchSize = 12;

  function loadIndex() {
    if (records) return Promise.resolve(records);
    if (!pendingIndex) {
      pendingIndex = fetch(indexURL, { cache: "no-cache" })
        .then((response) => {
          if (!response.ok) throw new Error("Search index unavailable");
          return response.json();
        })
        .then((data) => {
          if (!Array.isArray(data.entries) || !window.RLKSearch) throw new Error("Invalid search index");
          records = window.RLKSearch.prepare(data.entries);
          return records;
        })
        .catch((error) => {
          pendingIndex = null;
          throw error;
        });
    }
    return pendingIndex;
  }

  function appendResults() {
    const next = matches.slice(shown, shown + batchSize);
    for (const match of next) {
      const { entry } = match;
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = new URL(entry.url, indexURL).href;
      link.dataset.searchUrl = entry.url;
      const title = document.createElement("strong");
      title.textContent = entry.title;
      link.appendChild(title);
      if (entry.pageTitle && entry.pageTitle !== entry.title) {
        const context = document.createElement("span");
        context.className = "rlk-search-section";
        context.textContent = entry.pageTitle;
        link.appendChild(context);
      }
      const summary = document.createElement("p");
      summary.textContent = window.RLKSearch.excerpt(match);
      link.appendChild(summary);
      item.appendChild(link);
      results.appendChild(item);
    }
    shown += next.length;
    moreButton.hidden = shown >= matches.length;
    const count = `${matches.length} ${matches.length === 1 ? "result" : "results"} found`;
    status.textContent = (fuzzyOnly ? "Showing close spelling matches. " : "") + count + (shown < matches.length ? `; showing ${shown}.` : ".");
  }

  function renderSearch() {
    results.replaceChildren();
    moreButton.hidden = true;
    shown = 0;
    matches = [];
    if (!records) return;
    const found = window.RLKSearch.search(records, input.value);
    if (found.empty) {
      status.textContent = "Try a name, MXene, MATLAB, a grant number, or CV.";
      return;
    }
    matches = found.matches;
    fuzzyOnly = found.fuzzyOnly;
    if (!matches.length) {
      status.textContent = `No matches found for “${input.value.trim()}”. Try a shorter name or another keyword.`;
      return;
    }
    appendResults();
  }

  moreButton.addEventListener("click", () => {
    const firstNew = shown;
    appendResults();
    results.children[firstNew]?.querySelector("a")?.focus();
  });

  searchButton.addEventListener("click", async () => {
    setOpen(false);
    if (!dialog.open) dialog.showModal();
    searchButton.setAttribute("aria-expanded", "true");
    input.focus();
    input.select();
    status.textContent = "Loading search…";
    try {
      await loadIndex();
      renderSearch();
    } catch (_) {
      status.textContent = "Search is temporarily unavailable. Please close this panel and try again.";
    }
  });
  dialog.querySelector(".rlk-search-close").addEventListener("click", closeSearch);
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (event.key === "Tab") {
      const controls = Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]'))
        .filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }, true);
  dialog.addEventListener("close", () => {
    searchButton.setAttribute("aria-expanded", "false");
    searchButton.focus();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeSearch();
  });
  input.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderSearch, 120);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      const first = results.querySelector("a");
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  dialog.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    clearTimeout(searchTimer);
    renderSearch();
  });
  results.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeSearch();
  });

  function revealTarget() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    const requestedURL = location.href;
    const panel = target.closest('[role="tabpanel"]');
    if (panel && panel.hidden) {
      const tab = Array.from(document.querySelectorAll('[role="tab"], [data-panel], [aria-controls]'))
        .find((control) => control.getAttribute("aria-controls") === panel.id || control.dataset.panel === panel.id);
      if (tab) {
        tab.click();
        // Some existing tab controllers replace the fragment with the panel ID.
        history.replaceState(null, "", requestedURL);
      }
    }
    const paper = target.closest("#publication-list .publication");
    if (paper && paper.hidden) {
      const paperSearch = document.getElementById("paper-search");
      const paperYear = document.getElementById("paper-year");
      if (paperSearch) { paperSearch.value = ""; paperSearch.dispatchEvent(new Event("input", { bubbles: true })); }
      if (paperYear) { paperYear.value = "all"; paperYear.dispatchEvent(new Event("change", { bubbles: true })); }
    }
    for (let ancestor = target; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === "DETAILS") ancestor.open = true;
    }
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  window.addEventListener("hashchange", revealTarget);
  window.addEventListener("pageshow", revealTarget);
  revealTarget();

})();
