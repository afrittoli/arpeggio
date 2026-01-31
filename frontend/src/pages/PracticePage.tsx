import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  generateSet,
  createPracticeSession,
  getPracticeHistory,
} from "../api/client";
import type { PracticeItem, PracticeEntryInput } from "../types";

function PracticePage() {
  const [practiceItems, setPracticeItems] = useState<PracticeItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: history = [] } = useQuery({
    queryKey: ["practice-history"],
    queryFn: () => getPracticeHistory(),
    enabled: showHistory,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateSet(),
    onSuccess: (data) => {
      setPracticeItems(data.items);
      setCheckedItems(new Set());
      setSubmitted(false);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (entries: PracticeEntryInput[]) => createPracticeSession(entries),
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const toggleItem = (item: PracticeItem) => {
    const key = `${item.type}-${item.id}`;
    const newChecked = new Set(checkedItems);
    if (newChecked.has(key)) {
      newChecked.delete(key);
    } else {
      newChecked.add(key);
    }
    setCheckedItems(newChecked);
  };

  const handleSubmit = () => {
    const entries: PracticeEntryInput[] = practiceItems.map((item) => ({
      item_type: item.type,
      item_id: item.id,
      was_practiced: checkedItems.has(`${item.type}-${item.id}`),
    }));
    submitMutation.mutate(entries);
  };

  const enabledCount = practiceItems.length;
  const hasItems = enabledCount > 0;

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
          <div className="practice-list">
            {practiceItems.map((item) => {
              const key = `${item.type}-${item.id}`;
              const isChecked = checkedItems.has(key);
              return (
                <div
                  key={key}
                  className={`practice-item ${item.type} ${isChecked ? "checked" : ""}`}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleItem(item)}
                    />
                    {item.display_name}
                  </label>
                </div>
              );
            })}
          </div>

          <div className="submit-section">
            <button
              className="submit-btn primary"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Saving..." : "Save Practice Session"}
            </button>
          </div>
        </>
      )}

      {submitted && (
        <div className="success-message">
          <p>
            Practice session saved! You practiced {checkedItems.size} out of{" "}
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
