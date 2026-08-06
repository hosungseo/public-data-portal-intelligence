# Share copy

## Threads / X (KR)

공공데이터포털에서 **수요가 높은 파일데이터 중 API 전환을 먼저 검토할 후보**를 읽는 작은 페이지를 공개했습니다.

핵심은 “무엇이 인기 있나”가 아니라,
**그래서 지금 무엇을 먼저 API로 바꿔볼 가치가 있나**입니다.

2026년 8월 최신 재산출 기준입니다.

- 공식 목록유형 `FILE` 전체 후보 83,695건
- 다운로드 1,000건 이상 또는 국가중점인 우선 후보 11,442건
- 응답 필드가 노출된 후보 51,535건
- 파일과 API 수요가 함께 관찰된 후보 7,312건

목록·메타는 2026년 현행본, 연간 이용이력은 공식 최신본인 2024년 말 기준입니다. 파일 다운로드 수를 API 신청 수로 중복 집계하던 이전 오류도 바로잡았습니다.

페이지:
https://hosungseo.github.io/public-data-portal-intelligence/

리포:
https://github.com/hosungseo/public-data-portal-intelligence

---

## GitHub intro (KR)

공공데이터 운영에서 자주 생기는 질문이 있습니다.

**많이 쓰이는 파일데이터 중 무엇을 먼저 API 전환 검토할 것인가?**

이 프로젝트는 그 질문을 가볍게 읽을 수 있는 정적 리더입니다. 브라우저에는 무거운 원본 대신 경량 summary/index asset만 올립니다.

이 페이지는 자동 의사결정 도구가 아니라 **우선 검토 큐**를 만드는 도구입니다. 즉 “모든 파일은 API가 되어야 한다”가 아니라, **어떤 항목이 먼저 사람 검토를 받을 만한가**를 보여줍니다.

페이지:
https://hosungseo.github.io/public-data-portal-intelligence/

리포:
https://github.com/hosungseo/public-data-portal-intelligence

---

## GitHub intro (EN)

A lightweight static reader for one practical public-data question:

**Which high-demand file datasets look like strong API-conversion candidates?**

It is designed as a prioritization surface, not an automatic decision system. The current build reviews 83,695 official `FILE` catalog entries, flags 11,442 priority candidates, and exposes source-vintage differences rather than hiding them. The browser reads lightweight summary/index assets, not the raw source files.

Page:
https://hosungseo.github.io/public-data-portal-intelligence/

Repo:
https://github.com/hosungseo/public-data-portal-intelligence

---

## Brunch / longer KR intro

공공데이터를 보다 보면 “이건 사람들이 많이 받는데 왜 아직도 파일 중심일까?”라는 생각이 드는 항목들이 있습니다. 반대로 어떤 데이터는 API처럼 보이지만 실제로는 수요가 낮고, 어떤 데이터는 파일인데도 이미 API 전환 검토 우선순위가 높아 보입니다.

이번에 만든 페이지는 그 지점을 읽기 쉽게 보여주기 위한 작은 실험입니다. 질문은 단순합니다.

**공공데이터포털에서 수요가 높은 파일데이터 중, 무엇을 먼저 API 전환 후보로 검토할 것인가?**

브라우저에는 무거운 원본 데이터를 직접 올리지 않고 경량 summary/index asset만 사용합니다. 그래서 페이지는 가볍고, 보는 사람은 shortlist와 전체 큐를 바로 오갈 수 있습니다.

이 페이지가 하는 일은 자동 추천이 아닙니다. 오히려 그 반대에 가깝습니다. 데이터 구조, 업데이트 주기, 법적 제약, 운영 여건을 검토하기 전에, **먼저 사람이 볼 만한 큐를 정리하는 것**이 목적입니다.

즉 “이건 API로 바꿔야 한다”가 아니라,
**“이건 지금 한 번 검토해볼 가치가 있다”**를 보여주는 페이지입니다.

페이지:
https://hosungseo.github.io/public-data-portal-intelligence/

리포:
https://github.com/hosungseo/public-data-portal-intelligence

---

## GitHub repo description

A lightweight static reader for high-demand file datasets that look like API-conversion candidates.
