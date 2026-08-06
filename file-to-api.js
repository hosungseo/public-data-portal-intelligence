(function () {
  const data = window.FILE_TO_API_DATA;
  const index = window.FILE_TO_API_INDEX;

  const QUEUE_PAGE_SIZE = 25;
  const queueState = {
    search: "",
    scope: "",
    provider: "",
    lane: "",
    format: "",
    sort: "usage_signal",
    page: 0,
    filtered: [],
  };
  let queueSearchTimer = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function number(value) {
    return new Intl.NumberFormat("ko-KR").format(value || 0);
  }

  function percent(value) {
    return `${((value || 0) * 100).toFixed(1)}%`;
  }

  const laneLabelMap = {
    "Metadata-ready": "즉시 검토 가능",
    "Demand leader": "수요 우선",
    "Cross-channel demand": "교차수요 확인",
    "Usage gap check": "이력 재검증 필요",
  };

  const sourceComboLabelMap = {
    "Universe + metadata + usage": "지원센터목록 + 메타 + 이용이력",
    "Universe + metadata": "지원센터목록 + 메타",
    "Metadata + usage": "메타 + 이용이력",
    "Universe only": "지원센터목록만 결합",
    "Universe + usage": "지원센터목록 + 이용이력",
  };

  const basisLabelMap = {
    "usage-rollup": "이용이력 집계",
    "current-counter": "현재 카운터",
  };

  function laneLabel(lane) {
    return laneLabelMap[lane] || lane || "-";
  }

  function sourceComboLabel(label) {
    return sourceComboLabelMap[label] || label || "-";
  }

  function basisLabel(label) {
    return basisLabelMap[label] || label || "-";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function portalSearchUrl(title, listKey) {
    if (listKey) return `https://www.data.go.kr/data/${encodeURIComponent(listKey)}/fileData.do`;
    return `https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=${encodeURIComponent(title || "")}`;
  }

  function dateText(value, withTime = false) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
    }).format(date);
  }

  function signedNumber(value) {
    const n = Number(value) || 0;
    if (n === 0) return "±0";
    return `${n > 0 ? "+" : "−"}${number(Math.abs(n))}`;
  }

  function yearSpanText(row) {
    if (row.usage_year_min && row.usage_year_max) return `${row.usage_year_min}–${row.usage_year_max}`;
    if (row.usage_year_min) return String(row.usage_year_min);
    return "-";
  }

  function metricCard(item) {
    return `
      <div class="metric-card">
        <div class="metric-label">${escapeHtml(item.label)}</div>
        <div class="metric-value">${escapeHtml(item.value)}</div>
        <div class="metric-note">${escapeHtml(item.note)}</div>
      </div>
    `;
  }

  function barRows(items) {
    return items
      .map(
        (item) => `
          <div class="bar-row">
            <div class="bar-meta">
              <span class="bar-label">${escapeHtml(item.label)}</span>
              <span class="bar-value">${escapeHtml(item.value)}</span>
            </div>
            <div class="muted">${escapeHtml(item.note)}</div>
            <div class="bar-track" style="--share:${item.share}">
              <span></span>
            </div>
          </div>
        `,
      )
      .join("");
  }

  function chip(label, count, share) {
    return `<span class="chip">${escapeHtml(label)} <span class="mini">${escapeHtml(number(count))}</span> <span class="mini">${escapeHtml(percent(share))}</span></span>`;
  }

  function laneClass(lane) {
    return `lane lane-${String(lane || "").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  }

  function reasonList(items) {
    return `<ul class="reason-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function metaItems(row) {
    const yearText =
      row.usage_year_min && row.usage_year_max
        ? `${row.usage_year_min}-${row.usage_year_max}`
        : row.usage_year_min || "-";

    return [
      { label: "종합 신호", value: number(row.usage_total_signal) },
      { label: "다운로드", value: number(row.signal_downloads) },
      { label: "API 신청", value: number(row.signal_api_applies) },
      { label: "결합상태", value: sourceComboLabel(row.source_combo_label) },
      { label: "포맷", value: row.data_format || "-" },
      { label: "연도", value: String(yearText) },
    ]
      .map(
        (item) => `
          <div class="meta-item">
            <div class="meta-label">${escapeHtml(item.label)}</div>
            <div class="meta-value">${escapeHtml(item.value)}</div>
          </div>
        `,
      )
      .join("");
  }

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
            <div class="copy">${escapeHtml(koRationaleBase(lane, evidence))} <span class="mono">${escapeHtml(koRationaleNumbers(evidence, lane))}</span></div>
          </div>
          <div class="shortlist-card-stats">
            <span><span class="k">↓</span> <span class="v accent">${escapeHtml(number(row.signal_downloads))}</span></span>
            <span><span class="k">신호</span> <span class="v">${escapeHtml(number(row.usage_total_signal))}</span></span>
            <span><span class="k">메타</span> <span class="v">${escapeHtml(row.metadata_richness_score)}/5</span></span>
            ${row.signal_api_applies ? `<span><span class="k">API</span> <span class="v">${escapeHtml(number(row.signal_api_applies))}</span></span>` : ""}
          </div>
          <div class="shortlist-card-toggle">${openAttr ? '접기 −' : '펼쳐서 근거 보기 ▾'}</div>
        </summary>
        <div class="shortlist-card-body">
          <div class="summary-label">근거 요약</div>
          <p class="summary-copy">${escapeHtml(koReasonSummary(evidence))}</p>
          <ol class="reason-list">
            ${koReasons(evidence).map((item) => `<li><span>${escapeHtml(item)}</span></li>`).join("")}
          </ol>
          <a class="portal-link" href="${escapeHtml(portalSearchUrl(row.title, row.list_key))}" target="_blank" rel="noreferrer noopener">↗ 공공데이터포털 원문 열기</a>
        </div>
      </details>
    `;
  }

  function renderOverview() {
    const overview = data.overview;
    const topRow = data.shortlist.items[0];
    const universe = overview.reviewed_universe_count || 0;
    const reviewedSharePct = ((overview.reviewed_share || 0) * 100).toFixed(1);

    const universeEl = byId("hero-universe-count");
    if (universeEl) universeEl.textContent = number(universe);

    byId("hero-lede").textContent =
      `공식 목록유형이 FILE인 ${number(overview.candidate_count)}건을 전수 검토 대상으로 잡았습니다. 그중 다운로드가 반복되거나 국가중점데이터로 지정된 ${number(overview.priority_count)}건을 우선 후보로 분류했습니다. 모든 파일을 일괄 전환하는 대신, 반복 조회·갱신·자동화 수요가 큰 데이터부터 API 적합성을 확인하는 큐입니다.`;

    const criteriaCopy = byId("criteria-copy");
    if (criteriaCopy) {
      criteriaCopy.textContent =
        `공공데이터포털의 파일데이터 ${number(overview.candidate_count)}건이 모두 검토 후보입니다. 그중 ${number(overview.priority_count)}건은 우선 후보로 분류되고, 같은 큐 안에서 점수에 따라 우선순위가 매겨집니다.`;
    }
    const criteriaUniverseTag = byId("criteria-universe-tag");
    if (criteriaUniverseTag) {
      criteriaUniverseTag.textContent = `(전체 ${number(overview.candidate_count)}건)`;
    }
    const criteriaPass = byId("criteria-pass");
    if (criteriaPass) {
      const priorityPct = ((overview.priority_share || 0) * 100).toFixed(1);
      criteriaPass.textContent = `${number(overview.priority_count)} / ${number(overview.candidate_count)} (${priorityPct}%)`;
    }

    byId("asset-note").textContent =
      `현재 페이지는 요약 ${data.source_assets.summary_js_path} (${number(data.source_assets.summary_js_bytes)} bytes)와 전체 큐 인덱스 ${data.source_assets.index_js_path} (${number(data.source_assets.index_js_bytes)} bytes)를 브라우저에서 읽습니다. 원천 CSV와 중간 결합 파일은 공개하지 않습니다.`;

    byId("hero-metrics").innerHTML = [
      { label: "검토 후보", value: number(overview.candidate_count), note: "공식 목록유형 FILE 전체", accent: false },
      { label: "우선 후보", value: number(overview.priority_count), note: `다운로드 1,000건 이상 또는 국가중점 — 전체의 ${percent(overview.priority_share)}`, accent: true },
      { label: "응답 필드 노출", value: number(overview.response_field_count), note: "출력 구조가 이미 보임", accent: false },
      { label: "교차수요 관찰", value: number(overview.api_applies_present_count), note: "연간 이력·현재 카운터 중 API 신호 존재", accent: false },
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

  }

  function renderFreshnessAndChanges() {
    const sourceGrid = byId("source-freshness-grid");
    if (sourceGrid) {
      sourceGrid.innerHTML = (data.source_snapshots || []).map((source) => {
        const isHistorical = source.code === "Y";
        const freshnessLabel = isHistorical ? "연간 이력 · 2024년까지" : "현행 목록 스냅샷";
        return `
          <a class="source-card${isHistorical ? " source-card--historical" : ""}" href="${escapeHtml(source.page_url)}" target="_blank" rel="noreferrer noopener">
            <div class="source-card-top"><span class="source-code">${escapeHtml(source.code)}</span><span class="source-status">${escapeHtml(freshnessLabel)}</span></div>
            <div class="source-title">${escapeHtml(source.label)}</div>
            <div class="source-date">${escapeHtml(source.snapshot_date || "-")}</div>
            <div class="source-meta">${escapeHtml(source.provider)} · CSV ${escapeHtml(number(source.parsed_row_count))}행</div>
            <span class="source-link">원천 페이지 ↗</span>
          </a>
        `;
      }).join("");
    }

    const generated = byId("freshness-generated");
    if (generated) generated.textContent = `재산출 ${dateText(data.generated_at, true)} KST`;

    const changeGrid = byId("change-grid");
    if (changeGrid) {
      changeGrid.innerHTML = (data.change_log?.metrics || []).map((metric) => {
        const delta = Number(metric.delta) || 0;
        const deltaClass = delta > 0 ? "is-up" : delta < 0 ? "is-down" : "is-flat";
        return `
          <div class="change-card">
            <div class="change-label">${escapeHtml(metric.label)}</div>
            <div class="change-current">${escapeHtml(number(metric.current))}</div>
            <div class="change-delta ${deltaClass}">${escapeHtml(signedNumber(delta))} <span>이전판 대비</span></div>
          </div>
        `;
      }).join("");
    }

    const changeNote = byId("change-note");
    if (changeNote) changeNote.textContent = data.change_log?.methodology_note || "";
    const baseline = byId("change-baseline");
    if (baseline) baseline.textContent = `비교 기준 ${dateText(data.change_log?.baseline_generated_at, true)} KST`;
  }

  function renderShape() {
    const copy = byId("shape-copy");
    if (copy) copy.textContent = `전체 ${number(data.overview.candidate_count)}건의 결합 상태·포맷·갱신 주기와 제공기관 분포입니다.`;
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

  function renderShortlist() {
    const metadataReady = data.shortlist.items.filter((item) => item.inspect_lane === "Metadata-ready").length;
    const usageGap = data.shortlist.items.filter((item) => item.inspect_lane === "Usage gap check").length;
    byId("shortlist-copy").textContent =
      `${number(metadataReady)}건은 메타데이터가 더 선명해 먼저 검토하기 좋고, ${number(usageGap)}건은 전환 검토 전 이력 재확인이 더 필요합니다.`;
    byId("shortlist-grid").innerHTML = data.shortlist.items.map((row, i) => shortlistCard(row, i)).join("");
  }

  function rowAt(i) {
    const r = index.rows;
    return {
      list_key: r.list_keys[i],
      title: r.titles[i],
      provider: index.providers[r.provider_idx[i]],
      format: index.formats[r.format_idx[i]],
      combo: index.combos[r.combo_idx[i]],
      combo_label: index.combo_labels[index.combos[r.combo_idx[i]]] || index.combos[r.combo_idx[i]],
      downloads: r.downloads[i],
      usage_signal: r.usage_signal[i],
      api_applies: r.api_applies[i],
      current_downloads: r.current_downloads ? r.current_downloads[i] : 0,
      usage_year_max: r.usage_year_max ? r.usage_year_max[i] : 0,
      metadata_score: r.metadata_score[i],
      flags: r.flags[i],
    };
  }

  function flagBit(row, name) {
    const mask = index.flag_bits[name];
    return (row.flags & mask) !== 0;
  }

  function queueEvidence(row) {
    return {
      downloads: row.downloads,
      hasResponse: flagBit(row, "has_response_fields"),
      hasRequest: flagBit(row, "has_request_variables"),
      metadataScore: row.metadata_score,
      comboKey: row.combo,
      comboLabelKo: sourceComboLabel(row.combo_label),
      apiApplies: row.api_applies,
      threshold: index.candidate_threshold,
      isPriority: flagBit(row, "is_priority"),
      isCore: flagBit(row, "is_core_data"),
      usageYearMax: row.usage_year_max,
      currentDownloads: row.current_downloads,
    };
  }

  function serverEvidence(row) {
    return {
      downloads: Number(row.signal_downloads) || 0,
      hasResponse: !!row.has_response_fields,
      hasRequest: !!row.has_request_variables,
      metadataScore: Number(row.metadata_richness_score) || 0,
      comboKey: row.source_combo,
      comboLabelKo: sourceComboLabel(row.source_combo_label),
      apiApplies: Number(row.signal_api_applies) || 0,
      threshold: 1000,
      isPriority: !!row.is_priority,
      isCore: !!row.is_core_data,
      usageYearMax: Number(row.usage_year_max) || 0,
      currentDownloads: Number(row.current_file_download_count) || 0,
    };
  }

  function deriveLaneFromEvidence(e) {
    if (e.comboKey === "UM-") return "Usage gap check";
    if (e.hasResponse && e.metadataScore >= 4) return "Metadata-ready";
    if (e.apiApplies > 0) return "Cross-channel demand";
    return "Demand leader";
  }

  function deriveLane(row) {
    return deriveLaneFromEvidence(queueEvidence(row));
  }

  function koReasonSummary(e) {
    const base = `다운로드 신호 ${number(e.downloads)}건`;
    if (e.hasResponse) return `${base}; 응답 필드가 이미 있어 출력 구조를 가늠할 수 있습니다.`;
    if (e.metadataScore >= 4) return `${base}; 메타정보가 비교적 풍부합니다.`;
    return `${base}; 현재는 구조 정보보다 수요·정책 신호를 먼저 확인해야 합니다.`;
  }

  function koReasons(e) {
    const reasons = ["공식 목록유형이 FILE인 행으로, 이미 API로 분류된 목록은 모집단에서 제외했습니다."];
    if (e.downloads >= e.threshold) {
      reasons.push(`다운로드 신호 ${number(e.downloads)}건으로 우선 기준 ${number(e.threshold)}건을 넘습니다.`);
    } else if (e.isCore) {
      reasons.push(`다운로드 신호는 ${number(e.downloads)}건이지만 국가중점데이터 지정으로 우선 후보에 합류합니다.`);
    } else {
      reasons.push(`다운로드 신호 ${number(e.downloads)}건으로 우선 기준 전의 일반 검토 후보입니다.`);
    }
    if (e.hasResponse) {
      reasons.push("메타데이터에 응답 필드가 이미 있어 출력 구조를 일부 가늠할 수 있습니다.");
    } else if (e.hasRequest) {
      reasons.push("메타데이터에 요청 변수가 이미 있어 API 계약의 일부 단서가 보입니다.");
    } else {
      reasons.push(`메타정보는 ${e.metadataScore}/5 수준이지만 요청·응답 구조는 아직 얇습니다.`);
    }
    const label = e.comboLabelKo;
    if (e.comboKey === "UMY") {
      reasons.push(`${label}이(가) 이미 결합되어 있어, 추가 결합 작업보다 사람 검토를 먼저 붙일 수 있습니다.`);
    } else if (e.comboKey === "UM-") {
      reasons.push(`${label}은(는) 결합되어 있지만 이용 이력은 빠져 있어, 수요 신호가 현재 카운터 기준으로만 집계됩니다.`);
    } else if (e.comboKey === "-MY") {
      reasons.push(`${label}이(가) 결합되어 있지만 지원센터목록 쪽 행이 아직 없어 먼저 정합성 확인이 필요합니다.`);
    } else if (e.comboKey === "U-Y") {
      reasons.push(`${label}이(가) 결합되어 있지만 메타정보가 아직 약해, API 설계 전에 메타 보강이 필요합니다.`);
    } else {
      reasons.push(`결합 상태는 ${label}이며, API 전환 검토 전에 결합 보완이 필요합니다.`);
    }
    return reasons;
  }

  function koRationaleBase(lane, e) {
    if (e && !e.isPriority) return "우선 게이트 전의 일반 후보입니다. 반복 조회 필요·갱신 빈도·파일 크기를 확인한 뒤 전환 순서를 올릴 수 있습니다.";
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
    return `${koRationaleBase(lane, e)} ${koRationaleNumbers(e, lane)}`;
  }

  function populateQueueSelects() {
    const providerSelect = byId("queue-provider");
    const opts = ['<option value="">전체 기관</option>'];
    for (const name of index.providers) {
      opts.push(`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`);
    }
    providerSelect.innerHTML = opts.join("");

    const formatSelect = byId("queue-format");
    const formatOpts = ['<option value="">전체 포맷</option>'];
    for (const label of index.formats) {
      formatOpts.push(`<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`);
    }
    formatSelect.innerHTML = formatOpts.join("");
  }

  function applyQueueFilter() {
    const q = queueState.search.trim().toLowerCase();
    const providerFilter = queueState.provider;
    const scopeFilter = queueState.scope;
    const laneFilter = queueState.lane;
    const formatFilter = queueState.format;
    const r = index.rows;
    const total = index.count;
    const filtered = [];

    for (let i = 0; i < total; i++) {
      if (scopeFilter) {
        const flags = r.flags[i];
        if (scopeFilter === "priority" && (flags & index.flag_bits.is_priority) === 0) continue;
        if (scopeFilter === "core" && (flags & index.flag_bits.is_core_data) === 0) continue;
      }
      if (providerFilter && index.providers[r.provider_idx[i]] !== providerFilter) continue;
      if (formatFilter && index.formats[r.format_idx[i]] !== formatFilter) continue;
      if (q) {
        const title = r.titles[i].toLowerCase();
        const provider = index.providers[r.provider_idx[i]].toLowerCase();
        if (!title.includes(q) && !provider.includes(q)) continue;
      }
      if (laneFilter) {
        const row = rowAt(i);
        if (deriveLane(row) !== laneFilter) continue;
      }
      filtered.push(i);
    }

    const sortKey = queueState.sort;
    if (sortKey === "downloads") {
      filtered.sort((a, b) => r.downloads[b] - r.downloads[a]);
    } else if (sortKey === "metadata_score") {
      filtered.sort((a, b) => r.metadata_score[b] - r.metadata_score[a] || r.usage_signal[b] - r.usage_signal[a]);
    } else if (sortKey === "api_applies") {
      filtered.sort((a, b) => r.api_applies[b] - r.api_applies[a] || r.usage_signal[b] - r.usage_signal[a]);
    } else {
      filtered.sort((a, b) => r.usage_signal[b] - r.usage_signal[a] || r.downloads[b] - r.downloads[a]);
    }

    queueState.filtered = filtered;
    queueState.page = 0;
  }

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
            ${flagBit(row, "is_priority") ? '<span class="queue-scope-badge">우선 후보</span>' : '<span class="queue-scope-badge queue-scope-badge--muted">일반 후보</span>'}
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
            <div class="label">검토 포인트</div>
            <div class="copy">${escapeHtml(koRationaleBase(lane, evidence))} <span class="mono">${escapeHtml(koRationaleNumbers(evidence, lane))}</span></div>
          </div>
          <div class="queue-vintage">수요 기준: ${row.usage_year_max ? `연간 이력 ${escapeHtml(String(row.usage_year_max))}년까지` : `현재 카운터 ${escapeHtml(number(row.current_downloads))}건`} · 목록키 ${escapeHtml(row.list_key || "-")}</div>
          <a class="portal-link" href="${escapeHtml(portalSearchUrl(row.title, row.list_key))}" target="_blank" rel="noreferrer noopener">↗ 공공데이터포털 원문 열기</a>
        </div>
      </details>
    `;
  }

  function renderQueue() {
    const total = queueState.filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE));
    if (queueState.page >= pageCount) queueState.page = pageCount - 1;
    if (queueState.page < 0) queueState.page = 0;

    const start = queueState.page * QUEUE_PAGE_SIZE;
    const end = Math.min(start + QUEUE_PAGE_SIZE, total);
    const list = byId("queue-list");

    byId("queue-summary").textContent = total === index.count
      ? `전체 ${number(total)}건 중 ${number(total === 0 ? 0 : start + 1)}–${number(end)}건 표시`
      : `전체 ${number(index.count)}건 중 ${number(total)}건 매치. ${number(total === 0 ? 0 : start + 1)}–${number(end)}건 표시.`;

    if (total === 0) {
      list.innerHTML = '<div class="queue-empty">조건에 맞는 후보가 없습니다.</div>';
    } else {
      const parts = [];
      for (let i = start; i < end; i++) {
        parts.push(queueRowHtml(queueState.filtered[i], i + 1));
      }
      list.innerHTML = parts.join("");
    }

    byId("queue-page-info").textContent = `${queueState.page + 1} / ${pageCount} 페이지`;
    byId("queue-prev").disabled = queueState.page === 0;
    byId("queue-next").disabled = queueState.page >= pageCount - 1;
  }

  function renderQueueCopy() {
    byId("queue-copy").textContent =
      `FILE 목록 ${number(index.count)}건 전체가 큐에 있습니다. 범위를 ‘우선 후보’로 좁히면 다운로드 1,000건 이상 또는 국가중점인 ${number(index.priority_count)}건만 볼 수 있고, 각 행에서 원문·근거·수요 기준시점을 확인할 수 있습니다.`;
  }

  function wireQueueEvents() {
    const search = byId("queue-search");
    search.addEventListener("input", (event) => {
      clearTimeout(queueSearchTimer);
      const value = event.target.value;
      queueSearchTimer = setTimeout(() => {
        queueState.search = value;
        applyQueueFilter();
        renderQueue();
      }, 140);
    });

    byId("queue-provider").addEventListener("change", (event) => {
      queueState.provider = event.target.value;
      applyQueueFilter();
      renderQueue();
    });
    byId("queue-scope").addEventListener("change", (event) => {
      queueState.scope = event.target.value;
      applyQueueFilter();
      renderQueue();
    });
    byId("queue-lane").addEventListener("change", (event) => {
      queueState.lane = event.target.value;
      applyQueueFilter();
      renderQueue();
    });
    byId("queue-format").addEventListener("change", (event) => {
      queueState.format = event.target.value;
      applyQueueFilter();
      renderQueue();
    });
    byId("queue-sort").addEventListener("change", (event) => {
      queueState.sort = event.target.value;
      applyQueueFilter();
      renderQueue();
    });

    byId("queue-reset").addEventListener("click", () => {
      queueState.search = "";
      queueState.scope = "";
      queueState.provider = "";
      queueState.lane = "";
      queueState.format = "";
      queueState.sort = "usage_signal";
      byId("queue-search").value = "";
      byId("queue-scope").value = "";
      byId("queue-provider").value = "";
      byId("queue-lane").value = "";
      byId("queue-format").value = "";
      byId("queue-sort").value = "usage_signal";
      applyQueueFilter();
      renderQueue();
    });

    byId("queue-prev").addEventListener("click", () => {
      if (queueState.page > 0) {
        queueState.page -= 1;
        renderQueue();
        byId("queue-section").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    byId("queue-next").addEventListener("click", () => {
      queueState.page += 1;
      renderQueue();
      byId("queue-section").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function renderReviewQueue() {
    if (!index) {
      const section = byId("queue-section");
      if (section) {
        section.innerHTML = '<div class="panel"><div class="empty">output/file_to_api_index.js 가 없습니다. 인덱스 자산을 먼저 생성해야 합니다.</div></div>';
      }
      return;
    }
    renderQueueCopy();
    populateQueueSelects();
    applyQueueFilter();
    renderQueue();
    wireQueueEvents();
  }

  function initReveal() {
    const nodes = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 },
    );

    nodes.forEach((node) => observer.observe(node));
  }

  function renderFunnelSection() {
    const funnel = byId("funnel");
    if (!funnel) return;

    const overview = data.overview;
    const candidateCount = overview.candidate_count || 0;
    const priorityCount = overview.priority_count || 0;
    const split = overview.priority_split || {};
    const dlPassCount = split.dl_pass_count || 0;
    const coreAddedCount = split.core_added_count || 0;
    const criteria = overview.criteria_funnel || [];

    // 7 단계: 검토 모집단 → 다운로드 통과 → +국가중점 합류
    //         → 호스팅 → 결합 → 메타 → 다운로드 신호 핵심 후보
    // 우선 게이트는 OR 조건이라 두 단계로 나눠 보여준다 — 두 번째 화살표는 빠짐이 아닌 합류(union).
    const targets = [
      candidateCount,
      dlPassCount,
      priorityCount,
      ...criteria.map((c) => c.count || 0),
    ];
    // drops[idx]는 arrows[idx]가 표시하는 변화량.
    // arrow 0: 검토 후보 → 다운로드 통과 (빠짐)
    // arrow 1: 다운로드 통과 → 우선 후보 (합류 +)
    // arrow 2~5: 우선 후보 → 핵심 후보 (빠짐)
    const drops = [];
    for (let i = 0; i < targets.length - 1; i++) {
      const delta = targets[i + 1] - targets[i];
      drops.push(Math.abs(delta));
    }
    const UNION_ARROW_IDX = 1;

    const stages = funnel.querySelectorAll(".funnel-stage");
    const arrows = funnel.querySelectorAll(".funnel-arrow");

    // 기준 stage와 그 앞 화살표에 라벨·제목·풀이·기술적 필터 문구 동적 주입.
    // stage 번호는 03 우선 후보 다음부터(04부터) 매겨짐.
    criteria.forEach((c, i) => {
      const stage = stages[i + 3];
      const arrow = arrows[i + 2];
      const stageNum = String(i + 4).padStart(2, "0");
      if (stage) {
        const labelEl = stage.querySelector("[data-stage-label]");
        const titleEl = stage.querySelector("[data-stage-title]");
        const noteEl  = stage.querySelector("[data-criterion-note]");
        if (labelEl) labelEl.textContent = `${stageNum} · + ${c.label}`;
        if (titleEl) titleEl.textContent = c.stage_title || "";
        if (noteEl)  noteEl.textContent  = c.explanation || c.threshold_text || "";
      }
      if (arrow) {
        const labelEl = arrow.querySelector("[data-criterion-label]");
        const textEl  = arrow.querySelector("[data-criterion-text]");
        if (labelEl) labelEl.textContent = `+ ${c.label}`;
        if (textEl)  textEl.textContent  = c.threshold_text || "";
      }
    });
    targets.forEach((value, idx) => {
      const stage = stages[idx];
      if (!stage) return;
      stage.dataset.target = String(value);
      const valueEl = stage.querySelector(".funnel-stage-value");
      const fillEl = stage.querySelector(".funnel-bar-fill");
      if (valueEl) valueEl.dataset.count = String(value);
      if (fillEl) {
        const pct = candidateCount > 0 ? Math.max(0.8, (value / candidateCount) * 100) : 0;
        fillEl.dataset.fill = String(pct);
      }
    });
    arrows.forEach((arrow, idx) => {
      const dropEl = arrow.querySelector(".drop-count");
      if (dropEl) dropEl.dataset.count = String(drops[idx]);
    });

    const priorityNote = byId("funnel-stage-priority-note");
    if (priorityNote) {
      const sharePct = ((overview.priority_share || 0) * 100).toFixed(1);
      priorityNote.textContent = `다운로드 통과 ${number(dlPassCount)} + 정책 합류 ${number(coreAddedCount)} = ${number(priorityCount)} (전체 검토 후보의 ${sharePct}%)`;
    }

    const copy = byId("funnel-copy");
    const highlights = overview.priority_highlights || {};
    const poolCount = highlights.pool_count || 0;
    if (copy) {
      copy.textContent = `검토 후보 ${number(candidateCount)}건을 다운로드 1차로 ${number(dlPassCount)}건까지 좁히고, 국가중점 ${number(coreAddedCount)}건을 합류해 우선 후보 ${number(priorityCount)}건을 만듭니다. 여기에 호스팅·결합·메타·다운로드 4개 기준을 순차로 적용해 ${number(poolCount)}건의 핵심 후보군으로 추립니다.`;
    }

    // 핵심 후보 풀 안의 highlights (API 신호·국가중점·둘 다)
    const subEl = byId("priority-highlights-sub");
    if (subEl) {
      subEl.textContent = `위 ${number(poolCount)}건의 핵심 후보 안에서 — API 신호와 국가중점은 강제 필터가 아닌 '추가 우선순위 표시'입니다.`;
    }
    const highlightCounts = {
      api: highlights.api_count,
      core: highlights.core_count,
      both: highlights.both_count,
    };
    Object.entries(highlightCounts).forEach(([key, value]) => {
      const el = document.querySelector(`[data-highlight-count="${key}"]`);
      if (el) el.textContent = number(value || 0);
    });

    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function animateNumber(el, finalValue, duration) {
      const start = performance.now();
      function step(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = number(Math.floor(finalValue * eased));
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = number(finalValue);
        }
      }
      requestAnimationFrame(step);
    }

    function reset() {
      stages.forEach((stage) => {
        stage.classList.remove("is-visible");
        const valueEl = stage.querySelector(".funnel-stage-value");
        const fillEl = stage.querySelector(".funnel-bar-fill");
        if (valueEl) valueEl.textContent = "—";
        if (fillEl) fillEl.style.width = "0%";
      });
      arrows.forEach((arrow) => {
        arrow.classList.remove("is-visible");
        const dropEl = arrow.querySelector(".drop-count");
        if (dropEl) dropEl.textContent = "—";
      });
    }

    function play() {
      reset();
      if (reduceMotion) {
        stages.forEach((stage, idx) => {
          stage.classList.add("is-visible");
          const valueEl = stage.querySelector(".funnel-stage-value");
          const fillEl = stage.querySelector(".funnel-bar-fill");
          if (valueEl) valueEl.textContent = number(targets[idx]);
          if (fillEl) fillEl.style.width = `${fillEl.dataset.fill}%`;
        });
        arrows.forEach((arrow, idx) => {
          arrow.classList.add("is-visible");
          const dropEl = arrow.querySelector(".drop-count");
          if (dropEl) dropEl.textContent = number(drops[idx]);
        });
        return;
      }

      function showStage(idx, dur) {
        stages[idx].classList.add("is-visible");
        animateNumber(stages[idx].querySelector(".funnel-stage-value"), targets[idx], dur);
        requestAnimationFrame(() => {
          const fill = stages[idx].querySelector(".funnel-bar-fill");
          if (fill) fill.style.width = `${fill.dataset.fill}%`;
        });
      }
      function showArrow(idx, dur) {
        arrows[idx].classList.add("is-visible");
        animateNumber(arrows[idx].querySelector(".drop-count"), drops[idx], dur);
      }

      // 9 단계: stage 0(big) → arrow 0 → stage 1 → arrow 1 → ... → stage 8
      // 첫 stage는 700ms 카운트, 그 후 stage 500ms, arrow 400ms, 간격 480ms
      const sequence = [];
      let t = 0;
      const stageDur = 600;
      const arrowDur = 400;
      const stageGap = 480;
      const arrowGap = 380;
      sequence.push({ delay: t, action: () => showStage(0, 700) });
      t += stageGap + 220;
      for (let i = 0; i < arrows.length; i++) {
        sequence.push({ delay: t, action: () => showArrow(i, arrowDur) });
        t += arrowGap;
        sequence.push({ delay: t, action: () => showStage(i + 1, stageDur) });
        t += stageGap;
      }
      sequence.forEach(({ delay, action }) => setTimeout(action, delay));
    }

    let played = false;
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !played) {
            played = true;
            play();
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });
      observer.observe(funnel);
    } else {
      play();
    }

    const replayBtn = byId("funnel-replay");
    if (replayBtn) {
      replayBtn.addEventListener("click", play);
    }
  }

  function renderWhySection() {
    const counterEl = byId("why-counter-value");
    const counter = byId("why-counter");
    if (!counterEl || !counter) return;

    const final = Number(data.overview.signal_total) || 0;
    counter.dataset.final = String(final);

    const sublabel = byId("why-counter-sublabel");
    if (sublabel) {
      sublabel.textContent =
        `이 검토 큐의 ${number(data.overview.candidate_count)}건에서 관찰된 다운로드·API 신청 신호입니다. 절감량의 확정치가 아니라 반복 수요의 규모를 보는 지표입니다.`;
    }

    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function animateCounter() {
      if (counterEl.dataset.animated === "1") return;
      counterEl.dataset.animated = "1";

      if (reduceMotion || final === 0) {
        counterEl.textContent = number(final);
        return;
      }

      const duration = 1800;
      const start = performance.now();
      function step(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = Math.floor(final * eased);
        counterEl.textContent = number(value);
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          counterEl.textContent = number(final);
        }
      }
      requestAnimationFrame(step);
    }

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter();
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      observer.observe(counter);
    } else {
      animateCounter();
    }

    const replayBtn = byId("why-replay");
    const fileSteps = Array.from(document.querySelectorAll("#why-steps-file li"));
    const apiSteps = Array.from(document.querySelectorAll("#why-steps-api li"));

    function reset() {
      fileSteps.concat(apiSteps).forEach((li) => {
        li.classList.remove("is-active", "is-done");
      });
    }

    function play() {
      reset();
      if (reduceMotion) {
        fileSteps.concat(apiSteps).forEach((li) => li.classList.add("is-done"));
        return;
      }
      apiSteps.forEach((li, i) => {
        setTimeout(() => li.classList.add("is-done"), 80 * (i + 1));
      });
      fileSteps.forEach((li, i) => {
        const enterDelay = 700 * (i + 1);
        setTimeout(() => {
          li.classList.add("is-active");
          setTimeout(() => {
            li.classList.remove("is-active");
            li.classList.add("is-done");
          }, 600);
        }, enterDelay);
      });
    }

    if (replayBtn) {
      replayBtn.addEventListener("click", play);
    }
  }

  function init() {
    if (!data) {
      document.body.innerHTML = '<main class="app"><div class="empty">output/file_to_api_summary.js 가 없습니다. 요약 자산을 먼저 생성해야 합니다.</div></main>';
      return;
    }

    renderOverview();
    renderFreshnessAndChanges();
    renderShape();
    renderProviders();
    renderShortlist();
    renderReviewQueue();
    renderFunnelSection();
    renderWhySection();
    initReveal();
  }

  init();
})();
