from models import Arpeggio, PracticeEntry, PracticeSession, Scale


def test_generate_practice_set_empty(client):
    # If no items enabled, it should return empty list or handle it
    # Currently services/selector.py handles it
    response = client.post("/api/generate-set")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []


def test_generate_practice_set_with_data(client, db):
    # Enable some items
    s1 = Scale(note="C", type="major", octaves=2, enabled=True, weight=1.0)
    a1 = Arpeggio(note="G", type="major", octaves=2, enabled=True, weight=1.0)
    db.add_all([s1, a1])
    db.commit()

    response = client.post("/api/generate-set")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) > 0
    # Check structure
    for item in data["items"]:
        assert "id" in item
        assert "type" in item
        assert "display_name" in item


def test_create_practice_session(client, db):
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    db.add(s1)
    db.commit()
    db.refresh(s1)

    payload = {
        "entries": [
            {
                "item_type": "scale",
                "item_id": s1.id,
                "articulation": "slurred",
                "was_practiced": True,
                "practiced_slurred": True,
                "practiced_separate": False,
                "practiced_bpm": 65,
                "target_bpm": 60,
                "matched_target_bpm": True,
            }
        ]
    }

    response = client.post("/api/practice-session", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["entries_count"] == 1
    assert data["practiced_count"] == 1

    # Verify in DB
    session = db.query(PracticeSession).first()
    assert session is not None
    assert len(session.entries) == 1
    assert session.entries[0].item_id == s1.id
    assert session.entries[0].practiced_bpm == 65


def test_get_practice_history(client, db):
    # Setup an enabled scale so it shows up in history
    s1 = Scale(note="C", type="major", octaves=2, enabled=True, target_bpm=60)
    db.add(s1)
    db.commit()
    db.refresh(s1)

    session = PracticeSession()
    db.add(session)
    db.flush()

    entry = PracticeEntry(
        session_id=session.id,
        item_type="scale",
        item_id=s1.id,
        was_practiced=True,
        practiced_bpm=70,
        created_at=session.created_at,
    )
    db.add(entry)
    db.commit()

    response = client.get("/api/practice-history")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    # Find our scale in history
    scale_history = next(
        (item for item in data if item["item_id"] == s1.id and item["item_type"] == "scale"), None
    )
    assert scale_history is not None
    assert scale_history["times_practiced"] == 1
    assert scale_history["max_practiced_bpm"] == 70
