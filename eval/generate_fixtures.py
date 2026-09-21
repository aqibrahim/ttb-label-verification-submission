"""
Generates a small set of synthetic alcohol label images for the eval
harness, plus a fixtures.json describing, for each one:
  - the "true" text actually rendered onto the image (ground truth for
    extraction accuracy)
  - a corresponding application record to compare it against
  - the verdict each field is expected to produce

These are plain programmatically-drawn images (a background, some text),
not photographs of real products or any existing label design - they
exist purely to exercise the pipeline against known-correct answers.

Usage:
    python3 generate_fixtures.py
"""

import json
import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
LABELS_DIR = os.path.join(OUT_DIR, "labels")
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

STANDARD_WARNING = (
    "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink "
    "alcoholic beverages during pregnancy because of the risk of birth defects. "
    "(2) Consumption of alcoholic beverages impairs your ability to drive a car or "
    "operate machinery, and may cause health problems."
)


def wrap_text(text, width_chars):
    import textwrap

    return "\n".join(textwrap.wrap(text, width_chars))


def draw_label(
    filename,
    brand,
    class_type,
    abv,
    net,
    warning_text,
    warning_bold=True,
    warning_all_caps=True,
    rotate=0,
):
    img = Image.new("RGB", (900, 650), color=(245, 240, 225))
    draw = ImageDraw.Draw(img)

    brand_font = ImageFont.truetype(FONT_BOLD, 46)
    body_font = ImageFont.truetype(FONT_REGULAR, 26)
    warning_font_bold = ImageFont.truetype(FONT_BOLD, 16)
    warning_font_regular = ImageFont.truetype(FONT_REGULAR, 16)

    y = 50
    draw.text((60, y), brand, font=brand_font, fill=(30, 20, 10))
    y += 80
    draw.text((60, y), class_type, font=body_font, fill=(40, 30, 20))
    y += 50
    draw.text((60, y), abv, font=body_font, fill=(40, 30, 20))
    y += 40
    draw.text((60, y), net, font=body_font, fill=(40, 30, 20))
    y += 60

    warning_font = warning_font_bold if warning_bold else warning_font_regular
    display_warning = warning_text if warning_all_caps else warning_text[0].upper() + warning_text[1:].lower().replace(
        "government warning", "Government Warning", 1
    )
    wrapped = wrap_text(display_warning, 90)
    draw.multiline_text((60, y), wrapped, font=warning_font, fill=(20, 20, 20), spacing=6)

    if rotate:
        img = img.rotate(rotate, expand=True, fillcolor=(245, 240, 225))

    os.makedirs(LABELS_DIR, exist_ok=True)
    path = os.path.join(LABELS_DIR, filename)
    img.save(path, quality=92)
    return path


def main():
    fixtures = []

    # 1. Perfect match - every field should pass
    draw_label(
        "01_perfect_match.jpg",
        "OLD TOM DISTILLERY",
        "Kentucky Straight Bourbon Whiskey",
        "45% Alc./Vol. (90 Proof)",
        "750 mL",
        STANDARD_WARNING,
    )
    fixtures.append({
        "id": "01_perfect_match",
        "image": "labels/01_perfect_match.jpg",
        "true_label_text": {
            "brand_name": "OLD TOM DISTILLERY",
            "class_type": "Kentucky Straight Bourbon Whiskey",
            "alcohol_content_raw": "45% Alc./Vol. (90 Proof)",
            "net_contents_raw": "750 mL",
            "government_warning_text": STANDARD_WARNING,
        },
        "application": {
            "brand": "Old Tom Distillery",
            "classType": "Kentucky Straight Bourbon Whiskey",
            "abv": "45%",
            "net": "750 mL",
            "warning": STANDARD_WARNING,
        },
        "expected_verdicts": {
            "Brand Name": "pass",
            "Class / Type": "pass",
            "Alcohol Content": "pass",
            "Net Contents": "pass",
            "Government Warning": "pass",
        },
        "notes": "Brand case differs from the label (Title Case vs ALL CAPS) but should still pass - this is the exact Dave's-feedback case.",
    })

    # 2. Genuine brand mismatch
    draw_label(
        "02_brand_mismatch.jpg",
        "YOUNG TOM DISTILLERY",
        "Kentucky Straight Bourbon Whiskey",
        "45% Alc./Vol.",
        "750 mL",
        STANDARD_WARNING,
    )
    fixtures.append({
        "id": "02_brand_mismatch",
        "image": "labels/02_brand_mismatch.jpg",
        "true_label_text": {
            "brand_name": "YOUNG TOM DISTILLERY",
            "class_type": "Kentucky Straight Bourbon Whiskey",
            "alcohol_content_raw": "45% Alc./Vol.",
            "net_contents_raw": "750 mL",
            "government_warning_text": STANDARD_WARNING,
        },
        "application": {
            "brand": "Old Tom Distillery",
            "classType": "Kentucky Straight Bourbon Whiskey",
            "abv": "45%",
            "net": "750 mL",
            "warning": STANDARD_WARNING,
        },
        "expected_verdicts": {
            "Brand Name": "fail",
            "Class / Type": "pass",
            "Alcohol Content": "pass",
            "Net Contents": "pass",
            "Government Warning": "pass",
        },
        "notes": "A genuine brand name mismatch, not just a casing difference.",
    })

    # 3. ABV mismatch
    draw_label(
        "03_abv_mismatch.jpg",
        "RIVERBEND DISTILLERY",
        "American Blended Whiskey",
        "40% Alc./Vol.",
        "750 mL",
        STANDARD_WARNING,
    )
    fixtures.append({
        "id": "03_abv_mismatch",
        "image": "labels/03_abv_mismatch.jpg",
        "true_label_text": {
            "brand_name": "RIVERBEND DISTILLERY",
            "class_type": "American Blended Whiskey",
            "alcohol_content_raw": "40% Alc./Vol.",
            "net_contents_raw": "750 mL",
            "government_warning_text": STANDARD_WARNING,
        },
        "application": {
            "brand": "Riverbend Distillery",
            "classType": "American Blended Whiskey",
            "abv": "45%",
            "net": "750 mL",
            "warning": STANDARD_WARNING,
        },
        "expected_verdicts": {
            "Brand Name": "pass",
            "Class / Type": "pass",
            "Alcohol Content": "fail",
            "Net Contents": "pass",
            "Government Warning": "pass",
        },
        "notes": "Application says 45%, label says 40% - a real compliance-relevant mismatch.",
    })

    # 4. Net contents unit difference (should still match numerically)
    draw_label(
        "04_net_contents_units.jpg",
        "HARBOR LIGHT DISTILLERS",
        "Vodka",
        "40% Alc./Vol.",
        "0.75 L",
        STANDARD_WARNING,
    )
    fixtures.append({
        "id": "04_net_contents_units",
        "image": "labels/04_net_contents_units.jpg",
        "true_label_text": {
            "brand_name": "HARBOR LIGHT DISTILLERS",
            "class_type": "Vodka",
            "alcohol_content_raw": "40% Alc./Vol.",
            "net_contents_raw": "0.75 L",
            "government_warning_text": STANDARD_WARNING,
        },
        "application": {
            "brand": "Harbor Light Distillers",
            "classType": "Vodka",
            "abv": "40%",
            "net": "750 mL",
            "warning": STANDARD_WARNING,
        },
        "expected_verdicts": {
            "Brand Name": "pass",
            "Class / Type": "pass",
            "Alcohol Content": "pass",
            "Net Contents": "pass",
            "Government Warning": "pass",
        },
        "notes": "Label uses 0.75 L, application uses 750 mL - should match via unit conversion.",
    })

    # 5. Government warning wording altered - must fail, no fuzzy matching
    altered_warning = STANDARD_WARNING.replace(
        "impairs your ability to drive a car or operate machinery",
        "may affect your ability to drive or operate machinery",
    )
    draw_label(
        "05_warning_wording_altered.jpg",
        "SILVER CREEK CELLARS",
        "Cabernet Sauvignon",
        "13.5% Alc./Vol.",
        "750 mL",
        altered_warning,
    )
    fixtures.append({
        "id": "05_warning_wording_altered",
        "image": "labels/05_warning_wording_altered.jpg",
        "true_label_text": {
            "brand_name": "SILVER CREEK CELLARS",
            "class_type": "Cabernet Sauvignon",
            "alcohol_content_raw": "13.5% Alc./Vol.",
            "net_contents_raw": "750 mL",
            "government_warning_text": altered_warning,
        },
        "application": {
            "brand": "Silver Creek Cellars",
            "classType": "Cabernet Sauvignon",
            "abv": "13.5%",
            "net": "750 mL",
            "warning": STANDARD_WARNING,
        },
        "expected_verdicts": {
            "Brand Name": "pass",
            "Class / Type": "pass",
            "Alcohol Content": "pass",
            "Net Contents": "pass",
            "Government Warning": "fail",
        },
        "notes": "Warning wording is softened/altered - must fail even though it's close, since no fuzzy matching is allowed on this field.",
    })

    # 6. Government warning header not all-caps - review, not auto-fail
    draw_label(
        "06_warning_header_not_caps.jpg",
        "SILVER CREEK CELLARS",
        "Cabernet Sauvignon",
        "13.5% Alc./Vol.",
        "750 mL",
        STANDARD_WARNING,
        warning_all_caps=False,
    )
    fixtures.append({
        "id": "06_warning_header_not_caps",
        "image": "labels/06_warning_header_not_caps.jpg",
        "true_label_text": {
            "brand_name": "SILVER CREEK CELLARS",
            "class_type": "Cabernet Sauvignon",
            "alcohol_content_raw": "13.5% Alc./Vol.",
            "net_contents_raw": "750 mL",
            "government_warning_text": STANDARD_WARNING,
        },
        "application": {
            "brand": "Silver Creek Cellars",
            "classType": "Cabernet Sauvignon",
            "abv": "13.5%",
            "net": "750 mL",
            "warning": STANDARD_WARNING,
        },
        "expected_verdicts": {
            "Brand Name": "pass",
            "Class / Type": "pass",
            "Alcohol Content": "pass",
            "Net Contents": "pass",
            "Government Warning": "review",
        },
        "notes": "Wording matches exactly but the header isn't rendered in all caps - expected to be flagged for review rather than an automatic fail.",
    })

    # 7. Class/type wording variant - review, not auto-pass/fail
    draw_label(
        "07_class_type_variant.jpg",
        "MAPLE HOLLOW BREWING",
        "India Pale Ale",
        "6.2% Alc./Vol.",
        "12 fl oz",
        STANDARD_WARNING,
    )
    fixtures.append({
        "id": "07_class_type_variant",
        "image": "labels/07_class_type_variant.jpg",
        "true_label_text": {
            "brand_name": "MAPLE HOLLOW BREWING",
            "class_type": "India Pale Ale",
            "alcohol_content_raw": "6.2% Alc./Vol.",
            "net_contents_raw": "12 fl oz",
            "government_warning_text": STANDARD_WARNING,
        },
        "application": {
            "brand": "Maple Hollow Brewing",
            "classType": "IPA",
            "abv": "6.2%",
            "net": "12 fl oz",
            "warning": STANDARD_WARNING,
        },
        "expected_verdicts": {
            "Brand Name": "pass",
            "Class / Type": "review",
            "Alcohol Content": "pass",
            "Net Contents": "pass",
            "Government Warning": "pass",
        },
        "notes": "Application says 'IPA', label spells out 'India Pale Ale' - a wording difference that should route to review rather than being auto-decided.",
    })

    # 8. Rotated/angled photo - tests robustness to non-ideal image capture
    draw_label(
        "08_rotated_photo.jpg",
        "PINE RIDGE MEADERY",
        "Traditional Mead",
        "12% Alc./Vol.",
        "750 mL",
        STANDARD_WARNING,
        rotate=8,
    )
    fixtures.append({
        "id": "08_rotated_photo",
        "image": "labels/08_rotated_photo.jpg",
        "true_label_text": {
            "brand_name": "PINE RIDGE MEADERY",
            "class_type": "Traditional Mead",
            "alcohol_content_raw": "12% Alc./Vol.",
            "net_contents_raw": "750 mL",
            "government_warning_text": STANDARD_WARNING,
        },
        "application": {
            "brand": "Pine Ridge Meadery",
            "classType": "Traditional Mead",
            "abv": "12%",
            "net": "750 mL",
            "warning": STANDARD_WARNING,
        },
        "expected_verdicts": {
            "Brand Name": "pass",
            "Class / Type": "pass",
            "Alcohol Content": "pass",
            "Net Contents": "pass",
            "Government Warning": "pass",
        },
        "notes": "Photo rotated 8 degrees, simulating an off-angle phone photo. Extraction should still succeed; this fixture is about robustness, not a designed failure.",
    })

    with open(os.path.join(OUT_DIR, "fixtures.json"), "w") as f:
        json.dump(fixtures, f, indent=2)

    print(f"Generated {len(fixtures)} fixtures in {LABELS_DIR}")


if __name__ == "__main__":
    main()
