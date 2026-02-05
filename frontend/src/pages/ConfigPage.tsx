import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getScales,
  getArpeggios,
  updateScale,
  updateArpeggio,
  bulkEnableScales,
  bulkEnableArpeggios,
  getAlgorithmConfig,
  updateAlgorithmConfig,
  resetAlgorithmConfig,
} from "../api/client";
import type { Scale, Arpeggio, AlgorithmConfig } from "../types";
import { BpmInput } from "../components/BpmInput";


type Tab = "scales" | "arpeggios" | "weekly-focus" | "algorithm" | "metronome";

// Slot colors and CSS class names
const SLOT_STYLES: Record<number, { className: string; label: string }> = {
  0: { className: "tonal", label: "Tonal" },
  1: { className: "chromatic", label: "Chrom" },
  2: { className: "other", label: "7th" },
  3: { className: "arpeggios", label: "Triad" },
};

// WeightSlider component with Safari-compatible pointer events
function WeightSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (weight: number) => void;
}) {
  const [localValue, setLocalValue] = useState<number | null>(null);
  const commitTimeoutRef = useRef<number | null>(null);

  // Use localValue during interaction, otherwise use prop value
  const displayValue = localValue ?? value;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);

    // Debounced commit fallback for Safari edge cases
    if (commitTimeoutRef.current) {
      clearTimeout(commitTimeoutRef.current);
    }
    commitTimeoutRef.current = window.setTimeout(() => {
      if (localValue !== null) {
        onChange(newValue);
        setLocalValue(null);
      }
    }, 500);
  };

  const handlePointerDown = () => {
    setLocalValue(value);
    if (commitTimeoutRef.current) {
      clearTimeout(commitTimeoutRef.current);
    }
  };

  const handlePointerUp = () => {
    if (localValue !== null) {
      onChange(localValue);
      setLocalValue(null);
    }
    if (commitTimeoutRef.current) {
      clearTimeout(commitTimeoutRef.current);
    }
  };

  return (
    <div className="weight-control">
      <input
        type="range"
        min="0.1"
        max="3"
        step="0.1"
        value={displayValue}
        onChange={handleChange}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <span>{displayValue.toFixed(1)}</span>
    </div>
  );
}

const NOTES = ["A", "B", "C", "D", "E", "F", "G"];
const ACCIDENTAL_SYMBOLS: Record<string, string> = {
  flat: "♭",
  sharp: "♯",
};
const SCALE_TYPES = [
  "major",
  "minor",
  "minor_harmonic",
  "minor_melodic",
  "chromatic",
];
const ARPEGGIO_TYPES = ["major", "minor", "diminished", "dominant"];
const SCALE_OCTAVES = [1, 2, 3];
const ARPEGGIO_OCTAVES = [1, 2, 3];

function ConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>("scales");
  const [noteFilter, setNoteFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [octaveFilter, setOctaveFilter] = useState<string>("");
  const [enabledFilter, setEnabledFilter] = useState<string>("");
  const [fixedSlots, setFixedSlots] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  // Queries
  const { data: scales = [], isLoading: scalesLoading } = useQuery({
    queryKey: ["scales"],
    queryFn: () => getScales(),
  });

  const { data: arpeggios = [], isLoading: arpeggiosLoading } = useQuery({
    queryKey: ["arpeggios"],
    queryFn: () => getArpeggios(),
  });

  const { data: algorithmData, isLoading: algorithmLoading } = useQuery({
    queryKey: ["algorithm"],
    queryFn: () => getAlgorithmConfig(),
  });

  // Mutations
  const updateScaleMutation = useMutation({
    mutationFn: ({
      id,
      update,
    }: {
      id: number;
      update: { enabled?: boolean; weight?: number; target_bpm?: number };
    }) => updateScale(id, update),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scales"] }),
  });

  const updateArpeggioMutation = useMutation({
    mutationFn: ({
      id,
      update,
    }: {
      id: number;
      update: { enabled?: boolean; weight?: number; target_bpm?: number };
    }) => updateArpeggio(id, update),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["arpeggios"] }),
  });

  const bulkEnableScalesMutation = useMutation({
    mutationFn: ({ ids, enabled }: { ids: number[]; enabled: boolean }) =>
      bulkEnableScales(ids, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scales"] }),
  });

  const bulkEnableArpeggiosMutation = useMutation({
    mutationFn: ({ ids, enabled }: { ids: number[]; enabled: boolean }) =>
      bulkEnableArpeggios(ids, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["arpeggios"] }),
  });

  const updateAlgorithmMutation = useMutation({
    mutationFn: (config: AlgorithmConfig) => updateAlgorithmConfig(config),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["algorithm"] }),
  });

  const resetAlgorithmMutation = useMutation({
    mutationFn: () => resetAlgorithmConfig(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["algorithm"] }),
  });

  // Filter scales
  const filteredScales = scales.filter((scale: Scale) => {
    if (noteFilter && scale.note !== noteFilter) return false;
    if (typeFilter) {
      if (typeFilter === "minor") {
        if (!scale.type.startsWith("minor")) return false;
      } else if (scale.type !== typeFilter) {
        return false;
      }
    }
    if (octaveFilter && scale.octaves !== parseInt(octaveFilter)) return false;
    if (enabledFilter === "enabled" && !scale.enabled) return false;
    if (enabledFilter === "disabled" && scale.enabled) return false;
    return true;
  });

  // Filter arpeggios
  const filteredArpeggios = arpeggios.filter((arpeggio: Arpeggio) => {
    if (noteFilter && arpeggio.note !== noteFilter) return false;
    if (typeFilter && arpeggio.type !== typeFilter) return false;
    if (enabledFilter === "enabled" && !arpeggio.enabled) return false;
    if (enabledFilter === "disabled" && arpeggio.enabled) return false;
    if (octaveFilter && arpeggio.octaves !== parseInt(octaveFilter))
      return false;
    return true;
  });

  const handleBulkEnable = (enabled: boolean) => {
    if (activeTab === "scales") {
      const ids = filteredScales.map((s: Scale) => s.id);
      bulkEnableScalesMutation.mutate({ ids, enabled });
    } else if (activeTab === "arpeggios") {
      const ids = filteredArpeggios.map((a: Arpeggio) => a.id);
      bulkEnableArpeggiosMutation.mutate({ ids, enabled });
    }
  };

  const algorithmConfig = algorithmData?.config;

  // Toggle fixed state for a slot (max 2 can be fixed)
  const toggleFixed = (index: number) => {
    setFixedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < 2) {
        next.add(index);
      }
      return next;
    });
  };

  // Handler to update a slot's percentage while keeping total at 100%
  const handleSlotPercentChange = (index: number, newPercent: number) => {
    if (!algorithmConfig) return;

    // Clamp to valid range
    newPercent = Math.max(0, Math.min(100, newPercent));

    const slots = [...algorithmConfig.slots];
    const oldPercent = slots[index].percent;
    const diff = newPercent - oldPercent;

    if (diff === 0) return;

    // Find slots that can be adjusted (not fixed and not the one being changed)
    const adjustableIndices = slots
      .map((_, i) => i)
      .filter((i) => i !== index && !fixedSlots.has(i));

    if (adjustableIndices.length === 0) return;

    // Calculate total of adjustable slots
    const adjustableTotal = adjustableIndices.reduce(
      (sum, i) => sum + slots[i].percent,
      0
    );

    // Check if adjustment is possible
    if (adjustableTotal + diff < 0) {
      // Can't reduce adjustable slots below 0
      newPercent = oldPercent + adjustableTotal;
    }

    const actualDiff = newPercent - oldPercent;
    if (actualDiff === 0) return;

    // Apply the change to the target slot
    slots[index] = { ...slots[index], percent: newPercent };

    // Distribute the difference among adjustable slots proportionally
    if (adjustableTotal > 0) {
      adjustableIndices.forEach((i) => {
        const ratio = slots[i].percent / adjustableTotal;
        const newVal = Math.max(0, slots[i].percent - actualDiff * ratio);
        slots[i] = { ...slots[i], percent: Math.round(newVal) };
      });
    } else {
      // All adjustable slots are at 0, distribute equally
      const perSlot = Math.round(-actualDiff / adjustableIndices.length);
      adjustableIndices.forEach((i) => {
        slots[i] = { ...slots[i], percent: perSlot };
      });
    }

    // Ensure total is exactly 100
    const total = slots.reduce((sum, s) => sum + s.percent, 0);
    if (total !== 100 && adjustableIndices.length > 0) {
      const adjustment = 100 - total;
      // Find the largest adjustable slot
      let maxIdx = adjustableIndices[0];
      adjustableIndices.forEach((i) => {
        if (slots[i].percent > slots[maxIdx].percent) maxIdx = i;
      });
      slots[maxIdx] = {
        ...slots[maxIdx],
        percent: slots[maxIdx].percent + adjustment,
      };
    }

    updateAlgorithmMutation.mutate({ ...algorithmConfig, slots });
  };

  return (
    <div>
      <div className="tabs">
        <button
          className={activeTab === "scales" ? "active" : ""}
          onClick={() => {
            if (activeTab !== "scales") {
              setTypeFilter("");
              setOctaveFilter("");
            }
            setActiveTab("scales");
          }}
        >
          Scales
        </button>
        <button
          className={activeTab === "arpeggios" ? "active" : ""}
          onClick={() => {
            if (activeTab !== "arpeggios") {
              setTypeFilter("");
              setOctaveFilter("");
            }
            setActiveTab("arpeggios");
          }}
        >
          Arpeggios
        </button>
        <button
          className={activeTab === "weekly-focus" ? "active" : ""}
          onClick={() => setActiveTab("weekly-focus")}
        >
          Weekly Focus
        </button>
        <button
          className={activeTab === "algorithm" ? "active" : ""}
          onClick={() => setActiveTab("algorithm")}
        >
          Algorithm
        </button>
        <button
          className={activeTab === "metronome" ? "active" : ""}
          onClick={() => setActiveTab("metronome")}
        >
          Metronome
        </button>
      </div>

      {(activeTab === "scales" || activeTab === "arpeggios") && (
        <>
          <div className="filters">
            <label>
              Note:
              <select
                value={noteFilter}
                onChange={(e) => setNoteFilter(e.target.value)}
              >
                <option value="">All</option>
                {NOTES.map((note) => (
                  <option key={note} value={note}>
                    {note}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type:
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All</option>
                {(activeTab === "scales" ? SCALE_TYPES : ARPEGGIO_TYPES).map(
                  (type) => (
                    <option key={type} value={type}>
                      {type === "minor" && activeTab === "scales"
                        ? "minor (all)"
                        : type.replace("_", " ")}
                    </option>
                  )
                )}
              </select>
            </label>
            <label>
              Octaves:
              <select
                value={octaveFilter}
                onChange={(e) => setOctaveFilter(e.target.value)}
              >
                <option value="">All</option>
                {(activeTab === "scales" ? SCALE_OCTAVES : ARPEGGIO_OCTAVES).map(
                  (oct) => (
                    <option key={oct} value={oct}>
                      {oct}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={enabledFilter === "enabled"}
                onChange={(e) =>
                  setEnabledFilter(e.target.checked ? "enabled" : "")
                }
              />
              Show enabled only
            </label>
          </div>

          <div className="bulk-actions">
            <button onClick={() => handleBulkEnable(true)}>
              Enable Filtered
            </button>
            <button onClick={() => handleBulkEnable(false)}>
              Disable Filtered
            </button>
          </div>
        </>
      )}

      {activeTab === "scales" && (
        <div className="table-container">
          {scalesLoading ? (
            <p>Loading scales...</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Enabled</th>
                  <th>Scale</th>
                  <th>Type</th>
                  <th>Oct</th>
                  <th>Weight</th>
                  <th title="Target Speed (quaver BPM)">Target (♪)</th>
                </tr>
              </thead>
              <tbody>
                {filteredScales.map((scale: Scale) => (
                  <tr key={scale.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={scale.enabled}
                        onChange={(e) =>
                          updateScaleMutation.mutate({
                            id: scale.id,
                            update: { enabled: e.target.checked },
                          })
                        }
                      />
                    </td>
                    <td>
                      {scale.note}
                      {scale.accidental ? ACCIDENTAL_SYMBOLS[scale.accidental] : ""}
                    </td>
                    <td>{scale.type.replace("_", " ")}</td>
                    <td>{scale.octaves}</td>
                    <td>
                      <WeightSlider
                        value={scale.weight}
                        onChange={(weight) =>
                          updateScaleMutation.mutate({
                            id: scale.id,
                            update: { weight },
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="bpm-input"
                        min={20}
                        max={240}
                        placeholder={String(algorithmConfig?.default_scale_bpm ?? 60)}
                        value={scale.target_bpm ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : 0;
                          updateScaleMutation.mutate({
                            id: scale.id,
                            update: { target_bpm: val },
                          });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "arpeggios" && (
        <div className="table-container">
          {arpeggiosLoading ? (
            <p>Loading arpeggios...</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Enabled</th>
                  <th>Arpeggio</th>
                  <th>Type</th>
                  <th>Oct</th>
                  <th>Weight</th>
                  <th title="Target Speed (quaver BPM)">Target (♪)</th>
                </tr>
              </thead>
              <tbody>
                {filteredArpeggios.map((arpeggio: Arpeggio) => (
                  <tr key={arpeggio.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={arpeggio.enabled}
                        onChange={(e) =>
                          updateArpeggioMutation.mutate({
                            id: arpeggio.id,
                            update: { enabled: e.target.checked },
                          })
                        }
                      />
                    </td>
                    <td>
                      {arpeggio.note}
                      {arpeggio.accidental ? ACCIDENTAL_SYMBOLS[arpeggio.accidental] : ""}
                    </td>
                    <td>{arpeggio.type}</td>
                    <td>{arpeggio.octaves}</td>
                    <td>
                      <WeightSlider
                        value={arpeggio.weight}
                        onChange={(weight) =>
                          updateArpeggioMutation.mutate({
                            id: arpeggio.id,
                            update: { weight },
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="bpm-input"
                        min={20}
                        max={240}
                        placeholder={String(algorithmConfig?.default_arpeggio_bpm ?? 72)}
                        value={arpeggio.target_bpm ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : 0;
                          updateArpeggioMutation.mutate({
                            id: arpeggio.id,
                            update: { target_bpm: val },
                          });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "weekly-focus" && (
        <div className="algorithm-settings">
          {algorithmLoading ? (
            <p>Loading settings...</p>
          ) : algorithmConfig ? (
            <div className="setting-group">
              <h3>Weekly Focus</h3>
              <p className="setting-description">
                The teacher may recommend focusing on specific keys or types for the week.
                When enabled, practice sets will prioritize items matching the focus criteria
                by reserving a proportion of slots for them.
              </p>
              <div className="setting-row">
                <label>Enable Weekly Focus:</label>
                <input
                  type="checkbox"
                  checked={algorithmConfig.weekly_focus?.enabled ?? false}
                  onChange={(e) =>
                    updateAlgorithmMutation.mutate({
                      ...algorithmConfig,
                      weekly_focus: {
                        ...(algorithmConfig.weekly_focus || {
                          keys: [],
                          types: [],
                          probability_increase: 80,
                        }),
                        enabled: e.target.checked,
                      },
                    })
                  }
                />
              </div>
              {algorithmConfig.weekly_focus?.enabled && (
                <>
                  <div className="focus-selectors">
                    <div className="focus-group">
                      <label>Focus Keys:</label>
                      <div className="chip-container">
                        {NOTES.map((note) => (
                          <button
                            key={note}
                            className={`chip ${
                              algorithmConfig.weekly_focus.keys.includes(note)
                                ? "active"
                                : ""
                            }`}
                            onClick={() => {
                              const keys = algorithmConfig.weekly_focus.keys.includes(
                                note
                              )
                                ? algorithmConfig.weekly_focus.keys.filter(
                                    (k) => k !== note
                                  )
                                : [...algorithmConfig.weekly_focus.keys, note];
                              updateAlgorithmMutation.mutate({
                                ...algorithmConfig,
                                weekly_focus: {
                                  ...algorithmConfig.weekly_focus,
                                  keys,
                                },
                              });
                            }}
                          >
                            {note}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="focus-group">
                      <label>Focus Types:</label>
                      <div className="chip-container">
                        {[...new Set([...SCALE_TYPES, ...ARPEGGIO_TYPES])]
                          .filter((t) => t !== "chromatic")
                          .concat(["chromatic"])
                          .map((type) => (
                            <button
                              key={type}
                              className={`chip ${
                                algorithmConfig.weekly_focus.types.includes(type)
                                  ? "active"
                                  : ""
                              }`}
                              onClick={() => {
                                const types = algorithmConfig.weekly_focus.types.includes(
                                  type
                                )
                                  ? algorithmConfig.weekly_focus.types.filter(
                                      (t) => t !== type
                                    )
                                  : [...algorithmConfig.weekly_focus.types, type];
                                updateAlgorithmMutation.mutate({
                                  ...algorithmConfig,
                                  weekly_focus: {
                                    ...algorithmConfig.weekly_focus,
                                    types,
                                  },
                                });
                              }}
                            >
                              {type.replace("_", " ")}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label>Probability Boost:</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={algorithmConfig.weekly_focus.probability_increase}
                      onChange={(e) =>
                        updateAlgorithmMutation.mutate({
                          ...algorithmConfig,
                          weekly_focus: {
                            ...algorithmConfig.weekly_focus,
                            probability_increase: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                    <span>
                      {algorithmConfig.weekly_focus.probability_increase}%
                    </span>
                  </div>
                  <p className="setting-description">
                    The boost percentage determines how many slots in each practice set are
                    reserved for focus items. For example, with 5 items and 80% boost, 4 slots
                    are filled from focus items first, then 1 slot from non-focus items.
                    If there aren't enough focus items, the remaining slots are filled from
                    non-focus items (and vice versa).
                  </p>
                </>
              )}
            </div>
          ) : null}
        </div>
      )}

      {activeTab === "algorithm" && (
        <div className="algorithm-settings">
          {algorithmLoading ? (
            <p>Loading settings...</p>
          ) : algorithmConfig ? (
            <>
              <div className="setting-group">
                <h3>General Settings</h3>
                <div className="setting-row">
                  <label>Total items per practice set:</label>
                  <input
                    type="number"
                    min="3"
                    max="10"
                    value={algorithmConfig.total_items}
                    onChange={(e) =>
                      updateAlgorithmMutation.mutate({
                        ...algorithmConfig,
                        total_items: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="setting-row">
                  <label>Octave variety:</label>
                  <input
                    type="checkbox"
                    checked={algorithmConfig.octave_variety}
                    onChange={(e) =>
                      updateAlgorithmMutation.mutate({
                        ...algorithmConfig,
                        octave_variety: e.target.checked,
                      })
                    }
                  />
                </div>
                <p className="setting-description">
                  When enabled, items with the same octave count as already selected items
                  have their selection weight reduced by 50%, encouraging a mix of 1, 2, and 3 octave exercises.
                </p>
                <div className="setting-row">
                  <label>Slurred vs Separate:</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={algorithmConfig.slurred_percent ?? 50}
                    onChange={(e) =>
                      updateAlgorithmMutation.mutate({
                        ...algorithmConfig,
                        slurred_percent: parseInt(e.target.value),
                      })
                    }
                  />
                  <span>{algorithmConfig.slurred_percent ?? 50}% slurred</span>
                </div>
                <p className="setting-description">
                  Controls the balance between slurred and separate articulation suggestions
                  in practice sets. 50% means equal chance of either.
                </p>
              </div>

              <div className="setting-group">
                <h3>Category Distribution</h3>

                {/* Stacked bar visualization */}
                <div className="distribution-bar">
                  {algorithmConfig.slots.map((slot, index) => (
                    <div
                      key={index}
                      className={`distribution-segment ${SLOT_STYLES[index]?.className || ""}`}
                      style={{ flex: slot.percent }}
                    >
                      {slot.percent >= 10 ? `${slot.percent}%` : ""}
                    </div>
                  ))}
                </div>

                {/* Legend with sliders */}
                <div className="category-legend">
                  {algorithmConfig.slots.map((slot, index) => (
                    <div
                      key={index}
                      className={`legend-item ${fixedSlots.has(index) ? "fixed" : ""}`}
                    >
                      <div className={`legend-color ${SLOT_STYLES[index]?.className || ""}`} />
                      <div className="legend-info">
                        <div className="legend-name">{slot.name}</div>
                        <div className="legend-types">{slot.types.join(", ")}</div>
                      </div>
                      <div className="legend-control">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={slot.percent}
                          disabled={fixedSlots.has(index)}
                          onChange={(e) =>
                            handleSlotPercentChange(index, parseInt(e.target.value))
                          }
                        />
                        <span className="legend-percent-value">{slot.percent}%</span>
                      </div>
                      <label className="legend-fixed">
                        <input
                          type="checkbox"
                          checked={fixedSlots.has(index)}
                          disabled={!fixedSlots.has(index) && fixedSlots.size >= 2}
                          onChange={() => toggleFixed(index)}
                        />
                        Fix
                      </label>
                    </div>
                  ))}
                </div>

                {/* Variation slider */}
                <div className="variation-control">
                  <label>Randomness (±):</label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={algorithmConfig.variation}
                    onChange={(e) =>
                      updateAlgorithmMutation.mutate({
                        ...algorithmConfig,
                        variation: parseInt(e.target.value),
                      })
                    }
                  />
                  <span className="variation-value">±{algorithmConfig.variation / 2}%</span>
                </div>
              </div>

              <div className="setting-group">
                <h3>Weighting Parameters</h3>
                <p className="setting-description">
                  Items are selected using weighted random selection. The formula is:
                </p>
                <code className="formula">
                  weight = item_weight × base_mult × (1 + days_since / days_factor) ÷ (practice_count + divisor)
                </code>
                <p className="setting-description">
                  Items practiced less recently or less frequently are more likely to be selected.
                </p>
                <div className="setting-row">
                  <label>Base multiplier:</label>
                  <input
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={algorithmConfig.weighting.base_multiplier}
                    onChange={(e) =>
                      updateAlgorithmMutation.mutate({
                        ...algorithmConfig,
                        weighting: {
                          ...algorithmConfig.weighting,
                          base_multiplier: parseFloat(e.target.value),
                        },
                      })
                    }
                  />
                  <span className="param-hint">Scales all weights uniformly</span>
                </div>
                <div className="setting-row">
                  <label>Days since practice factor:</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={algorithmConfig.weighting.days_since_practice_factor}
                    onChange={(e) =>
                      updateAlgorithmMutation.mutate({
                        ...algorithmConfig,
                        weighting: {
                          ...algorithmConfig.weighting,
                          days_since_practice_factor: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                  <span className="param-hint">Lower = more emphasis on recent practice</span>
                </div>
                <div className="setting-row">
                  <label>Practice count divisor:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={algorithmConfig.weighting.practice_count_divisor}
                    onChange={(e) =>
                      updateAlgorithmMutation.mutate({
                        ...algorithmConfig,
                        weighting: {
                          ...algorithmConfig.weighting,
                          practice_count_divisor: parseInt(e.target.value),
                        },
                      })
                    }
                  />
                  <span className="param-hint">Higher = less emphasis on practice count</span>
                </div>
              </div>

              <div className="setting-group">
                <button onClick={() => resetAlgorithmMutation.mutate()}>
                  Reset to Defaults
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {activeTab === "metronome" && (
        <div className="algorithm-settings">
          {algorithmLoading ? (
            <p>Loading settings...</p>
          ) : algorithmConfig ? (
            <div className="setting-group">
              <h3>Default BPM Settings</h3>
              <p className="setting-description">
                Default metronome speeds for scales and arpeggios. All speeds are shown as
                quaver (♪) BPM with crotchet (♩) equivalent. These are used as starting
                points when you enable the metronome during practice, and as the target
                BPM for items that don't have a custom target set.
              </p>
              <div className="setting-row">
                <label>Default Scale</label>
                <span className="bpm-note-prefix">♪=</span>
                <BpmInput
                  value={algorithmConfig.default_scale_bpm ?? 60}
                  onChange={(v) =>
                    updateAlgorithmMutation.mutate({
                      ...algorithmConfig,
                      default_scale_bpm: v,
                    })
                  }
                />
                <span className="bpm-crotchet-display">
                  (♩={Math.round((algorithmConfig.default_scale_bpm ?? 60) / 2)})
                </span>
              </div>
              <div className="setting-row">
                <label>Default Arpeggio</label>
                <span className="bpm-note-prefix">♪=</span>
                <input
                  type="number"
                  min="20"
                  max="240"
                  value={algorithmConfig.default_arpeggio_bpm ?? 72}
                  onChange={(e) =>
                    updateAlgorithmMutation.mutate({
                      ...algorithmConfig,
                      default_arpeggio_bpm: parseInt(e.target.value) || 72,
                    })
                  }
                />
                <span className="bpm-crotchet-display">
                  (♩={Math.round((algorithmConfig.default_arpeggio_bpm ?? 72) / 2)})
                </span>
              </div>
              <p className="setting-description">
                You can also set custom target BPM for individual scales and arpeggios in
                the Scales and Arpeggios tabs. Custom targets override these defaults.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default ConfigPage;
