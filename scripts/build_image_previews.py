#!/usr/bin/env python3
"""Create lighter WebP display copies of photographs; never rewrite originals.

Run with Python 3 and Pillow after adding photographs. Existing image links and
img fallbacks keep the original files. Scientific schematics are left unchanged.
"""
from pathlib import Path
from urllib.parse import unquote, urlsplit
from html.parser import HTMLParser
import html,json,re
from PIL import Image,ImageOps

ROOT=Path(__file__).resolve().parents[1]
PREVIEWS=ROOT/'image-previews'
EXTRA_PHOTOS={'profile.png','crystal.png','plastic fuel recovery.png'}
TAG=re.compile(r'<picture\b[^>]*class="site-picture"[^>]*>[\s\S]*?</picture>|<img\b[^>]*>',re.I)
class ImageTag(HTMLParser):
    def __init__(self,tag):
        super().__init__();self.attrs={};self.tag='';self.feed(tag)
    def handle_starttag(self,tag,attrs):
        if tag=='img':self.attrs=dict(attrs);self.tag=self.get_starttag_text()

def candidate(tag):
    image=ImageTag(tag)
    url=urlsplit(image.attrs.get('src',''))
    if url.scheme or url.netloc:return None
    name=unquote(url.path)
    source=(ROOT/name).resolve()
    if not source.is_relative_to(ROOT) or not source.is_file():return None
    if source.suffix.lower() not in {'.jpg','.jpeg'} and source.name not in EXTRA_PHOTOS:return None
    if source.stat().st_size<90000:return None
    return name,source,image

sources={}
for page in sorted(ROOT.glob('*.html')):
    for match in TAG.finditer(page.read_text()):
        item=candidate(match.group())
        if item:sources[item[0]]=item[1]
PREVIEWS.mkdir(exist_ok=True)
records={}
for name,source in sorted(sources.items()):
    slug=re.sub(r'[^a-z0-9]+','-',source.stem.lower()).strip('-')
    dest=PREVIEWS/(slug+'.webp')
    with Image.open(source) as original:
        image=ImageOps.exif_transpose(original)
        has_alpha='A' in image.getbands() or 'transparency' in image.info
        image=image.convert('RGBA' if has_alpha else 'RGB')
        dimensions=image.size
        limit=2400 if source.name=='MnGeTeO6.jpg' else (960 if source.name=='profile.png' else 1600)
        if image.width>limit:
            image.resize((limit,round(image.height*limit/image.width)),Image.Resampling.LANCZOS).save(dest,'WEBP',quality=88,method=6)
        else:image.save(dest,'WEBP',quality=88,method=6)
    if dest.stat().st_size>=source.stat().st_size*.9:
        dest.unlink();continue
    records[name]={'preview':dest.relative_to(ROOT).as_posix(),'original_bytes':source.stat().st_size,'preview_bytes':dest.stat().st_size,'width':dimensions[0],'height':dimensions[1]}
for page in sorted(ROOT.glob('*.html')):
    before=page.read_text()
    def replace(match):
        item=candidate(match.group())
        if not item or item[0] not in records:return match.group()
        name,source,tag=item;record=records[name];original_tag=tag.tag
        if 'width' not in tag.attrs:original_tag=original_tag.replace('<img','<img width="'+str(record['width'])+'"',1)
        if 'height' not in tag.attrs:original_tag=original_tag.replace('<img','<img height="'+str(record['height'])+'"',1)
        if 'decoding' not in tag.attrs:original_tag=original_tag.replace('<img','<img decoding="async"',1)
        return '<picture class="site-picture"><source type="image/webp" srcset="'+record['preview']+'">'+original_tag+'</picture>'
    after=TAG.sub(replace,before)
    if 'class="site-picture"' in after and 'figure-style.css?' not in after:
        after=after.replace('</head>','<link rel="stylesheet" href="figure-style.css?v=20261123-portfolio-polish">\n</head>')
    if after!=before:page.write_text(after)
report={'images':len(records),'original_bytes':sum(r['original_bytes'] for r in records.values()),'preview_bytes':sum(r['preview_bytes'] for r in records.values()),'files':records}
print(json.dumps(report,ensure_ascii=False))
