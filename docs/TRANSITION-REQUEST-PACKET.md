# Transition Request Packet v2

`public-data-portal-intelligence`가 장기적으로 만들어야 할 핵심 산출물은 **전환 요청 패킷**입니다.

이 패킷은 파일데이터를 자동으로 API로 바꾸는 실행 명령이 아니라,
- 무엇이 이미 API인지
- 무엇이 파일데이터만 존재하는지
- 무엇이 전환 검토 가치가 높은지
를 사람이 검토 가능한 형태로 구조화한 결과물입니다.

---

## 목적

전환 요청 패킷은 다음 3가지를 돕습니다.

1. **발견**
- 이 데이터가 파일데이터인지, API인지, 둘 다 있는지 빠르게 식별

2. **설명**
- 왜 이 데이터가 전환 후보인지, 또는 아직 아닌지 설명

3. **제안**
- 필요하면 API 전환 요청 초안 또는 후속 검토 액션으로 이어지게 함

즉, 이 패킷은 전환 실행기보다 **발견자 + 설명자 + 제안자** 역할에 맞춰져 있습니다.

---

## Required fields

- `schema_version`
  - 패킷 스키마 버전 (`2.0`)
- `dataset_name`
  - 데이터셋명
- `provider`
  - 제공기관
- `portal_url`
  - 공공데이터포털 원문 URL
- `current_format`
  - CSV / XLSX / ZIP 등 현재 제공 형식
- `has_api`
  - 이미 동일·유사 API가 존재하는지 (`true` / `false` / `unknown`)
- `candidate_reason`
  - 왜 전환 후보인지 한 줄 요약
- `demand_signals`
  - 다운로드 수, API형 신청, 국가중점 여부와 각 기준시점
- `source_vintage`
  - 목록·메타·이용이력 각각의 스냅샷 날짜
- `metadata_quality`
  - 메타정보 충실도
- `response_fields_visible`
  - 응답 필드 노출 여부
- `transition_lane`
  - 즉시 검토 가능 / 교차수요 확인 / 이력 재검증 필요 / 수요 우선
- `human_next_action`
  - 사람이 다음에 해야 할 일
- `decision`
  - `keep_file` / `file_and_api` / `convert_to_api` / `needs_evidence`

---

## Optional fields

- `similar_api_exists`
  - 유사 API 존재 여부
- `licensing_risk`
  - 라이선스/법적 제약 메모
- `hosting_type`
  - 포털 호스팅 / 기관 호스팅
- `update_cycle`
  - 갱신 주기
- `schema_notes`
  - 식별자, 필터, 페이지네이션, 응답 필드 초안
- `freshness_sla`
  - API 반영 지연과 기준시점 제안
- `operations_notes`
  - 예상 호출량, 버전 정책, 장애·지원 종료 계획
- `notes`
  - 추가 검토 메모

---

## Suggested JSON shape

```json
{
  "schema_version": "2.0",
  "dataset_name": "예시 데이터셋",
  "provider": "예시 제공기관",
  "portal_url": "https://www.data.go.kr/...",
  "current_format": "CSV",
  "has_api": false,
  "candidate_reason": "다운로드 수요가 높고 응답 필드가 드러나 있어 API 전환 검토 가치가 높음",
  "demand_signals": {
    "downloads": 12450,
    "api_requests": 0,
    "is_priority_dataset": true,
    "usage_through_year": 2024,
    "current_counter_as_of": "2026-06-30"
  },
  "source_vintage": {
    "catalog": "2026-06-30",
    "metadata": "2026-07-03",
    "usage_history": "2024-12-31"
  },
  "metadata_quality": 4,
  "response_fields_visible": true,
  "transition_lane": "즉시 검토 가능",
  "human_next_action": "식별자와 갱신 SLA 확인 후 API 병행 제공 요청 초안 작성",
  "decision": "file_and_api",
  "similar_api_exists": "동일 기관 유사 통계 API 일부 존재",
  "licensing_risk": "특이 제약 없음",
  "hosting_type": "포털 호스팅",
  "update_cycle": "월간",
  "schema_notes": "dataset_id와 기준연월 필터, cursor 페이지네이션 검토",
  "freshness_sla": "원천 갱신 후 2영업일 이내",
  "operations_notes": "v1 버전 고정, 월 호출량 추정 후 쿼터 설정",
  "notes": "다운로드 수요 대비 구조가 단순해 우선 검토 적합"
}
```

---

## Agent return pattern

에이전트는 이 패킷을 바탕으로 보통 아래 3단계로 응답합니다.

### 1. 찾는다
- 이 데이터는 현재 파일데이터만 존재합니다
- 또는 이미 API가 존재합니다

### 2. 설명한다
- 다운로드 수요와 메타정보 충실도를 보면 API 전환 우선 검토 후보입니다
- 또는 아직 수요/메타 근거가 약합니다

### 3. 제안한다
- 원하면 바로 파일 분석으로 이어갈 수 있습니다
- 또는 API 전환 요청 초안 패킷을 만들 수 있습니다

---

## Design principle

**전환 요청 패킷은 authoritative API를 대신하지 않는다.**

이 패킷의 목적은
- 전환 후보를 구조화하고
- 사람의 검토를 돕고
- 에이전트가 설명 가능한 형태로 되돌아가게 하는 것
입니다.

## Four review gates

요청 초안은 아래 네 질문을 모두 명시해야 합니다.

1. **구조** — 안정적인 식별자·필터·페이지네이션·응답 스키마를 정의할 수 있는가
2. **최신성** — 원천 기준시점과 API 반영 지연을 이용자가 이해할 수 있는가
3. **권리** — 개인정보·제3자 권리·이용허락 범위가 호출형 제공과 충돌하지 않는가
4. **운영** — 호출량·버전·장애·지원 종료를 담당기관이 지속 관리할 수 있는가

네 게이트를 통과하지 못하면 자동으로 탈락시키지 않고 `needs_evidence`로 남깁니다. 파일 유지가 더 적합한 경우에는 `keep_file`, 원본 파일과 호출형 접근을 함께 제공하는 편이 좋은 경우에는 `file_and_api`를 선택합니다.
