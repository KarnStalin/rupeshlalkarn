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
    "gokart.html": "projects.html"
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
})();
