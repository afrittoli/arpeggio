import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPracticeHistoryDetailed, getAlgorithmConfig } from "../api/client";
import type { PracticeHistoryDetailedItem, BpmUnit } from "../types";

type TimeRange = "week" | "month" | "6months" | "all" | "custom";
type SortField = "name" | "times_practiced" | "likelihood" | "last_practiced" | "bpm";
type SortDirection = "asc" | "desc";
type ItemType = "scale" | "arpeggio";
type AccidentalFilter = "natural" | "flat" | "sharp";
type PracticeFilter = "all" | "practiced" | "never";

const NOTES = ["A", "B", "C", "D", "E", "F", "G"];
const ALL_TYPES = [
  "major",
  "minor",
  "minor_harmonic",
  "minor_melodic",
  "diminished",
  "dominant",
  "chromatic",
];

// Get tint class for type chips
const getTypeTintClass = (type: string): string => {
  if (type === "chromatic") return "tint-chromatic";
  if (type === "diminished" || type === "dominant") return "tint-other";
  return "tint-tonal";
};

// Get row class based on item type and subtype
const getRowClass = (itemType: string, subtype: string): string => {
  if (subtype === "chromatic") return "chromatic";
  if (subtype === "diminished" || subtype === "dominant") return "other";
  return itemType; // "scale" or "arpeggio"
};

function getDateRange(range: TimeRange): { from?: string; to?: string } {
  if (range === "all") return {};

  const now = new Date();
  const to = now.toISOString().split("T")[0];

  let from: Date;
  switch (range) {
    case "week":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "6months":
      from = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    default:
      return {};
  }

  return { from: from.toISOString().split("T")[0], to };
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

/**
 * Convert BPM for display based on unit.
 */
function displayBpm(bpm: number, unit: BpmUnit): number {
  return unit === "crotchet" ? Math.round(bpm / 2) : bpm;
}

/**
 * Get the BPM notation symbol for a given unit.
 */
function getBpmSymbol(unit: BpmUnit): string {
  return unit === "crotchet" ? "\u2669" : "\u266A";
}

function HistoryPage() {
  // Filter state
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemType[]>([]);
  const [noteFilter, setNoteFilter] = useState<string[]>([]);
  const [accidentalFilter, setAccidentalFilter] = useState<AccidentalFilter[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [practiceFilter, setPracticeFilter] = useState<PracticeFilter>("all");
  const [focusOnlyFilter, setFocusOnlyFilter] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState<SortField>("likelihood");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Get algorithm config for BPM display units
  const { data: algorithmData } = useQuery({
    queryKey: ["algorithm-config"],
    queryFn: () => getAlgorithmConfig(),
  });
  const scaleBpmUnit: BpmUnit = algorithmData?.config?.scale_bpm_unit ?? "quaver";
  const arpeggiosBpmUnit: BpmUnit = algorithmData?.config?.arpeggio_bpm_unit ?? "quaver";

  // Calculate date range based on selection
  const dateParams = useMemo(() => {
    if (timeRange === "custom") {
      return {
        from_date: customFrom || undefined,
        to_date: customTo || undefined,
      };
    }
    const { from, to } = getDateRange(timeRange);
    return { from_date: from, to_date: to };
  }, [timeRange, customFrom, customTo]);

  // Fetch data - we'll do client-side filtering for most filters
  // Only send date range to the API
  const { data: history = [], isLoading, error } = useQuery({
    queryKey: ["practice-history-detailed", dateParams],
    queryFn: () => getPracticeHistoryDetailed(dateParams),
  });

  // Client-side filtering
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Item type filter
      if (itemTypeFilter.length > 0 && !itemTypeFilter.includes(item.item_type as ItemType)) {
        return false;
      }
      // Note filter
      if (noteFilter.length > 0 && !noteFilter.includes(item.note)) {
        return false;
      }
      // Accidental filter
      if (accidentalFilter.length > 0) {
        const itemAccidental = item.accidental || "natural";
        if (itemAccidental === null && !accidentalFilter.includes("natural")) return false;
        if (itemAccidental !== null && itemAccidental !== "natural" && !accidentalFilter.includes(itemAccidental as AccidentalFilter)) return false;
        if (itemAccidental === null && accidentalFilter.includes("natural")) { /* pass */ }
        else if (!accidentalFilter.includes(itemAccidental as AccidentalFilter)) return false;
      }
      // Type filter
      if (typeFilter.length > 0) {
        if (!typeFilter.includes(item.subtype)) {
          // Also check if "minor" is selected and item is minor variant
          if (typeFilter.includes("minor") && item.subtype.startsWith("minor")) {
            // pass
          } else {
            return false;
          }
        }
      }
      // Practice filter
      if (practiceFilter === "practiced" && item.times_practiced === 0) return false;
      if (practiceFilter === "never" && item.times_practiced > 0) return false;
      // Focus only filter
      if (focusOnlyFilter && !item.is_weekly_focus) return false;

      return true;
    });
  }, [history, itemTypeFilter, noteFilter, accidentalFilter, typeFilter, practiceFilter, focusOnlyFilter]);

  // Sort the filtered data
  const sortedHistory = useMemo(() => {
    const sorted = [...filteredHistory];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.display_name.localeCompare(b.display_name);
          break;
        case "times_practiced":
          comparison = a.times_practiced - b.times_practiced;
          break;
        case "likelihood":
          comparison = a.selection_likelihood - b.selection_likelihood;
          break;
        case "last_practiced":
          if (!a.last_practiced && !b.last_practiced) comparison = 0;
          else if (!a.last_practiced) comparison = -1;
          else if (!b.last_practiced) comparison = 1;
          else comparison = new Date(a.last_practiced).getTime() - new Date(b.last_practiced).getTime();
          break;
        case "bpm": {
          const aBpm = a.max_practiced_bpm ?? 0;
          const bBpm = b.max_practiced_bpm ?? 0;
          comparison = aBpm - bBpm;
          break;
        }
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [filteredHistory, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  // Toggle helper for multi-select arrays
  const toggleArrayItem = <T,>(arr: T[], item: T, setArr: (arr: T[]) => void) => {
    if (arr.includes(item)) {
      setArr(arr.filter((i) => i !== item));
    } else {
      setArr([...arr, item]);
    }
  };

  const handleChipClick = (callback: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    callback();
    e.currentTarget.blur();
  };

  const clearFilters = () => {
    setTimeRange("all");
    setCustomFrom("");
    setCustomTo("");
    setItemTypeFilter([]);
    setNoteFilter([]);
    setAccidentalFilter([]);
    setTypeFilter([]);
    setPracticeFilter("all");
    setFocusOnlyFilter(false);
  };

  const hasActiveFilters =
    timeRange !== "all" ||
    itemTypeFilter.length > 0 ||
    noteFilter.length > 0 ||
    accidentalFilter.length > 0 ||
    typeFilter.length > 0 ||
    practiceFilter !== "all" ||
    focusOnlyFilter;

  // Calculate max likelihood in current view for relative bar scaling
  const maxLikelihood = useMemo(() => {
    if (sortedHistory.length === 0) return 1;
    return Math.max(...sortedHistory.map((item) => item.selection_likelihood));
  }, [sortedHistory]);

  const renderBpmCell = (item: PracticeHistoryDetailedItem) => {
    const unit = item.item_type === "scale" ? scaleBpmUnit : arpeggiosBpmUnit;
    const symbol = getBpmSymbol(unit);

    if (item.max_practiced_bpm === null && item.target_bpm === null) {
      return <span className="bpm-na">-</span>;
    }

    const maxBpm = item.max_practiced_bpm !== null ? displayBpm(item.max_practiced_bpm, unit) : null;
    const targetBpm = item.target_bpm !== null ? displayBpm(item.target_bpm, unit) : null;

    if (maxBpm === null) {
      return (
        <span className="bpm-target-only" title={`Target: ${symbol}=${targetBpm}`}>
          {symbol}={targetBpm}
        </span>
      );
    }

    const atTarget = targetBpm !== null && maxBpm >= targetBpm;

    return (
      <span className={`bpm-value ${atTarget ? "at-target" : "below-target"}`} title={targetBpm ? `Target: ${symbol}=${targetBpm}` : undefined}>
        {symbol}={maxBpm}
        {targetBpm && !atTarget && <span className="bpm-target">/{targetBpm}</span>}
        {atTarget && <span className="bpm-check" title="At or above target">✓</span>}
      </span>
    );
  };

  if (isLoading) {
    return <div className="loading">Loading practice history...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>Error loading practice history</p>
        <code>{String(error)}</code>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h2>Practice History</h2>
        <span className="history-count">
          {sortedHistory.length} item{sortedHistory.length !== 1 ? "s" : ""}
          {hasActiveFilters && " (filtered)"}
        </span>
        {hasActiveFilters && (
          <button className="clear-filters-btn" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="history-filters">
        {/* Row 1: Time and Practice Status */}
        <div className="filter-row">
          <div className="filter-group">
            <label>Time:</label>
            <div className="chip-container">
              {[
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
                { value: "6months", label: "6 Mo" },
                { value: "all", label: "All" },
                { value: "custom", label: "Custom" },
              ].map((option) => (
                <button
                  key={option.value}
                  className={`chip ${timeRange === option.value ? "active" : ""}`}
                  onClick={handleChipClick(() => setTimeRange(option.value as TimeRange))}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {timeRange === "custom" && (
              <div className="custom-date-inputs">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  placeholder="From"
                />
                <span>to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  placeholder="To"
                />
              </div>
            )}
          </div>

          <div className="filter-group">
            <label>Status:</label>
            <div className="chip-container">
              <button
                className={`chip ${practiceFilter === "all" ? "active" : ""}`}
                onClick={handleChipClick(() => setPracticeFilter("all"))}
              >
                All
              </button>
              <button
                className={`chip ${practiceFilter === "practiced" ? "active" : ""}`}
                onClick={handleChipClick(() => setPracticeFilter("practiced"))}
              >
                Practiced
              </button>
              <button
                className={`chip ${practiceFilter === "never" ? "active" : ""}`}
                onClick={handleChipClick(() => setPracticeFilter("never"))}
              >
                Never
              </button>
            </div>
          </div>

          <div className="filter-group">
            <label>View:</label>
            <div className="chip-container">
              <button
                className={`chip ${focusOnlyFilter ? "active" : ""}`}
                onClick={handleChipClick(() => setFocusOnlyFilter(!focusOnlyFilter))}
              >
                Weekly focus
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Kind and Octaves */}
        <div className="filter-row">
          <div className="filter-group">
            <label>Kind:</label>
            <div className="chip-container">
              <button
                className={`chip tint-tonal ${itemTypeFilter.includes("scale") ? "active" : ""}`}
                onClick={handleChipClick(() => toggleArrayItem(itemTypeFilter, "scale", setItemTypeFilter))}
              >
                Scales
              </button>
              <button
                className={`chip tint-arpeggio ${itemTypeFilter.includes("arpeggio") ? "active" : ""}`}
                onClick={handleChipClick(() => toggleArrayItem(itemTypeFilter, "arpeggio", setItemTypeFilter))}
              >
                Arpeggios
              </button>
            </div>
          </div>
        </div>

        {/* Row 3: Note and Accidental */}
        <div className="filter-row">
          <div className="filter-group">
            <label>Note:</label>
            <div className="chip-container">
              {NOTES.map((note) => (
                <button
                  key={note}
                  className={`chip ${noteFilter.includes(note) ? "active" : ""}`}
                  onClick={handleChipClick(() => toggleArrayItem(noteFilter, note, setNoteFilter))}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label>Accidental:</label>
            <div className="chip-container">
              <button
                className={`chip ${accidentalFilter.includes("natural") ? "active" : ""}`}
                onClick={handleChipClick(() => toggleArrayItem(accidentalFilter, "natural", setAccidentalFilter))}
              >
                {"\u266E"}
              </button>
              <button
                className={`chip ${accidentalFilter.includes("flat") ? "active" : ""}`}
                onClick={handleChipClick(() => toggleArrayItem(accidentalFilter, "flat", setAccidentalFilter))}
              >
                {"\u266D"}
              </button>
              <button
                className={`chip ${accidentalFilter.includes("sharp") ? "active" : ""}`}
                onClick={handleChipClick(() => toggleArrayItem(accidentalFilter, "sharp", setAccidentalFilter))}
              >
                {"\u266F"}
              </button>
            </div>
          </div>
        </div>

        {/* Row 4: Type */}
        <div className="filter-row">
          <div className="filter-group filter-group-wide">
            <label>Type:</label>
            <div className="chip-container">
              {ALL_TYPES.map((type) => (
                <button
                  key={type}
                  className={`chip ${getTypeTintClass(type)} ${typeFilter.includes(type) ? "active" : ""}`}
                  onClick={handleChipClick(() => toggleArrayItem(typeFilter, type, setTypeFilter))}
                >
                  {type.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="likelihood-note">
        Likelihood shows base selection probability (bar scaled relative to max in view). Weekly focus items receive an additional boost during practice set generation.
      </p>

      {sortedHistory.length === 0 ? (
        <p className="no-data">
          {hasActiveFilters
            ? "No items match the current filters."
            : "No practice history found. Enable some scales and arpeggios in Config, then start practicing!"}
        </p>
      ) : (
        <div className="table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th
                  className={`sortable ${sortField === "name" ? "sorted" : ""}`}
                  onClick={() => handleSort("name")}
                >
                  <span className="th-content">
                    Name
                    <span className="sort-icon">
                      {sortField === "name" ? (sortDirection === "asc" ? "\u2191" : "\u2193") : "\u21C5"}
                    </span>
                  </span>
                </th>
                <th>Type</th>
                <th>Oct</th>
                <th
                  className={`sortable ${sortField === "times_practiced" ? "sorted" : ""}`}
                  onClick={() => handleSort("times_practiced")}
                >
                  <span className="th-content">
                    #
                    <span className="sort-icon">
                      {sortField === "times_practiced" ? (sortDirection === "asc" ? "\u2191" : "\u2193") : "\u21C5"}
                    </span>
                  </span>
                </th>
                <th
                  className={`sortable ${sortField === "last_practiced" ? "sorted" : ""}`}
                  onClick={() => handleSort("last_practiced")}
                >
                  <span className="th-content">
                    Last
                    <span className="sort-icon">
                      {sortField === "last_practiced" ? (sortDirection === "asc" ? "\u2191" : "\u2193") : "\u21C5"}
                    </span>
                  </span>
                </th>
                <th
                  className={`sortable ${sortField === "bpm" ? "sorted" : ""}`}
                  onClick={() => handleSort("bpm")}
                >
                  <span className="th-content">
                    BPM
                    <span className="sort-icon">
                      {sortField === "bpm" ? (sortDirection === "asc" ? "\u2191" : "\u2193") : "\u21C5"}
                    </span>
                  </span>
                </th>
                <th
                  className={`sortable ${sortField === "likelihood" ? "sorted" : ""}`}
                  onClick={() => handleSort("likelihood")}
                >
                  <span className="th-content">
                    Likelihood
                    <span className="sort-icon">
                      {sortField === "likelihood" ? (sortDirection === "asc" ? "\u2191" : "\u2193") : "\u21C5"}
                    </span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedHistory.map((item) => (
                <tr
                  key={`${item.item_type}-${item.item_id}`}
                  className={getRowClass(item.item_type, item.subtype)}
                >
                  <td className="name-cell">
                    <div className="name-cell-content">
                      {item.display_name}
                      {item.is_weekly_focus && (
                        <span className="weekly-focus-badge" title="Weekly Focus Item">
                          {"\u2605"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`item-type-indicator ${item.item_type}`}>
                      {item.item_type === "scale" ? "S" : "A"}
                    </span>
                  </td>
                  <td>{item.octaves}</td>
                  <td className={item.times_practiced === 0 ? "never-practiced" : ""}>
                    {item.times_practiced}
                  </td>
                  <td>
                    {item.last_practiced
                      ? formatRelativeDate(item.last_practiced)
                      : "Never"}
                  </td>
                  <td>{renderBpmCell(item)}</td>
                  <td>
                    <div className="likelihood-cell" title={`${(item.selection_likelihood * 100).toFixed(2)}% base probability`}>
                      <div
                        className="likelihood-bar"
                        style={{
                          width: `${maxLikelihood > 0 ? (item.selection_likelihood / maxLikelihood) * 100 : 0}%`,
                        }}
                      />
                      <span className={`likelihood-value ${maxLikelihood > 0 && item.selection_likelihood / maxLikelihood > 0.5 ? "on-dark" : ""}`}>
                        {(item.selection_likelihood * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
