# TTB Label Verification Assistant

**Author:** Aqib Rahim
**Live deployment:** https://ttb-label-verification-six.vercel.app/

*This repository is a fork of the official take-home instructions repo. The original assignment brief — stakeholder interview notes and technical requirements — is preserved unchanged at [ASSIGNMENT.md](ASSIGNMENT.md). [DECISIONS.md](DECISIONS.md) maps specific stakeholder feedback to the exact code that addresses it.*

A tool that checks whether an alcohol label photo matches the corresponding COLA application record — brand name, class/type, alcohol content, net contents, and the mandatory Government Warning statement — and flags mismatches for agent review. It's a standalone proof-of-concept and does not integrate with COLA itself.

The brief left the tech stack open ("free to use any programming languages, frameworks, or libraries"), so I picked a stack that reflects how I'd actually build a small internal tool for a team like this: a React frontend, a small Express API, and the label-reading step done server-side so an API credential never has to sit in the browser. Every decision below traces back to something a specific stakeholder said in the interview notes — see DECISIONS.md for the direct mapping.

## Contents

- [Screenshots](#screenshots)
- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Approach](#approach)
- [Full setup](#full-setup)
- [Deploying it](#deploying-it)
- [Assumptions](#assumptions)
- [Known limitations / trade-offs](#known-limitations--trade-offs)
- [Tools used](#tools-used)
- [Hardening notes](#hardening-notes)

## Screenshots

Checking one label — application record on the left, label photo on the right, result below. A case-only difference in the brand name (`Stone's Throw` vs `STONE'S THROW`) still passes, with a note:

![Single label check, filled in](docs/screenshots/02-single-check-filled.png)

The result: every field matches except the Government Warning header, which isn't bold — flagged for review rather than auto-failed, since that's a softer signal than a wording mismatch:

![Single label check result](docs/screenshots/03-single-check-result.png)

Batch mode — one row per label, each with its own fields and photo, processed together:

![Batch check view](docs/screenshots/04-batch-check.png)

## Quick start

Fastest way to see it work, no API key required:

```bash
git clone https://github.com/aqibrahim/ttb-label-verification-submission.git
cd ttb-label-verification-submission

cd server && npm install && npm start &     # http://localhost:4000, demo mode (no key needed)
cd ../client && npm install && npm run dev  # http://localhost:5173
```

Open the printed client URL, fill in an application record (or leave it — the demo response is canned either way), upload any image, click **Verify Label**. A yellow banner marks the result as demo data. To get real label-reading instead of the canned demo, see [Full setup](#full-setup) below.

Or skip local setup entirely and use the live deployment (real model, not demo mode): **https://ttb-label-verification-six.vercel.app/**

## Project structure

```
.
├── ASSIGNMENT.md          the original take-home brief, unmodified
├── DECISIONS.md           stakeholder feedback → specific code, mapped directly
├── client/                React + Vite + Tailwind frontend
│   └── src/
│       ├── App.jsx            tab switching, page shell
│       ├── api.js             fetch wrapper to the server
│       └── components/        SingleCheck, BatchCheck, Stamp, ChecklistRow
├── server/                Express API
│   ├── Dockerfile
│   └── src/
│       ├── index.js            app entry, security middleware
│       ├── routes/verify.js    POST /api/verify
│       ├── services/
│       │   ├── modelClient.js       model call: retries, response validation, demo mode
│       │   └── imagePreprocess.js   resize/orient/normalize before sending
│       └── utils/
│           ├── compare.js           the match/review/mismatch decision logic
│           └── validation.js        request + model-response schemas (Zod)
├── eval/                  evaluation harness: extraction & verdict accuracy
│   ├── generate_fixtures.py    builds the synthetic label images
│   ├── fixtures/                8 labels + ground truth (fixtures.json)
│   └── run_eval.mjs
├── docs/screenshots/      the images used above
└── .github/workflows/     CI: audit, lint, test, build
```

Every `*.test.js` file next to the code it tests (`server/src/**`) is a real, currently-passing unit test — 29 total, see [Tools used](#tools-used).

## Approach

**Architecture.** `client/` is the UI. `server/` receives an image plus the application's stated fields, calls a vision-language model to read the label, and runs the comparison locally before responding. Doing the model call server-side (rather than from the browser) means the credential never reaches client code, the comparison logic exists in exactly one place with one set of tests instead of being duplicated, and the frontend only ever talks to `POST /api/verify` — it doesn't need to know which model provider is behind it.

**The three-way verdict.** Every field gets **match**, **needs review**, or **mismatch** — never a bare pass/fail:
- **Match** — application and label agree; case/punctuation-only differences (`STONE'S THROW` vs `Stone's Throw`) still count as a match.
- **Needs review** — close, but ambiguous enough a human should look (class/type wording differs, an image-quality issue was flagged, warning header formatting looks off).
- **Mismatch** — application and label clearly disagree, or a required field wasn't detected at all.

The Government Warning is the one field with **no fuzzy matching**: it must match word-for-word, and the `GOVERNMENT WARNING:` header must be all-caps — a common place people try to soften or bury the statement.

**Model reliability.** A model call is the one non-deterministic part of the pipeline, so it's treated differently from the rest of the code:
- The response is validated against a Zod schema, not just `JSON.parse`'d — a model can return syntactically valid JSON with the wrong shape (a string where a boolean was expected), and that's now caught rather than silently trusted.
- Transient failures (rate limits, 5xx, malformed/invalid JSON) retry up to 3 times with exponential backoff; genuine bad requests (4xx) or missing config fail immediately instead of wasting retries on input that won't change.
- Images are auto-oriented (EXIF), downscaled past the model's useful resolution, and normalized to JPEG before sending — cuts upload size/cost with no known accuracy trade-off.
- `eval/` runs the real pipeline against 8 synthetic label images with known ground truth and reports **extraction accuracy** and **verdict accuracy** separately, since a wrong answer can come from the model misreading the label or from the comparison logic being wrong — different bugs, different fixes. See `eval/README.md`.

## Full setup

Requires Node.js 18+ (for native `fetch` and the built-in test runner).

### Server

```bash
cd server
npm install
cp .env.example .env
# edit .env: set MODEL_API_URL / MODEL_API_KEY / MODEL_NAME for real extraction
npm start        # http://localhost:4000
npm test         # 29 unit tests
```

Without a key configured, the server runs in **demo mode**: it returns a clearly-labeled canned response instead of failing, so the full UI works immediately after cloning (see `isDemoMode` in `server/src/services/modelClient.js`).

**Docker**, as an alternative to a local Node install:
```bash
cd server
docker build -t label-verify-server .
docker run -p 4000:4000 --env-file .env label-verify-server
```

### Client

```bash
cd client
npm install
npm run dev      # http://localhost:5173, proxies /api to :4000
```

### Evaluation harness (optional, needs a real model key)

```bash
cd eval
npm install
npm run run      # reports extraction & verdict accuracy against 8 fixtures
```

## Deploying it

- **Server:** any Node host works (Render, Railway, Fly.io, a VPS, or the Dockerfile above). Set the three `MODEL_*` environment variables and `PORT` — never commit a real `.env`.
- **Client:** `npm run build` in `client/` produces a static `dist/` deployable to Vercel, Netlify, GitHub Pages, or any static host. Point `VITE_API_BASE` at the deployed server's URL (e.g. `https://your-api.onrender.com/api`) at build time.

The live deployment linked at the top of this file follows exactly this split: server on Render, client on Vercel.

## Assumptions

- Checks the fields called out in the brief: brand name, class/type, alcohol content, net contents, and the Government Warning statement. Bottler name/address and country of origin aren't extracted or compared yet — a natural next addition, same pattern.
- The default Government Warning text reflects the standard federal statement (27 CFR 16.21); an agent should confirm current wording against TTB's published requirement, and can edit the text box if a different approved variant applies.
- "Bold" detection on the warning header is a best-effort visual judgment, not a certainty — surfaced as "needs review" rather than an automatic fail.
- No data (images, application fields, or results) is persisted anywhere; everything lives in memory for the duration of a request. A production version would need a real answer for PII handling and retention policy.

## Known limitations / trade-offs

- **Image quality** (angled, glared, blurry photos) is flagged by the model as an "image quality issue" and surfaced as "needs review," but the tool doesn't attempt to correct or enhance the image — a reasonable stretch goal, not core scope for this pass.
- **Class/type wording differences** always route to "needs review" rather than being auto-passed or auto-failed, since judging whether two designations are legally equivalent is exactly the kind of call that should stay with a human.
- Not integrated with COLA or any other system — by design, this is a standalone proof-of-concept.
- Automated test coverage is at the logic layer (comparison, validation, model-client retry behavior, image preprocessing — 29 tests). The Express routes and React components are covered by manual testing rather than automated tests, given the time box; component/integration tests would be the next addition.
- Batch mode processes labels with limited concurrency (3 at a time) rather than fully in parallel, to keep behavior predictable if a batch is large — worth revisiting with real load numbers.

## Tools used

- **Client:** React 18, Vite, Tailwind CSS
- **Server:** Node.js, Express, Multer (file uploads), Zod (request + model-response validation), Helmet (security headers), express-rate-limit (abuse protection), Sharp (image preprocessing)
- **Testing:** Node's built-in test runner (`node --test`) across comparison logic, validation, retry/demo-mode behavior (with a mocked model), and image preprocessing — 29 tests, no extra test framework dependency for something this size
- **Evaluation:** a standalone harness (`eval/`) running the real pipeline against synthetic label fixtures with known ground truth, reporting extraction/verdict accuracy separately
- **Linting/formatting:** ESLint (flat config) in both `client/` and `server/`, shared Prettier config at the repo root
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — `npm audit` (fails the build on high/critical), lint, and tests on the server; audit, lint, and build on the client — on every push and pull request
- **Containerization:** `server/Dockerfile`, so the API runs with just Docker, no local Node install required
- **Model provider:** a hosted vision-language model, called once per label image, configured entirely through environment variables (`MODEL_API_URL`, `MODEL_API_KEY`, `MODEL_NAME`) so the provider can be swapped without touching application code

## Hardening notes

- Requests to `/api/verify` are validated with a Zod schema (field length limits) before anything is sent to the model, and the uploaded file's MIME type is checked against an allow-list (JPEG/PNG/WEBP).
- The verify endpoint is rate-limited (60 requests per 15 minutes per IP by default) since each request costs real model quota/money — see `server/src/index.js` to adjust for expected traffic.
- Helmet sets standard security headers on all responses.
- `npm audit --audit-level=high` runs in CI on both client and server; a real vulnerability caught this way (sharp, vite) was fixed by dependency upgrade, not suppressed.
- None of this replaces real authentication/authorization for a production deployment — there's no login or per-agent identity in this prototype, which would be a required addition before handling real applications.
