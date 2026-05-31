# EMI Calculator — E2E Test Suite

End-to-end automation for [emicalculator.net](https://emicalculator.net/) using **Cypress 14**.  
The suite validates loan input controls, EMI calculations, chart/table consistency, and Excel exports.

---

## Architecture

The project follows a layered Cypress structure so specs stay readable and reusable logic lives in one place.

```
emi-calculator/
├── cypress/
│   ├── e2e/
│   │   └── emi_caluculator.cy.js   # Test scenarios and assertions
│   ├── support/
│   │   ├── commands.js             # Custom Cypress commands (UI actions)
│   │   ├── helpers/
│   │   │   └── emiHelpers.js       # Pure functions (EMI formula, parsing)
│   │   └── e2e.js                  # Global hooks and plugin imports
│   └── downloads/                  # Excel files saved during tests
├── .github/workflows/e2e.yml       # CI pipeline
├── cypress.config.js               # Cypress + Node tasks (Excel parsing)
├── .env.example                    # Environment template
└── package.json
```

### Layer responsibilities

| Layer | File | Role |
|-------|------|------|
| **Spec** | `cypress/e2e/emi_caluculator.cy.js` | Describes *what* to test. Keeps steps short; delegates actions to commands and math to helpers. |
| **Commands** | `cypress/support/commands.js` | Reusable UI interactions — visit page, set/drag sliders, read charts, download Excel. |
| **Helpers** | `cypress/support/helpers/emiHelpers.js` | Framework-free utilities — parse ₹ values, compute expected EMI, look up Excel rows. |
| **Config** | `cypress.config.js` | Base URL, shared session (`testIsolation: false`), and Node `cy.task` handlers for reading downloaded `.xlsx` files. |
| **CI** | `.github/workflows/e2e.yml` | Runs the full suite on push to `main`, manual dispatch, or deploy webhook. |

### Key design decisions

- **Shared browser session** — `testIsolation: false` with a single `before()` hook. The page loads once; each test continues from the previous state. Faster runs, closer to a real user session.
- **Two slider strategies**
  - `setSlider` — sets the linked text input and fires `change` (fast, reliable for most tests).
  - `slideSlider` — drags the jQuery UI handle with real mouse events via `cypress-real-events` (validates actual slider UX).
- **Formula-based assertions** — EMI, total interest, and total payment are calculated in test code and compared against the UI and Excel export, not hard-coded expected strings.
- **Chart data via Highcharts API** — bar chart values are read from `window.Highcharts.charts` rather than scraping SVG pixels.
- **Real Excel downloads** — the browser downloads the file to `cypress/downloads/`; a Node task parses it with the `xlsx` package for assertions.

### Environment configuration

Runtime settings come from a `.env` file (loaded by `dotenv` in `cypress.config.js`):

```env
BASE_URL=https://emicalculator.net/
```

Copy the template before your first local run:

```bash
cp .env.example .env
```

`BASE_URL` is passed into Cypress as `Cypress.env("BASE_URL")` and used by `cy.visitEmiCalculator()`.

---

## Regression strategy

This is a **focused smoke/regression suite** — four scenarios that cover the calculator's core user journey without testing every edge case on the site.

### Test data

All scenarios use the same loan inputs for consistency:

| Field | Value |
|-------|-------|
| Amount | ₹20,00,000 |
| Rate | 10.5% |
| Tenure | 15 years (180 months) |

### Coverage map

| # | Scenario | What it guards against |
|---|----------|------------------------|
| 1 | **Slider updates** | jQuery UI sliders fail to sync with inputs after drag |
| 2 | **EMI formula** | Incorrect EMI, total interest, or total payment in the summary panel |
| 3 | **Bar chart vs table** | Year-wise principal/interest mismatch between chart and payment schedule |
| 4 | **Excel download** | Broken export — wrong loan details, summary figures, or schedule structure |

### What is intentionally out of scope

- Personal / car loan tab switching
- Advance vs arrears EMI scheme
- PDF download, share link, responsive layout
- Boundary values (min/max amount, zero interest, etc.)

These can be added as the suite grows. The current four tests act as a **release gate** for the home loan happy path.

### When tests run

| Trigger | Purpose |
|---------|---------|
| Push to `main` | Automatic regression on every merge |
| Manual workflow dispatch | On-demand run against staging or production |
| `repository_dispatch` (`ui-deploy-completed`) | Post-deploy verification hook |

---

## Execution steps

### Prerequisites

- **Node.js** 18, 20, or 22 (required by Cypress 14)
- **Chrome** (used in CI; Electron is used by default locally)

### 1. Clone and install

```bash
git clone <repo-url>
cd emi-calculator
npm ci
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set `BASE_URL` to the target site:

```env
BASE_URL=https://emicalculator.net/
```

### 3. Run tests locally

**Headless (CI-like):**

```bash
npx cypress run
```

**Interactive runner (debugging):**

```bash
npx cypress open
```

Then select **E2E Testing** → choose a browser → run `emi_caluculator.cy.js`.

**Single spec:**

```bash
npx cypress run --spec cypress/e2e/emi_caluculator.cy.js
```

**Specific test by title:**

```bash
npx cypress run --spec cypress/e2e/emi_caluculator.cy.js --env grep="EMI formula"
```

> `slideSlider` uses `cypress-real-events` and requires a **Chromium-based browser** (Chrome or Edge).

### 4. Review artifacts

| Output | Location |
|--------|----------|
| Videos | `cypress/videos/` (on failure) |
| Screenshots | `cypress/screenshots/` (on failure) |
| Downloaded Excel | `cypress/downloads/loan_amortization_schedule.xlsx` |

### 5. CI execution

The **End-to-end tests** workflow (`.github/workflows/e2e.yml`) runs automatically on push to `main`.

**Manual run from GitHub:**

1. Go to **Actions** → **End-to-end tests**
2. Click **Run workflow**
3. Choose **staging** or **production**
4. Review the job log; download **cypress-videos** artifact if the run fails

**Required GitHub secret:**

| Secret | Description |
|--------|-------------|
| `BASE_URL` | Target calculator URL (e.g. `https://emicalculator.net/`) |

---

## Project scripts

```bash
npm run prettier    # Format all files
npx cypress run     # Run full suite headless
npx cypress open    # Open interactive test runner
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `BASE_URL` is undefined | Ensure `.env` exists and contains `BASE_URL=...` |
| Slider drag does not move | Run in Chrome/Edge; `cypress-real-events` does not work in Firefox |
| Excel assertion fails | Check `cypress/downloads/` for the saved file; re-run the download test |
| EMI off by ₹1 | Expected — site rounds displayed EMI but uses unrounded value for totals; helpers mirror this |
