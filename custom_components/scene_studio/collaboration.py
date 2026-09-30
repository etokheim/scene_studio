"""Canonical revisions and field-wise three-way merges for shared editors."""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from typing import Any

_MISSING = object()
_ATOMIC_FIELDS = {"color", "membership", "slots", "labels", "include", "exclude"}


class RevisionConflict(Exception):
    """An item changed in the same fields since the editor's base snapshot."""

    def __init__(self, fields: list[str], current: Any, revision: str) -> None:
        super().__init__("Conflicting fields: " + ", ".join(fields))
        self.fields = fields
        self.current = current
        self.revision = revision


class ItemDeleted(Exception):
    """The editor is trying to update an item removed by another editor."""


def revision_for(value: Any) -> str:
    """Return a stable token for a JSON-safe editor snapshot."""
    serialized = json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def merge_fields(base: Any, local: Any, saved: Any) -> tuple[Any, list[str]]:
    """Merge independent edits; return field paths that both editors changed."""
    conflicts: list[str] = []

    def merge(before: Any, mine: Any, theirs: Any, path: tuple[str, ...]) -> Any:
        if mine == before:
            return deepcopy(theirs) if theirs is not _MISSING else _MISSING
        if theirs in (before, mine):
            return deepcopy(mine) if mine is not _MISSING else _MISSING
        can_descend = isinstance(mine, dict) and isinstance(theirs, dict)
        can_descend = can_descend and (isinstance(before, dict) or before is _MISSING)
        if can_descend and (not path or path[-1] not in _ATOMIC_FIELDS):
            before = {} if before is _MISSING else before
            result = {}
            for key in before.keys() | mine.keys() | theirs.keys():
                value = merge(
                    before.get(key, _MISSING),
                    mine.get(key, _MISSING),
                    theirs.get(key, _MISSING),
                    (*path, key),
                )
                if value is not _MISSING:
                    result[key] = value
            return result
        conflicts.append(".".join(path) or "item")
        return deepcopy(mine) if mine is not _MISSING else _MISSING

    result = merge(base, local, saved, ())
    return result, sorted(conflicts)
