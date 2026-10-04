"""Exercise failure propagation through HA's real storage write boundary."""

import asyncio
from pathlib import Path
from unittest.mock import patch

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util.file import WriteError
from homeassistant.util.json import SerializationError

from custom_components.scene_studio.store import SceneStudioStore


@pytest.mark.parametrize(
    "error", [WriteError("disk full"), SerializationError("bad JSON")]
)
@pytest.mark.parametrize("scoped", [False, True])
def test_actual_storage_failure_rolls_back_and_allows_retry(tmp_path, error, scoped):
    async def run():
        hass = HomeAssistant(str(tmp_path))
        store = SceneStudioStore(hass)
        store.scenes = {"room": {"id": "room", "scene_name": "Before"}}
        await store.async_save()
        disk = Path(store._store.path)  # pylint: disable=protected-access
        before = disk.read_bytes()
        completed = []
        with patch.object(
            store._store, "_async_write_data", wraps=store._store._async_write_data
        ):  # pylint: disable=protected-access
            boundary = (
                patch.object(store._store, "_write_prepared_data", side_effect=error)
                if isinstance(error, WriteError)
                else patch(
                    "homeassistant.helpers.storage.json_helper.prepare_save_json",
                    side_effect=error,
                )
            )
            with boundary, pytest.raises(HomeAssistantError, match="Could not persist"):
                await store._async_mutate(  # pylint: disable=protected-access
                    lambda: store.scenes["room"].update(scene_name="After"),
                    scope={"scenes": ["room"]} if scoped else None,
                )
                completed.append(True)
        assert not completed
        assert store.scenes["room"]["scene_name"] == "Before"
        assert disk.read_bytes() == before
        assert store._store._atomic_writes  # pylint: disable=protected-access
        await store._async_mutate(  # pylint: disable=protected-access
            lambda: store.scenes["room"].update(scene_name="Retry")
        )
        assert b"Retry" in disk.read_bytes()
        await hass.async_stop(force=True)

    asyncio.run(run())
