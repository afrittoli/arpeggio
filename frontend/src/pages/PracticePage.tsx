import { useState, useEffect, useCallback, useRef } from "react";
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

// Practice articulation states for the cycling button
type PracticeArticulationState = "none" | "slurred" | "separate" | "both";

function getPracticeArticulationState(state: PracticeState): PracticeArticulationState {
  if (state.slurred && state.separate) return "both";
  if (state.slurred) return "slurred";
  if (state.separate) return "separate";
  return "none";
}

function practiceStateFromArticulation(artState: PracticeArticulationState): { slurred: boolean; separate: boolean } {
  switch (artState) {
    case "slurred": return { slurred: true, separate: false };
    case "separate": return { slurred: false, separate: true };
    case "both": return { slurred: true, separate: true };
    default: return { slurred: false, separate: false };
  }
}

function getNextPracticeState(
  current: PracticeArticulationState,
  suggested: "slurred" | "separate"
): PracticeArticulationState {
  const other = suggested === "slurred" ? "separate" : "slurred";
  // Cycle: none → suggested → both → other → none
  const cycle: PracticeArticulationState[] = ["none", suggested, "both", other];
  const idx = cycle.indexOf(current);
  return cycle[(idx + 1) % cycle.length];
}

const PRACTICE_STATE_LABELS: Record<PracticeArticulationState, string> = {
  none: "○",
  slurred: "♪⌒♪",
  separate: "♪♪",
  both: "♪♪ + ♪⌒♪",
};

const PRACTICE_STATE_TITLES: Record<PracticeArticulationState, string> = {
  none: "Not practiced",
  slurred: "Practiced slurred",
  separate: "Practiced separate",
  both: "Practiced both",
};

const ALL_PRACTICE_STATES: PracticeArticulationState[] = ["none", "slurred", "separate", "both"];

const STORAGE_KEY = "practiceSession";

interface StoredSession {
  items: PracticeItem[];
  state: Record<string, PracticeState>;
  timestamp: number;
  metronomeChecked?: boolean;
  metronomeBpm?: number | null;
  activeMetronomeItemKey?: string | null;
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

function PracticeArticulationButton({
  item,
  state,
  onCycle,
  onSetState,
  isMenuOpen,
  onMenuOpen,
  onMenuClose,
}: {
  item: PracticeItem;
  state: PracticeState;
  onCycle: () => void;
  onSetState: (artState: PracticeArticulationState) => void;
  isMenuOpen: boolean;
  onMenuOpen: () => void;
  onMenuClose: () => void;
}) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const didLongPress = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const artState = getPracticeArticulationState(state);
  const isSuggested = (artState === "slurred" || artState === "separate") && artState === item.articulation;
  const includesSuggested = artState === "both" || isSuggested;

  // Close menu when clicking or right-clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutsideEvent = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        onMenuClose();
      }
    };
    document.addEventListener("mousedown", handleOutsideEvent);
    document.addEventListener("contextmenu", handleOutsideEvent);
    return () => {
      document.removeEventListener("mousedown", handleOutsideEvent);
      document.removeEventListener("contextmenu", handleOutsideEvent);
    };
  }, [isMenuOpen, onMenuClose]);

  const openMenu = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.top, left: rect.left + rect.width / 2 });
    }
    onMenuOpen();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu();
  };

  const handleTouchStart = () => {
    didLongPress.current = false;
    longPressTimer.current = window.setTimeout(() => {
      didLongPress.current = true;
      openMenu();
    }, 500);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (didLongPress.current) {
      e.preventDefault();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    onCycle();
  };

  return (
    <div className="practice-articulation-container" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        className={`practice-articulation-btn ${artState} ${includesSuggested ? "suggested" : ""}`}
        title={`${PRACTICE_STATE_TITLES[artState]} (click to cycle, right-click for menu)`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {artState === "none" ? (
          <span className="practice-art-hint">{PRACTICE_STATE_LABELS[item.articulation]}</span>
        ) : (
          PRACTICE_STATE_LABELS[artState]
        )}
      </button>
      {isMenuOpen && menuPos && (
        <div
          ref={menuRef}
          className="practice-art-menu"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {ALL_PRACTICE_STATES.map((s) => (
            <button
              key={s}
              className={`practice-art-menu-item ${s === artState ? "active" : ""} ${s === item.articulation || s === "both" ? "suggested-hint" : ""}`}
              onClick={() => {
                onSetState(s);
                onMenuClose();
              }}
            >
              <span className="practice-art-menu-label">{PRACTICE_STATE_LABELS[s]}</span>
              <span className="practice-art-menu-desc">{PRACTICE_STATE_TITLES[s]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(true);
  const [metronomeBpm, setMetronomeBpm] = useState<number | null>(
    () => loadStoredSession()?.metronomeBpm ?? null
  );
  const [metronomeChecked, setMetronomeChecked] = useState(
    () => loadStoredSession()?.metronomeChecked ?? false
  ); // Metronome checkbox is checked (visible)
  const [activeMetronomeItemKey, setActiveMetronomeItemKey] = useState<string | null>(
    () => loadStoredSession()?.activeMetronomeItemKey ?? null
  );
  const { playingItemKey, play: playDrone, stop: stopDrone, isPlaying: isDronePlaying } = useDrone();

  // Save to localStorage when items, state, or metronome state changes
  useEffect(() => {
    if (practiceItems.length > 0 && !submitted && !isSaved) {
      const session: StoredSession = {
        items: practiceItems,
        state: practiceState,
        timestamp: Date.now(),
        metronomeChecked,
        metronomeBpm,
        activeMetronomeItemKey,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }, [practiceItems, practiceState, submitted, isSaved, metronomeChecked, metronomeBpm, activeMetronomeItemKey]);

  const { data: history = [] } = useQuery({
    queryKey: ["practice-history"],
    queryFn: () => getPracticeHistory(),
    enabled: practiceItems.length > 0,
  });

  // Fetch algorithm config for BPM display unit settings
  const { data: algorithmData } = useQuery({
    queryKey: ["algorithm-config"],
    queryFn: () => getAlgorithmConfig(),
  });
  const scaleBpmUnit: BpmUnit = algorithmData?.config?.scale_bpm_unit ?? "quaver";
  const arpeggiosBpmUnit: BpmUnit = algorithmData?.config?.arpeggio_bpm_unit ?? "quaver";
  const metronomeGain = algorithmData?.config?.metronome_gain ?? 0.6;
  const droneGain = algorithmData?.config?.drone_gain ?? 0.4;

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
    setIsSaved(false);
  }, []);

  const handleMetronomeEnabledChange = useCallback((isEnabled: boolean) => {
    setMetronomeChecked(isEnabled);
    setIsSaved(false);
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

  const setPracticeArticulation = (item: PracticeItem, artState: PracticeArticulationState) => {
    const key = `${item.type}-${item.id}`;
    const { slurred, separate } = practiceStateFromArticulation(artState);
    const willHaveAnyPractice = slurred || separate;
    setPracticeState((prev) => {
      const current = prev[key] || { slurred: false, separate: false, recordBpm: false, bpm: null };
      return {
        ...prev,
        [key]: {
          ...current,
          slurred,
          separate,
          recordBpm: willHaveAnyPractice ? current.recordBpm : false,
          bpm: willHaveAnyPractice ? current.bpm : null,
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
      metronomeChecked,
      metronomeBpm,
      activeMetronomeItemKey,
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
              const isMetronomeActive = activeMetronomeItemKey === key;
              return (
                <div
                  key={key}
                  className={`practice-item ${practiceItemClass} ${hasAnyPractice ? "checked" : ""} ${isMetronomeActive ? "active" : ""}`}
                  onClick={() => {
                    setActiveMetronomeItemKey(key);
                    setIsSaved(false);
                  }}
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
                  <div onClick={(e) => e.stopPropagation()}>
                    <DroneButton
                      note={note}
                      itemKey={key}
                      isPlaying={isThisDronePlaying}
                      isDisabled={isDronePlaying && !isThisDronePlaying}
                      onPlay={(key, note) => playDrone(key, note, droneGain)}
                      onStop={stopDrone}
                    />
                  </div>
                  <PracticeArticulationButton
                    item={item}
                    state={state}
                    onCycle={() => {
                      const current = getPracticeArticulationState(state);
                      const next = getNextPracticeState(current, item.articulation);
                      setPracticeArticulation(item, next);
                    }}
                    onSetState={(artState) => setPracticeArticulation(item, artState)}
                    isMenuOpen={openMenuKey === key}
                    onMenuOpen={() => setOpenMenuKey(key)}
                    onMenuClose={() => setOpenMenuKey(null)}
                  />
                    <div className="practice-bpm-section" onClick={(e) => e.stopPropagation()}>
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
            key={activeMetronomeItemKey || "default"}
            defaultBpm={(() => {
              if (activeMetronomeItemKey) {
                const item = practiceItems.find(i => `${i.type}-${i.id}` === activeMetronomeItemKey);
                if (item) return item.target_bpm;
              }
              return 60;
            })()}
            initialUnit={(() => {
              if (activeMetronomeItemKey) {
                const item = practiceItems.find(i => `${i.type}-${i.id}` === activeMetronomeItemKey);
                if (item) return getBpmUnit(item.type);
              }
              return "quaver";
            })()}
            initialEnabled={metronomeChecked}
            onBpmChange={handleMetronomeBpmChange}
            onEnabledChange={handleMetronomeEnabledChange}
            gain={metronomeGain}
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

    </div>
  );
}

export default PracticePage;
