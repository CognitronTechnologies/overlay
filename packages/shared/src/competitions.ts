/** Competitions accepted for automated free-tip drafts. Provider IDs are intentionally
 * absent until a configured sports-data provider mapping is verified. */
export type CompetitionPhase = 1 | 2;
export interface SupportedCompetition {
  key: string;
  name: string;
  enabled: boolean;
  phase: CompetitionPhase;
  providerIds?: Readonly<Record<string, string>>;
}

export const SUPPORTED_COMPETITIONS: readonly SupportedCompetition[] = [
  { key: 'premier-league', name: 'Premier League', enabled: true, phase: 1 },
  { key: 'championship', name: 'Championship', enabled: true, phase: 1 },
  { key: 'league-one', name: 'League One', enabled: true, phase: 1 },
  { key: 'league-two', name: 'League Two', enabled: true, phase: 1 },
  { key: 'fa-cup', name: 'FA Cup', enabled: true, phase: 1 },
  { key: 'efl-cup', name: 'EFL Cup', enabled: true, phase: 1 },
  { key: 'la-liga', name: 'La Liga', enabled: false, phase: 2 },
  { key: 'serie-a', name: 'Serie A', enabled: false, phase: 2 },
  { key: 'ligue-1', name: 'Ligue 1', enabled: false, phase: 2 },
  { key: 'primeira-liga', name: 'Primeira Liga', enabled: false, phase: 2 },
  { key: 'turkish-super-lig', name: 'Turkish S?per Lig', enabled: false, phase: 2 },
  { key: 'belgian-pro-league', name: 'Belgian Pro League', enabled: false, phase: 2 },
  { key: 'saudi-pro-league', name: 'Saudi Pro League', enabled: false, phase: 2 },
  { key: 'brasileirao', name: 'Brasileir?o', enabled: false, phase: 2 },
  { key: 'argentine-liga-profesional', name: 'Argentine Liga Profesional', enabled: false, phase: 2 },
] as const;

export function findCompetition(value: string): SupportedCompetition | undefined {
  const normalized = value.trim().toLocaleLowerCase();
  return SUPPORTED_COMPETITIONS.find(
    (competition) => competition.key === normalized || competition.name.toLocaleLowerCase() === normalized,
  );
}

export function isEnabledCompetition(value: string): boolean {
  return findCompetition(value)?.enabled === true;
}
