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

type Tab = "scales" | "arpeggios" | "algorithm";

// WeightSlider component that only saves on mouse/touch release
function WeightSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (weight: number) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const isDragging = useRef(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDragging.current = true;
    setLocalValue(parseFloat(e.target.value));
  };

  const handleCommit = () => {
    if (isDragging.current) {
      isDragging.current = false;
      onChange(localValue);
    }
  };

  // Sync with external value when not dragging
  if (!isDragging.current && value !== localValue) {
    setLocalValue(value);
  }

  return (
    <div className="weight-control">
      <input
        type="range"
        min="0.1"
        max="3"
        step="0.1"
        value={localValue}
        onChange={handleChange}
        onMouseUp={handleCommit}
        onTouchEnd={handleCommit}
      />
      <span>{localValue.toFixed(1)}</span>
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
  "diminished",
  "dominant",
];
const ARPEGGIO_TYPES = ["major", "minor"];
const SCALE_OCTAVES = [1, 2, 3];
const ARPEGGIO_OCTAVES = [2, 3];

function ConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>("scales");
  const [noteFilter, setNoteFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [octaveFilter, setOctaveFilter] = useState<string>("");
  const [enabledFilter, setEnabledFilter] = useState<string>("");
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
      update: { enabled?: boolean; weight?: number };
    }) => updateScale(id, update),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scales"] }),
  });

  const updateArpeggioMutation = useMutation({
    mutationFn: ({
      id,
      update,
    }: {
      id: number;
      update: { enabled?: boolean; weight?: number };
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
        // "minor" matches both minor_harmonic and minor_melodic
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

  return (
    <div>
      <div className="tabs">
        <button
          className={activeTab === "scales" ? "active" : ""}
          onClick={() => setActiveTab("scales")}
        >
          Scales
        </button>
        <button
          className={activeTab === "arpeggios" ? "active" : ""}
          onClick={() => setActiveTab("arpeggios")}
        >
          Arpeggios
        </button>
        <button
          className={activeTab === "algorithm" ? "active" : ""}
          onClick={() => setActiveTab("algorithm")}
        >
          Algorithm
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
                      {type === "minor" ? "minor (all)" : type.replace("_", " ")}
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
                  <th>Octaves</th>
                  <th>Weight</th>
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
                  <th>Octaves</th>
                  <th>Weight</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
                <div className="setting-row">
                  <label>Limit arpeggios (% of total):</label>
                  <input
                    type="checkbox"
                    checked={algorithmConfig.max_arpeggio_percent !== null}
                    onChange={(e) =>
                      updateAlgorithmMutation.mutate({
                        ...algorithmConfig,
                        max_arpeggio_percent: e.target.checked ? 20 : null,
                      })
                    }
                  />
                  {algorithmConfig.max_arpeggio_percent !== null && (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="5"
                      value={algorithmConfig.max_arpeggio_percent}
                      onChange={(e) =>
                        updateAlgorithmMutation.mutate({
                          ...algorithmConfig,
                          max_arpeggio_percent: parseInt(e.target.value),
                        })
                      }
                      style={{ width: "60px", marginLeft: "0.5rem" }}
                    />
                  )}
                  {algorithmConfig.max_arpeggio_percent !== null && (
                    <span style={{ marginLeft: "0.25rem" }}>%</span>
                  )}
                </div>
              </div>

              <div className="setting-group">
                <h3>Weighting Parameters</h3>
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
                </div>
              </div>

              <div className="setting-group">
                <h3>Category Slots</h3>
                <div className="slot-list">
                  {algorithmConfig.slots.map((slot, index) => (
                    <div key={index} className="slot-item">
                      <span>
                        <strong>{slot.name}</strong>: {slot.types.join(", ")} (
                        {slot.item_type})
                      </span>
                      <span>
                        {slot.min_count}-{slot.max_count} items
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: "0.875rem", color: "#666" }}>
                  Slot configuration can be edited via API for advanced
                  customization.
                </p>
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
    </div>
  );
}

export default ConfigPage;
