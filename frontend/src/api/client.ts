import type {
  Scale,
  Arpeggio,
  SelectionSet,
  ArticulationMode,
  PracticeItem,
  PracticeEntryInput,
  SessionResponse,
  PracticeHistoryItem,
  PracticeHistoryDetailedItem,
  AlgorithmConfig,
} from "../types";

// Use relative URL - works in production (same origin) and dev (via Vite proxy)
const API_BASE = "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Scales
export async function getScales(params?: {
  note?: string;
  type?: string;
  octaves?: number;
  enabled?: boolean;
}): Promise<Scale[]> {
  const searchParams = new URLSearchParams();
  if (params?.note) searchParams.set("note", params.note);
  if (params?.type) searchParams.set("type", params.type);
  if (params?.octaves) searchParams.set("octaves", String(params.octaves));
  if (params?.enabled !== undefined)
    searchParams.set("enabled", String(params.enabled));

  const query = searchParams.toString();
  return fetchJson<Scale[]>(`${API_BASE}/scales${query ? `?${query}` : ""}`);
}

export async function updateScale(
  id: number,
  update: { enabled?: boolean; weight?: number; target_bpm?: number; articulation_mode?: ArticulationMode }
): Promise<Scale> {
  return fetchJson<Scale>(`${API_BASE}/scales/${id}`, {
    method: "PUT",
    body: JSON.stringify(update),
  });
}

export async function bulkEnableScales(
  ids: number[],
  enabled: boolean
): Promise<{ updated: number }> {
  return fetchJson<{ updated: number }>(`${API_BASE}/scales/bulk-enable`, {
    method: "POST",
    body: JSON.stringify({ ids, enabled }),
  });
}

// Arpeggios
export async function getArpeggios(params?: {
  note?: string;
  type?: string;
  octaves?: number;
  enabled?: boolean;
}): Promise<Arpeggio[]> {
  const searchParams = new URLSearchParams();
  if (params?.note) searchParams.set("note", params.note);
  if (params?.type) searchParams.set("type", params.type);
  if (params?.octaves) searchParams.set("octaves", String(params.octaves));
  if (params?.enabled !== undefined)
    searchParams.set("enabled", String(params.enabled));

  const query = searchParams.toString();
  return fetchJson<Arpeggio[]>(
    `${API_BASE}/arpeggios${query ? `?${query}` : ""}`
  );
}

export async function updateArpeggio(
  id: number,
  update: { enabled?: boolean; weight?: number; target_bpm?: number; articulation_mode?: ArticulationMode }
): Promise<Arpeggio> {
  return fetchJson<Arpeggio>(`${API_BASE}/arpeggios/${id}`, {
    method: "PUT",
    body: JSON.stringify(update),
  });
}

export async function bulkEnableArpeggios(
  ids: number[],
  enabled: boolean
): Promise<{ updated: number }> {
  return fetchJson<{ updated: number }>(`${API_BASE}/arpeggios/bulk-enable`, {
    method: "POST",
    body: JSON.stringify({ ids, enabled }),
  });
}

// Practice
export async function generateSet(): Promise<{ items: PracticeItem[] }> {
  return fetchJson<{ items: PracticeItem[] }>(`${API_BASE}/generate-set`, {
    method: "POST",
  });
}

export async function createPracticeSession(
  entries: PracticeEntryInput[]
): Promise<SessionResponse> {
  return fetchJson<SessionResponse>(`${API_BASE}/practice-session`, {
    method: "POST",
    body: JSON.stringify({ entries }),
  });
}

export async function getPracticeHistory(
  itemType?: string
): Promise<PracticeHistoryItem[]> {
  const query = itemType ? `?item_type=${itemType}` : "";
  return fetchJson<PracticeHistoryItem[]>(
    `${API_BASE}/practice-history${query}`
  );
}

export async function getPracticeHistoryDetailed(params?: {
  item_type?: string;
  subtype?: string;
  note?: string;
  accidental?: string;
  from_date?: string;
  to_date?: string;
}): Promise<PracticeHistoryDetailedItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.item_type) searchParams.set("item_type", params.item_type);
  if (params?.subtype) searchParams.set("subtype", params.subtype);
  if (params?.note) searchParams.set("note", params.note);
  if (params?.accidental) searchParams.set("accidental", params.accidental);
  if (params?.from_date) searchParams.set("from_date", params.from_date);
  if (params?.to_date) searchParams.set("to_date", params.to_date);

  const query = searchParams.toString();
  return fetchJson<PracticeHistoryDetailedItem[]>(
    `${API_BASE}/practice-history-detailed${query ? `?${query}` : ""}`
  );
}

// Settings
export async function getAlgorithmConfig(): Promise<{
  config: AlgorithmConfig;
}> {
  return fetchJson<{ config: AlgorithmConfig }>(
    `${API_BASE}/settings/algorithm`
  );
}

export async function updateAlgorithmConfig(
  config: AlgorithmConfig
): Promise<{ config: AlgorithmConfig }> {
  return fetchJson<{ config: AlgorithmConfig }>(
    `${API_BASE}/settings/algorithm`,
    {
      method: "PUT",
      body: JSON.stringify({ config }),
    }
  );
}

export async function resetAlgorithmConfig(): Promise<{
  config: AlgorithmConfig;
}> {
  return fetchJson<{ config: AlgorithmConfig }>(
    `${API_BASE}/settings/algorithm/reset`,
    {
      method: "POST",
    }
  );
}

// Selection Sets
export async function getSelectionSets(): Promise<SelectionSet[]> {
  return fetchJson<SelectionSet[]>(`${API_BASE}/selection-sets`);
}

export async function getActiveSelectionSet(): Promise<SelectionSet | null> {
  return fetchJson<SelectionSet | null>(`${API_BASE}/selection-sets/active`);
}

export async function createSelectionSet(
  name: string
): Promise<SelectionSet> {
  return fetchJson<SelectionSet>(`${API_BASE}/selection-sets`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateSelectionSet(
  id: number,
  update: { name?: string; update_from_current?: boolean }
): Promise<SelectionSet> {
  return fetchJson<SelectionSet>(`${API_BASE}/selection-sets/${id}`, {
    method: "PUT",
    body: JSON.stringify(update),
  });
}

export async function deleteSelectionSet(
  id: number
): Promise<{ message: string }> {
  return fetchJson<{ message: string }>(`${API_BASE}/selection-sets/${id}`, {
    method: "DELETE",
  });
}

export async function deactivateSelectionSets(): Promise<{ message: string }> {
  return fetchJson<{ message: string }>(
    `${API_BASE}/selection-sets/deactivate`,
    { method: "POST" }
  );
}

export async function loadSelectionSet(
  id: number
): Promise<{ message: string; scales_enabled: number; arpeggios_enabled: number }> {
  return fetchJson<{ message: string; scales_enabled: number; arpeggios_enabled: number }>(
    `${API_BASE}/selection-sets/${id}/load`,
    { method: "POST" }
  );
}

// Initialize database
export async function initDatabase(): Promise<{
  message: string;
  scales: number;
  arpeggios: number;
}> {
  return fetchJson<{ message: string; scales: number; arpeggios: number }>(
    `${API_BASE}/init-database`,
    {
      method: "POST",
    }
  );
}
