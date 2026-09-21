# Decisions

A quick map from what the stakeholders actually said (see `ASSIGNMENT.md`)
to where and how each concern is addressed in the code. Meant as a fast way
to verify the interview notes were read and responded to specifically,
rather than built against a generic "check a label" spec.

| Who said what | Where it's addressed |
|---|---|
| Sarah: *"If we can't get results back in about 5 seconds, nobody's going to use it."* | One model call per label (`server/src/services/modelClient.js`), images downscaled and normalized before sending (`server/src/services/imagePreprocess.js`) so upload/processing time stays low regardless of the photo's original size. |
| Sarah: *"We need something my mother could figure out... clean, obvious, no hunting for buttons."* | Two tabs, numbered steps, one primary button per screen (`client/src/App.jsx`, `SingleCheck.jsx`). Results shown as a stamp plus a row-by-row checklist that mirrors the paper checklist agents already use (`ChecklistRow.jsx`), not a dashboard of scores. |
| Sarah / Janet: batch uploads of 200-300 applications at once. | Batch Check tab (`client/src/components/BatchCheck.jsx`): add any number of label rows, each with its own fields and photo, processed with bounded concurrency (3 at a time) rather than one at a time or all at once. |
| Dave: *"STONE'S THROW... Kentucky Straight Bourbon Whiskey... it's obviously the same thing. You need judgment."* | `normalizeText()` in `server/src/utils/compare.js` treats case/punctuation-only differences as a match with a note, rather than a hard fail - see the `01_perfect_match` fixture in `eval/`, built specifically around this example. |
| Jenny: the Government Warning has to be exact, word-for-word, header in all caps and bold. | The one field with no fuzzy matching at all (`compareFields`'s Government Warning block): wording must match exactly; a non-caps or non-bold header is flagged for review rather than silently passed. Covered by `06_warning_header_not_caps` and `05_warning_wording_altered` in the eval set. |
| Jenny: labels photographed at odd angles, bad lighting, glare. | Images are auto-oriented via EXIF before sending (`imagePreprocess.js`); the model is asked to report `image_quality_issues`, surfaced as "needs review" rather than a silent wrong answer. The `08_rotated_photo` eval fixture exercises this directly. |
| Marcus: not integrating with COLA for this prototype; standalone proof-of-concept. | No COLA integration anywhere - the app takes application fields as manual input, not a COLA lookup. |
| Marcus: outbound network is often restricted; the scanning vendor pilot broke when its ML endpoints were firewalled. | The model provider is reached through one configurable endpoint (`MODEL_API_URL`), and the whole model call lives server-side - an IT team only needs to allow one outbound destination from one host, not from every agent's browser. |
| Marcus: be careful with production deployment, PII, retention. | No data (images, fields, results) is persisted anywhere in this prototype - documented explicitly in the README's Assumptions section, flagged as a real gap to close before production use. |

## A note on what this doesn't solve

None of this replaces judgment on genuinely ambiguous cases - a wording
difference that might or might not be a legally equivalent class/type
designation, for instance, is deliberately routed to "needs review" rather
than decided automatically. That's the same posture Dave described: the
tool should remove routine matching work, not make the judgment calls that
were never routine in the first place.
