"""Palette cover URLs exposed on scene entities."""

from custom_components.scene_studio.const import KIND_CIRCADIAN, KIND_SIMPLE
from custom_components.scene_studio.palette import (
    gallery_cover_url,
    scene_palette_image_attributes,
)


def test_gallery_cover_url_is_a_stable_path():
    assert gallery_cover_url("reading") == "/api/scene_studio/gallery/reading.jpg"
    assert gallery_cover_url("not-a-palette") is None
    assert gallery_cover_url("../reading") is None
    assert gallery_cover_url(None) is None


def test_simple_scene_image_comes_from_its_palette():
    variables = {
        "pal": {"id": "pal", "kind": "palette", "builtin_id": "reading", "slots": []},
        "plain": {"id": "plain", "kind": "palette", "slots": [{"color_mode": "hs"}]},
    }
    assert scene_palette_image_attributes(
        {"kind": KIND_SIMPLE, "palette_id": "pal"}, variables, {}
    ) == {"palette_image": "/api/scene_studio/gallery/reading.jpg"}
    assert (
        scene_palette_image_attributes(
            {"kind": KIND_SIMPLE, "palette_id": "plain"}, variables, {}
        )
        == {}
    )


def test_circadian_scene_image_prefers_noon():
    variables = {
        "dawn_pal": {
            "id": "dawn_pal",
            "kind": "palette",
            "builtin_id": "desert-sunrise",
            "slots": [],
        },
        "noon_pal": {
            "id": "noon_pal",
            "kind": "palette",
            "builtin_id": "linen-noon",
            "slots": [],
        },
    }
    attrs = scene_palette_image_attributes(
        {
            "kind": KIND_CIRCADIAN,
            "theme_id": "day",
            "event_palettes": {
                "dawn": {"palette_id": "dawn_pal"},
                "noon": {"palette_id": "noon_pal"},
            },
        },
        variables,
        {},
    )
    assert attrs["palette_image"] == "/api/scene_studio/gallery/linen-noon.jpg"
    assert attrs["palette_images"] == {
        "dawn": "/api/scene_studio/gallery/desert-sunrise.jpg",
        "noon": "/api/scene_studio/gallery/linen-noon.jpg",
    }


def test_circadian_scene_falls_back_to_the_theme_palette():
    variables = {
        "noon_pal": {
            "id": "noon_pal",
            "kind": "palette",
            "builtin_id": "linen-noon",
            "slots": [],
        }
    }
    themes = {
        "day": {
            "id": "day",
            "events": {"noon": {"color": {"variable_ref": "noon_pal"}, "brightness": 200}},
        }
    }
    attrs = scene_palette_image_attributes(
        {"kind": KIND_CIRCADIAN, "theme_id": "day"},
        variables,
        themes,
    )
    assert attrs["palette_image"] == "/api/scene_studio/gallery/linen-noon.jpg"
    assert attrs["palette_images"] == {
        "noon": "/api/scene_studio/gallery/linen-noon.jpg",
    }
