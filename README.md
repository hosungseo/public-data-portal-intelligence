# Public Data Portal Intelligence

**Live page:** <https://hosungseo.github.io/public-data-portal-intelligence/>

![File-to-API reader preview](assets/file-to-api-reader.png)

공공데이터포털의 **파일데이터 중 API 전환 검토 우선순위가 높은 후보군**을 읽기 쉽게 보여주는 퍼블릭 리더입니다.

이 저장소가 답하려는 질문은 단순합니다.

> 공공데이터포털 파일데이터 가운데, 무엇을 먼저 API 전환 검토 대상으로 볼 것인가?

첫 공개 버전은 `file_to_api` 슬라이스만 다룹니다.

## What this repo is for

이 프로젝트는 공공데이터포털의 전체 파일데이터를 공개하는 저장소가 아닙니다.
대신, 다음과 같은 **검토 큐**를 빠르게 읽기 위한 표면을 제공합니다.

- 수요가 이미 높은 파일데이터는 무엇인가
- 메타데이터가 충분해서 API 설계를 덜 추측적으로 시작할 수 있는 것은 무엇인가
- 어떤 제공기관이 API 전환 검토 후보를 많이 보유하고 있는가
- 파일 수요와 API형 수요가 동시에 관찰되는 후보는 어디인가

즉, 이 저장소의 목적은 **API 전환 검토 우선순위를 시각적으로 정리하는 것**입니다.

## What the page does

페이지는 현재 메타데이터상 여전히 파일 중심으로 보이지만, 실제 이용 수요는 높아서 **API 전환 검토 대상**으로 먼저 살펴볼 만한 후보를 보여줍니다.

이 페이지는 자동 판정기가 아니라, **사람이 먼저 볼 검토 큐(prioritization surface)** 입니다.

## Current heuristic

하나의 행은 다음 조건을 만족할 때 `file_to_api_candidate`로 분류됩니다.

- 실질적으로 파일형 데이터에 가깝고
- 다운로드 수요가 **1,000+** 이상이며
- 목록 유형, 서비스 유형, 데이터 형식만 봤을 때 아직 API형 데이터처럼 보이지 않는 경우

## Current snapshot

현재 공개 페이지는 경량 summary asset 기반으로 다음 검토 큐를 보여줍니다.

- **10,045** file-to-API candidates
- **8,762** rows already attach universe, metadata, and usage
- **6,763** rows already expose response fields
- **2,621** rows already show some API-side demand

## What this page helps answer

- 현재 API 전환 검토 큐의 규모는 어느 정도인가?
- 무엇을 먼저 검토해야 하는가?
- 어떤 제공기관이 후보군을 많이 보유하고 있는가?
- 어떤 후보는 이미 response fields나 cross-channel demand를 갖고 있는가?

## Data policy

이 repo는 의도적으로 **경량 reader asset만** 포함합니다.

Included:
- `index.html`
- `file-to-api.html`
- `file-to-api.js`
- `output/file_to_api_summary.js`
- `output/file_to_api_summary.json`

Not included:
- full merged master JSON
- raw source datasets
- internal scratch files
- intermediate analysis files

공개 페이지는 이 lightweight summary asset을 브라우저에서 직접 읽습니다.

## Notes

- 이 페이지는 **API 전환 검토 큐**이지, 모든 flagged 파일이 반드시 API가 되어야 한다는 뜻은 아닙니다.
- 실제 API 전환 여부는 schema, update cycle, legal constraints, 운영 가능성 검토가 추가로 필요합니다.
- 공개 페이지는 전체 원천 공개보다 **검토 우선순위의 가독성**에 최적화되어 있습니다.
