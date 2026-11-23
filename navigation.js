/* Edit this list to change the main menu across the whole site. */
(() => {
  const items = [
    ["Home", "index.html"],
    ["About", "about.html"],
    ["Research", "research.html"],
    ["Experience", "experience.html"],
    ["Publications", "publications.html"],
    ["Projects", "projects.html"],
    ["Skills", "skills.html"],
    ["Contact", "contact.html"]
  ];
  const parents = {
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
      <h2 id="rlk-search-title">Search this site</h2>
      <button class="rlk-search-close" type="button">Close</button>
    </div>
    <form class="rlk-search-form" role="search">
      <label for="rlk-search-input">Search topics and pages</label>
      <input id="rlk-search-input" name="q" type="search" placeholder="Research, publications, skills…" autocomplete="off" spellcheck="false" maxlength="120" aria-describedby="rlk-search-status">
    </form>
    <p class="rlk-search-status" id="rlk-search-status" role="status" aria-live="polite">Try MXene, MATLAB, Argonne, or CV.</p>
    <ol class="rlk-search-results" aria-label="Search results"></ol>
  `;
  document.body.appendChild(dialog);
  const input = dialog.querySelector("input");
  const status = dialog.querySelector(".rlk-search-status");
  const results = dialog.querySelector(".rlk-search-results");
  const closeSearch = () => dialog.close();
  const indexURL = new URL("search-index.json", document.currentScript ? document.currentScript.src : document.baseURI);
  indexURL.searchParams.set("v", "20261123-original-abstracts");
  let records = null;
  let pendingIndex = null;
  let searchTimer;

  const normalize = (value) => String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

  function loadIndex() {
    if (records) return Promise.resolve(records);
    if (!pendingIndex) {
      pendingIndex = fetch(indexURL, { cache: "no-cache" })
        .then((response) => {
          if (!response.ok) throw new Error("Search index unavailable");
          return response.json();
        })
        .then((data) => {
          if (!Array.isArray(data.entries)) throw new Error("Invalid search index");
          records = data.entries.map((entry) => ({
            ...entry,
            titleSearch: normalize(entry.title),
            sectionSearch: normalize(entry.section),
            descriptionSearch: normalize(entry.description),
            headingsSearch: normalize(entry.headings),
            textSearch: normalize(entry.text)
          }));
          return records;
        })
        .catch((error) => {
          pendingIndex = null;
          throw error;
        });
    }
    return pendingIndex;
  }

  function snippet(entry, tokens) {
    const text = entry.text || entry.description;
    const lower = text.toLowerCase();
    const positions = tokens.map((token) => lower.indexOf(token)).filter((index) => index >= 0);
    if (!positions.length) return entry.description;
    let start = Math.max(0, Math.min(...positions) - 55);
    if (start > 0) {
      const nextSpace = text.indexOf(" ", start);
      if (nextSpace >= 0) start = nextSpace + 1;
    }
    const excerpt = text.slice(start, start + 190).trim();
    return (start ? "… " : "") + excerpt + (start + 190 < text.length ? "…" : "");
  }

  function renderSearch() {
    results.replaceChildren();
    if (!records) return;
    const query = normalize(input.value);
    if (query.length < 2) {
      status.textContent = "Try MXene, MATLAB, Argonne, or CV.";
      return;
    }
    const tokens = query.split(/\s+/);
    const bestByPage = new Map();
    records.forEach((entry) => {
      const searchable = [entry.titleSearch, entry.sectionSearch, entry.headingsSearch, entry.descriptionSearch, entry.textSearch].join(" ");
      if (!tokens.every((token) => searchable.includes(token))) return;
      let score = 0;
      tokens.forEach((token) => {
        if (entry.titleSearch.includes(token)) score += 35;
        if (entry.sectionSearch.includes(token)) score += 20;
        if (entry.headingsSearch.includes(token)) score += 15;
        if (entry.descriptionSearch.includes(token)) score += 5;
        if (entry.textSearch.includes(token)) score += 1;
      });
      if (entry.titleSearch === query) score += 100;
      else if (entry.titleSearch.startsWith(query)) score += 35;
      else if (entry.titleSearch.includes(query)) score += 25;
      if (entry.sectionSearch.includes(query)) score += 20;
      if (entry.section) score += 2;
      const previous = bestByPage.get(entry.key);
      if (!previous || score > previous.score) bestByPage.set(entry.key, { entry, score });
    });
    const matches = Array.from(bestByPage.values()).sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
    if (!matches.length) {
      status.textContent = `No matches found for “${input.value.trim()}”. Try another topic or method.`;
      return;
    }
    status.textContent = `${matches.length} ${matches.length === 1 ? "page" : "pages"} found${matches.length > 8 ? "; showing the first 8" : ""}.`;
    matches.slice(0, 8).forEach(({ entry }) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = entry.url;
      const title = document.createElement("strong");
      title.textContent = entry.title;
      link.appendChild(title);
      if (entry.section) {
        const section = document.createElement("span");
        section.className = "rlk-search-section";
        section.textContent = entry.section;
        link.appendChild(section);
      }
      const summary = document.createElement("p");
      summary.textContent = snippet(entry, tokens);
      link.appendChild(summary);
      item.appendChild(link);
      results.appendChild(item);
    });
  }

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

})();
