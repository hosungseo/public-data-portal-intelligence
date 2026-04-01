# Public Data Portal Intelligence

**Live page:** <https://hosungseo.github.io/public-data-portal-intelligence/>

A small static reader for one practical question:

> Which high-demand file datasets look like strong API-conversion candidates?

이 프로젝트는 공공데이터포털에서 **수요가 높지만 아직 API처럼 보이지 않는 파일데이터**를 우선 검토 큐로 읽기 쉽게 보여주는 정적 리더입니다.

첫 공개 버전은 `file_to_api` 슬라이스만 다룹니다.

## Why this exists

Public-data teams often know that some file datasets are heavily used, but they do not always have a lightweight way to answer:

- which datasets should be inspected first for API conversion?
- which rows already have enough metadata to make API design less speculative?
- which providers dominate the queue?
- where is demand already visible across both file usage and API-style usage?

This page is meant to make that review queue visible quickly.

## What the page does

The page surfaces file-oriented public datasets that currently show meaningful demand but do **not** yet look API-shaped from their metadata.

It is designed as a **prioritization surface**, not an automatic decision system.

## Current heuristic

A row is flagged as a `file_to_api_candidate` when it is:

- file-like in practice
- showing signal downloads of **1,000+**
- **not** showing API-like metadata patterns in list type, service type, or data format

## Current snapshot

The current public page is built from a lightweight summary asset and reflects this queue snapshot:

- **10,045** file-to-API candidates
- **8,762** rows already attach universe, metadata, and usage
- **6,763** rows already expose response fields
- **2,621** rows already show some API-side demand

## What the page helps answer

- How large is the current file-to-API queue?
- Which rows should be inspected first?
- Which providers dominate the queue?
- Which candidates already have response fields or cross-channel demand?

## Data policy

This repo intentionally ships only lightweight reader assets.

Included:
- `index.html`
- `file-to-api.html`
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

- This is a review queue, not a claim that every flagged file should become an API.
- Real API conversion still needs schema, update-cycle, legal, and operational review.
- The page optimizes for readable prioritization, not exhaustive source publication.
