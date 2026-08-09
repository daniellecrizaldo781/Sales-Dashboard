# 2026 Sales Performance Dashboard

Pastel, interactive BI dashboard for **SMS CB Escalated Numbers** and **Inbound Sales**.
Data comes from a private Google Sheet — the sheet ID is never stored in this repo.

## How it stays up to date

1. GitHub Actions runs `sync_sales.py` **every hour** (`.github/workflows/sync.yml`).
2. The script reads the sheet ID from the repo secret `SALES_SHEET`, pulls both tabs,
   validates every row, and writes `data.js`.
3. Actions commits `data.js` — GitHub Pages redeploys automatically.

You never paste a token, never edit HTML, and no credential is ever in the frontend.

## One-time setup

**A. Add the repo secret**

Repo → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*

| Name | Value |
|---|---|
| `SALES_SHEET` | `SHEET_ID\|SMSCB_GID\|INBOUND_GID` |

**B. Allow Actions to commit**

*Settings* → *Actions* → *General* → Workflow permissions → **Read and write permissions**.

**C. Turn on Pages**

*Settings* → *Pages* → Source: **Deploy from a branch** → `main` / `/ (root)`.

**D. Sheet sharing**

The sheet must be *Anyone with the link → Viewer* (link stays private in the secret).

## Running a sync by hand

Repo → *Actions* → **Sync Sales Data** → *Run workflow*.

## Files

| File | Purpose |
|---|---|
| `sync_sales.py` | Sheet → validated `data.js` |
| `data.js` | Generated data (do not edit) |
| `index.html` | 3-page SPA shell |
| `styles.css` | Pastel theme + responsive rules |
| `app-core.js` | Loading, validation, filters, aggregation |
| `app-charts.js` | ECharts renderers |
| `app-render.js` | KPI cards and tables |
| `app-init.js` | Nav, filter wiring, auto-refresh |

## Data rules

- Only **2026** dates are counted.
- A row counts as a sale when it has an order amount > 0 or `Order Created = Yes`.
- Duplicate order numbers on the same date/amount are skipped.
- Blank/invalid dates, blank rows, and non-sale rows are excluded and reported
  in the status pill next to *Last Updated*.
- Weeks are Monday-start and parsed without timezone shifting.

Created by Danielle Ann Mari Crizaldo - Call Team Lead
