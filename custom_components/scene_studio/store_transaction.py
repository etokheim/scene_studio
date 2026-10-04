"""Rollback snapshots for full-store and explicitly scoped mutations."""

from collections.abc import Iterable, Mapping
from copy import deepcopy
from typing import Any

_FIELDS = (
    "scenes",
    "area_names",
    "variables",
    "themes",
    "settings",
    "managed_native_scene_ids",
    "pending_hide_sync",
)
_MISSING = object()


class StoreSnapshot:
    """Copy only an operation's declared write set; full operations stay explicit."""

    def __init__(self, store: Any, scope: Mapping[str, Iterable[str] | None] | None):
        self.scope = dict(scope) if scope is not None else dict.fromkeys(_FIELDS)
        self.values = {}
        for field, keys in self.scope.items():
            if field not in _FIELDS:
                raise ValueError(f"Unknown transaction field: {field}")
            current = getattr(store, field)
            if keys is None:
                self.values[field] = deepcopy(current)
            else:
                self.values[field] = {
                    key: deepcopy(current[key]) if key in current else _MISSING
                    for key in keys
                }

    def unchanged(self, store: Any) -> bool:
        """Compare precisely the fields/items the operation is allowed to change."""
        for field, previous in self.values.items():
            current = getattr(store, field)
            if self.scope[field] is None:
                if current != previous:
                    return False
            elif any(
                current.get(key, _MISSING) != value for key, value in previous.items()
            ):
                return False
        return True

    def restore(self, store: Any) -> None:
        """Restore edits, inserts and deletes without replacing unrelated items."""
        for field, previous in self.values.items():
            if self.scope[field] is None:
                setattr(store, field, previous)
            else:
                current = getattr(store, field)
                for key, value in previous.items():
                    if value is _MISSING:
                        current.pop(key, None)
                    else:
                        current[key] = value
