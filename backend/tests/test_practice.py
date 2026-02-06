from datetime import datetime, timedelta

from models import Arpeggio, PracticeEntry, PracticeSession, Scale, Setting


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


def test_get_practice_history_detailed_empty(client):
    """Test detailed history with no enabled items."""
    response = client.get("/api/practice-history-detailed")
    assert response.status_code == 200
    data = response.json()
    assert data == []


def test_get_practice_history_detailed_with_data(client, db):
    """Test detailed history returns all expected fields."""
    # Setup scales and arpeggios
    s1 = Scale(note="C", type="major", octaves=2, enabled=True, target_bpm=60, weight=1.0)
    s2 = Scale(note="A", accidental="flat", type="minor", octaves=2, enabled=True, weight=1.0)
    a1 = Arpeggio(note="G", type="major", octaves=2, enabled=True, target_bpm=72, weight=1.0)
    db.add_all([s1, s2, a1])
    db.commit()
    db.refresh(s1)
    db.refresh(s2)
    db.refresh(a1)

    # Add some practice entries
    session = PracticeSession()
    db.add(session)
    db.flush()

    entry = PracticeEntry(
        session_id=session.id,
        item_type="scale",
        item_id=s1.id,
        was_practiced=True,
        practiced_bpm=65,
    )
    db.add(entry)
    db.commit()

    response = client.get("/api/practice-history-detailed")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3  # 2 scales + 1 arpeggio

    # Find the C major scale
    c_major = next(
        (item for item in data if item["note"] == "C" and item["subtype"] == "major"), None
    )
    assert c_major is not None
    assert c_major["item_type"] == "scale"
    assert c_major["display_name"] == "C major - 2 octaves"
    assert c_major["octaves"] == 2
    assert c_major["times_practiced"] == 1
    assert c_major["max_practiced_bpm"] == 65
    assert c_major["target_bpm"] == 60
    assert "selection_likelihood" in c_major
    assert c_major["selection_likelihood"] > 0
    assert "is_weekly_focus" in c_major

    # Find the A flat minor scale
    a_minor = next(
        (item for item in data if item["note"] == "A" and item["accidental"] == "flat"), None
    )
    assert a_minor is not None
    assert a_minor["times_practiced"] == 0
    assert a_minor["max_practiced_bpm"] is None

    # Find the arpeggio
    g_arpeggio = next((item for item in data if item["item_type"] == "arpeggio"), None)
    assert g_arpeggio is not None
    assert g_arpeggio["note"] == "G"
    assert g_arpeggio["subtype"] == "major"


def test_get_practice_history_detailed_filter_by_item_type(client, db):
    """Test filtering by item_type."""
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    a1 = Arpeggio(note="G", type="major", octaves=2, enabled=True)
    db.add_all([s1, a1])
    db.commit()

    # Filter scales only
    response = client.get("/api/practice-history-detailed?item_type=scale")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["item_type"] == "scale"

    # Filter arpeggios only
    response = client.get("/api/practice-history-detailed?item_type=arpeggio")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["item_type"] == "arpeggio"


def test_get_practice_history_detailed_filter_by_subtype(client, db):
    """Test filtering by subtype."""
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    s2 = Scale(note="A", type="minor", octaves=2, enabled=True)
    db.add_all([s1, s2])
    db.commit()

    response = client.get("/api/practice-history-detailed?subtype=major")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["subtype"] == "major"


def test_get_practice_history_detailed_filter_by_note(client, db):
    """Test filtering by note."""
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    s2 = Scale(note="A", type="major", octaves=2, enabled=True)
    db.add_all([s1, s2])
    db.commit()

    response = client.get("/api/practice-history-detailed?note=C")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["note"] == "C"


def test_get_practice_history_detailed_filter_by_accidental(client, db):
    """Test filtering by accidental."""
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)  # natural
    s2 = Scale(note="B", accidental="flat", type="major", octaves=2, enabled=True)
    s3 = Scale(note="F", accidental="sharp", type="major", octaves=2, enabled=True)
    db.add_all([s1, s2, s3])
    db.commit()

    # Filter natural (no accidental)
    response = client.get("/api/practice-history-detailed?accidental=natural")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["note"] == "C"
    assert data[0]["accidental"] is None

    # Filter flat
    response = client.get("/api/practice-history-detailed?accidental=flat")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["accidental"] == "flat"


def test_get_practice_history_detailed_filter_by_date_range(client, db):
    """Test filtering by date range."""
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    db.add(s1)
    db.commit()
    db.refresh(s1)

    # Create sessions with different dates
    session1 = PracticeSession()
    db.add(session1)
    db.flush()

    # Old entry (10 days ago)
    old_date = datetime.utcnow() - timedelta(days=10)
    entry1 = PracticeEntry(
        session_id=session1.id,
        item_type="scale",
        item_id=s1.id,
        was_practiced=True,
        created_at=old_date,
    )
    db.add(entry1)

    # Recent entry (1 day ago)
    recent_date = datetime.utcnow() - timedelta(days=1)
    entry2 = PracticeEntry(
        session_id=session1.id,
        item_type="scale",
        item_id=s1.id,
        was_practiced=True,
        created_at=recent_date,
    )
    db.add(entry2)
    db.commit()

    # Get all history - should have 2 practice entries
    response = client.get("/api/practice-history-detailed")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["times_practiced"] == 2

    # Filter to last 5 days - should only count 1 entry
    from_date = (datetime.utcnow() - timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%S")
    response = client.get(f"/api/practice-history-detailed?from_date={from_date}")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["times_practiced"] == 1


def test_get_practice_history_detailed_weekly_focus(client, db):
    """Test that weekly focus items are marked correctly."""
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    s2 = Scale(note="A", type="minor", octaves=2, enabled=True)
    db.add_all([s1, s2])
    db.commit()

    # Enable weekly focus on "C" note
    setting = Setting(
        key="selection_algorithm",
        value={
            "weekly_focus": {
                "enabled": True,
                "keys": ["C"],
                "types": [],
                "categories": [],
            }
        },
    )
    db.add(setting)
    db.commit()

    response = client.get("/api/practice-history-detailed")
    assert response.status_code == 200
    data = response.json()

    c_scale = next((item for item in data if item["note"] == "C"), None)
    a_scale = next((item for item in data if item["note"] == "A"), None)

    assert c_scale["is_weekly_focus"] is True
    assert a_scale["is_weekly_focus"] is False
