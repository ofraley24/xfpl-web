// Read-only import of an FPL team by its public team id, through the site's relay (/api/fpl/..., see functions/).
// The public endpoints show the squad as of the last deadline; transfers made since then are private to the owner.

export interface ImportedTeam {
  teamId: number;
  name: string;          // team name
  manager: string;
  gw: number;            // the gameweek whose picks were loaded
  squad: number[];       // FPL element ids in FPL's pick order (1-11 starters, 12-15 bench)
  missing: number[];     // picks not in this forecast (e.g. players who left the league)
  bankFpl: number;       // £m in the bank at that gameweek
  valueFpl: number;      // £m team value at that gameweek
  captain: number | null;
  vice: number | null;
  chip: string | null;
  importedAt: string;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`/api/fpl/${path}`);
  if (r.status === 404) throw new Error("not found — check the team id");
  if (!r.ok) throw new Error(`FPL returned ${r.status}`);
  return r.json() as Promise<T>;
}

interface Entry { id: number; name: string; player_first_name: string; player_last_name: string; current_event: number | null }
interface Picks {
  active_chip: string | null;
  entry_history: { event: number; bank: number; value: number };
  picks: { element: number; position: number; is_captain: boolean; is_vice_captain: boolean }[];
}

/** Load a team's squad from its latest gameweek. `known` = element ids present in the forecast. */
export async function importTeam(teamId: number, known: Set<number>): Promise<ImportedTeam> {
  const entry = await get<Entry>(`entry/${teamId}/`);
  const gw = entry.current_event;
  if (!gw) throw new Error("this team has not played a gameweek yet");
  const picks = await get<Picks>(`entry/${teamId}/event/${gw}/picks/`);
  const order = [...picks.picks].sort((a, b) => a.position - b.position);
  return {
    teamId,
    name: entry.name,
    manager: `${entry.player_first_name} ${entry.player_last_name}`.trim(),
    gw,
    squad: order.map((p) => p.element).filter((id) => known.has(id)),
    missing: order.map((p) => p.element).filter((id) => !known.has(id)),
    bankFpl: picks.entry_history.bank / 10,
    valueFpl: picks.entry_history.value / 10,
    captain: order.find((p) => p.is_captain)?.element ?? null,
    vice: order.find((p) => p.is_vice_captain)?.element ?? null,
    chip: picks.active_chip,
    importedAt: new Date().toISOString(),
  };
}

export const FPL_TRANSFERS_URL = "https://fantasy.premierleague.com/transfers";
export const FPL_PICK_TEAM_URL = "https://fantasy.premierleague.com/my-team";
