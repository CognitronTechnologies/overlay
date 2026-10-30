import { BANNED_PHRASES, ENABLED_COMPETITIONS, MARKETS, MAX_DRAFT_OUTPUT_BYTES, isIsoDate, isUrl, kickoffApprovalMarginMinutes, normalizeName } from './policy.mjs';

const ARTICLE_FIELDS = new Set(['dedupeKey', 'title', 'slug', 'body', 'excerpt', 'category', 'tags', 'sources', 'reviewerWarnings']);
const TIP_FIELDS = new Set(['dedupeKey', 'tipDate', 'sport', 'league', 'match', 'market', 'selection', 'odds', 'analysis', 'kickoffAt', 'eventId', 'expiresAt', 'oddsProvider', 'oddsRetrievedAt', 'sources', 'reviewerWarnings', 'rationale']);
const TIP_DISCLAIMER = 'These free tips are provided for informational purposes and are not betting advice or a guarantee of any outcome. They are separate from tipsters’ paid live picks. 18+. Please gamble responsibly.';
const words = (value) => value.trim().split(/\s+/).filter(Boolean).length;
const within = (value, min, max) => typeof value === 'string' && value.length >= min && value.length <= max;
const supportedComp = (value) => ENABLED_COMPETITIONS.find((item) => item.key === value?.trim().toLowerCase() || item.name.toLowerCase() === value?.trim().toLowerCase());

function strictObject(item, fields, label) {
  const errors = [];
  if (!item || typeof item !== 'object' || Array.isArray(item)) return [`${label} must be an object`];
  for (const key of Object.keys(item)) if (!fields.has(key)) errors.push(`${label} has unsupported field: ${key}`);
  return errors;
}

function sourceErrors(sources, bundle, { minimum, label, kinds, tierRequired = false, publicFeedsAllowed = false } = {}) {
  const errors = [];
  if (!Array.isArray(sources) || sources.length < minimum || sources.length > 20) return [`${label} requires ${minimum}–20 sources`];
  const byUrl = new Map((bundle.sources ?? []).map((source) => [source.url, source]));
  for (const source of sources) {
    if (!source || typeof source !== 'object' || Object.keys(source).some((key) => !['url', 'title', 'publisher', 'retrievedAt', 'kind'].includes(key))) {
      errors.push(`${label} has a source with unsupported fields`); continue;
    }
    if (!isUrl(source.url) || !within(source.title, 1, 300) || !within(source.publisher, 1, 120) || !isIsoDate(source.retrievedAt) || !['news', 'official', 'match', 'odds', 'other'].includes(source.kind)) {
      errors.push(`${label} has a malformed source`); continue;
    }
    const evidence = byUrl.get(source.url);
    if (!evidence) errors.push(`${label} cites a URL not present in the evidence bundle: ${source.url}`);
    else {
      if (!evidence.permittedAutomatedUse && !(publicFeedsAllowed && evidence.publicFeedEvidence)) errors.push(`${label} uses a source without automated-use clearance: ${source.url}`);
      if (kinds && !kinds.includes(source.kind)) errors.push(`${label} source kind is not allowed: ${source.kind}`);
      if (tierRequired && !['A', 'B'].includes(evidence.tier)) errors.push(`${label} source is not classified as Tier A/B: ${source.url}`);
      if (source.publisher !== evidence.publisher || source.retrievedAt !== evidence.retrievedAt || source.kind !== evidence.kind) errors.push(`${label} source metadata does not match the evidence bundle: ${source.url}`);
    }
  }
  const publishers = new Set(sources.map((source) => source?.publisher?.trim().toLowerCase()).filter(Boolean));
  if (publishers.size < minimum) errors.push(`${label} needs ${minimum} independent source organisations`);
  return errors;
}

function sourceUrlsInText(text, sources, label) {
  const errors = [];
  const urls = [...String(text).matchAll(/https?:\/\/[^\s)\]]+/g)].map(([url]) => url.replace(/[.,;:]+$/, ''));
  const allow = new Set(sources.map((source) => source.url));
  for (const url of urls) if (!allow.has(url)) errors.push(`${label} contains an uncited URL not in its source list: ${url}`);
  for (const source of sources) if (!String(text).includes(source.url)) errors.push(`${label} does not cite source URL: ${source.url}`);
  return errors;
}

function noBannedLanguage(text, label) {
  return BANNED_PHRASES.filter((phrase) => phrase.test(text)).map((phrase) => `${label} contains prohibited language (${phrase})`);
}

export function hasVerbatimOverlap(text, bundle, minimum = 25) {
  const tokens = (value) => String(value ?? '').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const draftWords = tokens(text);
  const spans = new Set();
  for (let i = 0; i <= draftWords.length - minimum; i += 1) spans.add(draftWords.slice(i, i + minimum).join(' '));
  const evidence = [...(bundle.news ?? []).flatMap((item) => [item.title, item.summary]), ...(bundle.sources ?? []).map((item) => item.title)];
  return evidence.some((value) => {
    const sourceWords = tokens(value);
    for (let i = 0; i <= sourceWords.length - minimum; i += 1) if (spans.has(sourceWords.slice(i, i + minimum).join(' '))) return true;
    return false;
  });
}

const ARTICLE_UNCERTAINTY = /\b(?:unknown|unclear|not clear|not yet|yet to|does not establish|has not confirmed|have not confirmed|remains uncertain|not known|unanswered|not specified|not disclosed|not made clear|do not say|does not say|nothing should be inferred|no details\b|unconfirmed|is expected|are expected|expected to|no confirmation|no indication|uncertain|unresolved)\b/i;
const COPYEDIT_UNCERTAINTY_WARNING = 'Copy edit removed uncertainty wording present in the validated draft; confirm the relevant qualification remains clear.';

function hasArticleUncertainty(text) {
  return ARTICLE_UNCERTAINTY.test(String(text ?? ''));
}

function validateArticle(draft, bundle, now, priorDraft) {
  const errors = strictObject(draft, ARTICLE_FIELDS, 'Article');
  if (!within(draft.title, 1, 160)) errors.push('Article headline must be 1?160 characters');
  if (!within(draft.body, 1, 50_000)) errors.push('Article body must be 1–50,000 characters');
  if (!within(draft.dedupeKey, 8, 160)) errors.push('Article dedupeKey must be 8–160 characters');
  if (draft.excerpt !== undefined && !within(draft.excerpt, 1, 300)) errors.push('Article excerpt must be 1?300 characters');
  if (draft.category !== undefined && !['news', 'content'].includes(draft.category)) errors.push('Unsupported article category');
  if (!Array.isArray(draft.tags) || draft.tags.length < 2 || draft.tags.length > 5 || draft.tags.some((tag) => !within(tag, 1, 40))) errors.push('Article requires 2–5 canonical tags');
  const sources = draft.sources ?? [];
  errors.push(...sourceErrors(sources, bundle, { minimum: 2, label: 'Article', kinds: ['news', 'official'], tierRequired: true, publicFeedsAllowed: true }));
  const evidenceSources = new Map((bundle.sources ?? []).map((source) => [source.url, source]));
  for (const item of sources) {
    const evidence = evidenceSources.get(item.url);
    const publishedAt = Date.parse(evidence?.publishedAt ?? '');
    if (!Number.isFinite(publishedAt) || publishedAt > now.getTime() + 60_000 || now.getTime() - publishedAt > 24 * 60 * 60_000) errors.push(`Article source is undated or older than 24 hours: ${item.url}`);
  }
  errors.push(...sourceUrlsInText(draft.body, sources, 'Article body'));
  for (const item of sources) {
    if (!String(draft.body ?? '').includes(item.publisher)) errors.push(`Article body lacks publisher attribution: ${item.publisher}`);
  }
  if (hasVerbatimOverlap(`${draft.title ?? ''} ${draft.excerpt ?? ''} ${draft.body ?? ''}`, bundle)) errors.push('Article copies a verbatim span of at least 25 words from feed evidence');
  if (!hasArticleUncertainty(draft.body) && !hasArticleUncertainty(priorDraft?.body)) errors.push('Article must handle uncertainty in reader-facing prose');
  if (!/next|upcoming|scheduled/i.test(draft.body ?? '')) errors.push('Article must state what happens next');
  if (!Number.isFinite(Date.parse(bundle.retrievedAt)) || Date.parse(bundle.retrievedAt) > now.getTime() + 60_000 || now.getTime() - Date.parse(bundle.retrievedAt) > 60 * 60_000) errors.push('Evidence bundle retrieval time is invalid or older than 60 minutes');
  const articleBannedPhrases = BANNED_PHRASES.filter((phrase) => phrase.source !== '\\bconfidence\\b');
  errors.push(...articleBannedPhrases.filter((phrase) => phrase.test(`${draft.title ?? ''}\n${draft.excerpt ?? ''}\n${draft.body ?? ''}`)).map((phrase) => `Article contains prohibited language (${phrase})`));
  return errors;
}

function eventForTip(draft, bundle) {
  const comp = supportedComp(draft.league);
  if (!comp) return null;
  const [home, away] = (draft.match ?? '').split(/\s+vs\.?\s+/i);
  if (!home || !away) return null;
  return (bundle.fixtures ?? []).find((fixture) => fixture.competition === comp.key
    && normalizeName(fixture.home) === normalizeName(home)
    && normalizeName(fixture.away) === normalizeName(away)
    && fixture.kickoffAt === draft.kickoffAt);
}

function tipPolicyRejections(draft, bundle, now, approvalMarginMinutes) {
  const reasons = [];
  const kickoff = Date.parse(draft.kickoffAt);
  const leadHours = (kickoff - now.getTime()) / 3_600_000;
  if (leadHours < 2 || leadHours > 36) reasons.push('Kickoff is outside the 2–36 hour drafting window');
  if (kickoff - now.getTime() < approvalMarginMinutes * 60_000) reasons.push(`Kickoff is less than the ${approvalMarginMinutes}-minute minimum review margin`);
  const fixture = eventForTip(draft, bundle);
  if (!fixture) reasons.push('Fixture identity, enabled competition, or kickoff is not verified by the evidence bundle');
  else {
    if (!fixture.verifiedVenue) reasons.push('Venue verification is unavailable');
    if (!fixture.seniorMensVerified) reasons.push('Senior men\'s fixture eligibility is unverified');
    if (!fixture.competitionRound) reasons.push('Competition round is unverified');
    if (supportedComp(draft.league)?.key === 'fa-cup') {
      const round = String(fixture.competitionRound ?? '').toLowerCase();
      if (/qualifying|first round|second round|1st round|2nd round/.test(round)) reasons.push('FA Cup qualifying, first-round, and second-round ties are excluded');
      if (!fixture.faCupTipEligible || !fixture.coveredLeagueDivisionsVerified) reasons.push('FA Cup round/team-division eligibility is unverified');
    }
    if (fixture.status !== 'NS') reasons.push('Fixture is not verified as pre-match');
    if (fixture.teamNews?.home?.status !== 'verified' || fixture.teamNews?.away?.status !== 'verified') reasons.push('Current team news for both teams is unavailable');
    const sourceByUrl = new Map((bundle.sources ?? []).map((source) => [source.url, source]));
    const citedUrls = new Set((draft.sources ?? []).map((source) => source.url));
    for (const side of ['home', 'away']) {
      const report = fixture.teamNews?.[side];
      const updatedAt = Date.parse(report?.retrievedAt ?? '');
      if (!Number.isFinite(updatedAt) || updatedAt > now.getTime() + 60_000 || now.getTime() - updatedAt > 6 * 60 * 60_000) reasons.push(`Current ${side} team news freshness is unverified`);
      if (!Array.isArray(report?.sourceUrls) || !report.sourceUrls.length || report.sourceUrls.some((url) => !citedUrls.has(url) || !sourceByUrl.get(url)?.permittedAutomatedUse)) reasons.push(`Current ${side} team news has no cited licensed source`);
    }
    const suspension = fixture.suspensionCheck;
    const suspensionUpdatedAt = Date.parse(suspension?.retrievedAt ?? '');
    if (suspension?.status !== 'verified' || !Number.isFinite(suspensionUpdatedAt) || suspensionUpdatedAt > now.getTime() + 60_000 || now.getTime() - suspensionUpdatedAt > 6 * 60 * 60_000 || !Array.isArray(suspension.sourceUrls) || !suspension.sourceUrls.length || suspension.sourceUrls.some((url) => !citedUrls.has(url) || !sourceByUrl.get(url)?.permittedAutomatedUse)) reasons.push('Applicable suspension checks are missing, stale, or unsourced');
    for (const side of ['home', 'away']) {
      const squad = fixture.squadChecks?.[side];
      if (!squad?.latestTenComplete || squad.regularStarterStarts < 5 || !squad.criticalPlayersIdentified || squad.criticalPlayerAvailability !== 'confirmed' || !Number.isInteger(squad.uncertainRegularStarters) || squad.uncertainRegularStarters >= 3) reasons.push(`Squad uncertainty gate is not verified for ${side}`);
    }
    if (['fa-cup', 'efl-cup'].includes(fixture.competition) && !fixture.cupRotationChecked) reasons.push('Cup rotation check is unverified');
    if (!fixture.lineupsConfirmed && !(draft.reviewerWarnings ?? []).includes('PRE_LINEUP')) reasons.push('Pre-lineup draft must include the PRE_LINEUP warning');
    for (const side of ['home', 'away']) {
      const sample = fixture.formSamples?.[side];
      if (!sample || sample.completedMatches < 10 || sample.currentSeasonMatches < 5 || sample.withinDays > 180) reasons.push(`Adequate comparable ${side} team form is unavailable`);
      else if (!isIsoDate(sample.retrievedAt) || now.getTime() - Date.parse(sample.retrievedAt) > 24 * 60 * 60_000) reasons.push(`Comparable ${side} team form is stale or undated`);
    }
  }
  const sources = draft.sources ?? [];
  const evidenceSources = new Map((bundle.sources ?? []).map((source) => [source.url, source]));
  const selectedEvidence = sources.map((source) => evidenceSources.get(source.url)).filter(Boolean);
  if (new Set(selectedEvidence.map((source) => source.publisher)).size < 2) reasons.push('Two independent licensed source organisations are required');
  if (!selectedEvidence.some((source) => source.tier === 'B' && source.performanceData && source.permittedAutomatedUse)) reasons.push('A contract-cleared Tier B performance-data source is required');
  if ((draft.rationale?.counterarguments ?? []).length < 2) reasons.push('At least two concrete counterarguments/risks are required');
  const fullContent = `${draft.analysis ?? ''}\n${draft.rationale?.rationale ?? ''}\n${(draft.rationale?.counterarguments ?? []).join('\n')}`;
  if (!fullContent.includes(TIP_DISCLAIMER)) reasons.push('Required free-tip disclaimer is missing verbatim');
  const content = fullContent.replace(TIP_DISCLAIMER, '');
  if (words(draft.analysis ?? '') < 150 || words(draft.analysis ?? '') > 250) reasons.push('Tip analysis must be 150–250 words');
  if (draft.expiresAt) {
    const expiry = Date.parse(draft.expiresAt);
    const oddsRetrievedAt = Date.parse(draft.oddsRetrievedAt);
    const kickoffCutoff = kickoff - approvalMarginMinutes * 60_000;
    if (!Number.isFinite(expiry) || expiry <= now.getTime()) reasons.push('Tip expiry must be in the future');
    if (Number.isFinite(expiry) && expiry > kickoffCutoff) reasons.push(`Tip expiry must be no later than kickoff minus the ${approvalMarginMinutes}-minute approval margin`);
    if (!Number.isFinite(oddsRetrievedAt) || (Number.isFinite(expiry) && expiry > oddsRetrievedAt + 30 * 60_000)) reasons.push('Tip expiry exceeds oddsRetrievedAt plus 30 minutes');
  } else reasons.push('Tip expiry is required');
  const matchingOdds = (bundle.odds ?? []).filter((item) => item.competition === supportedComp(draft.league)?.key
    && normalizeName(item.home) === normalizeName((draft.match ?? '').split(/\s+vs\.?\s+/i)[0])
    && normalizeName(item.away) === normalizeName((draft.match ?? '').split(/\s+vs\.?\s+/i)[1])
    && item.kickoffAt === draft.kickoffAt
    && item.market === draft.market && item.selection === draft.selection && item.odds === draft.odds);
  const namedOdds = matchingOdds.find((item) => item.bookmaker && (draft.analysis ?? '').toLocaleLowerCase().includes(item.bookmaker.toLocaleLowerCase()));
  if (!namedOdds) reasons.push('Exact selection, named bookmaker, market, and decimal odds are not present in provider evidence');
  else {
    const matchingOdds = namedOdds;
    const updatedAt = Date.parse(matchingOdds.oddsUpdatedAt);
    if (!Number.isFinite(updatedAt) || now.getTime() - updatedAt > 5 * 60_000 || updatedAt > now.getTime() + 60_000) reasons.push('Odds quote is missing or older than five minutes');
    if (draft.oddsProvider !== matchingOdds.provider || draft.oddsRetrievedAt !== matchingOdds.oddsRetrievedAt) reasons.push('Odds provider or retrieval time does not match evidence');
  }
  if (draft.market === '1X2' && ![draft.match?.split(/\s+vs\.?\s+/i)[0], 'Draw', draft.match?.split(/\s+vs\.?\s+/i)[1]].includes(draft.selection)) reasons.push('1X2 selection must be one team or Draw');
  if (draft.market === 'btts' && !['yes', 'no'].includes(draft.selection?.toLowerCase())) reasons.push('BTTS selection must be Yes or No');
  if (draft.market === 'totals' && !/^(Over|Under)\s+(?:\d+\.5)$/i.test(draft.selection ?? '')) reasons.push('Totals selection must use a supported half-goal line');
  if (BANNED_PHRASES.some((phrase) => phrase.test(content))) reasons.push('Tip contains prohibited prediction, guarantee, pressure, or staking language');
  return reasons;
}

function validateTip(draft, bundle, now, env) {
  const errors = strictObject(draft, TIP_FIELDS, 'Free-tip');
  if (!within(draft.dedupeKey, 8, 160)) errors.push('Free-tip dedupeKey must be 8–160 characters');
  if (draft.sport !== 'soccer' && draft.sport !== 'football') errors.push('Free-tip sport must be soccer or football');
  if (!supportedComp(draft.league)) errors.push('Free-tip league is not enabled');
  if (!within(draft.match, 1, 160) || !draft.match.includes(' vs ')) errors.push('Free-tip match must be Home vs Away');
  if (!MARKETS.has(draft.market)) errors.push('Free-tip market is not supported');
  if (!within(draft.selection, 1, 160)) errors.push('Free-tip selection is invalid');
  if (!Number.isFinite(draft.odds) || draft.odds <= 1 || draft.odds > 1000) errors.push('Free-tip odds must be decimal and greater than 1');
  if (!within(draft.analysis, 1, 2000) || !isIsoDate(draft.kickoffAt) || !/^\d{4}-\d\d-\d\d$/.test(draft.tipDate ?? '')) errors.push('Free-tip content or date fields are malformed');
  const tipDay = new Date(`${draft.tipDate}T00:00:00.000Z`);
  if (!Number.isFinite(tipDay.getTime()) || tipDay.toISOString().slice(0, 10) !== draft.tipDate) errors.push('tipDate must be a real UTC calendar date');
  if (isIsoDate(draft.kickoffAt) && new Date(draft.kickoffAt).toISOString().slice(0, 10) !== draft.tipDate) errors.push('tipDate must equal the kickoff UTC date');
  if (draft.eventId !== undefined && !within(draft.eventId, 1, 80)) errors.push('Tip eventId must be 1?80 characters');
  if (draft.expiresAt !== undefined && !isIsoDate(draft.expiresAt)) errors.push('Tip expiresAt must be an ISO timestamp');
  if (draft.reviewerWarnings !== undefined && (!Array.isArray(draft.reviewerWarnings) || draft.reviewerWarnings.length > 20 || draft.reviewerWarnings.some((warning) => !within(warning, 1, 300)))) errors.push('Tip reviewerWarnings must contain at most 20 strings of at most 300 characters');
  if (!within(draft.oddsProvider, 1, 120) || !isIsoDate(draft.oddsRetrievedAt)) errors.push('Tip odds provider and retrieval timestamp are required');
  if (draft.rationale === undefined) errors.push('Tip rationale is required');
  if (draft.rationale !== undefined && (!draft.rationale || Object.keys(draft.rationale).some((key) => !['rationale', 'counterarguments'].includes(key)) || !within(draft.rationale.rationale, 1, 4000) || !Array.isArray(draft.rationale.counterarguments) || draft.rationale.counterarguments.length > 10 || draft.rationale.counterarguments.some((item) => !within(item, 1, 1000)))) errors.push('Tip rationale does not match the API schema');
  const sources = draft.sources ?? [];
  errors.push(...sourceErrors(sources, bundle, { minimum: 2, label: 'Free-tip' }));
  errors.push(...sourceUrlsInText(`${draft.analysis ?? ''}\n${draft.rationale?.rationale ?? ''}\n${(draft.rationale?.counterarguments ?? []).join('\n')}`, sources, 'Free-tip analysis'));
  errors.push(...noBannedLanguage(`${draft.analysis ?? ''}\n${draft.rationale?.rationale ?? ''}`.replace(TIP_DISCLAIMER, ''), 'Free-tip'));
  return { errors, reasons: errors.length ? [] : tipPolicyRejections(draft, bundle, now, kickoffApprovalMarginMinutes(env)) };
}

export function validateDrafts({ kind, response, bundle, now = new Date(), maxDrafts, env = process.env, priorValidatedDrafts = [] }) {
  const input = typeof response === 'string' ? JSON.parse(response) : response;
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => key !== 'drafts') || !Array.isArray(input.drafts)) throw new Error('Copilot output must be a JSON object with a drafts array only');
  if (Buffer.byteLength(JSON.stringify(input)) > MAX_DRAFT_OUTPUT_BYTES) throw new Error('Copilot output exceeds the size limit');
  const ceiling = kind === 'tip' ? 5 : 5;
  const maximum = maxDrafts === undefined ? ceiling : Number(maxDrafts);
  if (!Number.isInteger(maximum) || maximum < 0 || maximum > ceiling) throw new Error(`maxDrafts must be an integer from 0 to ${ceiling}`);
  if (!['article', 'tip'].includes(kind)) throw new Error(`Unknown draft kind: ${kind}`);
  if (input.drafts.length > maximum) throw new Error(`Copilot returned more than ${maximum} drafts`);
  const accepted = [];
  const rejected = [];
  const fatalErrors = [];
  for (const [index, draft] of input.drafts.entries()) {
    let result;
    const priorDraft = kind === 'article'
      ? priorValidatedDrafts.find((item) => item?.dedupeKey === draft?.dedupeKey)
      : undefined;
    if (kind === 'article') {
      const errors = validateArticle(draft, bundle, now, priorDraft);
      result = { errors, reasons: [] };
    } else result = validateTip(draft, bundle, now, env);
    if (result.errors.length) {
      fatalErrors.push(...result.errors.map((message) => `Draft ${index + 1}: ${message}`));
      rejected.push({ index: index + 1, reasons: result.errors });
    } else if (result.reasons.length) rejected.push({ index: index + 1, reasons: result.reasons });
    else if (kind === 'article') {
      const termsWarnings = (draft.sources ?? []).map((source) => (bundle.sources ?? []).find((item) => item.url === source.url)).filter((source) => source?.termsNote).map((source) => `${source.publisher}: ${source.termsNote}`.slice(0, 300));
      const researchWarning = `Researched ${String(bundle.retrievedAt ?? '').slice(0, 10)} UTC from public feed summaries`;
      const uncertaintyWarnings = !hasArticleUncertainty(draft.body) && hasArticleUncertainty(priorDraft?.body) ? [COPYEDIT_UNCERTAINTY_WARNING] : [];
      const warnings = [...new Set([researchWarning, ...termsWarnings, ...uncertaintyWarnings, ...(draft.reviewerWarnings ?? [])])].slice(0, 19);
      const duplicateWarning = 'Compare pending, published and rejected coverage over seven days; automated dedupe prevents exact retries only.';
      if (!warnings.includes(duplicateWarning)) {
        if (warnings.length >= 20) warnings[warnings.length - 1] = duplicateWarning;
        else warnings.push(duplicateWarning);
      }
      accepted.push({ ...draft, reviewerWarnings: warnings });
    } else accepted.push(draft);
  }
  return { accepted, rejected, fatalErrors };
}

export { TIP_DISCLAIMER, hasArticleUncertainty };
