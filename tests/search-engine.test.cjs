const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../search-engine.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'search-index.json'), 'utf8'));
const index = engine.prepare(data.entries);
const find = (query) => engine.search(index, query).matches;

test('names find their page text and public document references', () => {
  for (const [query, prefix] of [
    ['Dr. Sunil Karna', 'magnetic-materials.html#'],
    ['Seena Reeves', 'experience.html#'],
    ['Gururaj M. Neelgund', 'Poster_RLK.pdf#page=1'],
    ['Raghava R. Kommalapati', 'conferences.html#'],
    ['John Singleton', 'Rupesh_Lal_Karn_CV.pdf#page=9'],
    ['Bhairab Sah', 'Rupesh_Lal_Karn_CV.pdf#page=4']
  ]) assert.ok(find(query).some((m) => m.entry.url.startsWith(prefix)), query);
});

test('all matching papers and more than eight locations remain available', () => {
  const hits = find('Laxman Palikhel');
  const urls = new Set(hits.map((m) => m.entry.url));
  assert.ok(hits.length > 12);
  assert.equal(urls.size, hits.length);
  for (const paper of data.entries.filter((e) => e.kind === 'article' && e.key === 'publications.html' && /laxman/i.test(e.text) && /palikhel/i.test(e.text))) {
    assert.ok(urls.has(paper.url), paper.title);
  }
});

test('British and American spellings have identical results', () => {
  for (const [a, b] of [['modeling', 'modelling'], ['characterization', 'characterisation'], ['centre', 'center']]) {
    assert.deepEqual(find(a).map((m) => m.entry.url), find(b).map((m) => m.entry.url));
  }
});

test('common spelling mistakes and PDF author superscripts remain searchable', () => {
  const typo = engine.search(index, 'Neelgound');
  assert.ok(typo.fuzzyOnly);
  assert.ok(typo.matches.some((m) => m.entry.url === 'Poster_RLK.pdf#page=1'));
  assert.ok(find('Jathropa').some((m) => /jatropha/i.test(m.entry.text)));
});

test('chemical formulas work with ASCII and Unicode subscripts', () => {
  assert.deepEqual(find('Mn3Al2Ge3O12').map((m) => m.entry.url), find('Mn₃Al₂Ge₃O₁₂').map((m) => m.entry.url));
  assert.ok(find('Mn1-xCoxGeTeO6').some((m) => m.entry.key === 'magnetic-materials.html'));
});

test('quoted phrases retain connecting words and grant numbers remain searchable', () => {
  const phrase = find('"Effect of CuO"');
  assert.ok(phrase.some((m) => m.entry.key === 'publications.html'));
  assert.ok(find('SRDI-75/76-Engg-3').some((m) => m.entry.url === 'experience.html#ugc-plastic-pyrolysis'));
});

test('CV shortcut goes to the first PDF page and author snippets show the queried name', () => {
  assert.equal(find('CV')[0].entry.url, 'Rupesh_Lal_Karn_CV.pdf#page=1');
  const match = find('Seena Reeves').find((m) => m.entry.key === 'experience.html');
  assert.match(engine.excerpt(match), /Seena Reeves/);
});

test('empty and nonexistent searches do not fabricate matches', () => {
  assert.ok(engine.search(index, '').empty);
  assert.equal(find('zzzznotarealtopic99127').length, 0);
  assert.equal(find('<img src=x onerror=alert(99127)>').length, 0);
});


test('standalone role words and short technical prefixes remain searchable', () => {
  assert.ok(find('Professor').some((m) => m.entry.key === 'Rupesh_Lal_Karn_CV.pdf'));
  assert.ok(find('Cu').some((m) => /CuO/.test(m.entry.text)));
});
