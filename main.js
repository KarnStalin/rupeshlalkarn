
document.addEventListener("DOMContentLoaded", function () {
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav-links");

  if (menuButton && nav) {
    menuButton.addEventListener("click", function () {
      const isOpen = nav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });
  }

  const year = document.getElementById("year");
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  // Hide unavailable project photos.
  document.querySelectorAll("[data-project-image]").forEach(img => {
    const placeholder = img.previousElementSibling;

    img.addEventListener("load", () => {
      if (placeholder) placeholder.hidden = true;
      img.hidden = false;
    });

    img.addEventListener("error", () => {
      img.hidden = true;
      if (placeholder) placeholder.hidden = false;
    });

    if (img.complete) {
      if (img.naturalWidth > 0) {
        if (placeholder) placeholder.hidden = true;
      } else {
        img.hidden = true;
      }
    }
  });

  document.querySelectorAll("[data-gallery-image]").forEach(img => {
    img.addEventListener("error", () => {
      img.remove();
    });

    if (img.complete && img.naturalWidth === 0) {
      img.remove();
    }
  });
});

// =======================================
// CONFERENCE TABS
// =======================================

document.addEventListener("DOMContentLoaded", () => {

  const tabs = document.querySelectorAll(
    "[data-conference-tab]"
  );

  const panels = document.querySelectorAll(
    "[data-conference-panel]"
  );

  if (!tabs.length) return;

  function activateTab(name) {

    tabs.forEach(tab => {
      const active =
        tab.dataset.conferenceTab === name;

      tab.classList.toggle("active", active);
      tab.setAttribute(
        "aria-selected",
        String(active)
      );
      tab.tabIndex = active ? 0 : -1;
    });

    panels.forEach(panel => {
      panel.hidden =
        panel.dataset.conferencePanel !== name;
    });

    history.replaceState(
      null,
      "",
      "#" + name
    );
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.conferenceTab);
    });

    tab.addEventListener("keydown", event => {
      const keys = [
        "ArrowLeft", "ArrowRight",
        "Home", "End"
      ];

      if (!keys.includes(event.key)) return;

      event.preventDefault();

      let next = index;

      if (event.key === "ArrowRight")
        next = (index + 1) % tabs.length;

      if (event.key === "ArrowLeft")
        next = (index - 1 + tabs.length) % tabs.length;

      if (event.key === "Home") next = 0;
      if (event.key === "End")
        next = tabs.length - 1;

      tabs[next].focus();

      activateTab(
        tabs[next].dataset.conferenceTab
      );
    });
  });

  activateTab(
    location.hash === "#oral" ? "oral" : "poster"
  );

});

/* ==========================================
   CONFERENCE TABS
   Poster Presentations / Oral Presentations
   ========================================== */

document.addEventListener("DOMContentLoaded", function () {

  const tabs = document.querySelectorAll(
    "[data-conference-tab]"
  );

  const panels = document.querySelectorAll(
    "[data-conference-panel]"
  );

  if (tabs.length === 0 || panels.length === 0) {
    return;
  }

  function showTab(selectedTab) {

    tabs.forEach(function (tab) {
      const isActive =
        tab.dataset.conferenceTab === selectedTab;

      tab.classList.toggle("active", isActive);

      tab.setAttribute(
        "aria-selected",
        String(isActive)
      );

      tab.tabIndex = isActive ? 0 : -1;
    });

    panels.forEach(function (panel) {
      const isActive =
        panel.dataset.conferencePanel === selectedTab;

      panel.hidden = !isActive;
    });

    history.replaceState(
      null,
      "",
      "#" + selectedTab
    );
  }

  tabs.forEach(function (tab) {

    tab.addEventListener("click", function () {
      showTab(tab.dataset.conferenceTab);
    });

  });

  // Open the correct tab from the URL
  if (window.location.hash === "#oral") {
    showTab("oral");
  } else {
    showTab("poster");
  }

});
