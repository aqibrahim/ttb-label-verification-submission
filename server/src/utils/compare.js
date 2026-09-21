// Field comparison logic for label verification.
// Kept separate from the HTTP layer and the model client so it can be
// unit tested in isolation and reused by any caller.

export function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeWarning(s) {
  // Collapse whitespace only - case is preserved because the warning
  // statement must match the required wording exactly, including the
  // all-caps header.
  return (s || "").replace(/\s+/g, " ").trim();
}

export function parseVolumeToMl(s) {
  if (!s) return null;
  const str = String(s).toLowerCase();
  let m = str.match(/([\d.]+)\s*ml/);
  if (m) return parseFloat(m[1]);
  m = str.match(/([\d.]+)\s*(l|liter|litre)\b/);
  if (m) return parseFloat(m[1]) * 1000;
  m = str.match(/([\d.]+)\s*(fl\.?\s*oz|fluid ounce)/);
  if (m) return parseFloat(m[1]) * 29.5735;
  return null;
}

export function parsePercent(s) {
  if (!s) return null;
  const m = String(s).match(/([\d.]+)\s*%/);
  if (m) return parseFloat(m[1]);
  return null;
}

function mkRow(status, name, appliedVal, labelVal, note) {
  return { status, name, appliedVal: appliedVal ?? "", labelVal: labelVal ?? "", note: note || "" };
}

/**
 * Compares an application record against fields extracted from a label
 * image and returns a per-field verdict plus an overall verdict.
 *
 * @param {object} applied  { brand, classType, abv, net, warning }
 * @param {object} extracted  fields returned by the label-reading service
 * @returns {{ rows: Array, overall: "pass"|"review"|"fail" }}
 */
export function compareFields(applied = {}, extracted = {}) {
  const rows = [];
  let hasFail = false;
  let hasReview = false;

  // Brand name
  {
    const a = applied.brand;
    const e = extracted.brand_name;
    if (!e) {
      rows.push(mkRow("fail", "Brand Name", a, "Not detected on label", "Image unclear or field missing"));
      hasFail = true;
    } else if (normalizeText(a) === normalizeText(e)) {
      const exact = (a || "").trim() === (e || "").trim();
      rows.push(mkRow("pass", "Brand Name", a, e, exact ? "" : "Matches (case/formatting differs)"));
    } else {
      rows.push(mkRow("fail", "Brand Name", a, e, "Does not match application"));
      hasFail = true;
    }
  }

  // Class / Type
  {
    const a = applied.classType;
    const e = extracted.class_type;
    if (!e) {
      rows.push(mkRow("fail", "Class / Type", a, "Not detected on label", "Image unclear or field missing"));
      hasFail = true;
    } else if (normalizeText(a) === normalizeText(e)) {
      const exact = (a || "").trim() === (e || "").trim();
      rows.push(mkRow("pass", "Class / Type", a, e, exact ? "" : "Matches (case/formatting differs)"));
    } else {
      rows.push(mkRow("review", "Class / Type", a, e, "Wording differs - confirm designation is equivalent"));
      hasReview = true;
    }
  }

  // Alcohol content
  {
    const a = applied.abv;
    const e = extracted.alcohol_content_raw;
    const an = parsePercent(a);
    const en = parsePercent(e);
    if (!e) {
      rows.push(mkRow("fail", "Alcohol Content", a, "Not detected on label", "Image unclear or field missing"));
      hasFail = true;
    } else if (an != null && en != null && Math.abs(an - en) < 0.15) {
      rows.push(mkRow("pass", "Alcohol Content", a, e, ""));
    } else if (an != null && en != null) {
      rows.push(mkRow("fail", "Alcohol Content", a, e, "Percentage does not match application"));
      hasFail = true;
    } else {
      rows.push(mkRow("review", "Alcohol Content", a, e, "Could not parse a percentage to compare numerically"));
      hasReview = true;
    }
  }

  // Net contents
  {
    const a = applied.net;
    const e = extracted.net_contents_raw;
    const aMl = parseVolumeToMl(a);
    const eMl = parseVolumeToMl(e);
    if (!e) {
      rows.push(mkRow("fail", "Net Contents", a, "Not detected on label", "Image unclear or field missing"));
      hasFail = true;
    } else if (aMl != null && eMl != null && Math.abs(aMl - eMl) < 1) {
      rows.push(mkRow("pass", "Net Contents", a, e, ""));
    } else if (aMl != null && eMl != null) {
      rows.push(mkRow("fail", "Net Contents", a, e, "Volume does not match application"));
      hasFail = true;
    } else {
      rows.push(mkRow("review", "Net Contents", a, e, "Could not parse a volume to compare numerically"));
      hasReview = true;
    }
  }

  // Government warning - exact match required, no fuzzy matching
  {
    const a = normalizeWarning(applied.warning);
    const e = normalizeWarning(extracted.government_warning_text);
    if (!extracted.government_warning_text) {
      rows.push(mkRow("fail", "Government Warning", "(required statement)", "Not detected on label", "Warning statement missing or unreadable"));
      hasFail = true;
    } else if (a === e) {
      const capsOk = extracted.government_warning_header_all_caps !== false;
      const boldOk = extracted.government_warning_header_bold !== false;
      if (capsOk && boldOk) {
        rows.push(mkRow("pass", "Government Warning", "(exact statement required)", e, ""));
      } else {
        const issues = [];
        if (!capsOk) issues.push('"GOVERNMENT WARNING:" header not in all caps');
        if (!boldOk) issues.push("header does not appear bold");
        rows.push(mkRow("review", "Government Warning", "(exact statement required)", e, issues.join("; ")));
        hasReview = true;
      }
    } else {
      rows.push(mkRow("fail", "Government Warning", "(exact statement required)", e, "Wording differs from required statement - exact match required"));
      hasFail = true;
    }
  }

  // Image quality flag
  if (extracted.image_quality_issues && extracted.image_quality_issues.length) {
    rows.push(mkRow("review", "Image Quality", "-", extracted.image_quality_issues.join(", "), "Consider requesting a clearer photo"));
    hasReview = true;
  }

  let overall = "pass";
  if (hasFail) overall = "fail";
  else if (hasReview) overall = "review";

  return { rows, overall };
}
