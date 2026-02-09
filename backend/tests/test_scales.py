from models import Scale


def test_get_scales_empty(client):
    response = client.get("/api/scales")
    assert response.status_code == 200
    assert response.json() == []


def test_get_scales_with_data(client, db):
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    s2 = Scale(note="D", type="major", octaves=2, enabled=False)
    db.add_all([s1, s2])
    db.commit()

    response = client.get("/api/scales")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    # Test filtering
    response = client.get("/api/scales?enabled=true")
    assert len(response.json()) == 1
    assert response.json()[0]["note"] == "C"


def test_update_scale(client, db):
    s1 = Scale(note="C", type="major", octaves=2, enabled=True)
    db.add(s1)
    db.commit()
    db.refresh(s1)

    response = client.put(f"/api/scales/{s1.id}", json={"enabled": False, "target_bpm": 80})
    assert response.status_code == 200
    assert response.json()["enabled"] is False
    assert response.json()["target_bpm"] == 80

    # Verify in DB
    db.refresh(s1)
    assert s1.enabled is False
    assert s1.target_bpm == 80

    # Test clearing target_bpm by setting to 0
    response = client.put(f"/api/scales/{s1.id}", json={"target_bpm": 0})
    assert response.status_code == 200
    assert response.json()["target_bpm"] is None

    db.refresh(s1)
    assert s1.target_bpm is None


def test_bulk_enable_scales(client, db):
    s1 = Scale(note="C", type="major", octaves=2, enabled=False)
    s2 = Scale(note="D", type="major", octaves=2, enabled=False)
    db.add_all([s1, s2])
    db.commit()
    db.refresh(s1)
    db.refresh(s2)

    response = client.post("/api/scales/bulk-enable", json={"ids": [s1.id, s2.id], "enabled": True})
    assert response.status_code == 200
    assert response.json()["updated"] == 2

    db.refresh(s1)
    db.refresh(s2)
    assert s1.enabled is True
    assert s2.enabled is True
