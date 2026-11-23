#!/usr/bin/env python3
"""Build the site's search index: python3 scripts/build_search_index.py."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote
import json
import re

ROOT = Path(__file__).resolve().parents[1]
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
BLOCK = {'article', 'aside', 'blockquote', 'br', 'dd', 'details', 'div', 'dl', 'dt', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'section', 'summary', 'table', 'td', 'th', 'tr', 'ul'}

class Node:
    def __init__(self, tag='', attrs=None):
        self.tag = tag
        self.attrs = dict(attrs or [])
        self.children = []

    def find_all(self, predicate):
        found = []
        for child in self.children:
            if isinstance(child, Node):
                if predicate(child):
                    found.append(child)
                found.extend(child.find_all(predicate))
        return found

    def text(self):
        if self.tag in {'script', 'style', 'noscript', 'svg'}:
            return ''
        parts = []
        for child in self.children:
            if isinstance(child, str):
                parts.append(child)
            else:
                value = child.text()
                parts.append((' ' + value + ' ') if child.tag in BLOCK else value)
        return ''.join(parts)

class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
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

def compact(text):
    return re.sub(r'\s+', ' ', text).strip()

entries = []
page_count = 0
for path in sorted(ROOT.glob('*.html')):
    doc = Document(path.read_text(encoding='utf-8')).root
    mains = doc.find_all(lambda node: node.tag == 'main')
    titles = doc.find_all(lambda node: node.tag == 'title')
    if not mains or not titles:
        continue
    main = mains[0]
    title = compact(titles[0].text()).removesuffix(' | Rupesh Lal Karn')
    if path.name == 'index.html':
        title = 'Rupesh Lal Karn — Home'
    descriptions = doc.find_all(lambda node: node.tag == 'meta' and node.attrs.get('name') == 'description')
    description = descriptions[0].attrs.get('content', '') if descriptions else ''
    url = './' if path.name == 'index.html' else path.name
    entries.append({'key': path.name, 'title': title, 'section': '', 'url': url, 'description': compact(description), 'headings': compact(' '.join(n.text() for n in main.find_all(lambda node: node.tag in {'h2', 'h3', 'h4'}))), 'text': compact(main.text())})
    page_count += 1
    for section in main.find_all(lambda node: node.tag == 'section' and bool(node.attrs.get('id'))):
        headings = section.find_all(lambda node: node.tag in {'h2', 'h3'})
        if not headings:
            continue
        heading = compact(headings[0].text())
        text = compact(section.text())
        summary = text[len(heading):].strip() if text.startswith(heading) else text
        entries.append({'key': path.name, 'title': title, 'section': heading, 'url': path.name + '#' + quote(section.attrs['id'], safe='-_.:'), 'description': summary[:220], 'headings': compact(' '.join(n.text() for n in section.find_all(lambda node: node.tag in {'h2', 'h3', 'h4'}))), 'text': text})

cv = ROOT / 'Rupesh_Lal_Karn_CV.pdf'
if cv.exists():
    entries.append({'key': cv.name, 'title': 'Curriculum Vitae (CV)', 'section': 'PDF document', 'url': cv.name, 'description': 'Education, research appointments, publications, teaching, and professional experience of Rupesh Lal Karn.', 'text': 'CV resume curriculum vitae Rupesh Lal Karn education research publications national laboratory appointments teaching professional consultancy experience.'})

payload = {'version': 1, 'pages': page_count, 'entries': entries}
(ROOT / 'search-index.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(f'Indexed {page_count} pages and {len(entries)} searchable page/section records.')
