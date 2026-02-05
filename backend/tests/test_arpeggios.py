from models import Arpeggio


def test_get_arpeggios_empty(client):
    response = client.get("/api/arpeggios")
    assert response.status_code == 200
    assert response.json() == []


def test_get_arpeggios_with_data(client, db):
    a1 = Arpeggio(note="C", type="major", octaves=2, enabled=True)
    a2 = Arpeggio(note="D", type="major", octaves=2, enabled=False)
    db.add_all([a1, a2])
    db.commit()

    response = client.get("/api/arpeggios")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    # Test filtering
    response = client.get("/api/arpeggios?enabled=true")
    assert len(response.json()) == 1
    assert response.json()[0]["note"] == "C"


def test_update_arpeggio(client, db):
    a1 = Arpeggio(note="C", type="major", octaves=2, enabled=True)
    db.add(a1)
    db.commit()
    db.refresh(a1)

    response = client.put(f"/api/arpeggios/{a1.id}", json={"enabled": False, "target_bpm": 80})
    assert response.status_code == 200
    assert response.json()["enabled"] is False
    assert response.json()["target_bpm"] == 80

    # Verify in DB
    db.refresh(a1)
    assert a1.enabled is False
    assert a1.target_bpm == 80


def test_bulk_enable_arpeggios(client, db):
    a1 = Arpeggio(note="C", type="major", octaves=2, enabled=False)
    a2 = Arpeggio(note="D", type="major", octaves=2, enabled=False)
    db.add_all([a1, a2])
    db.commit()
    db.refresh(a1)
    db.refresh(a2)

    response = client.post(
        "/api/arpeggios/bulk-enable", json={"ids": [a1.id, a2.id], "enabled": True}
    )
    assert response.status_code == 200
    assert response.json()["updated"] == 2

    db.refresh(a1)
    db.refresh(a2)
    assert a1.enabled is True
    assert a2.enabled is True
