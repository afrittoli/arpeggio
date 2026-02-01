import type {
  Scale,
  Arpeggio,
  PracticeItem,
  PracticeEntryInput,
  SessionResponse,
  PracticeHistoryItem,
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
  update: { enabled?: boolean; weight?: number }
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
  update: { enabled?: boolean; weight?: number }
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
