import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  generateSet,
  createPracticeSession,
  getPracticeHistory,
  getAlgorithmConfig,
} from "../api/client";
import Metronome from "../components/Metronome";
import DroneButton from "../components/DroneButton";
import { useDrone } from "../hooks/useDrone";
import { parseNoteFromDisplayName } from "../utils/audio";
import type { PracticeItem, PracticeEntryInput, BpmUnit } from "../types";

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

function isChromatic(item: string): boolean {
  const parts = item.split(' ');
  return parts[parts.length-1] === 'chromatic';
}

function isOther(item: string): boolean {
  const parts = item.split(' ');
  return parts[parts.length-2] === 'dominant' || parts[parts.length-2] === 'diminished';
}

/**
 * Format BPM display based on the configured unit.
 * @param bpm - The stored BPM value (always in quaver units)
 * @param unit - The display unit: "quaver" or "crotchet"
 * @returns Formatted string like "♪ = 120" or "♩ = 60"
 */
function formatBpmDisplay(bpm: number, unit: BpmUnit): string {
  if (unit === "crotchet") {
    return `♩ = ${Math.round(bpm / 2)}`;
  }
  return `♪ = ${bpm}`;
}

/**
 * Get the BPM notation symbol for a given unit.
 */
function getBpmSymbol(unit: BpmUnit): string {
  return unit === "crotchet" ? "♩" : "♪";
}

/**
 * Convert BPM for display based on unit.
 */
function displayBpm(bpm: number, unit: BpmUnit): number {
  return unit === "crotchet" ? Math.round(bpm / 2) : bpm;
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
  const [isSaved, setIsSaved] = useState(true);
  const [metronomeBpm, setMetronomeBpm] = useState<number | null>(null);
  const [metronomeChecked, setMetronomeChecked] = useState(false); // Metronome checkbox is checked (visible)
  const { playingItemKey, play: playDrone, stop: stopDrone, isPlaying: isDronePlaying } = useDrone();

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

  // Fetch algorithm config for BPM display unit settings
  const { data: algorithmData } = useQuery({
    queryKey: ["algorithm-config"],
    queryFn: () => getAlgorithmConfig(),
  });
  const scaleBpmUnit: BpmUnit = algorithmData?.config?.scale_bpm_unit ?? "quaver";
  const arpeggiosBpmUnit: BpmUnit = algorithmData?.config?.arpeggio_bpm_unit ?? "quaver";

  // Helper to get the BPM unit for an item based on its type
  const getBpmUnit = (itemType: string): BpmUnit => {
    return itemType === "scale" ? scaleBpmUnit : arpeggiosBpmUnit;
  };

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

    const unit = getBpmUnit(item.type);
    const symbol = getBpmSymbol(unit);
    const displayValue = displayBpm(maxBpm, unit);
    return `Practiced at ${symbol}=${displayValue}`;
  };

  const handleMetronomeBpmChange = useCallback((bpm: number) => {
    setMetronomeBpm(bpm);
  }, []);

  const handleMetronomeEnabledChange = useCallback((isEnabled: boolean) => {
    setMetronomeChecked(isEnabled);
  }, []);

  const [emptyError, setEmptyError] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () => generateSet(),
    onSuccess: (data) => {
      setEmptyError(false);

      if (!data || !data.items || !Array.isArray(data.items)) {
        console.error("Malformed data returned from generateSet:", data);
        return;
      }

      if (data.items.length === 0) {
        console.warn("API returned an empty practice set. Check if items are enabled in Config.");
        setEmptyError(true);
        setSubmitted(false);
        setIsSaved(true);
        setPracticeItems([]);
        return;
      }

      try {
        // Initialize practice state for each item BEFORE setting items to avoid render issues
        const initialState: Record<string, PracticeState> = {};
        data.items.forEach((item) => {
          const key = `${item.type}-${item.id}`;
          initialState[key] = { slurred: false, separate: false, recordBpm: false, bpm: null };
        });
        setPracticeState(initialState);
        setPracticeItems(data.items);
        setSubmitted(false);
        setIsSaved(false);
      } catch (err) {
        console.error("Error updating state after generation:", err);
      }
    },
    onError: (error) => {
      console.error("Mutation error generating set:", error);
    }
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

      // Check if any articulation will remain checked after this toggle
      const otherArticulation = articulation === "slurred" ? "separate" : "slurred";
      const willHaveAnyPractice = newArticulationValue || current[otherArticulation];

      // Auto-disable BPM recording if no articulation will be checked
      const newRecordBpm = willHaveAnyPractice ? current.recordBpm : false;
      const newBpm = willHaveAnyPractice ? current.bpm : null;

      return {
        ...prev,
        [key]: {
          ...current,
          [articulation]: newArticulationValue,
          recordBpm: newRecordBpm,
          bpm: newBpm,
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
    // Stop any playing drone before submitting
    if (isDronePlaying) {
      stopDrone();
    }

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

      {emptyError && (
        <div className="error" style={{ marginBottom: "1rem" }}>
          <p>
            No practice items were generated. Please go to the <strong>Config</strong> tab
            and ensure you have enabled at least one scale or arpeggio.
          </p>
        </div>
      )}

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
              const shortName = shortDisplayName(item);
              let practiceItemClass = item.type.toString();
              if (isChromatic(shortName)) {
                practiceItemClass = "chromatic";
              } else if (isOther(shortName)) {
                practiceItemClass = "other";
              }
              const note = parseNoteFromDisplayName(item.display_name);
              const isThisDronePlaying = playingItemKey === key;
              return (
                <div
                  key={key}
                  className={`practice-item ${practiceItemClass} ${hasAnyPractice ? "checked" : ""}`}
                >
                  <div className="practice-item-header">
                    <div className="practice-item-name">
                      {shortName}
                      {item.is_weekly_focus && (
                        <span className="weekly-focus-badge" title="Weekly Focus Item">
                          ★
                        </span>
                      )}
                    </div>
                    <div className="practice-item-details">
                      {item.octaves} octaves, {formatBpmDisplay(item.target_bpm, getBpmUnit(item.type))}
                      {historyText && (
                        <div className="practice-history-info">{historyText}</div>
                      )}
                    </div>
                  </div>
                  <DroneButton
                    note={note}
                    itemKey={key}
                    isPlaying={isThisDronePlaying}
                    isDisabled={isDronePlaying && !isThisDronePlaying}
                    onPlay={playDrone}
                    onStop={stopDrone}
                  />
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
                      <label className={`record-bpm-toggle ${!hasAnyPractice ? "disabled" : ""}`} title="Record practice BPM">
                        <input
                          type="checkbox"
                          checked={state.recordBpm}
                          onChange={() => toggleRecordBpm(item)}
                          disabled={!hasAnyPractice}
                        />
                        <span className="record-bpm-label">{getBpmSymbol(getBpmUnit(item.type))}=</span>
                      </label>
                      {hasAnyPractice && state.recordBpm && (
                        <>
                          <input
                            type="number"
                            className={`item-bpm-input ${bpmMatches ? "match" : "diff"}`}
                            min={10}
                            max={240}
                            value={state.bpm !== null ? displayBpm(state.bpm, getBpmUnit(item.type)) : ""}
                            onChange={(e) => {
                              const unit = getBpmUnit(item.type);
                              const displayVal = e.target.value ? parseInt(e.target.value) : null;
                              // Convert display value back to quaver for storage
                              const quaverVal = displayVal !== null
                                ? (unit === "crotchet" ? displayVal * 2 : displayVal)
                                : null;
                              updateItemBpm(item, quaverVal);
                            }}
                          />
                        </>
                      )}
                    </div>
                </div>
              );
            })}
          </div>

          <Metronome
            onBpmChange={handleMetronomeBpmChange}
            onEnabledChange={handleMetronomeEnabledChange}
          />

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
