"""Scene-card swatches scale chromatic RGB by each light's brightness."""

from custom_components.circadian_scenes.snapshots import swatch_rgb


def test_on_full_brightness_keeps_chroma():
    assert swatch_rgb(
        {"state": "on", "brightness": 255, "rgb_color": [200, 100, 40]}
    ) == [200, 100, 40]


def test_on_half_brightness_scales_channels():
    assert swatch_rgb(
        {"state": "on", "brightness": 128, "rgb_color": [200, 100, 40]}
    ) == [100, 50, 20]


def test_off_is_black_even_with_color():
    assert swatch_rgb(
        {"state": "off", "brightness": 255, "rgb_color": [200, 100, 40]}
    ) == [0, 0, 0]


def test_on_without_brightness_is_full():
    assert swatch_rgb({"state": "on", "rgb_color": [10, 20, 30]}) == [10, 20, 30]
