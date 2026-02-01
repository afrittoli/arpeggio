export interface Scale {
  id: number;
  note: string;
  accidental: string | null;
  type: string;
  octaves: number;
  enabled: boolean;
  weight: number;
  display_name: string;
}

export interface Arpeggio {
  id: number;
  note: string;
  accidental: string | null;
  type: string;
  octaves: number;
  enabled: boolean;
  weight: number;
  display_name: string;
}

export interface PracticeItem {
  type: "scale" | "arpeggio";
  id: number;
  display_name: string;
  octaves: number;
  articulation: "slurred" | "separate";
}

export interface PracticeEntryInput {
  item_type: string;
  item_id: number;
  articulation?: string;
  was_practiced?: boolean;
  practiced_slurred: boolean;
  practiced_separate: boolean;
  practiced_bpm?: number;
}

export interface SessionResponse {
  id: number;
  created_at: string;
  entries_count: number;
  practiced_count: number;
}

export interface PracticeHistoryItem {
  item_type: string;
  item_id: number;
  display_name: string;
  total_sessions: number;
  times_practiced: number;
  last_practiced: string | null;
}

export interface SlotConfig {
  name: string;
  types: string[];
  item_type: "scale" | "arpeggio";
  percent: number;
}

export interface WeightingConfig {
  base_multiplier: number;
  days_since_practice_factor: number;
  practice_count_divisor: number;
}

export interface AlgorithmConfig {
  total_items: number;
  variation: number;
  slots: SlotConfig[];
  octave_variety: boolean;
  slurred_percent: number;
  weighting: WeightingConfig;
  default_scale_bpm: number;
  default_arpeggio_bpm: number;
}
