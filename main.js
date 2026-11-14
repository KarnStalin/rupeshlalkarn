
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
