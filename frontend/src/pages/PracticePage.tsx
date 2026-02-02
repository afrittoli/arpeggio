import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  generateSet,
  createPracticeSession,
  getPracticeHistory,
  getAlgorithmConfig,
} from "../api/client";
import Metronome from "../components/Metronome";
import type { PracticeItem, PracticeEntryInput } from "../types";

interface PracticeState {
  slurred: boolean;
  separate: boolean;
  recordBpm: boolean; // Whether to record BPM for this item (user must enable)
  bpm: number | null; // BPM used for this specific item
}

const STORAGE_KEY = "practiceSession";

interface StoredSession {
  items: PracticeItem[];
  state: Record<string, PracticeState>;
  timestamp: number;
}

function loadStoredSession(): StoredSession | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return null;
}

function shortDisplayName(item: PracticeItem): string {
  const [title] = item.display_name.split(' - ');
  return title.trim();
}

function PracticePage() {
  // Use lazy initializers that run on each mount
  const [practiceItems, setPracticeItems] = useState<PracticeItem[]>(
    () => loadStoredSession()?.items ?? []
  );
  const [practiceState, setPracticeState] = useState<Record<string, PracticeState>>(
    () => loadStoredSession()?.state ?? {}
  );
  const [submitted, setSubmitted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isSaved, setIsSaved] = useState(() => loadStoredSession() === null);
  const [metronomeBpm, setMetronomeBpm] = useState<number | null>(null);
  const [metronomeChecked, setMetronomeChecked] = useState(false); // Metronome checkbox is checked (visible)

  // Save to localStorage when items or state change (but not when saved)
  useEffect(() => {
    if (practiceItems.length > 0 && !submitted && !isSaved) {
      const session: StoredSession = {
        items: practiceItems,
        state: practiceState,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }, [practiceItems, practiceState, submitted, isSaved]);

  const { data: history = [] } = useQuery({
    queryKey: ["practice-history"],
    queryFn: () => getPracticeHistory(),
    enabled: showHistory || practiceItems.length > 0,
  });

  const { data: configData } = useQuery({
    queryKey: ["algorithm-config"],
    queryFn: () => getAlgorithmConfig(),
  });

  const defaultBpm = configData?.config.default_scale_bpm ?? 60;

  // Create a map for quick lookup of history data by item
  const historyMap = new Map(
    history.map((item) => [`${item.item_type}-${item.item_id}`, item])
  );

  // Helper to format practice history BPM display
  const getHistoryBpmText = (item: PracticeItem): string | null => {
    const historyItem = historyMap.get(`${item.type}-${item.id}`);
    if (!historyItem || historyItem.max_practiced_bpm === null || historyItem.target_bpm === null) {
      return null;
    }

    const maxBpm = historyItem.max_practiced_bpm;
    const targetBpm = historyItem.target_bpm;

    if (maxBpm === targetBpm) {
      return "Practiced at target speed";
    }

    const crotchetBpm = Math.round(maxBpm / 2);
    return `Practiced at ♪=${maxBpm}, ♩=${crotchetBpm}`;
  };

  const handleMetronomeBpmChange = useCallback((bpm: number) => {
    setMetronomeBpm(bpm);
  }, []);

  const handleMetronomeEnabledChange = useCallback((isEnabled: boolean) => {
    setMetronomeChecked(isEnabled);
  }, []);

  const generateMutation = useMutation({
    mutationFn: () => generateSet(),
    onSuccess: (data) => {
      setPracticeItems(data.items);
      // Initialize practice state for each item
      const initialState: Record<string, PracticeState> = {};
      data.items.forEach((item) => {
        const key = `${item.type}-${item.id}`;
        initialState[key] = { slurred: false, separate: false, recordBpm: false, bpm: null };
      });
      setPracticeState(initialState);
      setSubmitted(false);
      setIsSaved(false);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (entries: PracticeEntryInput[]) => createPracticeSession(entries),
    onSuccess: () => {
      setSubmitted(true);
      setIsSaved(true);
      localStorage.removeItem(STORAGE_KEY);
    },
  });

  const togglePractice = (item: PracticeItem, articulation: "slurred" | "separate") => {
    const key = `${item.type}-${item.id}`;
    setPracticeState((prev) => {
      const current = prev[key] || { slurred: false, separate: false, recordBpm: false, bpm: null };
      const newArticulationValue = !current[articulation];

      return {
        ...prev,
        [key]: {
          ...current,
          [articulation]: newArticulationValue,
        },
      };
    });
    setIsSaved(false);
  };

  const toggleRecordBpm = (item: PracticeItem) => {
    const key = `${item.type}-${item.id}`;
    setPracticeState((prev) => {
      const current = prev[key] || { slurred: false, separate: false, recordBpm: false, bpm: null };
      const newRecordBpm = !current.recordBpm;

      // When enabling, set default BPM: metronome value if checked, otherwise target
      let newBpm = current.bpm;
      if (newRecordBpm && current.bpm === null) {
        newBpm = metronomeChecked && metronomeBpm ? metronomeBpm : item.target_bpm;
      }

      return {
        ...prev,
        [key]: {
          ...current,
          recordBpm: newRecordBpm,
          bpm: newRecordBpm ? newBpm : null, // Clear BPM when disabling
        },
      };
    });
    setIsSaved(false);
  };

  const updateItemBpm = (item: PracticeItem, bpm: number | null) => {
    const key = `${item.type}-${item.id}`;
    setPracticeState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        bpm,
      },
    }));
    setIsSaved(false);
  };

  const handleSave = () => {
    // Save to localStorage and mark as saved
    const session: StoredSession = {
      items: practiceItems,
      state: practiceState,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setIsSaved(true);
  };

  const handleSubmit = () => {
    const entries: PracticeEntryInput[] = practiceItems.map((item) => {
      const key = `${item.type}-${item.id}`;
      const state = practiceState[key] || { slurred: false, separate: false, recordBpm: false, bpm: null };
      const wasPracticed = state.slurred || state.separate;

      // Only record BPM if user explicitly enabled it
      const shouldRecordBpm = wasPracticed && state.recordBpm && state.bpm !== null;
      const practicedBpm = shouldRecordBpm ? state.bpm : null;
      const matchedTarget = practicedBpm !== null ? practicedBpm === item.target_bpm : null;

      return {
        item_type: item.type,
        item_id: item.id,
        articulation: item.articulation,
        practiced_slurred: state.slurred,
        practiced_separate: state.separate,
        practiced_bpm: practicedBpm ?? undefined,
        target_bpm: shouldRecordBpm ? item.target_bpm : undefined,
        matched_target_bpm: matchedTarget ?? undefined,
      };
    });
    submitMutation.mutate(entries);
  };

  const hasItems = practiceItems.length > 0;

  // Count practiced items (at least one articulation checked)
  const practicedCount = Object.values(practiceState).filter(
    (state) => state.slurred || state.separate
  ).length;

  return (
    <div className="practice-container">
      <button
        className="generate-btn primary"
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending}
      >
        {generateMutation.isPending
          ? "Generating..."
          : practiceItems.length > 0
          ? "Generate New Set"
          : "Generate Practice Set"}
      </button>

      {generateMutation.isError && (
        <div className="error" style={{ marginBottom: "1rem" }}>
          <p>
            Error generating practice set. Make sure you have enabled some
            scales and arpeggios in the Config tab.
          </p>
        </div>
      )}

      {hasItems && !submitted && (
        <>
          {!isSaved && (
            <div className="unsaved-indicator">
              Unsaved session
            </div>
          )}
          <div className="practice-list">
            {practiceItems.map((item) => {
              const key = `${item.type}-${item.id}`;
              const state = practiceState[key] || { slurred: false, separate: false, recordBpm: false, bpm: null };
              const hasAnyPractice = state.slurred || state.separate;
              const bpmMatches = state.bpm !== null && state.bpm === item.target_bpm;
              const historyText = getHistoryBpmText(item);
              return (
                <div
                  key={key}
                  className={`practice-item ${item.type} ${hasAnyPractice ? "checked" : ""}`}
                >
                  <div className="practice-item-header">
                    <div className="practice-item-name">
                      {shortDisplayName(item)}
                    </div>
                    <div className="practice-item-details">
                      {item.octaves} octaves, ♪ = {item.target_bpm}
                      {historyText && (
                        <div className="practice-history-info">{historyText}</div>
                      )}
                    </div>
                  </div>
                  <div className="practice-checkboxes">
                    <label className={`articulation-checkbox ${item.articulation === "slurred" ? "suggested" : ""} ${state.slurred ? "done" : ""}`}>
                      <input
                        type="checkbox"
                        checked={state.slurred}
                        onChange={() => togglePractice(item, "slurred")}
                      />
                      ♪⌒♪
                    </label>
                    <label className={`articulation-checkbox ${item.articulation === "separate" ? "suggested" : ""} ${state.separate ? "done" : ""}`}>
                      <input
                        type="checkbox"
                        checked={state.separate}
                        onChange={() => togglePractice(item, "separate")}
                      />
                      ♪♪
                    </label>
                  </div>
                    <div className="practice-bpm-section">
                      <label className="record-bpm-toggle" title="Record practice BPM">
                        <input
                          type="checkbox"
                          checked={state.recordBpm}
                          onChange={() => toggleRecordBpm(item)}
                        />
                        <span className="record-bpm-label">♪=</span>
                      </label>
                      {state.recordBpm && (
                        <>
                          <input
                            type="number"
                            className={`item-bpm-input ${bpmMatches ? "match" : "diff"}`}
                            min={20}
                            max={240}
                            value={state.bpm ?? ""}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value) : null;
                              updateItemBpm(item, val);
                            }}
                          />
                          {/* <span className={`item-bpm-status ${bpmMatches ? "match" : "diff"}`}>
                            {bpmMatches ? "✓" : state.bpm !== null ? `${state.bpm > item.target_bpm ? "+" : ""}${state.bpm - item.target_bpm}` : ""}
                          </span> */}
                        </>
                      )}
                    </div>
                </div>
              );
            })}
          </div>

          <div className="submit-section">
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={isSaved}
            >
              {isSaved ? "Saved" : "Save for Later"}
            </button>
            <button
              className="submit-btn primary"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit to History"}
            </button>
          </div>

          <Metronome
            defaultBpm={defaultBpm}
            onBpmChange={handleMetronomeBpmChange}
            onEnabledChange={handleMetronomeEnabledChange}
          />
        </>
      )}

      {submitted && (
        <div className="success-message">
          <p>
            Practice session saved! You practiced {practicedCount} out of{" "}
            {practiceItems.length} items.
          </p>
          <button
            onClick={() => generateMutation.mutate()}
            style={{ marginTop: "1rem" }}
          >
            Generate Another Set
          </button>
        </div>
      )}

      <div style={{ marginTop: "2rem" }}>
        <button onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? "Hide Practice History" : "Show Practice History"}
        </button>

        {showHistory && (
          <div style={{ marginTop: "1rem" }}>
            <h3>Practice History</h3>
            {history.length === 0 ? (
              <p>No practice history yet. Enable some scales and start practicing!</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Times Practiced</th>
                      <th>Last Practiced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={`${item.item_type}-${item.item_id}`}>
                        <td>{item.display_name}</td>
                        <td>{item.times_practiced}</td>
                        <td>
                          {item.last_practiced
                            ? new Date(item.last_practiced).toLocaleDateString()
                            : "Never"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PracticePage;
