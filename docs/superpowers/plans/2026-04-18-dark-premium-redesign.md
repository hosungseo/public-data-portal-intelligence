# Dark Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사양서 `docs/superpowers/specs/2026-04-18-dark-premium-redesign.md`에 명시된 다크 프리미엄 디자인으로 페이지를 리디자인한다.

**Architecture:** `file-to-api.html`의 인라인 `<style>` 블록을 새 토큰으로 교체, 섹션 DOM을 Hero → Shortlist → Queue → Shape → Method 순으로 재배치, `file-to-api.js`의 `renderOverview`/`shortlistCard`/`providerRow`/`renderShape`/`queueRowHtml`을 새 구조에 맞게 수정. `index.html`은 `file-to-api.html`의 사본이므로 각 Task 마지막에 동기화한다.

**Tech Stack:** 순수 HTML/CSS(인라인)/JS. 정적 GitHub Pages 배포. Pretendard Variable CDN(jsdelivr). 검증은 로컬 Python HTTP 서버 + Playwright MCP 도구로 수행.

**Repo:** `/Users/seohoseong/.openclaw/workspace/public-data-portal-intelligence` (branch: `main`, remote: `hosungseo/public-data-portal-intelligence`)

---

## Preflight

각 Task는 **작업 디렉토리 기준**으로 명령을 기술한다. 세션 시작 시 다음을 확인한다:

```bash
cd /Users/seohoseong/.openclaw/workspace/public-data-portal-intelligence
git status   # 깨끗한 main 브랜치, 최신 상태
git pull --ff-only
```

**로컬 서버 (모든 검증 Task에서 공통):**

```bash
python3 -m http.server 8790 > /tmp/pdpi-redesign.log 2>&1 &
echo $! > /tmp/pdpi-redesign.pid
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8790/file-to-api.html
# expected: 200
```

**서버 종료 (마지막 Task에서):**

```bash
kill $(cat /tmp/pdpi-redesign.pid) 2>/dev/null
rm -f /tmp/pdpi-redesign.pid /tmp/pdpi-redesign.log
```

**Playwright 사용:** 각 검증 Step에서 `mcp__playwright__browser_navigate` → `mcp__playwright__browser_evaluate`.

---

## Task 1: Pretendard 웹폰트와 폰트 스택 변경

**Files:**
- Modify: `file-to-api.html` (head 영역 `<head>` 내부, `:root` 변수 블록)

- [ ] **Step 1: `<head>`에 Pretendard CDN `<link>` 추가**

`file-to-api.html`의 `<meta>` 아래, `<title>` 위에 추가:

```html
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
```

- [ ] **Step 2: `--sans`·`--mono` 변수의 값을 교체**

`file-to-api.html`의 `:root` 블록에서 다음 두 줄을 바꾼다:

```css
        --sans: "Avenir Next", "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
        --mono: "SFMono-Regular", "IBM Plex Mono", "Menlo", monospace;
```

를

```css
        --sans: "Pretendard Variable", "Pretendard", "Inter", "SF Pro Text", "Apple SD Gothic Neo", sans-serif;
        --mono: "SFMono-Regular", "JetBrains Mono", "IBM Plex Mono", "Menlo", monospace;
```

로 교체.

- [ ] **Step 3: `index.html`로 동기화**

```bash
cp file-to-api.html index.html
```

- [ ] **Step 4: 서버 띄우고 폰트 로드 확인**

```bash
python3 -m http.server 8790 > /tmp/pdpi-redesign.log 2>&1 &
echo $! > /tmp/pdpi-redesign.pid
sleep 1
```

Playwright로 `http://localhost:8790/file-to-api.html` navigate 후 evaluate:

```js
() => getComputedStyle(document.body).fontFamily.includes("Pretendard")
```

Expected: `true`

- [ ] **Step 5: 커밋**

```bash
git add file-to-api.html index.html
git commit -m "feat(design): Pretendard Variable 웹폰트 적용 + 라틴 Inter 우선"
```

---

## Task 2: 다크 컬러 토큰 치환

**Files:**
- Modify: `file-to-api.html` (`:root` 블록, `body` 배경, `body::before` 그리드 마스크)

- [ ] **Step 1: `:root` 변수를 다크 토큰으로 교체**

`file-to-api.html`의 `:root` 블록 전체(—`--bg` 부터 `--shadow`, `--sans`, `--mono` 앞까지—)를 다음으로 교체:

```css
      :root {
        --bg: #000000;
        --surface: #0a0a0a;
        --surface-muted: #050505;
        --line: #1a1a1a;
        --line-strong: #333333;
        --ink: #fafafa;
        --muted: #a0a0a0;
        --muted-deep: #666666;
        --accent: #0af97a;
        --accent-soft: rgba(10, 249, 122, 0.08);
        --accent-edge: rgba(10, 249, 122, 0.04);
        --accent-strong: #0af97a;
        --shadow: 0 18px 42px rgba(0, 0, 0, 0.6);
```

(Pretendard 폰트 스택 2줄은 그대로 유지.)

- [ ] **Step 2: `body` 배경을 단색 검정으로**

```css
      body {
        margin: 0;
        min-height: 100vh;
        font-family: var(--sans);
        color: var(--ink);
        background: var(--bg);
      }
```

기존의 `radial-gradient`/`linear-gradient` 다층 배경을 통째로 위의 한 줄로 바꾼다.

- [ ] **Step 3: `body::before` 그리드 오버레이 제거**

`body::before { content: ""; … }` 규칙 블록 전체를 삭제.

- [ ] **Step 4: 표면 처리 클래스의 배경·경계 정비**

`.masthead, .panel, .shortlist-card, .strong-card`의 `background`·`border`·`backdrop-filter` 공통 규칙을 다음으로 교체:

```css
      .masthead,
      .panel,
      .shortlist-card,
      .strong-card {
        border: 1px solid var(--line);
        background: var(--surface);
        box-shadow: none;
      }
```

`backdrop-filter`와 `box-shadow: var(--shadow)` 제거.

- [ ] **Step 5: `index.html` 동기화**

```bash
cp file-to-api.html index.html
```

- [ ] **Step 6: 브라우저로 색 변화 확인**

Playwright evaluate:

```js
() => ({
  bg: getComputedStyle(document.body).backgroundColor,
  ink: getComputedStyle(document.body).color,
  accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
})
```

Expected: `bg: "rgb(0, 0, 0)"`, `ink: "rgb(250, 250, 250)"`, `accent: "#0af97a"`

- [ ] **Step 7: 커밋**

```bash
git add file-to-api.html index.html
git commit -m "feat(design): 색 토큰을 다크 프리미엄으로 교체"
```

---

## Task 3: 히어로 재구성 (선언문 + 4 KPI + 우선순위 1위 프리뷰)

**Files:**
- Modify: `file-to-api.html` (masthead section DOM + 관련 CSS)
- Modify: `file-to-api.js` (`renderOverview` 함수)

- [ ] **Step 1: `.masthead` 관련 CSS를 새 히어로 스타일로 교체**

`file-to-api.html`의 `.masthead`, `.eyebrow`, `.masthead-grid`, `.lede`, `.focus-note`, `.metric-grid.hero-metric-grid`, `.asset-note`, `.asset-label`, `.asset-value` 블록을 다음 단일 블록으로 교체:

```css
      .hero {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--bg);
        color: var(--ink);
        padding: 0;
        border: none;
      }

      .hero-topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 8px;
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--muted-deep);
        border-bottom: 1px solid var(--surface);
      }

      .hero-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .hero-brand::before {
        content: "";
        width: 6px;
        height: 6px;
        background: var(--accent);
      }

      .hero-topbar nav {
        display: flex;
        gap: 22px;
      }

      .hero-topbar nav a {
        color: var(--muted-deep);
        text-decoration: none;
        transition: color 140ms ease;
      }

      .hero-topbar nav a:hover,
      .hero-topbar nav a:focus-visible {
        color: var(--ink);
        outline: none;
      }

      .hero-body {
        flex: 1;
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
        gap: 48px;
        padding: 80px 8px 40px;
        align-items: start;
      }

      .hero-statement {
        font-size: clamp(36px, 5vw, 56px);
        line-height: 1.02;
        font-weight: 500;
        letter-spacing: -0.045em;
        margin: 0;
      }

      .hero-statement .step-muted {
        color: var(--muted-deep);
      }

      .hero-statement .step-accent {
        color: var(--accent);
      }

      .hero-lede {
        margin-top: 20px;
        max-width: 46ch;
        font-size: 15px;
        line-height: 1.55;
        color: var(--muted);
      }

      .hero-cta {
        margin-top: 22px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .hero-cta a {
        display: inline-flex;
        align-items: center;
        padding: 10px 20px;
        font-size: 13px;
        text-decoration: none;
        letter-spacing: -0.01em;
        transition: opacity 140ms ease, background 140ms ease, border-color 140ms ease;
      }

      .hero-cta .primary {
        background: var(--accent);
        color: #000;
        font-weight: 500;
      }

      .hero-cta .primary:hover,
      .hero-cta .primary:focus-visible {
        opacity: 0.85;
        outline: none;
      }

      .hero-cta .ghost {
        background: transparent;
        color: var(--ink);
        border: 1px solid var(--line-strong);
      }

      .hero-cta .ghost:hover,
      .hero-cta .ghost:focus-visible {
        border-color: var(--accent);
        color: var(--accent);
        outline: none;
      }

      .hero-kpi {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1px;
        background: var(--line);
      }

      .hero-kpi .card {
        background: var(--bg);
        padding: 22px 18px;
      }

      .hero-kpi .label {
        font-size: 10px;
        color: var(--muted-deep);
        text-transform: uppercase;
        letter-spacing: 0.18em;
      }

      .hero-kpi .value {
        font-family: var(--mono);
        font-size: 36px;
        font-weight: 500;
        letter-spacing: -0.03em;
        margin-top: 6px;
      }

      .hero-kpi .value.accent {
        color: var(--accent);
      }

      .hero-kpi .note {
        font-size: 11px;
        color: var(--muted);
        margin-top: 4px;
        line-height: 1.4;
      }

      .hero-top-preview {
        margin-top: 20px;
        padding: 18px 0;
        border-top: 1px solid var(--line);
        font-size: 13px;
        line-height: 1.55;
        color: var(--muted);
      }

      .hero-top-preview strong {
        color: var(--ink);
        font-weight: 500;
      }

      .hero-top-preview .mono {
        font-family: var(--mono);
        color: var(--accent);
      }

      .hero-footer {
        padding: 20px 8px;
        border-top: 1px solid var(--surface);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 10px;
        letter-spacing: 0.18em;
        color: var(--muted-deep);
      }
```

- [ ] **Step 2: 히어로 DOM 교체**

`file-to-api.html`의 기존 `<section class="masthead" data-reveal> … </section>` 블록(브라우저에서 보면 최상단) 을 통째로 다음으로 교체:

```html
      <section class="hero" data-reveal>
        <div class="hero-topbar">
          <div class="hero-brand">Public Data Portal Intelligence</div>
          <nav>
            <a href="#queue-section">Queue</a>
            <a href="#method-section">Method</a>
            <a href="https://github.com/hosungseo/public-data-portal-intelligence" target="_blank" rel="noreferrer noopener">GitHub ↗</a>
          </nav>
        </div>
        <div class="hero-body">
          <div>
            <h1 class="hero-statement">
              10,045건의 파일데이터.<br>
              <span class="step-muted">무엇을 먼저 API로</span><br>
              <span class="step-accent">바꿀 것인가.</span>
            </h1>
            <p class="hero-lede" id="hero-lede"></p>
            <div class="hero-cta">
              <a class="primary" href="#queue-section">전체 큐 보기 ↓</a>
              <a class="ghost" href="#method-section">방법론</a>
            </div>
          </div>
          <div>
            <div class="hero-kpi" id="hero-metrics"></div>
            <div class="hero-top-preview" id="hero-top-preview"></div>
          </div>
        </div>
        <div class="hero-footer">
          <span>↓ SCROLL</span>
          <span>2026</span>
        </div>
      </section>
```

- [ ] **Step 3: 기존 `.section-nav` HTML 블록 제거**

`<nav class="section-nav" aria-label="섹션"> … </nav>` 블록을 통째로 삭제.

- [ ] **Step 4: `.section-nav`와 `[id$="-section"]` CSS 규칙 제거**

기존 `.section-nav { … }`, `.section-nav a { … }`, `.section-nav a:hover, …`, `[id$="-section"] { scroll-margin-top: 72px; }` 네 블록을 모두 삭제. 대신 상단 바 기반이므로 각 섹션에 `scroll-margin-top`을 단순화해 다음 한 줄만 남긴다:

```css
      [id$="-section"] {
        scroll-margin-top: 20px;
      }
```

- [ ] **Step 5: `renderOverview()` 재작성**

`file-to-api.js`의 `function renderOverview() { … }` 블록을 다음으로 교체:

```js
  function renderOverview() {
    const overview = data.overview;
    const topRow = data.shortlist.items[0];

    byId("hero-lede").textContent =
      `공공데이터포털 파일데이터 중 수요가 이미 높고 메타정보까지 갖춘 것부터 골라낸 리뷰 큐입니다. 모든 파일을 API로 바꾸자는 주장이 아니라, 무엇을 먼저 검토해야 하는지 드러내는 화면입니다.`;

    byId("asset-note").textContent =
      `현재 페이지는 ${data.source_assets.summary_js_path} (${number(data.source_assets.summary_js_bytes)} bytes) 기준으로 동작하며, 전체 마스터 자산 ${data.source_assets.master_path} (${number(data.source_assets.master_bytes)} bytes) 전체를 직접 노출하지 않습니다.`;

    byId("hero-metrics").innerHTML = [
      { label: "검토 후보", value: number(overview.candidate_count), note: `병합 카탈로그의 ${percent(overview.share_of_merged)}`, accent: false },
      { label: "우선 검토", value: number(data.shortlist.items.length), note: "즉시·수요·교차·재검증", accent: true },
      { label: "즉시 검토 가능", value: number(overview.response_field_count), note: "응답 필드 노출", accent: false },
      { label: "교차수요 관찰", value: number(overview.api_applies_present_count), note: "API형 신청 이미 발생", accent: false },
    ]
      .map((item) => `
        <div class="card">
          <div class="label">${escapeHtml(item.label)}</div>
          <div class="value${item.accent ? ' accent' : ''}">${escapeHtml(item.value)}</div>
          <div class="note">${escapeHtml(item.note)}</div>
        </div>
      `)
      .join("");

    if (topRow) {
      byId("hero-top-preview").innerHTML =
        `<span class="mono">01 →</span> <strong>${escapeHtml(topRow.title)}</strong><br>` +
        `${escapeHtml(topRow.provider_name)} · 다운로드 ${escapeHtml(number(topRow.signal_downloads))} · 메타 ${escapeHtml(String(topRow.metadata_richness_score))}/5 · ${escapeHtml(laneLabel(topRow.inspect_lane))}`;
    } else {
      byId("hero-top-preview").textContent = "";
    }

    byId("explainer-copy").textContent =
      `이 페이지는 공공데이터포털 파일데이터 가운데, 수요와 메타데이터 상태를 바탕으로 무엇을 먼저 API 전환 검토 대상으로 볼지 빠르게 가늠하기 위한 검토 큐입니다.`;
  }
```

- [ ] **Step 6: `index.html` 동기화 및 서버 재실행**

```bash
cp file-to-api.html index.html
```

Playwright로 새로고침 후 evaluate:

```js
() => ({
  heroText: document.querySelector('.hero-statement')?.textContent.trim(),
  kpiCount: document.querySelectorAll('.hero-kpi .card').length,
  accentKpi: document.querySelector('.hero-kpi .value.accent')?.textContent,
  topPreview: document.getElementById('hero-top-preview')?.textContent,
  topbarLinks: Array.from(document.querySelectorAll('.hero-topbar nav a')).map(a => a.textContent),
})
```

Expected: `heroText`에 "10,045건의 파일데이터", `kpiCount: 4`, `accentKpi: "12"`, `topPreview`에 "01 →" 및 1위 후보 제목, `topbarLinks`에 "Queue","Method","GitHub ↗" 포함.

- [ ] **Step 7: 커밋**

```bash
git add file-to-api.html index.html file-to-api.js
git commit -m "feat(design): Statement Lead 히어로 + 4 KPI + 1위 프리뷰로 재구성"
```

---

## Task 4: 섹션 순서 재배치 및 기관 섹션의 큐의 모습 흡수 준비

**Files:**
- Modify: `file-to-api.html` (섹션 순서)

**참고:** 실제 통합은 Task 8에서 수행. 이 Task는 DOM 순서만 재배치하고, 기관 panel을 shape-section 안으로 이동한다.

- [ ] **Step 1: 현재 DOM 구조 확인**

```bash
grep -n '<section' file-to-api.html | head -10
```

기존: hero → (explainer) → shortlist-section → queue-section → shape-section → method-section

- [ ] **Step 2: `#shape-section` 내부에 `#provider-section` panel 통합**

`file-to-api.html`에서 현재 shape-section 구조를 확인하면 이미 `<section class="section section-grid" id="shape-section">` 안에 두 개의 `<div class="panel">` 이 있다 (왼쪽: readiness+combo+format+update, 오른쪽: id="provider-section" panel). 현재 상태를 그대로 두고 Task 8에서 스타일·통합을 다룬다.

이 Task에서는 DOM 순서만 확인: Hero → Explainer(접힘 포함) → `#shortlist-section` → `#queue-section` → `#shape-section` → `#method-section` 순으로 되어 있는지 검증.

- [ ] **Step 3: Explainer 섹션 제거 또는 축소 결정**

사양서는 explainer 섹션을 별도로 두지 않는다(메시지가 히어로에 흡수됨). 기존 `<section class="section explainer-grid"> … </section>` 블록을 통째로 삭제한다.

- [ ] **Step 4: `index.html` 동기화**

```bash
cp file-to-api.html index.html
```

- [ ] **Step 5: 브라우저로 섹션 순서 확인**

Playwright evaluate:

```js
() => Array.from(document.querySelectorAll('main > section')).map(s => s.id || s.className)
```

Expected: 순서대로 `["hero is-visible" 또는 "hero", "shortlist-section", "queue-section", "shape-section", "method-section"]` (data-reveal 클래스 포함 허용).

- [ ] **Step 6: 커밋**

```bash
git add file-to-api.html index.html
git commit -m "refactor(design): explainer 섹션 제거 및 섹션 순서 확정"
```

---

## Task 5: 우선 검토 카드 재디자인 (에디토리얼 톤)

**Files:**
- Modify: `file-to-api.html` (`.shortlist-card` 관련 CSS)
- Modify: `file-to-api.js` (`shortlistCard` 함수)

- [ ] **Step 1: `.shortlist-card` CSS 규칙 교체**

`file-to-api.html`의 기존 `.shortlist-card > summary`, `.shortlist-card-title`, `.shortlist-card-provider`, `.shortlist-card-quick`, `.shortlist-card-body` 블록을 통째로 다음으로 교체:

```css
      .shortlist-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      details.shortlist-card {
        padding: 22px;
        background: var(--surface);
        border: 1px solid var(--line);
        transition: border-color 140ms ease, background 140ms ease;
      }

      details.shortlist-card[open] {
        border-color: var(--accent);
        background: var(--surface-muted);
      }

      details.shortlist-card > summary {
        list-style: none;
        cursor: pointer;
        display: block;
      }

      details.shortlist-card > summary::-webkit-details-marker {
        display: none;
      }

      .shortlist-card-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 14px;
      }

      .shortlist-card-rank {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--muted-deep);
      }

      details.shortlist-card[open] .shortlist-card-rank {
        color: var(--accent);
      }

      .shortlist-card-title {
        font-size: 19px;
        font-weight: 500;
        line-height: 1.3;
        letter-spacing: -0.015em;
        color: var(--ink);
      }

      .shortlist-card-provider {
        margin-top: 4px;
        color: var(--muted-deep);
        font-size: 11px;
      }

      .shortlist-card-rationale {
        margin-top: 14px;
        padding: 12px 14px;
        border: 1px solid var(--accent);
        background: var(--accent-edge);
      }

      .shortlist-card-rationale .label {
        font-size: 10px;
        color: var(--accent);
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 4px;
      }

      .shortlist-card-rationale .copy {
        font-size: 13px;
        line-height: 1.5;
        color: var(--ink);
      }

      .shortlist-card-rationale .copy .mono {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--muted);
      }

      .shortlist-card-stats {
        margin-top: 12px;
        display: flex;
        gap: 18px;
        flex-wrap: wrap;
        font-family: var(--mono);
        font-size: 11px;
      }

      .shortlist-card-stats .k {
        color: var(--muted);
      }

      .shortlist-card-stats .v {
        color: var(--ink);
      }

      .shortlist-card-stats .v.accent {
        color: var(--accent);
      }

      .shortlist-card-toggle {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--line);
        font-size: 10px;
        color: var(--muted-deep);
        letter-spacing: 0.1em;
      }

      details.shortlist-card[open] .shortlist-card-toggle {
        color: var(--accent);
      }

      .shortlist-card-body {
        margin-top: 16px;
      }

      .shortlist-card-body .summary-label {
        font-size: 10px;
        color: var(--muted-deep);
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .shortlist-card-body .summary-copy {
        padding-left: 14px;
        border-left: 2px solid var(--accent);
        color: var(--muted);
        line-height: 1.5;
        font-size: 14px;
        margin-bottom: 14px;
      }

      .shortlist-card-body ol.reason-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .shortlist-card-body ol.reason-list li {
        padding: 6px 0;
        border-bottom: 1px solid var(--line);
        display: flex;
        gap: 14px;
        font-size: 13px;
        line-height: 1.5;
        color: var(--ink);
      }

      .shortlist-card-body ol.reason-list li:last-child {
        border-bottom: none;
      }

      .shortlist-card-body ol.reason-list li::before {
        content: counter(reason, decimal-leading-zero);
        counter-increment: reason;
        font-family: var(--mono);
        color: var(--accent);
        font-size: 11px;
        padding-top: 3px;
        flex-shrink: 0;
      }

      .shortlist-card-body ol.reason-list {
        counter-reset: reason;
      }
```

기존 `.reason-list`에 `.shortlist-card-body ol.reason-list`로 스코프가 겹치지 않도록 주의. 기존 `.reason-list` 규칙은 Task 7에서 큐 행과 같이 재정의된다.

- [ ] **Step 2: 레인 뱃지 공용 스타일 갱신**

`.lane` 블록을 다음으로 교체:

```css
      .lane {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border: 1px solid var(--line-strong);
        background: transparent;
        color: var(--ink);
        font-size: 10px;
        letter-spacing: 0.05em;
      }

      .lane--metadata-ready {
        border-color: var(--accent);
        background: var(--accent-soft);
        color: var(--accent);
      }

      .lane--cross-channel-demand {
        border-color: #79c0ff;
        color: #79c0ff;
      }

      .lane--usage-gap-check {
        border-color: #d29922;
        color: #d29922;
      }
```

- [ ] **Step 3: `shortlistCard` 함수 재작성**

`file-to-api.js`의 `function shortlistCard(row, rankInList) { … }` 를 다음으로 교체:

```js
  function shortlistCard(row, rankInList) {
    const evidence = serverEvidence(row);
    const lane = row.inspect_lane || deriveLaneFromEvidence(evidence);
    const openAttr = rankInList === 0 ? " open" : "";
    const rank = String(row.rank).padStart(2, "0");
    const total = data.shortlist.items.length;
    return `
      <details class="shortlist-card"${openAttr}>
        <summary>
          <div class="shortlist-card-head">
            <div class="shortlist-card-rank">${rank} / ${total}</div>
            <span class="${laneClass(lane)}">${escapeHtml(laneLabel(lane))}</span>
          </div>
          <h3 class="shortlist-card-title">${escapeHtml(row.title)}</h3>
          <div class="shortlist-card-provider">${escapeHtml(row.provider_name)} · ${escapeHtml(row.data_format || '-')} · ${escapeHtml(row.update_cycle || '-')}</div>
          <div class="shortlist-card-rationale">
            <div class="label">왜 먼저?</div>
            <div class="copy">${escapeHtml(koRationaleBase(lane))} <span class="mono">${escapeHtml(koRationaleNumbers(evidence, lane))}</span></div>
          </div>
          <div class="shortlist-card-stats">
            <span><span class="k">↓</span> <span class="v accent">${escapeHtml(number(row.signal_downloads))}</span></span>
            <span><span class="k">신호</span> <span class="v">${escapeHtml(number(row.usage_total_signal))}</span></span>
            <span><span class="k">메타</span> <span class="v">${escapeHtml(row.metadata_richness_score)}/5</span></span>
            ${row.usage_openapi_apply_count_total ? `<span><span class="k">API</span> <span class="v">${escapeHtml(number(row.usage_openapi_apply_count_total))}</span></span>` : ""}
          </div>
          <div class="shortlist-card-toggle">${openAttr ? '접기 −' : '펼쳐서 근거 보기 ▾'}</div>
        </summary>
        <div class="shortlist-card-body">
          <div class="summary-label">근거 요약</div>
          <p class="summary-copy">${escapeHtml(koReasonSummary(evidence))}</p>
          <ol class="reason-list">
            ${koReasons(evidence).map((item) => `<li><span>${escapeHtml(item)}</span></li>`).join("")}
          </ol>
        </div>
      </details>
    `;
  }
```

이 함수는 새 헬퍼 `koRationaleBase(lane)`·`koRationaleNumbers(evidence, lane)` 를 사용한다. Step 4에서 추가.

- [ ] **Step 4: `koRationale`을 base/numbers로 분리**

`file-to-api.js`의 기존 `koRationale(e, lane)` 함수를 다음 세 함수로 교체:

```js
  function koRationaleBase(lane) {
    if (lane === "Metadata-ready") return "수요가 이미 확인됐고 응답 필드도 보여서 API 설계 검토를 먼저 붙이기 쉽습니다.";
    if (lane === "Cross-channel demand") return "파일 수요가 높고 API형 신청도 이미 보여, 이용자들이 API형 제공방식을 기대하고 있을 가능성이 큽니다.";
    if (lane === "Usage gap check") return "현재 수요는 충분히 크지만 이용 이력이 붙지 않았습니다. 전환 계획 전에 결합 상태를 먼저 재확인해야 합니다.";
    return "요청·응답 계약이 아직 선명하지 않더라도 수요가 충분히 강해 수작업 검토를 먼저 붙일 가치가 있습니다.";
  }

  function koRationaleNumbers(e, lane) {
    if (lane === "Metadata-ready") return `(다운로드 ${number(e.downloads)}건 · 메타 ${e.metadataScore}/5 · 응답 필드 존재)`;
    if (lane === "Cross-channel demand") return `(다운로드 ${number(e.downloads)}건 · API 신청 ${number(e.apiApplies)}건)`;
    if (lane === "Usage gap check") return `(다운로드 ${number(e.downloads)}건 · 결합 ${e.comboLabelKo})`;
    return `(다운로드 ${number(e.downloads)}건 · 메타 ${e.metadataScore}/5)`;
  }

  function koRationale(e, lane) {
    return `${koRationaleBase(lane)} ${koRationaleNumbers(e, lane)}`;
  }
```

`koRationale`은 다른 곳(큐 행 `queueRowHtml`)에서 아직 사용되므로 유지.

- [ ] **Step 5: `index.html` 동기화 및 검증**

```bash
cp file-to-api.html index.html
```

Playwright evaluate:

```js
() => {
  const first = document.querySelector('.shortlist-card[open]');
  return {
    firstOpen: !!first,
    rank: first?.querySelector('.shortlist-card-rank')?.textContent,
    rationaleLabel: first?.querySelector('.shortlist-card-rationale .label')?.textContent,
    rationaleCopy: first?.querySelector('.shortlist-card-rationale .copy')?.textContent,
    cardCount: document.querySelectorAll('.shortlist-card').length,
    openCount: document.querySelectorAll('.shortlist-card[open]').length,
  };
}
```

Expected: `firstOpen: true`, `rank: "01 / 12"`, `rationaleLabel: "왜 먼저?"`, `rationaleCopy` 한국어 문장 + 괄호 안 수치, `cardCount: 12`, `openCount: 1`.

- [ ] **Step 6: 커밋**

```bash
git add file-to-api.html index.html file-to-api.js
git commit -m "feat(design): 우선 검토 카드를 에디토리얼 톤으로 재디자인"
```

---

## Task 6: 큐 행 재디자인 (3상태)

**Files:**
- Modify: `file-to-api.html` (`.queue-row` 관련 CSS)
- Modify: `file-to-api.js` (`queueRowHtml` 함수)

- [ ] **Step 1: `.queue-row` 관련 CSS 교체**

`file-to-api.html`에서 `.queue-list`부터 `.queue-row-body`까지 기존 CSS 블록을 통째로 다음으로 교체:

```css
      .queue-list {
        display: grid;
        gap: 10px;
      }

      .queue-row {
        border: 1px solid var(--line);
        background: var(--bg);
        transition: border-color 140ms ease, background 140ms ease;
      }

      .queue-row:hover,
      .queue-row:focus-within {
        border-color: var(--line-strong);
        background: var(--surface);
      }

      .queue-row[open] {
        border-color: var(--accent);
      }

      .queue-row > summary {
        list-style: none;
        cursor: pointer;
        padding: 16px 20px;
        display: grid;
        grid-template-columns: 40px minmax(0, 1fr) auto;
        gap: 20px;
        align-items: center;
      }

      .queue-row > summary::-webkit-details-marker {
        display: none;
      }

      .queue-row-rank {
        font-family: var(--mono);
        font-size: 13px;
        color: var(--muted-deep);
      }

      .queue-row:hover .queue-row-rank,
      .queue-row[open] .queue-row-rank {
        color: var(--ink);
      }

      .queue-row-title {
        font-size: 15px;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: var(--ink);
      }

      .queue-row-provider {
        display: inline-block;
        margin-left: 10px;
        color: var(--muted-deep);
        font-size: 11px;
      }

      .queue-row-stats {
        margin-top: 6px;
        display: flex;
        gap: 18px;
        flex-wrap: wrap;
        font-family: var(--mono);
        font-size: 11px;
      }

      .queue-row-stats .k {
        color: var(--muted);
      }

      .queue-row-stats .v {
        color: var(--ink);
      }

      .queue-row-stats .v.accent {
        color: var(--accent);
      }

      .queue-row-stats .combo {
        color: var(--muted-deep);
      }

      .queue-row-tail {
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: flex-end;
      }

      .queue-row-toggle {
        font-size: 10px;
        color: var(--muted-deep);
      }

      .queue-row[open] .queue-row-toggle {
        color: var(--accent);
      }

      .queue-row-body {
        padding: 22px 24px 24px 84px;
        font-size: 13px;
        background: var(--surface-muted);
        border-top: 1px solid var(--line);
      }

      .queue-row-body .summary-copy {
        padding-left: 14px;
        border-left: 2px solid var(--accent);
        color: var(--muted);
        line-height: 1.5;
        font-size: 14px;
      }

      .queue-row-body .reasons-label {
        margin-top: 18px;
        font-size: 10px;
        color: var(--muted-deep);
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 10px;
      }

      .queue-row-body ol.reason-list {
        list-style: none;
        padding: 0;
        margin: 0;
        counter-reset: reason;
      }

      .queue-row-body ol.reason-list li {
        padding: 6px 0;
        border-bottom: 1px solid var(--line);
        display: flex;
        gap: 14px;
        font-size: 13px;
        line-height: 1.5;
        color: var(--ink);
      }

      .queue-row-body ol.reason-list li:last-child {
        border-bottom: none;
      }

      .queue-row-body ol.reason-list li::before {
        content: counter(reason, decimal-leading-zero);
        counter-increment: reason;
        font-family: var(--mono);
        color: var(--accent);
        font-size: 11px;
        padding-top: 3px;
        flex-shrink: 0;
      }

      .queue-row-body .rationale {
        margin-top: 20px;
        padding: 14px 16px;
        border: 1px solid var(--accent);
        background: var(--accent-edge);
      }

      .queue-row-body .rationale .label {
        font-size: 10px;
        color: var(--accent);
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .queue-row-body .rationale .copy {
        color: var(--ink);
        line-height: 1.55;
        font-size: 13px;
      }

      .queue-row-body .rationale .copy .mono {
        font-family: var(--mono);
        font-size: 11px;
        color: var(--muted);
      }

      .queue-row-body .portal-link {
        margin-top: 18px;
        display: inline-block;
        font-family: var(--mono);
        font-size: 12px;
        color: var(--accent);
        text-decoration: none;
        transition: opacity 140ms ease;
      }

      .queue-row-body .portal-link:hover,
      .queue-row-body .portal-link:focus-visible {
        opacity: 0.8;
        outline: none;
      }
```

- [ ] **Step 2: 기존 `.queue-row-facts`, `.queue-row-fact`, `.queue-row-tail .queue-row-toggle::after` 등 구형 규칙 삭제**

이전 단계에서 이미 교체했지만, `grep -n "queue-row-fact\|queue-row-toggle::after" file-to-api.html` 로 잔재를 확인하고 발견되면 삭제.

- [ ] **Step 3: `queueRowHtml` 재작성**

`file-to-api.js`의 `function queueRowHtml(rowIdx, rank) { … }` 를 다음으로 교체:

```js
  function queueRowHtml(rowIdx, rank) {
    const row = rowAt(rowIdx);
    const evidence = queueEvidence(row);
    const lane = deriveLaneFromEvidence(evidence);
    return `
      <details class="queue-row">
        <summary>
          <div class="queue-row-rank">${String(rank).padStart(2, "0")}</div>
          <div>
            <span class="queue-row-title">${escapeHtml(row.title || "(제목 없음)")}</span><span class="queue-row-provider">${escapeHtml(row.provider)} · ${escapeHtml(row.format || '-')}</span>
            <div class="queue-row-stats">
              <span><span class="k">↓</span> <span class="v accent">${escapeHtml(number(row.downloads))}</span></span>
              <span><span class="k">신호</span> <span class="v">${escapeHtml(number(row.usage_signal))}</span></span>
              <span><span class="k">메타</span> <span class="v">${row.metadata_score}/5</span></span>
              ${row.api_applies > 0 ? `<span><span class="k">API</span> <span class="v">${escapeHtml(number(row.api_applies))}</span></span>` : ""}
              <span class="combo">결합 ${escapeHtml(row.combo)}</span>
            </div>
          </div>
          <div class="queue-row-tail">
            <span class="${laneClass(lane)}">${escapeHtml(laneLabel(lane))}</span>
            <span class="queue-row-toggle">펼치기 +</span>
          </div>
        </summary>
        <div class="queue-row-body">
          <p class="summary-copy">${escapeHtml(koReasonSummary(evidence))}</p>
          <div class="reasons-label">근거</div>
          <ol class="reason-list">
            ${koReasons(evidence).map((item) => `<li><span>${escapeHtml(item)}</span></li>`).join("")}
          </ol>
          <div class="rationale">
            <div class="label">왜 먼저 검토?</div>
            <div class="copy">${escapeHtml(koRationaleBase(lane))} <span class="mono">${escapeHtml(koRationaleNumbers(evidence, lane))}</span></div>
          </div>
          <a class="portal-link" href="${escapeHtml(portalSearchUrl(row.title))}" target="_blank" rel="noreferrer noopener">↗ 공공데이터포털에서 검색</a>
        </div>
      </details>
    `;
  }
```

- [ ] **Step 4: `index.html` 동기화**

```bash
cp file-to-api.html index.html
```

- [ ] **Step 5: 브라우저 검증**

Playwright evaluate:

```js
() => {
  const first = document.querySelectorAll('.queue-row')[0];
  first.setAttribute('open', '');
  const body = first.querySelector('.queue-row-body');
  return {
    rank: first.querySelector('.queue-row-rank')?.textContent,
    title: first.querySelector('.queue-row-title')?.textContent,
    providerSpan: first.querySelector('.queue-row-provider')?.textContent,
    stats: first.querySelector('.queue-row-stats')?.textContent.replace(/\s+/g, ' ').trim(),
    lane: first.querySelector('.lane')?.textContent?.trim(),
    summaryCopy: body.querySelector('.summary-copy')?.textContent?.slice(0, 30),
    reasonsCount: body.querySelectorAll('.reason-list li').length,
    rationaleLabel: body.querySelector('.rationale .label')?.textContent,
  };
}
```

Expected: `rank: "01"`, `title`에 후보 제목, `providerSpan`에 `근로복지공단 · csv` 등, `stats`에 "↓" 포함 및 "다운로드" 값, `lane`이 "수요 우선" 등 한국어, `reasonsCount: 4`, `rationaleLabel: "왜 먼저 검토?"`.

- [ ] **Step 6: 커밋**

```bash
git add file-to-api.html index.html file-to-api.js
git commit -m "feat(design): 큐 행을 3상태 + 모노 수치 한 줄 레이아웃으로 재디자인"
```

---

## Task 7: 큐의 모습 섹션 (결합 바 + 포맷 칩 + 기관 탑5)

**Files:**
- Modify: `file-to-api.html` (shape-section DOM, panel 관련 CSS)
- Modify: `file-to-api.js` (`renderShape`, `renderProviders` 함수)

- [ ] **Step 1: shape-section DOM 단일 panel로 통합**

`file-to-api.html`의 기존 `<section class="section section-grid" id="shape-section"> … </section>` 블록 전체를 다음으로 교체:

```html
      <section class="section" id="shape-section">
        <div class="panel shape-panel" data-reveal>
          <div class="panel-head">
            <div>
              <h2>큐의 모습</h2>
              <p class="section-copy">현재 10,045건이 어떤 모양으로 쌓여 있는지.</p>
            </div>
          </div>
          <div class="shape-grid">
            <div class="shape-column">
              <div class="shape-block-label">결합 상태 분포</div>
              <div id="source-combo-bars"></div>

              <div class="shape-block-label" style="margin-top: 28px;">주요 포맷</div>
              <div class="chip-row" id="format-chips"></div>

              <div class="shape-block-label" style="margin-top: 22px;">갱신 주기</div>
              <div class="chip-row" id="update-chips"></div>
            </div>
            <div class="shape-column" id="provider-section">
              <div class="shape-block-label">기관 상위</div>
              <div id="provider-list"></div>
              <p class="section-copy" id="provider-copy" style="margin-top: 14px; font-size: 12px;"></p>
            </div>
          </div>
        </div>
      </section>
```

- [ ] **Step 2: shape-grid CSS 규칙 추가**

`file-to-api.html`의 `.shape-grid`, `.shape-column`, `.shape-block-label` 블록을 (기존에 있다면 갱신, 없다면 추가) 다음으로 설정 — 큐 컨트롤 블록 근처에 배치:

```css
      .shape-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        gap: 32px;
      }

      .shape-column {
        min-width: 0;
      }

      .shape-block-label {
        font-size: 10px;
        color: var(--muted-deep);
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 12px;
      }

      .bar-row {
        display: grid;
        gap: 4px;
        margin-bottom: 12px;
      }

      .bar-meta {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        font-size: 12px;
      }

      .bar-label {
        color: var(--ink);
      }

      .bar-label .muted {
        color: var(--muted-deep);
      }

      .bar-value {
        font-family: var(--mono);
        color: var(--muted);
      }

      .bar-value.accent {
        color: var(--accent);
      }

      .bar-track {
        height: 4px;
        background: var(--line);
      }

      .bar-track > span {
        display: block;
        height: 100%;
        background: var(--ink);
      }

      .bar-track.accent > span {
        background: var(--accent);
      }

      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .chip {
        display: inline-flex;
        gap: 8px;
        align-items: baseline;
        padding: 4px 10px;
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--ink);
        font-size: 11px;
      }

      .chip .mini {
        font-family: var(--mono);
        color: var(--muted);
      }

      .provider-row {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        padding: 8px 0;
        border-top: 1px solid var(--line);
        font-size: 12px;
      }

      .provider-row:first-child {
        border-top: none;
      }

      .provider-row .provider-name {
        color: var(--ink);
      }

      .provider-row .provider-metric {
        font-family: var(--mono);
        color: var(--muted);
      }
```

기존 `details.provider-row` 구현이 있다면 그 부분을 삭제하고 위 새 `.provider-row`(div 기반)로 대체한다.

- [ ] **Step 3: `renderShape` 갱신 — readiness-metrics 제거, combo 바 accent 규칙 추가**

`file-to-api.js`의 `renderShape()` 를 다음으로 교체:

```js
  function renderShape() {
    byId("source-combo-bars").innerHTML = data.slice_shape.source_combos
      .map((item, idx) => `
        <div class="bar-row">
          <div class="bar-meta">
            <span class="bar-label">${escapeHtml(sourceComboLabel(item.label))} <span class="muted">${escapeHtml(item.code)}</span></span>
            <span class="bar-value${idx === 0 ? ' accent' : ''}">${escapeHtml(percent(item.share))}</span>
          </div>
          <div class="bar-track${idx === 0 ? ' accent' : ''}"><span style="width:${Math.max(2, item.share * 100)}%"></span></div>
        </div>
      `)
      .join("");

    byId("format-chips").innerHTML = data.slice_shape.data_formats
      .map((item) => `<span class="chip">${escapeHtml(item.label)} <span class="mini">${escapeHtml(number(item.count))} · ${escapeHtml(percent(item.share))}</span></span>`)
      .join("");

    byId("update-chips").innerHTML = data.slice_shape.update_cycles
      .map((item) => `<span class="chip">${escapeHtml(item.label)} <span class="mini">${escapeHtml(number(item.count))} · ${escapeHtml(percent(item.share))}</span></span>`)
      .join("");
  }
```

(기존 readiness-metrics 렌더 라인은 DOM에서 요소가 사라졌으므로 이미 교체됨. 위 코드가 전체.)

- [ ] **Step 4: `renderProviders` 갱신 — 상위 5, 간결 표기**

`file-to-api.js`의 `renderProviders()`를 다음으로 교체:

```js
  function renderProviders() {
    const providerRollup = data.provider_rollup;
    byId("provider-copy").textContent =
      `상위 10개 기관이 전체 후보의 ${percent(providerRollup.top_10_share)}를 차지합니다. 큐를 줄이려면 이 기관들부터 볼 가치가 있습니다.`;
    byId("provider-list").innerHTML = providerRollup.providers
      .slice(0, 5)
      .map((item) => `
        <div class="provider-row">
          <div class="provider-name">${escapeHtml(item.provider_name)}</div>
          <div class="provider-metric">${escapeHtml(number(item.candidate_count))} · ${escapeHtml(percent(item.share_of_candidates))}</div>
        </div>
      `)
      .join("");
  }
```

- [ ] **Step 5: `providerRow` 함수 삭제**

기존 `function providerRow(item, rankInList) { … }` 블록을 통째로 삭제 (새로운 `renderProviders`가 인라인으로 처리).

- [ ] **Step 6: `index.html` 동기화 및 검증**

```bash
cp file-to-api.html index.html
```

Playwright evaluate:

```js
() => ({
  barCount: document.querySelectorAll('#source-combo-bars .bar-row').length,
  firstBarLabel: document.querySelector('#source-combo-bars .bar-label')?.textContent?.trim(),
  firstBarAccent: !!document.querySelector('#source-combo-bars .bar-track.accent'),
  formatChips: document.querySelectorAll('#format-chips .chip').length,
  updateChips: document.querySelectorAll('#update-chips .chip').length,
  providerRows: document.querySelectorAll('#provider-list .provider-row').length,
})
```

Expected: `barCount: 5` (UMY/UM-/-MY/U--/U-Y), `firstBarLabel`에 "지원센터목록 + 메타 + 이용이력 UMY", `firstBarAccent: true`, `formatChips: >=3`, `updateChips: >=3`, `providerRows: 5`.

- [ ] **Step 7: 커밋**

```bash
git add file-to-api.html index.html file-to-api.js
git commit -m "feat(design): 큐의 모습 섹션에 결합·포맷·기관 상위를 통합"
```

---

## Task 8: 큐 컨트롤·검색 입력·드롭다운 스타일 다크 적응

**Files:**
- Modify: `file-to-api.html` (`.queue-controls`, `.queue-field` 등)
- Modify: `file-to-api.js` (불필요, DOM 그대로)

- [ ] **Step 1: `.queue-controls` 관련 스타일 다크화**

`file-to-api.html`의 `.queue-field input`, `.queue-field select`, `.queue-reset`, `.queue-page-btn`, `.queue-summary` 블록을 다음으로 교체:

```css
      .queue-controls {
        display: grid;
        grid-template-columns: minmax(220px, 2fr) repeat(4, minmax(140px, 1fr)) auto;
        gap: 10px;
        align-items: end;
        margin-bottom: 14px;
      }

      .queue-field {
        display: grid;
        gap: 4px;
      }

      .queue-field-label {
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--muted-deep);
      }

      .queue-field input,
      .queue-field select {
        width: 100%;
        padding: 9px 10px;
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--ink);
        font: inherit;
        outline: none;
        transition: border-color 140ms ease, background 140ms ease;
      }

      .queue-field input:focus,
      .queue-field select:focus {
        border-color: var(--accent);
        background: var(--surface-muted);
      }

      .queue-reset,
      .queue-page-btn {
        padding: 9px 14px;
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--ink);
        cursor: pointer;
        transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
      }

      .queue-reset:hover,
      .queue-reset:focus-visible,
      .queue-page-btn:hover:not(:disabled),
      .queue-page-btn:focus-visible:not(:disabled) {
        border-color: var(--accent);
        color: var(--accent);
        outline: none;
      }

      .queue-page-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .queue-summary {
        margin-bottom: 10px;
        color: var(--muted);
        font-size: 12px;
      }

      .queue-pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        margin-top: 18px;
      }

      .queue-page-info {
        font-family: var(--mono);
        color: var(--muted);
        font-size: 12px;
      }

      .queue-empty {
        padding: 24px;
        border: 1px dashed var(--line);
        text-align: center;
        color: var(--muted);
      }
```

- [ ] **Step 2: method section을 panel details로 스타일 맞추기**

`file-to-api.html`의 method section 블록을 다음으로 교체:

```html
      <section class="section" id="method-section">
        <details class="panel method-panel" data-reveal>
          <summary>
            <h2>방법론과 공개 범위</h2>
            <span class="method-toggle">펼치기 ▾</span>
          </summary>
          <div class="panel-body">
            <p class="section-copy">이 페이지는 자동 판정기가 아니라, 사람이 API 전환 검토 우선순위를 빠르게 읽기 위한 경량 리뷰 화면입니다.</p>
            <div class="method-grid">
              <div class="note-list">
                <div class="note-item">
                  <div class="note-title">공개 요약 자산</div>
                  <div class="note-copy asset-value" id="asset-note"></div>
                </div>
                <div class="note-item">
                  <div class="note-title">이 페이지가 하지 않는 일</div>
                  <div class="note-copy">모든 flagged 파일이 반드시 API가 되어야 한다고 자동 판정하지 않습니다.</div>
                </div>
              </div>
              <div class="note-list">
                <div class="note-item">
                  <div class="note-title">추가 검토 필요</div>
                  <div class="note-copy">실제 API 전환 여부는 스키마, 법적 제약, 갱신 주기, 운영 가능성 검토가 추가로 필요합니다.</div>
                </div>
                <div class="note-item">
                  <div class="note-title">공개 범위</div>
                  <div class="note-copy">전체 원천데이터와 내부 중간분석 파일은 포함하지 않고, 공개 가능한 경량 요약 자산만 사용합니다.</div>
                </div>
              </div>
            </div>
          </div>
        </details>
      </section>
```

- [ ] **Step 3: method panel 관련 CSS 추가**

```css
      .method-panel {
        padding: 22px 24px;
        background: var(--surface);
        border: 1px solid var(--line);
        cursor: pointer;
      }

      .method-panel > summary {
        list-style: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .method-panel > summary::-webkit-details-marker {
        display: none;
      }

      .method-panel h2 {
        margin: 0;
      }

      .method-panel .method-toggle {
        font-size: 11px;
        color: var(--muted-deep);
        letter-spacing: 0.1em;
      }

      .method-panel[open] .method-toggle::after {
        content: "접기 ▴";
      }

      .method-panel:not([open]) .method-toggle::after {
        content: "";
      }

      .method-panel[open] .method-toggle {
        content: "";
      }

      .method-panel .panel-body {
        margin-top: 18px;
      }

      .method-grid {
        margin-top: 18px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .method-grid .note-list {
        display: grid;
        gap: 16px;
      }

      .note-item {
        padding: 14px 16px;
        background: var(--surface-muted);
        border: 1px solid var(--line);
      }

      .note-title {
        font-size: 11px;
        color: var(--accent);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }

      .note-copy {
        font-size: 13px;
        color: var(--muted);
        line-height: 1.55;
      }
```

- [ ] **Step 4: `index.html` 동기화**

```bash
cp file-to-api.html index.html
```

- [ ] **Step 5: 브라우저로 확인**

Playwright evaluate:

```js
() => ({
  searchBg: getComputedStyle(document.getElementById('queue-search')).backgroundColor,
  methodOpen: document.querySelector('.method-panel')?.open,
  noteItems: document.querySelectorAll('.method-panel .note-item').length,
})
```

Expected: `searchBg: "rgb(10, 10, 10)"`, `methodOpen: false`, `noteItems: 4`.

- [ ] **Step 6: 커밋**

```bash
git add file-to-api.html index.html
git commit -m "feat(design): 큐 컨트롤·방법론 섹션 다크 톤 적용"
```

---

## Task 9: 반응형 브레이크포인트 재설정

**Files:**
- Modify: `file-to-api.html` (`@media` 블록)

- [ ] **Step 1: 기존 `@media (max-width: 980px)` 와 `@media (max-width: 640px)` 블록 전체 제거 후 재작성**

두 블록을 통째로 다음 두 블록으로 교체:

```css
      @media (max-width: 1080px) {
        .hero-body {
          grid-template-columns: 1fr;
          padding: 60px 8px 40px;
        }

        .hero-kpi {
          grid-template-columns: repeat(4, 1fr);
        }

        .shape-grid {
          grid-template-columns: 1fr;
        }

        .method-grid {
          grid-template-columns: 1fr;
        }

        .shortlist-grid {
          grid-template-columns: 1fr;
        }

        .queue-controls {
          grid-template-columns: 1fr 1fr;
        }

        .queue-field--search,
        .queue-reset {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 640px) {
        .app {
          width: min(100vw - 16px, 1120px);
          padding-top: 0;
        }

        .hero-topbar,
        .hero-footer {
          padding-left: 4px;
          padding-right: 4px;
        }

        .hero-topbar nav {
          gap: 12px;
        }

        .hero-statement {
          font-size: 32px;
        }

        .hero-kpi {
          grid-template-columns: 1fr 1fr;
        }

        .hero-kpi .value {
          font-size: 28px;
        }

        .queue-controls {
          grid-template-columns: 1fr;
        }

        .queue-row > summary {
          grid-template-columns: 32px minmax(0, 1fr);
          gap: 12px;
        }

        .queue-row-tail {
          grid-column: 2;
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          margin-top: 6px;
        }

        .queue-row-body {
          padding: 18px 14px 18px 14px;
        }

        .shortlist-card {
          padding: 18px;
        }

        .shortlist-card-title {
          font-size: 17px;
        }
      }
```

- [ ] **Step 2: `.app` 그리드 기본 폭 확인**

```bash
grep -n '\.app {' file-to-api.html
```

기존 `.app { width: min(1120px, calc(100vw - 32px)); … }` 이면 그대로 두고, 필요 시 `padding: 0 0 72px;`로 단순화해 Hero의 full-bleed 느낌을 유지. Hero는 별도 padding을 가지므로 문제없다.

- [ ] **Step 3: `index.html` 동기화**

```bash
cp file-to-api.html index.html
```

- [ ] **Step 4: 브라우저 reize 검증**

Playwright evaluate:

```js
() => {
  const sizes = [];
  const checkAt = (w) => {
    // NOTE: can't actually resize in headless eval; test structure instead
    // We check that media queries exist
  };
  const styles = Array.from(document.styleSheets)
    .flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } })
    .filter(r => r.type === CSSRule.MEDIA_RULE)
    .map(r => r.conditionText || r.media.mediaText);
  return { mediaQueries: styles };
}
```

Expected: `mediaQueries` 배열에 `"(max-width: 1080px)"` 와 `"(max-width: 640px)"` 둘 다 포함.

보조 검증: Playwright `mcp__playwright__browser_resize` 도구가 있으면 640px로 resize 후 `getComputedStyle(document.querySelector('.hero-statement')).fontSize` 가 `"32px"` 임을 확인.

- [ ] **Step 5: 커밋**

```bash
git add file-to-api.html index.html
git commit -m "feat(design): 반응형 브레이크포인트 1080/640 재설정"
```

---

## Task 10: 접근성·모션·최종 푸시

**Files:**
- Modify: `file-to-api.html` (focus styles, data-reveal reveal)

- [ ] **Step 1: 전역 포커스 스타일 추가**

`file-to-api.html`의 CSS 끝부분에 다음 추가 (`@media` 블록들 앞):

```css
      :focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      button:focus-visible,
      a:focus-visible,
      input:focus-visible,
      select:focus-visible,
      details > summary:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
```

- [ ] **Step 2: `[data-reveal]` 진입 애니메이션 미세 조정**

기존 규칙을 다음으로 교체:

```css
      [data-reveal] {
        opacity: 0;
        transform: translateY(14px);
        transition: opacity 320ms ease, transform 320ms ease;
      }

      [data-reveal].is-visible {
        opacity: 1;
        transform: translateY(0);
      }

      @media (prefers-reduced-motion: reduce) {
        [data-reveal],
        .hero-cta a,
        .queue-row,
        .shortlist-card,
        .queue-field input,
        .queue-field select,
        .hero-topbar nav a {
          transition: none !important;
        }
      }
```

- [ ] **Step 3: `index.html` 최종 동기화**

```bash
cp file-to-api.html index.html
```

- [ ] **Step 4: 죽은 CSS 제거**

다음 규칙이 남아 있으면 삭제 (DOM에 해당 클래스가 더 이상 없음):

```bash
grep -n "\.priority-strip\b\|\.explainer-grid\b\|\.explainer-panel\b\|\.strong-card\b\|\.strong-summary\b\|\.show-more\b\|\.focus-note\b\|\.focus-value\b\|\.explainer-copy\b\|\.hero-metric-grid\b\|\.detail-evidence\b\|\.detail-links\b" file-to-api.html
```

찾으면 각 규칙 블록 전체를 삭제. explainer-grid CSS는 method-grid로 대체되었으므로 불필요.

- [ ] **Step 5: `index.html` 다시 동기화**

```bash
cp file-to-api.html index.html
```

- [ ] **Step 6: 브라우저 최종 회귀 확인**

Playwright로 다음 evaluate:

```js
() => {
  const warnings = [];
  // existence
  if (!document.querySelector('.hero')) warnings.push("missing .hero");
  if (document.querySelectorAll('.hero-kpi .card').length !== 4) warnings.push("hero kpi count != 4");
  if (!document.querySelector('.shortlist-card[open]')) warnings.push("no open shortlist");
  if (document.querySelectorAll('.queue-row').length !== 25) warnings.push("queue page size != 25");
  if (!document.querySelector('.method-panel')) warnings.push("missing method panel");
  if (!document.querySelector('.shape-panel')) warnings.push("missing shape panel");
  // old stuff gone
  if (document.getElementById('priority-strip')) warnings.push("priority-strip still present");
  if (document.getElementById('strongest-list')) warnings.push("strongest-list still present");
  if (document.querySelector('.section-nav')) warnings.push("section-nav still present");
  // english leftover
  const body = document.body.innerText;
  const engPatterns = ["Signal downloads", "no API-like metadata", "Response fields already exist", "File-like row with"];
  engPatterns.forEach(p => { if (body.includes(p)) warnings.push(`english leftover: ${p}`); });
  // scrollHeight
  return { warnings, scrollHeight: document.documentElement.scrollHeight };
}
```

Expected: `warnings: []`, `scrollHeight` 는 성공 기준의 ±20% 이내 (~5,964 ~ 8,946).

콘솔 에러 확인:

Playwright `mcp__playwright__browser_console_messages({ level: 'error' })` 가 favicon 404 외 다른 에러 없어야 한다.

- [ ] **Step 7: 서버 종료**

```bash
kill $(cat /tmp/pdpi-redesign.pid) 2>/dev/null
rm -f /tmp/pdpi-redesign.pid /tmp/pdpi-redesign.log
```

- [ ] **Step 8: 최종 커밋·푸시**

```bash
git add file-to-api.html index.html
git commit -m "feat(design): 포커스 스타일·모션 감쇠·죽은 CSS 정리"
git log --oneline -11
git push origin main
```

Expected: `git log` 에 Task 1~10 커밋 10개가 순서대로 보이고, push 성공 메시지.

---

## Self-Review

### 사양서 커버리지

| 사양서 항목 | 담당 Task |
|---|---|
| 색 토큰 교체 | Task 2 |
| 타이포 교체 (Pretendard+Inter+SF Mono) | Task 1 |
| 히어로 Statement Lead | Task 3 |
| 4 KPI + 우선순위 1위 프리뷰 | Task 3 |
| 상단 내비 (Queue/Method/GitHub) | Task 3 |
| 섹션 리듬 (5 섹션) | Task 4 |
| 우선 검토 카드 에디토리얼 | Task 5 |
| "왜 먼저?" 녹색 박스 | Task 5, Task 6 |
| 큐 행 3상태 | Task 6 |
| 레인 뱃지 2단계 | Task 5 (CSS 공용 처리) |
| 결합 바 + 포맷 칩 + 기관 상위 5 | Task 7 |
| 방법론 접힘 | Task 8 |
| 모션(140ms / native details / 320ms reveal / prefers-reduced-motion) | Task 10 |
| 반응형 1080/640 | Task 9 |
| 접근성 focus-visible | Task 10 |

### Placeholder 검사
- "TBD" / "TODO" / "appropriate error handling" 스캔 → 없음
- 모든 코드 블록은 실제로 붙여넣을 수 있는 완성된 스니펫

### 이름 일관성
- `koRationaleBase` / `koRationaleNumbers` 는 Task 5에서 도입되어 Task 5·6에서 같은 이름으로 사용
- `shortlistCard(row, rankInList)` 시그니처는 Task 5에서 확정, 호출부(`renderShortlist`)는 기존 동일
- `queueRowHtml(rowIdx, rank)` 시그니처는 Task 6에서 유지
- `renderProviders` 에서 제거되는 `providerRow` 는 Task 7 Step 5에서 명시 삭제
- `renderShape` 에서 `readiness-metrics`가 사라졌으므로 해당 innerHTML 할당도 함수에서 제거됨 (Task 7 Step 3 교체 함수에 반영)

### 타입·시그니처
- `evidence` 객체 형태(downloads/hasResponse/hasRequest/metadataScore/comboKey/comboLabelKo/apiApplies/threshold) — 기존 `queueEvidence`/`serverEvidence` 와 동일, 변경 없음
- `laneLabel(lane)`, `laneClass(lane)`, `sourceComboLabel(label)` 헬퍼 기존 것 그대로 사용
