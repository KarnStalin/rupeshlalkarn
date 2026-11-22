name: Update website navigation

on:
  workflow_dispatch:

permissions:
  contents: write
  pages: write

concurrency:
  group: website-navigation-update
  cancel-in-progress: false

jobs:
  update-navigation:
    runs-on: ubuntu-latest

    steps:
      - name: Check out the default branch
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.repository.default_branch }}

      - name: Update navigation across all HTML pages
        run: |
          python3 - <<'NAVPY'
          from pathlib import Path
          import re

          NAVCSS = r"""
          /* Shared navigation across the website. */

          .rlk-header {
            display: block;
            position: static;
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 0;
            border: 0;
            border-bottom: 1px solid #d8dcd4;
            background: #faf9f6;
            color: #272e2a;
            font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
            box-shadow: none;
          }

          .rlk-header *,
          .rlk-header *::before,
          .rlk-header *::after {
            box-sizing: border-box;
          }

          .rlk-header .rlk-header-inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 30px;
            width: min(1160px, calc(100% - 64px));
            min-height: 98px;
            margin: 0 auto;
            padding: 0;
          }

          .rlk-header .rlk-brand {
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            min-height: 44px;
            margin: 0;
            padding: 0;
            border: 0;
            color: #272e2a;
            font: 400 22px/1.3 Georgia, "Times New Roman", serif;
            letter-spacing: 0;
            text-decoration: none;
            white-space: nowrap;
            text-shadow: none;
          }

          .rlk-header .rlk-nav {
            display: flex;
            flex-wrap: nowrap;
            align-items: center;
            justify-content: flex-end;
            gap: 22px;
            width: auto;
            max-width: none;
            margin: 0;
            padding: 0;
            border: 0;
            background: transparent;
            box-shadow: none;
          }

          .rlk-header .rlk-nav a {
            display: inline-flex;
            align-items: center;
            justify-content: flex-start;
            min-height: 46px;
            margin: 0;
            padding: 0;
            border: 0;
            border-bottom: 1px solid transparent;
            border-radius: 0;
            background: transparent;
            color: #606961;
            font: 400 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
            letter-spacing: 0;
            text-decoration: none;
            text-transform: none;
            white-space: nowrap;
            text-shadow: none;
            box-shadow: none;
          }

          .rlk-header .rlk-nav a::before,
          .rlk-header .rlk-nav a::after {
            content: none;
          }

          .rlk-header .rlk-nav a:hover {
            color: #385975;
          }

          .rlk-header .rlk-nav a[aria-current="page"] {
            border-bottom-color: #385975;
            color: #272e2a;
          }

          .rlk-header .rlk-menu-button {
            display: none;
            min-width: 66px;
            min-height: 44px;
            margin: 0;
            padding: 9px 14px;
            border: 1px solid #d8dcd4;
            border-radius: 0;
            background: transparent;
            color: #272e2a;
            font: 400 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
            cursor: pointer;
            text-shadow: none;
            box-shadow: none;
          }

          .rlk-header a:focus-visible,
          .rlk-header button:focus-visible {
            outline: 2px solid #385975;
            outline-offset: 5px;
          }

          @media (max-width: 980px) {
            .rlk-header .rlk-header-inner {
              flex-wrap: wrap;
              gap: 8px 20px;
              min-height: 85px;
              padding: 18px 0;
            }

            .rlk-header .rlk-nav {
              flex-wrap: wrap;
              justify-content: flex-start;
              gap: 4px 22px;
              width: 100%;
            }

            .rlk-header[data-menu-ready] .rlk-menu-button {
              display: inline-flex;
              align-items: center;
              justify-content: center;
            }

            .rlk-header[data-menu-ready] .rlk-nav {
              display: none;
              flex-direction: column;
              align-items: stretch;
              gap: 0;
              padding-top: 12px;
            }

            .rlk-header[data-menu-ready] .rlk-nav.is-open {
              display: flex;
            }

            .rlk-header .rlk-nav a {
              min-height: 48px;
              align-self: flex-start;
            }
          }

          @media (max-width: 760px) {
            .rlk-header .rlk-header-inner {
              width: calc(100% - 40px);
            }
          }
          """

          NAVJS = r"""
          /* Edit this list to update the menu across the website. */
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

            const file = decodeURIComponent(
              location.pathname.split("/").pop() || "index.html"
            ).toLowerCase();

            const current = items.some(([, href]) => href === file)
              ? file
              : (parents[file] || "research.html");

            const links = document.createDocumentFragment();

            items.forEach(([label, href]) => {
              const link = document.createElement("a");
              link.href = href;
              link.textContent = label;

              if (href === current) {
                link.setAttribute("aria-current", "page");
              }

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

            button.addEventListener("click", () => {
              setOpen(button.getAttribute("aria-expanded") !== "true");
            });

            nav.addEventListener("click", (event) => {
              if (event.target.closest("a")) setOpen(false);
            });

            document.addEventListener("keydown", (event) => {
              if (
                event.key === "Escape" &&
                button.getAttribute("aria-expanded") === "true"
              ) {
                setOpen(false);
                button.focus();
              }
            });

            document.addEventListener("click", (event) => {
              if (
                !header.contains(event.target) &&
                button.getAttribute("aria-expanded") === "true"
              ) {
                setOpen(false);
              }
            });

            matchMedia("(max-width: 980px)").addEventListener(
              "change",
              () => setOpen(false)
            );
          })();
          """

          items = [
              ("Home", "index.html"),
              ("About", "about.html"),
              ("Research", "research.html"),
              ("Experience", "experience.html"),
              ("Publications", "publications.html"),
              ("Projects", "projects.html"),
              ("Skills", "skills.html"),
              ("Contact", "contact.html"),
          ]

          parents = {
              "teaching.html": "experience.html",
              "conferences.html": "publications.html",
              "tricar.html": "projects.html",
              "gokart.html": "projects.html",
          }

          main_files = {href for _, href in items}

          menu_pattern = r"""const menuButton\s*=\s*document\.querySelector\((["'])\.menu-button\1\);.*?navigation\.addEventListener\((["'])click\2,.*?\n\s*\}\);"""

          changes = []

          for path in sorted(Path(".").glob("*.html")):
              original = path.read_text(encoding="utf-8")

              current = (
                  path.name
                  if path.name in main_files
                  else parents.get(path.name, "research.html")
              )

              links = "\n".join(
                  '        <a href="' + href + '"'
                  + (' aria-current="page"' if href == current else '')
                  + '>' + label + '</a>'
                  for label, href in items
              )

              header = (
                  '<header class="rlk-header" data-rlk-header>\n'
                  '  <div class="rlk-header-inner">\n'
                  '    <a class="rlk-brand" href="index.html">'
                  'Rupesh Lal Karn</a>\n'
                  '    <button class="rlk-menu-button" type="button" '
                  'aria-controls="rlk-navigation" '
                  'aria-expanded="false">Menu</button>\n'
                  '    <nav class="rlk-nav" id="rlk-navigation" '
                  'aria-label="Main navigation">\n'
                  + links
                  + '\n    </nav>\n  </div>\n</header>'
              )

              updated, count = re.subn(
                  r'<header\b[^>]*>.*?</header>',
                  lambda match: header,
                  original,
                  count=1,
                  flags=re.S,
              )

              if count != 1:
                  raise RuntimeError(
                      "Could not identify the header in " + path.name
                  )

              updated = re.sub(
                  menu_pattern,
                  "",
                  updated,
                  flags=re.S,
              )

              additions = []

              if not re.search(
                  r'href=["\']navigation\.css(?:\?[^"\']*)?["\']',
                  updated,
              ):
                  additions.append(
                      '  <link rel="stylesheet" href="navigation.css">'
                  )

              if not re.search(
                  r'src=["\']navigation\.js(?:\?[^"\']*)?["\']',
                  updated,
              ):
                  additions.append(
                      '  <script src="navigation.js" defer></script>'
                  )

              if additions:
                  if "</head>" not in updated:
                      raise RuntimeError(
                          "Missing closing head tag in " + path.name
                      )

                  updated = updated.replace(
                      "</head>",
                      "\n".join(additions) + "\n</head>",
                      1,
                  )

              if updated != original:
                  path.write_text(updated, encoding="utf-8")
                  changes.append(path.name)

          Path("navigation.css").write_text(
              NAVCSS,
              encoding="utf-8",
          )

          Path("navigation.js").write_text(
              NAVJS,
              encoding="utf-8",
          )

          print("Updated HTML pages:", len(changes))
          print(
              "Main menu:",
              " / ".join(label for label, _ in items),
          )
          NAVPY

      - name: Commit the navigation changes
        id: changes
        env:
          SITE_DEFAULT_BRANCH: ${{ github.event.repository.default_branch }}
        run: |
          git add -- '*.html' navigation.css navigation.js

          if git diff --cached --quiet; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
            echo "The navigation is already up to date."
          else
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

            git commit -m "Standardize navigation across website pages"
            git push origin "HEAD:${SITE_DEFAULT_BRANCH}"

            echo "changed=true" >> "$GITHUB_OUTPUT"
          fi

      - name: Request a GitHub Pages rebuild
        if: steps.changes.outputs.changed == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh api --method POST \
            "repos/${GITHUB_REPOSITORY}/pages/builds" \
            --silent
