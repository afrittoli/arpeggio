"""Tests for selection sets API routes."""

from models import Arpeggio, Scale, SelectionSet


def test_list_selection_sets_empty(client):
    """GET /api/selection-sets returns empty list when no sets exist."""
    response = client.get("/api/selection-sets")
    assert response.status_code == 200
    assert response.json() == []


def test_create_selection_set(client, db):
    """POST /api/selection-sets creates a new set from currently enabled items."""
    # Create some scales and arpeggios, some enabled
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    s2 = Scale(note="D", type="major", octaves=2, enabled=False)
    s3 = Scale(note="E", type="minor_harmonic", octaves=1, enabled=True)
    a1 = Arpeggio(note="C", type="major", octaves=2, enabled=True)
    a2 = Arpeggio(note="D", type="minor", octaves=2, enabled=False)
    db.add_all([s1, s2, s3, a1, a2])
    db.commit()
    db.refresh(s1)
    db.refresh(s3)
    db.refresh(a1)

    response = client.post("/api/selection-sets", json={"name": "My Practice Set"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "My Practice Set"
    assert sorted(data["scale_ids"]) == sorted([s1.id, s3.id])
    assert data["arpeggio_ids"] == [a1.id]
    assert data["is_active"] is False
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_selection_set_duplicate_name(client, db):
    """POST /api/selection-sets returns 409 when name already exists."""
    ss = SelectionSet(name="Existing Set", scale_ids=[], arpeggio_ids=[])
    db.add(ss)
    db.commit()

    response = client.post("/api/selection-sets", json={"name": "Existing Set"})
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_create_selection_set_empty_name(client):
    """POST /api/selection-sets returns 422 when name is empty."""
    response = client.post("/api/selection-sets", json={"name": ""})
    assert response.status_code == 422


def test_list_selection_sets(client, db):
    """GET /api/selection-sets lists all selection sets."""
    ss1 = SelectionSet(name="Set A", scale_ids=[1, 2], arpeggio_ids=[3])
    ss2 = SelectionSet(name="Set B", scale_ids=[4], arpeggio_ids=[], is_active=True)
    db.add_all([ss1, ss2])
    db.commit()

    response = client.get("/api/selection-sets")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    names = [s["name"] for s in data]
    assert "Set A" in names
    assert "Set B" in names


def test_update_selection_set_name(client, db):
    """PUT /api/selection-sets/{id} can update the name."""
    ss = SelectionSet(name="Old Name", scale_ids=[1], arpeggio_ids=[2])
    db.add(ss)
    db.commit()
    db.refresh(ss)

    response = client.put(f"/api/selection-sets/{ss.id}", json={"name": "New Name"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Name"
    assert data["scale_ids"] == [1]
    assert data["arpeggio_ids"] == [2]


def test_update_selection_set_selection(client, db):
    """PUT /api/selection-sets/{id} can update the scale/arpeggio IDs."""
    ss = SelectionSet(name="My Set", scale_ids=[1], arpeggio_ids=[2])
    db.add(ss)
    db.commit()
    db.refresh(ss)

    response = client.put(
        f"/api/selection-sets/{ss.id}",
        json={"scale_ids": [10, 20], "arpeggio_ids": [30]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scale_ids"] == [10, 20]
    assert data["arpeggio_ids"] == [30]


def test_update_selection_set_not_found(client):
    """PUT /api/selection-sets/{id} returns 404 for nonexistent set."""
    response = client.put("/api/selection-sets/999", json={"name": "X"})
    assert response.status_code == 404


def test_update_selection_set_duplicate_name(client, db):
    """PUT /api/selection-sets/{id} returns 409 when renaming to existing name."""
    ss1 = SelectionSet(name="Set A", scale_ids=[], arpeggio_ids=[])
    ss2 = SelectionSet(name="Set B", scale_ids=[], arpeggio_ids=[])
    db.add_all([ss1, ss2])
    db.commit()
    db.refresh(ss2)

    response = client.put(f"/api/selection-sets/{ss2.id}", json={"name": "Set A"})
    assert response.status_code == 409


def test_delete_selection_set(client, db):
    """DELETE /api/selection-sets/{id} removes the set."""
    ss = SelectionSet(name="To Delete", scale_ids=[], arpeggio_ids=[])
    db.add(ss)
    db.commit()
    db.refresh(ss)

    response = client.delete(f"/api/selection-sets/{ss.id}")
    assert response.status_code == 200
    assert response.json()["message"] == "Selection set deleted"

    # Verify it's gone
    response = client.get("/api/selection-sets")
    assert response.json() == []


def test_delete_selection_set_not_found(client):
    """DELETE /api/selection-sets/{id} returns 404 for nonexistent set."""
    response = client.delete("/api/selection-sets/999")
    assert response.status_code == 404


def test_load_selection_set(client, db):
    """POST /api/selection-sets/{id}/load enables its items and disables others."""
    # Create scales and arpeggios
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    s2 = Scale(note="D", type="major", octaves=2, enabled=True)
    s3 = Scale(note="E", type="minor_harmonic", octaves=1, enabled=False)
    a1 = Arpeggio(note="C", type="major", octaves=2, enabled=True)
    a2 = Arpeggio(note="D", type="minor", octaves=2, enabled=False)
    db.add_all([s1, s2, s3, a1, a2])
    db.commit()
    db.refresh(s1)
    db.refresh(s2)
    db.refresh(s3)
    db.refresh(a1)
    db.refresh(a2)

    # Create a selection set that only includes s2 and a2
    ss = SelectionSet(name="My Set", scale_ids=[s2.id], arpeggio_ids=[a2.id])
    db.add(ss)
    db.commit()
    db.refresh(ss)

    response = client.post(f"/api/selection-sets/{ss.id}/load")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Selection set loaded"
    assert data["scales_enabled"] == 1
    assert data["arpeggios_enabled"] == 1

    # Verify: s2 enabled, s1 and s3 disabled
    db.refresh(s1)
    db.refresh(s2)
    db.refresh(s3)
    assert s1.enabled is False
    assert s2.enabled is True
    assert s3.enabled is False

    # Verify: a2 enabled, a1 disabled
    db.refresh(a1)
    db.refresh(a2)
    assert a1.enabled is False
    assert a2.enabled is True

    # Verify: the set is now active
    db.refresh(ss)
    assert ss.is_active is True


def test_load_selection_set_deactivates_others(client, db):
    """Loading a set deactivates any previously active set."""
    ss1 = SelectionSet(name="Set A", scale_ids=[], arpeggio_ids=[], is_active=True)
    ss2 = SelectionSet(name="Set B", scale_ids=[], arpeggio_ids=[])
    db.add_all([ss1, ss2])
    db.commit()
    db.refresh(ss1)
    db.refresh(ss2)

    response = client.post(f"/api/selection-sets/{ss2.id}/load")
    assert response.status_code == 200

    db.refresh(ss1)
    db.refresh(ss2)
    assert ss1.is_active is False
    assert ss2.is_active is True


def test_load_selection_set_not_found(client):
    """POST /api/selection-sets/{id}/load returns 404 for nonexistent set."""
    response = client.post("/api/selection-sets/999/load")
    assert response.status_code == 404


def test_get_active_selection_set(client, db):
    """GET /api/selection-sets/active returns the currently active set."""
    ss1 = SelectionSet(name="Set A", scale_ids=[1], arpeggio_ids=[], is_active=False)
    ss2 = SelectionSet(name="Set B", scale_ids=[2], arpeggio_ids=[3], is_active=True)
    db.add_all([ss1, ss2])
    db.commit()

    response = client.get("/api/selection-sets/active")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Set B"
    assert data["is_active"] is True


def test_get_active_selection_set_none(client):
    """GET /api/selection-sets/active returns null when no set is active."""
    response = client.get("/api/selection-sets/active")
    assert response.status_code == 200
    assert response.json() is None


def test_update_selection_set_from_current(client, db):
    """PUT /api/selection-sets/{id} with update_from_current captures currently enabled items."""
    # Create some scales and arpeggios
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    s2 = Scale(note="D", type="major", octaves=2, enabled=False)
    a1 = Arpeggio(note="C", type="major", octaves=2, enabled=True)
    db.add_all([s1, s2, a1])
    db.commit()
    db.refresh(s1)
    db.refresh(a1)

    ss = SelectionSet(name="My Set", scale_ids=[], arpeggio_ids=[])
    db.add(ss)
    db.commit()
    db.refresh(ss)

    response = client.put(
        f"/api/selection-sets/{ss.id}",
        json={"update_from_current": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scale_ids"] == [s1.id]
    assert data["arpeggio_ids"] == [a1.id]


def test_practice_session_stores_selection_set_id(client, db):
    """Creating a practice session stores the active selection set ID."""
    # Create an active selection set
    ss = SelectionSet(name="Active Set", scale_ids=[1], arpeggio_ids=[], is_active=True)
    db.add(ss)
    db.commit()
    db.refresh(ss)

    # Create a scale for the practice entry
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    db.add(s1)
    db.commit()
    db.refresh(s1)

    response = client.post(
        "/api/practice-session",
        json={
            "entries": [
                {
                    "item_type": "scale",
                    "item_id": s1.id,
                    "was_practiced": True,
                    "practiced_slurred": True,
                    "practiced_separate": False,
                }
            ]
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["selection_set_id"] == ss.id


def test_practice_session_null_selection_set_id(client, db):
    """Practice session has null selection_set_id when no set is active."""
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    db.add(s1)
    db.commit()
    db.refresh(s1)

    response = client.post(
        "/api/practice-session",
        json={
            "entries": [
                {
                    "item_type": "scale",
                    "item_id": s1.id,
                    "was_practiced": True,
                    "practiced_slurred": True,
                    "practiced_separate": False,
                }
            ]
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["selection_set_id"] is None


def test_deactivate_selection_sets(client, db):
    """POST /api/selection-sets/deactivate deactivates all sets and disables all items."""
    # Create items and a set
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    a1 = Arpeggio(note="C", type="major", octaves=2, enabled=True)
    db.add_all([s1, a1])
    db.commit()

    # Create and load a set
    client.post("/api/selection-sets", json={"name": "Active Set"})
    sets = client.get("/api/selection-sets").json()
    client.post(f"/api/selection-sets/{sets[0]['id']}/load")

    # Verify set is active
    active = client.get("/api/selection-sets/active").json()
    assert active is not None
    assert active["is_active"] is True

    # Deactivate
    response = client.post("/api/selection-sets/deactivate")
    assert response.status_code == 200

    # Verify no active set
    active = client.get("/api/selection-sets/active").json()
    assert active is None

    # Verify all items disabled
    db.refresh(s1)
    db.refresh(a1)
    assert s1.enabled is False
    assert a1.enabled is False
