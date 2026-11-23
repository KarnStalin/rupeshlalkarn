/* Full-text search shared by the site. No network service or external library. */
((root) => {
  const aliases = new Map(Object.entries({
    modelling: "modeling", modelled: "modeled", models: "model", descriptors: "descriptor",
    characterisation: "characterization", characterisations: "characterization", characterizations: "characterization",
    behaviour: "behavior", behaviours: "behavior", behaviors: "behavior", centre: "center", centres: "center", centers: "center",
    synthesised: "synthesized", synthesise: "synthesize", sulphide: "sulfide", sulphides: "sulfide", sulfides: "sulfide",
    sulphur: "sulfur", aluminium: "aluminum", analyse: "analyze", analysed: "analyzed", analyses: "analysis",
    labs: "laboratory", lab: "laboratory", laboratories: "laboratory", publications: "publication", papers: "paper",
    materials: "material", grants: "grant", nanoparticles: "nanoparticle", composites: "composite", fuels: "fuel",
    crystals: "crystal", measurements: "measurement", emissions: "emission", studies: "study", techniques: "technique"
  }));
  const stopWords = new Set("a an the and or of on in to for with by from at about show find search who what where is are was were my me dr professor prof er mr ms mrs".split(" "));
  const fold = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const words = (value) => (String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[\p{L}\p{N}]+/gu) || []).flatMap((raw) => {
    const token = fold(raw);
    const canonical = aliases.get(token) || token;
    // PDF affiliation superscripts can attach to names, e.g. Neelgund2.
    const name = raw.match(/^([A-Z][a-z]{4,})\d{1,2}$/);
    return name ? [fold(name[1]), canonical] : [canonical];
  });
  const normalize = (value) => words(value).join(" ");
  const phraseIn = (text, phrase) => Boolean(phrase) && (" " + text + " ").includes(" " + phrase + " ");

  // Bounded Damerau-Levenshtein distance also accepts a transposed pair of letters.
  function distance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    let beforePrevious = null;
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) {
        row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          row[j] = Math.min(row[j], beforePrevious[j - 2] + 1);
        }
      }
      beforePrevious = previous;
      previous = row;
    }
    return previous[b.length];
  }

  function prepare(entries) {
    const vocabulary = new Set();
    const records = entries.map((entry) => {
      const fields = {};
      for (const key of ["title", "headings", "description", "text", "keywords", "links", "pageTitle"]) {
        const tokens = words(entry[key]);
        fields[key] = { words: new Set(tokens), text: tokens.join(" ") };
        tokens.forEach((token) => vocabulary.add(token));
      }
      return { entry, fields, compactText: fold([entry.title, entry.headings, entry.text].join(" ")).replace(/[^\p{L}\p{N}]/gu, "") };
    });
    return { records, vocabulary: [...vocabulary], variants: new Map() };
  }

  function variants(index, term) {
    if (index.variants.has(term)) return index.variants.get(term);
    const choices = new Map([[term, { quality: 1, mode: "exact" }]]);
    const fuzzyLimit = /^[a-z]+$/.test(term) && term.length >= 4 && term.length <= 32 ? (term.length >= 7 ? 2 : 1) : 0;
    for (const candidate of index.vocabulary) {
      if (candidate === term) continue;
      if (term.length >= 2 && candidate.startsWith(term)) {
        choices.set(candidate, { quality: Math.max(.65, .88 - (candidate.length - term.length) * .02), mode: "prefix" });
      } else if (fuzzyLimit && /^[a-z]+$/.test(candidate) && Math.abs(candidate.length - term.length) <= fuzzyLimit) {
        const d = distance(term, candidate, fuzzyLimit);
        if (d <= fuzzyLimit) choices.set(candidate, { quality: d === 1 ? .58 : .4, mode: "fuzzy" });
      }
    }
    index.variants.set(term, choices);
    return choices;
  }

  function bestChoice(field, choices) {
    let best = null;
    for (const [word, match] of choices) {
      if (field.words.has(word) && (!best || match.quality > best.quality)) best = { ...match, word };
    }
    return best;
  }

  function search(index, rawQuery) {
    const normalized = normalize(rawQuery);
    let terms = words(rawQuery).filter((term) => !stopWords.has(term));
    if (!terms.length) terms = words(rawQuery);
    const longerTerms = terms.filter((term) => term.length > 1 || /^\d+$/.test(term));
    if (longerTerms.length) terms = longerTerms;
    terms = [...new Set(terms)];
    if (normalized.length < 2 || !terms.length) return { matches: [], terms: [], empty: true };
    const groups = terms.map((term) => variants(index, term));
    const quoted = /^\s*["“].+["”]\s*$/.test(rawQuery);
    const phrase = quoted ? normalized : terms.join(" ");
    const formula = /\p{L}/u.test(rawQuery) && /\d/u.test(rawQuery) && !/\s/.test(rawQuery.trim());
    const compactQuery = fold(rawQuery).replace(/[^\p{L}\p{N}]/gu, "");
    const matches = [];
    for (const record of index.records) {
      const { entry, fields } = record;
      const selections = [];
      let score = 0;
      let coreHits = 0;
      let matched = true;
      for (const choices of groups) {
        let best = null;
        for (const [key, weight] of Object.entries({ title: 28, headings: 15, description: 8, text: 8, keywords: 10, links: 4, pageTitle: 2 })) {
          const choice = bestChoice(fields[key], choices);
          if (!choice) continue;
          const weighted = weight * choice.quality;
          if (!best || choice.quality > best.quality || (choice.quality === best.quality && weighted > best.weighted)) best = { ...choice, weighted, field: key };
        }
        if (!best) { matched = false; break; }
        selections.push(best);
        score += best.weighted;
        if (best.field !== "pageTitle") coreHits++;
      }
      // Compact matching preserves formulas even when HTML separates their subscripts.
      if (!matched && formula && record.compactText.includes(compactQuery)) {
        matched = true; score = 55; coreHits = 1;
        selections.length = 0;
      }
      if (!matched || !coreHits) continue;
      const titleExact = fields.title.text === phrase;
      const exactPhrase = phraseIn(fields.text.text, phrase);
      if (quoted && !exactPhrase && !phraseIn(fields.title.text, phrase) && !phraseIn(fields.headings.text, phrase)) continue;
      if (entry.kind === "document" && entry.key === "Rupesh_Lal_Karn_CV.pdf" && entry.url.endsWith("page=1") && ["cv", "resume", "curriculum vitae"].includes(phrase)) score += 200;
      if (titleExact) score += 120;
      else if (phraseIn(fields.title.text, phrase)) score += 65;
      if (phraseIn(fields.headings.text, phrase)) score += 24;
      if (exactPhrase) score += 48;
      if (phraseIn(fields.description.text, phrase)) score += 16;
      const fuzzyCount = selections.filter((match) => match.mode === "fuzzy").length;
      const quality = selections.length ? Math.min(...selections.map((match) => match.quality)) : 1;
      // Generic document-title queries need one link, rather than nine identical CV links.
      if (entry.kind === "document" && !groups.some((choices) => bestChoice(fields.text, choices)) && !entry.url.endsWith("page=1")) continue;
      matches.push({ entry, score, quality, fuzzyCount, titleExact, groups, terms });
    }
    const byURL = new Map(matches.map((match) => [match.entry.url, match]));
    const suppressed = new Set();
    for (const match of matches) {
      for (const url of match.entry.ancestors || []) {
        const ancestor = byURL.get(url);
        if (ancestor && !ancestor.titleExact && match.quality >= ancestor.quality) suppressed.add(url);
      }
    }
    const visible = matches.filter((match) => !suppressed.has(match.entry.url));
    visible.sort((a, b) => a.fuzzyCount - b.fuzzyCount || b.score - a.score || a.entry.title.localeCompare(b.entry.title) || a.entry.url.localeCompare(b.entry.url, undefined, { numeric: true }));
    return { matches: visible, terms, empty: false, fuzzyOnly: visible.length > 0 && visible.every((match) => match.fuzzyCount > 0) };
  }

  function excerpt(match, length = 220) {
    const text = match.entry.text || match.entry.description || "";
    const hits = [];
    for (const token of text.matchAll(/[\p{L}\p{N}]+/gu)) {
      const tokens = words(token[0]);
      match.groups.forEach((choices, group) => {
        if (tokens.some((word) => choices.has(word))) hits.push({ position: token.index, group });
      });
    }
    if (!hits.length) return (match.entry.description || text).slice(0, length);
    let chosen = hits[0].position;
    let most = 0;
    for (const hit of hits) {
      const distinct = new Set(hits.filter((other) => other.position >= hit.position && other.position < hit.position + length - 45).map((other) => other.group)).size;
      if (distinct > most) { most = distinct; chosen = hit.position; }
      if (most === match.groups.length) break;
    }
    let start = Math.max(0, chosen - 45);
    if (start > 0) {
      const space = text.indexOf(" ", start);
      if (space >= 0) start = space + 1;
    }
    let end = Math.min(text.length, start + length);
    if (end < text.length) {
      const space = text.lastIndexOf(" ", end);
      if (space > start) end = space;
    }
    return (start ? "… " : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
  }

  const api = { prepare, search, excerpt, normalize };
  root.RLKSearch = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
