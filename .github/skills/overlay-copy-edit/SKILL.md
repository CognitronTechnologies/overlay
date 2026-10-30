---
name: overlay-copy-edit
description: "Use when: copy-editing Overlay football news drafts for publication readiness, either in the content-automation pipeline or interactively."
---

# Overlay Picks copy-edit

## Purpose and hard boundary

Make an evidence-grounded article publication-ready without changing its reporting. This is **copy-editing only**: never add, remove, or change facts, numbers, names, dates, quotes, scores, or sources. Never add URLs. Preserve every supplied source URL and link each source exactly once in the body. If a fix would require changing or inferring a fact, leave it unchanged and add a `reviewerWarning` explaining the unresolved issue.

Use only the supplied draft and its source records. Do not fetch, infer, or fill gaps from memory. Preserve attribution and the distinction between confirmed facts and reports. Do not turn an absence of information into a claim.

## House style

- **Attribution and links:** Attribute claims inline and naturally (for example, "Sky Sports reported..."). Link each source exactly once using a natural anchor: `[Publisher](exact-url-from-the-source-record)`. Use the source record's URL byte-for-byte; never leave a raw URL in prose or add a trailing "Sources:" list. Keep every supplied source linked. If a URL cannot be represented faithfully, leave the issue and warn.
- **Structure:** Start with a strong, dated lede covering who, what and when, using only facts already present. Follow with 2-4 reader-friendly `##` subheads that describe the content, not evidence status. Include a short `## What's next` section and reader-facing open questions where the supplied facts leave genuine uncertainty. Distinguish facts from reports in the wording ("confirmed", "according to", "reported"), not in headings. If the supplied material contains analysis/opinion, signpost it briefly and naturally; do not introduce analysis or implications.
- **No process/meta language in the public body.** Remove process notes about evidence bundles, feeds, snippets, drafts, AI, reviewers, research dates, or information "supplied to us". These belong only in `reviewerWarnings`; never convert them into public claims.
- **Competition naming:** Use **Carabao Cup** as the canonical name throughout, including first mention; do not alternate with "EFL Cup". Use **Premier League**, **Championship**, **League One**, **League Two**, and **FA Cup** for those competitions. Do not infer the competition from a club or fixture.
- **Names:** Use a person's full name on first mention, then surname. Use a club's commonly used name after first mention (for example, **Newcastle United** first, then **Newcastle**). Do not alter names present in a source.
- **Language and punctuation:** UK English spelling. Use no Oxford comma. Write scores with numerals and a hyphen (`3-1`). Format dates as `Thursday 29 October` (include the year only when needed to preserve the supplied date/context). Use sentence case for headings.
- **Headline:** 45-80 characters inclusive; sentence case, active voice, factual and not clickbait or a question. Keep only facts supported by the draft.
- **Excerpt:** 35-60 words inclusive. It must stand alone as a factual summary, without process notes or meta language.
- **Body:** 350-650 words inclusive. Trim repetition without dropping facts, qualifications, attribution, or source links. Keep tone calm and factual.
- **Safety and compliance:** Avoid betting pressure and the prohibited terms below. Do not speculate about conduct or characterize alleged misconduct beyond the supplied sources. Preserve careful attribution and qualifications; do not make unsupported defamatory claims.

### Prohibited betting language

Do not introduce or retain these terms/claims in public copy: `guaranteed`, `sure win`, `lock`, `banker`, `risk-free`, `can't lose`, `easy money`, `recover losses`, pressure/countdown language, income promises, probabilities, confidence percentages, fair odds, expected returns, invented track records, or claims of positive expected value. This follows `scripts/content-automation/prompts/news.md`. If removing a term would change a fact or quote, leave it and warn rather than altering the record.

## Procedure

1. Read the entire draft, source list, existing warnings, and the applicable news prompt's prohibited language.
2. Edit only `title`, `excerpt`, `body`, and `slug`; keep every source and every fact intact. Use exact source-record URLs to convert raw URLs into the required inline Markdown links.
3. Apply the house style. Remove repetition and process/meta text; do not replace removed text with an inferred fact. Keep uncertainty reader-facing and only where supported by the supplied material.
4. Check every source URL appears exactly once as a Markdown link in the body, with no raw URLs outside Markdown links. Retain all existing reviewer warnings. Append exactly one `reviewerWarnings` string starting `Copy edit:` that summarizes the edits in no more than 200 characters. If anything cannot safely be fixed, identify it in that warning. Do not add fields such as `copyEditNotes`.
5. Run the final checklist below. If a check fails and a safe copy edit cannot fix it, preserve the facts and flag it in the warning; never fabricate or silently omit content to satisfy a length or lint check.

## Pipeline output contract

Return valid JSON only, in the same shape: `{"drafts":[...]}`. Preserve `dedupeKey`, `sources`, `category`, and `tags` exactly, including their order and values. The only editable fields are `title`, `excerpt`, `body`, and `slug`; append the required warning to `reviewerWarnings` without removing or changing existing warnings. Do not add, remove, or rename any other fields. For an empty input list, return `{"drafts":[]}`. In interactive human use, return the edited article and its warning without pretending that pipeline-only metadata is public copy.

## Final self-check

- [ ] No raw URLs outside Markdown links.
- [ ] Every source URL appears exactly once as a Markdown link in the body, with the exact source-record URL.
- [ ] No banned meta phrases or process/meta language in the body.
- [ ] No banned headings: `Confirmed`, `Reported`, `What remains unknown`, `Commentary and analysis`, `Sources`.
- [ ] Headline is 45-80 characters inclusive.
- [ ] Excerpt is 35-60 words inclusive.
- [ ] Body is 350-650 words inclusive.
- [ ] No prohibited betting terms/claims.
- [ ] UK spelling is checked by the editor; it is not mechanically enforced.

### Banned meta phrases

Treat these as case-insensitive phrases/patterns in the public body: `evidence supplied to us`; `This section is our own reading`; `This draft relies only on short feed summaries`; `should be reviewed by an editor`; `Research date (UTC):`; mentions of `evidence bundle(s)`, `feed summary/summaries`, `snippet(s)`, `this draft`, `AI`, `reviewer(s)`, or `research date`; and process wording `supplied to us`. Do not ban ordinary factual attribution such as "Sky Sports reported".
