#!/usr/bin/env python3
"""Index all public HTML and linked PDFs. Run after content changes.

Usage: python3 scripts/build_search_index.py
Requires Poppler's pdftotext for the public PDF documents.
Stable IDs are added to searchable sections, papers, figures, and disclosures.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit
import json
import re
import shutil
import subprocess
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
BLOCK = {'article', 'aside', 'blockquote', 'br', 'dd', 'details', 'div', 'dl', 'dt', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'section', 'summary', 'table', 'td', 'th', 'tr', 'ul'}
SEARCH_BLOCKS = {'article', 'section', 'figure', 'details', 'aside'}
HEADINGS = {'h1', 'h2', 'h3', 'h4', 'h5', 'h6'}


def compact(value):
    return re.sub(r'\s+', ' ', value).strip()


class Node:
    def __init__(self, tag='', attrs=None, parent=None, insert_at=None):
        self.tag = tag
        self.attrs = dict(attrs or [])
        self.children = []
        self.parent = parent
        self.insert_at = insert_at

    def find_all(self, predicate):
        found = []
        for child in self.children:
            if isinstance(child, Node):
                if predicate(child):
                    found.append(child)
                found.extend(child.find_all(predicate))
        return found

    def text(self):
        if self.tag in {'script', 'style', 'noscript', 'input', 'select', 'option', 'template'} or 'data-rlk-header' in self.attrs:
            return ''
        if self.tag == 'img':
            return ' ' + self.attrs.get('alt', '') + ' '
        parts = []
        for child in self.children:
            if isinstance(child, str):
                parts.append(child)
            else:
                value = child.text()
                parts.append((' ' + value + ' ') if child.tag in BLOCK else value)
        # Non-visual labels carry accessible diagram and abbreviation information.
        for key in ['title', 'aria-label']:
            value = self.attrs.get(key, '')
            if value and value not in ''.join(parts):
                parts.append(' ' + value + ' ')
        return ''.join(parts)

    def links(self):
        return compact(' '.join(n.attrs['href'] for n in self.find_all(lambda n: n.tag == 'a' and n.attrs.get('href')) if not n.attrs['href'].startswith('#')))


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.offsets = [0] + [m.end() for m in re.finditer('\n', source)]
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        line, column = self.getpos()
        insert_at = self.offsets[line - 1] + column + len(self.get_starttag_text()) - 1
        node = Node(tag, attrs, self.stack[-1], insert_at)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                self.stack = self.stack[:index]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def public_page(doc):
    return not doc.find_all(lambda n: n.tag == 'meta' and (
        n.attrs.get('http-equiv', '').lower() == 'refresh' or
        (n.attrs.get('name', '').lower() == 'robots' and 'noindex' in n.attrs.get('content', '').lower())
    ))


def block_title(node):
    headings = node.find_all(lambda n: n.tag in HEADINGS)
    if headings:
        return compact(headings[0].text())
    if node.tag == 'details':
        summaries = node.find_all(lambda n: n.tag == 'summary')
        return compact(summaries[0].text()) if summaries else ''
    if node.tag == 'figure':
        captions = node.find_all(lambda n: n.tag == 'figcaption')
        if captions:
            return compact(captions[0].text())[:110]
        images = node.find_all(lambda n: n.tag == 'img' and n.attrs.get('alt'))
        return images[0].attrs['alt'][:110] if images else ''
    return ''


def slug(value):
    ascii_text = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', ascii_text).strip('-')[:90].rstrip('-') or 'content'


def searchable_blocks(main):
    return main.find_all(lambda n: n.tag in SEARCH_BLOCKS and bool(block_title(n)))


entries = []
page_count = 0
pdfs = set()
sources = []
for path in sorted(ROOT.rglob('*.html')):
    if any(part.startswith('.') or part in {'node_modules', 'vendor'} for part in path.relative_to(ROOT).parts):
        continue
    source = path.read_text(encoding='utf-8')
    doc = Document(source).root
    if not public_page(doc):
        continue
    mains = doc.find_all(lambda n: n.tag == 'main')
    titles = doc.find_all(lambda n: n.tag == 'title')
    if not mains or not titles:
        continue
    # Add stable anchors without reformatting or rewriting the existing content.
    ids = {n.attrs['id'] for n in doc.find_all(lambda n: bool(n.attrs.get('id')))}
    edits = []
    for node in searchable_blocks(mains[0]):
        if node.attrs.get('id'):
            continue
        base_id = 'search-' + slug(block_title(node))
        id_value = base_id
        number = 2
        while id_value in ids:
            id_value = base_id + '-' + str(number)
            number += 1
        ids.add(id_value)
        edits.append((node.insert_at, ' id="' + id_value + '"'))
    for position, insertion in sorted(edits, reverse=True):
        source = source[:position] + insertion + source[position:]
    if edits:
        path.write_text(source, encoding='utf-8')
        doc = Document(source).root
    main = doc.find_all(lambda n: n.tag == 'main')[0]
    body = doc.find_all(lambda n: n.tag == 'body')[0]
    filename = path.relative_to(ROOT).as_posix()
    page_title = compact(titles[0].text()).removesuffix(' | Rupesh Lal Karn')
    if filename == 'index.html':
        page_title = 'Rupesh Lal Karn — Home'
    descriptions = doc.find_all(lambda n: n.tag == 'meta' and n.attrs.get('name') == 'description')
    description = compact(descriptions[0].attrs.get('content', '')) if descriptions else ''
    url = './' if filename == 'index.html' else quote(filename, safe='/-_.')
    entries.append({'key': filename, 'kind': 'page', 'title': page_title, 'pageTitle': page_title, 'url': url, 'description': description,
                    'headings': compact(' '.join(n.text() for n in main.find_all(lambda n: n.tag in HEADINGS))),
                    'text': compact(body.text()), 'links': body.links(), 'ancestors': []})
    blocks = searchable_blocks(main)
    block_urls = {id(n): quote(filename, safe='/-_.') + '#' + quote(n.attrs['id'], safe='-_.:') for n in blocks}
    for node in blocks:
        ancestors = [url]
        parent = node.parent
        while parent:
            if id(parent) in block_urls:
                ancestors.append(block_urls[id(parent)])
            parent = parent.parent
        title = block_title(node)
        text = compact(node.text())
        summary = text[len(title):].strip() if text.startswith(title) else text
        entries.append({'key': filename, 'kind': node.tag, 'title': title, 'pageTitle': page_title, 'url': block_urls[id(node)],
                        'description': summary[:260], 'headings': compact(' '.join(n.text() for n in node.find_all(lambda n: n.tag in HEADINGS))),
                        'text': text, 'links': node.links(), 'ancestors': ancestors})
    # Only PDFs already linked on a public page are indexed; uploaded workspace reports are excluded.
    for link in doc.find_all(lambda n: n.tag == 'a' and n.attrs.get('href')):
        parsed = urlsplit(link.attrs['href'])
        if parsed.scheme or parsed.netloc:
            if parsed.hostname not in {'rlk.com.np', 'www.rlk.com.np'}:
                continue
            candidate = ROOT / unquote(parsed.path.lstrip('/'))
        else:
            candidate = path.parent / unquote(parsed.path)
        candidate = candidate.resolve()
        if candidate.is_relative_to(ROOT) and candidate.is_file() and candidate.suffix.lower() == '.pdf':
            pdfs.add(candidate)
    sources.append(filename)
    page_count += 1

if pdfs and not shutil.which('pdftotext'):
    raise SystemExit('Install Poppler (pdftotext) to index the linked public PDFs.')
for path in sorted(pdfs):
    output = subprocess.run(['pdftotext', '-layout', '-enc', 'UTF-8', str(path), '-'], capture_output=True, text=True, check=True).stdout
    pages = output.split('\f')
    if pages and not pages[-1].strip():
        pages.pop()
    filename = path.relative_to(ROOT).as_posix()
    title = {'Rupesh_Lal_Karn_CV.pdf': 'Curriculum Vitae (CV)', 'Poster_RLK.pdf': 'Research Poster'}.get(path.name, path.stem.replace('_', ' '))
    for number, page in enumerate(pages, 1):
        text = compact(page)
        if not text:
            continue
        entries.append({'key': filename, 'kind': 'document', 'title': title, 'pageTitle': 'PDF · Page ' + str(number) + ' of ' + str(len(pages)),
                        'url': quote(filename, safe='/-_.') + '#page=' + str(number), 'description': text[:260], 'headings': '', 'text': text,
                        'links': filename, 'keywords': 'CV resume curriculum vitae' if path.name == 'Rupesh_Lal_Karn_CV.pdf' else 'research poster presentation', 'ancestors': []})
    sources.append(filename)

payload = {'version': 2, 'pages': page_count, 'documents': len(pdfs), 'sources': sources, 'entries': entries}
(ROOT / 'search-index.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'Indexed {page_count} HTML pages, {len(pdfs)} public PDFs, and {len(entries)} searchable locations.')
