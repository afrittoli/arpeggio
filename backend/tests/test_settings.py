from models import DEFAULT_ALGORITHM_CONFIG


def test_get_algorithm_config_default(client):
    response = client.get("/api/settings/algorithm")
    assert response.status_code == 200
    assert response.json()["config"] == DEFAULT_ALGORITHM_CONFIG


def test_update_algorithm_config(client):
    new_config = {"new_key": "new_value"}
    response = client.put("/api/settings/algorithm", json={"config": new_config})
    assert response.status_code == 200
    assert response.json()["config"] == new_config

    # Verify persistence
    response = client.get("/api/settings/algorithm")
    assert response.json()["config"] == new_config


def test_reset_algorithm_config(client):
    # First update to something else
    client.put("/api/settings/algorithm", json={"config": {"different": True}})

    # Then reset
    response = client.post("/api/settings/algorithm/reset")
    assert response.status_code == 200
    assert response.json()["config"] == DEFAULT_ALGORITHM_CONFIG
