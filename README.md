# Public Data Portal Intelligence

A small static reader for one question:

> Which high-demand file datasets look like strong API-conversion candidates?

This first public cut focuses on the `file_to_api` slice only.

## What the page does

The page surfaces file-oriented public datasets that currently show meaningful demand but do **not** yet look API-shaped from their metadata.

It is designed as a review queue, not an automatic decision system.

## Current heuristic

A row is flagged as a `file_to_api_candidate` when it is:

- file-like in practice
- showing signal downloads of **1,000+**
- **not** showing API-like metadata patterns in list type, service type, or data format

## What the page helps answer

- How large is the current file-to-API queue?
- Which rows should be inspected first?
- Which providers dominate the queue?
- Which candidates already have response fields or cross-channel demand?

## Data policy

This repo intentionally ships only lightweight reader assets.

Included:
- `index.html`
- `file-to-api.js`
- `output/file_to_api_summary.js`
- `output/file_to_api_summary.json`

Not included:
- the full merged master JSON
- raw source datasets
- internal scratch or intermediate analysis files

The public page reads the lightweight summary asset directly in-browser.

## Open locally

```bash
python3 -m http.server
```

Then open:

- <http://127.0.0.1:8000/>

## GitHub Pages

This repo is structured so GitHub Pages can serve the root `index.html` directly.

## Notes

- This is a prioritization surface, not a claim that every flagged file should become an API.
- Real API conversion still needs schema, update-cycle, legal, and operational review.
