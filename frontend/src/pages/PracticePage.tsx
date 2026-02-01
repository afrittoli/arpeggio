import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  generateSet,
  createPracticeSession,
  getPracticeHistory,
} from "../api/client";
import type { PracticeItem, PracticeEntryInput } from "../types";

interface PracticeState {
  slurred: boolean;
  separate: boolean;
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
    enabled: showHistory,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateSet(),
    onSuccess: (data) => {
      setPracticeItems(data.items);
      // Initialize practice state for each item
      const initialState: Record<string, PracticeState> = {};
      data.items.forEach((item) => {
        const key = `${item.type}-${item.id}`;
        initialState[key] = { slurred: false, separate: false };
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
    setPracticeState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [articulation]: !prev[key][articulation],
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
      const state = practiceState[key] || { slurred: false, separate: false };
      return {
        item_type: item.type,
        item_id: item.id,
        articulation: item.articulation,
        practiced_slurred: state.slurred,
        practiced_separate: state.separate,
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
              const state = practiceState[key] || { slurred: false, separate: false };
              const hasAnyPractice = state.slurred || state.separate;
              return (
                <div
                  key={key}
                  className={`practice-item ${item.type} ${hasAnyPractice ? "checked" : ""}`}
                >
                  <div className="practice-item-name">
                    {item.display_name}
                  </div>
                  <div className="practice-checkboxes">
                    <label className={`articulation-checkbox ${item.articulation === "slurred" ? "suggested" : ""} ${state.slurred ? "done" : ""}`}>
                      <input
                        type="checkbox"
                        checked={state.slurred}
                        onChange={() => togglePractice(item, "slurred")}
                      />
                      Slurred
                    </label>
                    <label className={`articulation-checkbox ${item.articulation === "separate" ? "suggested" : ""} ${state.separate ? "done" : ""}`}>
                      <input
                        type="checkbox"
                        checked={state.separate}
                        onChange={() => togglePractice(item, "separate")}
                      />
                      Separate
                    </label>
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
