"""Tests for selection sets functionality."""

import pytest

from models import Arpeggio, PracticeEntry, PracticeSession, Scale, SelectionSet


class TestSelectionSetModel:
    """Test the SelectionSet model."""

    def test_create_selection_set(self, db):
        """Test creating a basic selection set."""
        selection_set = SelectionSet(
            name="Test Set",
            scale_ids=[1, 2, 3],
            arpeggio_ids=[4, 5],
        )
        db.add(selection_set)
        db.commit()
        db.refresh(selection_set)

        assert selection_set.id is not None
        assert selection_set.name == "Test Set"
        assert selection_set.scale_ids == [1, 2, 3]
        assert selection_set.arpeggio_ids == [4, 5]
        assert selection_set.is_active is False
        assert selection_set.created_at is not None
        assert selection_set.updated_at is not None

    def test_selection_set_unique_name(self, db):
        """Test that selection set names must be unique."""
        set1 = SelectionSet(name="Unique Name", scale_ids=[], arpeggio_ids=[])
        db.add(set1)
        db.commit()

        set2 = SelectionSet(name="Unique Name", scale_ids=[], arpeggio_ids=[])
        db.add(set2)
        with pytest.raises(Exception):
            db.commit()

    def test_selection_set_empty_ids(self, db):
        """Test creating a selection set with empty ID lists."""
        selection_set = SelectionSet(
            name="Empty Set",
            scale_ids=[],
            arpeggio_ids=[],
        )
        db.add(selection_set)
        db.commit()
        db.refresh(selection_set)

        assert selection_set.scale_ids == []
        assert selection_set.arpeggio_ids == []


class TestSelectionSetRoutes:
    """Test selection set API routes."""

    def test_get_selection_sets_empty(self, client):
        """Test getting selection sets when none exist."""
        response = client.get("/api/selection-sets")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_selection_set(self, client, db):
        """Test creating a selection set via API."""
        # Create some scales and arpeggios first
        s1 = Scale(note="C", type="major", octaves=2, enabled=True)
        s2 = Scale(note="D", type="minor_harmonic", octaves=2, enabled=True)
        a1 = Arpeggio(note="G", type="major", octaves=2, enabled=True)
        db.add_all([s1, s2, a1])
        db.commit()
        db.refresh(s1)
        db.refresh(s2)
        db.refresh(a1)

        payload = {
            "name": "My Practice Set",
            "scale_ids": [s1.id, s2.id],
            "arpeggio_ids": [a1.id],
        }
        response = client.post("/api/selection-sets", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "My Practice Set"
        assert data["scale_ids"] == [s1.id, s2.id]
        assert data["arpeggio_ids"] == [a1.id]
        assert data["is_active"] is False
        assert "id" in data

    def test_create_selection_set_duplicate_name(self, client, db):
        """Test that creating a set with duplicate name fails."""
        payload = {"name": "Duplicate", "scale_ids": [], "arpeggio_ids": []}
        response1 = client.post("/api/selection-sets", json=payload)
        assert response1.status_code == 200

        response2 = client.post("/api/selection-sets", json=payload)
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"]

    def test_get_selection_sets(self, client, db):
        """Test getting all selection sets."""
        set1 = SelectionSet(name="Set 1", scale_ids=[1], arpeggio_ids=[])
        set2 = SelectionSet(name="Set 2", scale_ids=[], arpeggio_ids=[2])
        db.add_all([set1, set2])
        db.commit()

        response = client.get("/api/selection-sets")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        names = [s["name"] for s in data]
        assert "Set 1" in names
        assert "Set 2" in names

    def test_get_selection_set_by_id(self, client, db):
        """Test getting a specific selection set."""
        selection_set = SelectionSet(
            name="Specific Set",
            scale_ids=[1, 2],
            arpeggio_ids=[3],
        )
        db.add(selection_set)
        db.commit()
        db.refresh(selection_set)

        response = client.get(f"/api/selection-sets/{selection_set.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Specific Set"
        assert data["scale_ids"] == [1, 2]
        assert data["arpeggio_ids"] == [3]

    def test_get_selection_set_not_found(self, client):
        """Test getting a non-existent selection set."""
        response = client.get("/api/selection-sets/9999")
        assert response.status_code == 404

    def test_update_selection_set(self, client, db):
        """Test updating a selection set."""
        selection_set = SelectionSet(
            name="Original Name",
            scale_ids=[1],
            arpeggio_ids=[2],
        )
        db.add(selection_set)
        db.commit()
        db.refresh(selection_set)

        payload = {
            "name": "Updated Name",
            "scale_ids": [3, 4],
            "arpeggio_ids": [5, 6],
        }
        response = client.put(
            f"/api/selection-sets/{selection_set.id}",
            json=payload,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["scale_ids"] == [3, 4]
        assert data["arpeggio_ids"] == [5, 6]

    def test_update_selection_set_not_found(self, client):
        """Test updating a non-existent selection set."""
        payload = {"name": "New Name", "scale_ids": [], "arpeggio_ids": []}
        response = client.put("/api/selection-sets/9999", json=payload)
        assert response.status_code == 404

    def test_delete_selection_set(self, client, db):
        """Test deleting a selection set."""
        selection_set = SelectionSet(
            name="To Delete",
            scale_ids=[],
            arpeggio_ids=[],
        )
        db.add(selection_set)
        db.commit()
        db.refresh(selection_set)

        response = client.delete(f"/api/selection-sets/{selection_set.id}")
        assert response.status_code == 200

        # Verify it's deleted
        response = client.get(f"/api/selection-sets/{selection_set.id}")
        assert response.status_code == 404

    def test_delete_selection_set_not_found(self, client):
        """Test deleting a non-existent selection set."""
        response = client.delete("/api/selection-sets/9999")
        assert response.status_code == 404


class TestLoadSelectionSet:
    """Test loading a selection set."""

    def test_load_selection_set(self, client, db):
        """Test loading a selection set enables items and sets active."""
        # Create scales and arpeggios
        s1 = Scale(note="C", type="major", octaves=2, enabled=False)
        s2 = Scale(note="D", type="minor_harmonic", octaves=2, enabled=True)
        s3 = Scale(note="E", type="chromatic", octaves=2, enabled=True)
        a1 = Arpeggio(note="G", type="major", octaves=2, enabled=False)
        a2 = Arpeggio(note="A", type="minor", octaves=2, enabled=True)
        db.add_all([s1, s2, s3, a1, a2])
        db.commit()
        db.refresh(s1)
        db.refresh(s2)
        db.refresh(s3)
        db.refresh(a1)
        db.refresh(a2)

        # Create selection set with only s1, s2, a1
        selection_set = SelectionSet(
            name="Load Test",
            scale_ids=[s1.id, s2.id],
            arpeggio_ids=[a1.id],
        )
        db.add(selection_set)
        db.commit()
        db.refresh(selection_set)

        # Load the selection set
        response = client.post(f"/api/selection-sets/{selection_set.id}/load")
        assert response.status_code == 200
        data = response.json()
        assert data["scales_enabled"] == 2
        assert data["arpeggios_enabled"] == 1
        assert data["scales_disabled"] == 1  # s3
        assert data["arpeggios_disabled"] == 1  # a2

        # Verify in DB
        db.refresh(s1)
        db.refresh(s2)
        db.refresh(s3)
        db.refresh(a1)
        db.refresh(a2)

        assert s1.enabled is True
        assert s2.enabled is True
        assert s3.enabled is False
        assert a1.enabled is True
        assert a2.enabled is False

        # Verify selection set is active
        db.refresh(selection_set)
        assert selection_set.is_active is True

    def test_load_selection_set_deactivates_others(self, client, db):
        """Test that loading a set deactivates other active sets."""
        set1 = SelectionSet(
            name="Set 1",
            scale_ids=[],
            arpeggio_ids=[],
            is_active=True,
        )
        set2 = SelectionSet(
            name="Set 2",
            scale_ids=[],
            arpeggio_ids=[],
            is_active=False,
        )
        db.add_all([set1, set2])
        db.commit()
        db.refresh(set1)
        db.refresh(set2)

        # Load set2
        response = client.post(f"/api/selection-sets/{set2.id}/load")
        assert response.status_code == 200

        # Verify set1 is no longer active, set2 is active
        db.refresh(set1)
        db.refresh(set2)
        assert set1.is_active is False
        assert set2.is_active is True

    def test_load_selection_set_not_found(self, client):
        """Test loading a non-existent selection set."""
        response = client.post("/api/selection-sets/9999/load")
        assert response.status_code == 404


class TestActiveSelectionSet:
    """Test active selection set functionality."""

    def test_get_active_selection_set(self, client, db):
        """Test getting the active selection set."""
        set1 = SelectionSet(
            name="Active Set",
            scale_ids=[1, 2],
            arpeggio_ids=[3],
            is_active=True,
        )
        db.add(set1)
        db.commit()

        response = client.get("/api/selection-sets/active")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Active Set"
        assert data["is_active"] is True

    def test_get_active_selection_set_none(self, client, db):
        """Test getting active set when none is active."""
        set1 = SelectionSet(
            name="Inactive Set",
            scale_ids=[],
            arpeggio_ids=[],
            is_active=False,
        )
        db.add(set1)
        db.commit()

        response = client.get("/api/selection-sets/active")
        assert response.status_code == 200
        assert response.json() is None

    def test_deactivate_all_selection_sets(self, client, db):
        """Test deactivating all selection sets."""
        set1 = SelectionSet(
            name="Set 1",
            scale_ids=[],
            arpeggio_ids=[],
            is_active=True,
        )
        set2 = SelectionSet(
            name="Set 2",
            scale_ids=[],
            arpeggio_ids=[],
            is_active=True,
        )
        db.add_all([set1, set2])
        db.commit()
        db.refresh(set1)
        db.refresh(set2)

        response = client.post("/api/selection-sets/deactivate")
        assert response.status_code == 200
        data = response.json()
        assert data["deactivated_count"] == 2

        # Verify in DB
        db.refresh(set1)
        db.refresh(set2)
        assert set1.is_active is False
        assert set2.is_active is False


class TestPracticeSessionWithSelectionSet:
    """Test practice session integration with selection sets."""

    def test_practice_session_tracks_active_selection_set(self, client, db):
        """Test that practice sessions track the active selection set."""
        # Create scale and selection set
        s1 = Scale(note="C", type="major", octaves=2, enabled=True)
        db.add(s1)
        db.commit()
        db.refresh(s1)

        selection_set = SelectionSet(
            name="Active Set",
            scale_ids=[s1.id],
            arpeggio_ids=[],
            is_active=True,
        )
        db.add(selection_set)
        db.commit()
        db.refresh(selection_set)

        # Create practice session
        payload = {
            "entries": [
                {
                    "item_type": "scale",
                    "item_id": s1.id,
                    "articulation": "slurred",
                    "was_practiced": True,
                    "practiced_slurred": True,
                    "practiced_separate": False,
                }
            ]
        }
        response = client.post("/api/practice-session", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["selection_set_id"] == selection_set.id

        # Verify in DB
        session = db.query(PracticeSession).first()
        assert session.selection_set_id == selection_set.id

    def test_practice_session_no_active_selection_set(self, client, db):
        """Test practice session when no selection set is active."""
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
                }
            ]
        }
        response = client.post("/api/practice-session", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["selection_set_id"] is None


class TestPracticeHistoryWithSelectionSet:
    """Test practice history filtering by selection set."""

    def test_filter_practice_history_by_selection_set(self, client, db):
        """Test filtering practice history by selection set ID."""
        # Create scales
        s1 = Scale(note="C", type="major", octaves=2, enabled=True, target_bpm=60)
        s2 = Scale(note="D", type="minor_harmonic", octaves=2, enabled=True, target_bpm=60)
        db.add_all([s1, s2])
        db.commit()
        db.refresh(s1)
        db.refresh(s2)

        # Create selection sets
        set1 = SelectionSet(
            name="Set 1",
            scale_ids=[s1.id],
            arpeggio_ids=[],
        )
        set2 = SelectionSet(
            name="Set 2",
            scale_ids=[s2.id],
            arpeggio_ids=[],
        )
        db.add_all([set1, set2])
        db.commit()
        db.refresh(set1)
        db.refresh(set2)

        # Create practice sessions with different selection sets
        session1 = PracticeSession(selection_set_id=set1.id)
        session2 = PracticeSession(selection_set_id=set2.id)
        db.add_all([session1, session2])
        db.flush()

        entry1 = PracticeEntry(
            session_id=session1.id,
            item_type="scale",
            item_id=s1.id,
            was_practiced=True,
        )
        entry2 = PracticeEntry(
            session_id=session2.id,
            item_type="scale",
            item_id=s2.id,
            was_practiced=True,
        )
        db.add_all([entry1, entry2])
        db.commit()

        # Filter by set1
        response = client.get(f"/api/practice-history?selection_set_id={set1.id}")
        assert response.status_code == 200
        data = response.json()
        # Should only contain s1 (from set1 sessions)
        item_ids = [item["item_id"] for item in data if item["item_type"] == "scale"]
        assert s1.id in item_ids
        # s2 should only appear if it has practices outside set1 (it doesn't here)

    def test_practice_history_no_filter(self, client, db):
        """Test practice history without selection set filter returns all."""
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
        )
        db.add(entry)
        db.commit()

        response = client.get("/api/practice-history")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
