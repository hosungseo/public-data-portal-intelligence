(function () {
  const data = window.FILE_TO_API_DATA;
  const index = window.FILE_TO_API_INDEX;
  let visibleStrongCount = 12;

  const QUEUE_PAGE_SIZE = 50;
  const queueState = {
    search: "",
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
    "Universe + metadata + usage": "우주 + 메타 + 이용이력",
    "Universe + metadata": "우주 + 메타",
    "Metadata + usage": "메타 + 이용이력",
    "Universe only": "우주만 결합",
    "Universe + usage": "우주 + 이용이력",
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

  function portalSearchUrl(title) {
    return `https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=${encodeURIComponent(title || "")}`;
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
      { label: "API 신청", value: number(row.usage_openapi_apply_count_total) },
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

  function shortlistCard(row) {
    const evidence = serverEvidence(row);
    const lane = row.inspect_lane || deriveLaneFromEvidence(evidence);
    return `
      <article class="shortlist-card">
        <div class="card-head">
          <div>
            <span class="rank">${String(row.rank).padStart(2, "0")}</span>
          </div>
          <span class="${laneClass(lane)}">${escapeHtml(laneLabel(lane))}</span>
        </div>
        <h3 class="title">${escapeHtml(row.title)}</h3>
        <div class="provider">${escapeHtml(row.provider_name)}</div>
        <div class="action-note">
          <div class="action-label">왜 먼저 검토?</div>
          <div class="action-copy">${escapeHtml(koRationale(evidence, lane))}</div>
        </div>
        <div class="tag-row">
          <span class="tag">${escapeHtml(sourceComboLabel(row.source_combo_label))}</span>
          <span class="tag">메타정보 ${escapeHtml(row.metadata_richness_score)}</span>
          ${row.has_response_fields ? '<span class="tag">응답 필드 있음</span>' : ""}
          ${row.usage_openapi_apply_count_total ? `<span class="tag">API 신청 ${escapeHtml(number(row.usage_openapi_apply_count_total))}</span>` : ""}
        </div>
        <div class="meta-row">${metaItems(row)}</div>
        <div class="summary-label">근거 요약</div>
        <p class="summary-copy">${escapeHtml(koReasonSummary(evidence))}</p>
        ${reasonList(koReasons(evidence))}
      </article>
    `;
  }

  function strongestCard(row) {
    const evidence = serverEvidence(row);
    const lane = row.inspect_lane || deriveLaneFromEvidence(evidence);
    return `
      <details class="strong-card"${row.rank <= 3 ? " open" : ""}>
        <summary class="strong-summary">
          <div class="detail-topline">
            <span class="rank">${String(row.rank).padStart(2, "0")}</span>
            <span class="tag">${escapeHtml(sourceComboLabel(row.source_combo_label))}</span>
          </div>
          <div>
            <h3 class="title">${escapeHtml(row.title)}</h3>
            <div class="provider">${escapeHtml(row.provider_name)}</div>
          </div>
          <div class="meta-row">${metaItems(row)}</div>
          <div class="action-note">
            <div class="action-label">왜 먼저 검토?</div>
            <div class="action-copy">${escapeHtml(koRationale(evidence, lane))}</div>
          </div>
          <div class="summary-label">근거 요약</div>
          <p class="summary-copy">${escapeHtml(koReasonSummary(evidence))}</p>
        </summary>
        <div class="detail-body">
          <div class="tag-row">
            <span class="tag">${escapeHtml(sourceComboLabel(row.source_combo_label))}</span>
            <span class="tag">메타정보 ${escapeHtml(row.metadata_richness_score)}</span>
            ${row.has_response_fields ? '<span class="tag">응답 필드 있음</span>' : ""}
            ${row.has_request_variables ? '<span class="tag">요청 변수 있음</span>' : ""}
            <span class="tag">${escapeHtml(basisLabel(row.signal_download_basis))}</span>
          </div>
          <div class="detail-evidence">
            <div class="meta-item"><div class="meta-label">갱신 주기</div><div class="meta-value">${escapeHtml(row.update_cycle || '-')}</div></div>
            <div class="meta-item"><div class="meta-label">전체 행 수</div><div class="meta-value">${escapeHtml(number(row.total_rows))}</div></div>
            <div class="meta-item"><div class="meta-label">이용 이력 행 수</div><div class="meta-value">${escapeHtml(number(row.usage_row_count))}</div></div>
            <div class="meta-item"><div class="meta-label">이력 연도</div><div class="meta-value">${escapeHtml(yearSpanText(row))}</div></div>
            <div class="meta-item"><div class="meta-label">포털 list_key</div><div class="meta-value">${escapeHtml(row.list_key || '-')}</div></div>
            <div class="meta-item"><div class="meta-label">다운로드 기준</div><div class="meta-value">${escapeHtml(basisLabel(row.signal_download_basis))}</div></div>
          </div>
          <div class="detail-links">
            <a class="detail-link" href="${escapeHtml(portalSearchUrl(row.title))}" target="_blank" rel="noreferrer noopener">포털에서 제목으로 검색 ↗</a>
          </div>
          ${reasonList(koReasons(evidence))}
        </div>
      </details>
    `;
  }

  function providerRow(item) {
    const shareText = percent(item.share_of_candidates || 0);
    const actionText = item.shortlist_count > 0
      ? `이 기관은 전체 후보의 ${shareText}를 차지하며, 바로 우선 검토로 넘겨볼 수 있는 후보가 ${number(item.shortlist_count)}건 있습니다.`
      : `이 기관은 후보가 많이 몰려 있어 큐를 줄이는 관점에서는 중요하지만, 바로 우선 검토로 분류된 후보는 아직 없습니다.`;
    return `
      <div class="provider-row">
        <div class="provider-topline">
          <div>
            <div class="provider-name">${escapeHtml(item.provider_name)}</div>
            <div class="muted">${escapeHtml(number(item.candidate_count))}건 후보 · 전체의 ${escapeHtml(shareText)}</div>
          </div>
          <div class="provider-metric">${escapeHtml(number(item.shortlist_count))}</div>
        </div>
        <div class="provider-action">
          <strong>어디부터 줄일까?</strong>
          <div class="provider-submetric">${escapeHtml(actionText)}</div>
        </div>
        <div class="provider-meta">
          <div>
            <div class="mini-label">응답 필드</div>
            <div class="mini-value">${escapeHtml(number(item.response_field_count))}</div>
          </div>
          <div>
            <div class="mini-label">3종 결합</div>
            <div class="mini-value">${escapeHtml(number(item.joined_count))}</div>
          </div>
          <div>
            <div class="mini-label">우선 검토</div>
            <div class="mini-value">${escapeHtml(number(item.shortlist_count))}</div>
          </div>
        </div>
        <div class="provider-examples">
          ${item.top_examples
            .map(
              (example) => `
                <span class="example-pill">
                  ${escapeHtml(example.title)} · ${escapeHtml(number(example.signal_downloads))}
                </span>
              `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderOverview() {
    const overview = data.overview;
    byId("hero-lede").textContent =
      `현재 ${number(overview.candidate_count)}건의 파일데이터가 API 전환 검토 큐에 올라와 있습니다. ` +
      `이미 메타데이터와 이용 이력이 어느 정도 붙어 있는 만큼, 지금의 질문은 무엇을 먼저 API 전환 검토 대상으로 볼 것인가입니다.`;
    byId("asset-note").textContent =
      `현재 페이지는 ${data.source_assets.summary_js_path} (${number(data.source_assets.summary_js_bytes)} bytes) 기준으로 동작하며, 전체 마스터 자산 ${data.source_assets.master_path} (${number(data.source_assets.master_bytes)} bytes) 전체를 직접 노출하지 않습니다.`;

    byId("hero-metrics").innerHTML = [
      {
        label: "검토 후보",
        value: number(overview.candidate_count),
        note: `전체 병합 카탈로그의 ${percent(overview.share_of_merged)}`,
      },
      {
        label: "즉시 검토 가능",
        value: number(overview.response_field_count),
        note: `응답 필드가 보여 API 설계를 덜 추측적으로 시작할 수 있는 ${number(overview.response_field_count)}건`,
      },
      {
        label: "교차수요 관찰",
        value: number(overview.api_applies_present_count),
        note: `파일 수요와 API형 수요가 함께 관찰되는 ${number(overview.api_applies_present_count)}건`,
      },
    ]
      .map(metricCard)
      .join("");

    byId("explainer-copy").textContent =
      `이 페이지는 공공데이터포털 파일데이터 가운데, 수요와 메타데이터 상태를 바탕으로 무엇을 먼저 API 전환 검토 대상으로 볼지 빠르게 가늠하기 위한 검토 큐입니다.`;

    byId("priority-strip").innerHTML = [
      {
        label: "우선 검토 묶음",
        value: `${number(data.shortlist.items.length)}건`,
        note: "즉시 검토 가능, 수요 우선, 교차수요, 이력 재검증 필요 후보를 함께 묶어 보여줍니다.",
      },
      {
        label: "즉시 검토 가능",
        value: `${number(overview.response_field_count)}건`,
        note: "응답 필드가 이미 드러나 데이터 구조를 더 쉽게 파악할 수 있습니다.",
      },
      {
        label: "교차수요 관찰",
        value: `${number(overview.api_applies_present_count)}건`,
        note: "파일 수요와 API형 수요가 함께 관찰되어 전환 검토 압력이 상대적으로 높습니다.",
      },
    ]
      .map((item) => `
        <div class="priority-item">
          <div class="priority-label">${escapeHtml(item.label)}</div>
          <div class="priority-value">${escapeHtml(item.value)}</div>
          <div class="priority-note">${escapeHtml(item.note)}</div>
        </div>
      `)
      .join("");
  }

  function renderShape() {
    const overview = data.overview;

    byId("readiness-metrics").innerHTML = [
      {
        label: "3종 결합",
        value: percent(overview.joined_share),
        note: `우주·메타·이용 이력이 함께 붙은 ${number(overview.joined_count)}건`,
      },
      {
        label: "이용 이력 부착",
        value: percent(overview.usage_attached_share),
        note: `이용 이력이 붙은 ${number(overview.usage_attached_count)}건`,
      },
      {
        label: "응답 필드 노출",
        value: percent(overview.response_field_share),
        note: `응답 필드가 보이는 ${number(overview.response_field_count)}건`,
      },
      {
        label: "API형 수요 관찰",
        value: percent(overview.api_applies_present_share),
        note: `API형 수요가 관찰되는 ${number(overview.api_applies_present_count)}건`,
      },
    ]
      .map(metricCard)
      .join("");

    byId("source-combo-bars").innerHTML = barRows(
      data.slice_shape.source_combos.map((item) => ({
        label: sourceComboLabel(item.label),
        value: percent(item.share),
        note: `${number(item.count)}건`,
        share: item.share,
      })),
    );

    byId("format-chips").innerHTML = data.slice_shape.data_formats
      .map((item) => chip(item.label, item.count, item.share))
      .join("");
    byId("update-chips").innerHTML = data.slice_shape.update_cycles
      .map((item) => chip(item.label, item.count, item.share))
      .join("");
  }

  function renderProviders() {
    const providerRollup = data.provider_rollup;
    byId("provider-copy").textContent =
      `상위 10개 기관이 전체 후보의 ${percent(providerRollup.top_10_share)}를 차지합니다. 어디부터 큐를 줄일지 보려면 후보가 집중된 기관과 우선 검토 후보가 함께 있는 기관을 먼저 보는 편이 효율적입니다.`;
    byId("provider-list").innerHTML = providerRollup.providers.map(providerRow).join("");
  }

  function renderShortlist() {
    const metadataReady = data.shortlist.items.filter((item) => item.inspect_lane === "Metadata-ready").length;
    const usageGap = data.shortlist.items.filter((item) => item.inspect_lane === "Usage gap check").length;
    byId("shortlist-copy").textContent =
      `${number(metadataReady)}건은 메타데이터가 더 선명해 먼저 검토하기 좋고, ${number(usageGap)}건은 전환 검토 전 이력 재확인이 더 필요합니다.`;
    byId("shortlist-grid").innerHTML = data.shortlist.items.map(shortlistCard).join("");
  }

  function renderStrongest() {
    const strongest = data.strongest_candidates.items;
    const shown = strongest.slice(0, visibleStrongCount);
    byId("strongest-copy").textContent =
      `신호 강도가 높은 후보를 먼저 펼쳐 보여줍니다. 현재 공개 자산에서는 ${number(strongest.length)}건 중 ${number(shown.length)}건을 먼저 제시합니다.`;
    byId("strongest-list").innerHTML = shown.map(strongestCard).join("");

    const button = byId("show-more");
    if (visibleStrongCount >= strongest.length) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    button.textContent = `${Math.min(12, strongest.length - visibleStrongCount)}개 더 보기`;
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
      metadata_score: r.metadata_score[i],
      flags: r.flags[i],
    };
  }

  function flagBit(row, name) {
    const mask = index.flag_bits[name];
    return (row.flags & mask) !== 0;
  }

  function deriveLane(row) {
    const hasUsage = flagBit(row, "source_usage");
    const hasResponse = flagBit(row, "has_response_fields");
    if (row.combo === "UM-" && !hasUsage) return "Usage gap check";
    if (hasResponse && row.metadata_score >= 4) return "Metadata-ready";
    if (row.api_applies > 0) return "Cross-channel demand";
    return "Demand leader";
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
      apiApplies: Number(row.usage_openapi_apply_count_total) || 0,
      threshold: 1000,
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
    const base = `다운로드 신호 ${number(e.downloads)}건, API형 메타데이터는 아직 보이지 않으며`;
    if (e.hasResponse) return `${base} 응답 필드는 이미 존재합니다.`;
    if (e.metadataScore >= 4) return `${base} 메타정보는 이미 최소 결합 형태보다 풍부합니다.`;
    return `${base} 현재는 메타정보보다 수요 신호가 더 강하게 작동합니다.`;
  }

  function koReasons(e) {
    const reasons = [
      `파일형 행이며 다운로드 신호 ${number(e.downloads)}건으로 ${number(e.threshold)}건 기준을 넘습니다.`,
      "목록 유형, 서비스 유형, 데이터 형식 기준으로 API형 메타데이터 패턴이 감지되지 않았습니다.",
    ];
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
      reasons.push(`${label}이(가) 결합되어 있지만 우주 쪽 행이 아직 없어 먼저 정합성 확인이 필요합니다.`);
    } else if (e.comboKey === "U-Y") {
      reasons.push(`${label}이(가) 결합되어 있지만 메타정보가 아직 약해, API 설계 전에 메타 보강이 필요합니다.`);
    } else {
      reasons.push(`결합 상태는 ${label}이며, API 전환 검토 전에 결합 보완이 필요합니다.`);
    }
    return reasons;
  }

  function koRationale(e, lane) {
    if (lane === "Metadata-ready") {
      return `수요가 이미 확인됐고 응답 필드도 보여서 API 설계 검토를 먼저 붙이기 쉽습니다. (다운로드 ${number(e.downloads)}건 · 메타 ${e.metadataScore}/5 · 응답 필드 존재)`;
    }
    if (lane === "Cross-channel demand") {
      return `파일 수요가 높고 API형 신청도 이미 보여, 이용자들이 API형 제공방식을 기대하고 있을 가능성이 큽니다. (다운로드 ${number(e.downloads)}건 · API 신청 ${number(e.apiApplies)}건)`;
    }
    if (lane === "Usage gap check") {
      return `현재 수요는 충분히 크지만 이용 이력이 붙지 않았습니다. 전환 계획 전에 결합 상태를 먼저 재확인해야 합니다. (다운로드 ${number(e.downloads)}건 · 결합 ${e.comboLabelKo})`;
    }
    return `요청·응답 계약이 아직 선명하지 않더라도 수요가 충분히 강해 수작업 검토를 먼저 붙일 가치가 있습니다. (다운로드 ${number(e.downloads)}건 · 메타 ${e.metadataScore}/5)`;
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
    const laneFilter = queueState.lane;
    const formatFilter = queueState.format;
    const r = index.rows;
    const total = index.count;
    const filtered = [];

    for (let i = 0; i < total; i++) {
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
          <div>
            <div class="queue-row-title">${escapeHtml(row.title || "(제목 없음)")}</div>
            <div class="queue-row-provider">${escapeHtml(row.provider)} &middot; ${escapeHtml(row.format || "-")} &middot; ${escapeHtml(evidence.comboLabelKo)}</div>
            <div class="queue-row-facts">
              <span class="queue-row-fact">종합 신호 <strong>${escapeHtml(number(row.usage_signal))}</strong></span>
              <span class="queue-row-fact">다운로드 <strong>${escapeHtml(number(row.downloads))}</strong></span>
              <span class="queue-row-fact">메타정보 <strong>${row.metadata_score}/5</strong></span>
              ${row.api_applies > 0 ? `<span class="queue-row-fact">API 신청 <strong>${escapeHtml(number(row.api_applies))}</strong></span>` : ""}
            </div>
          </div>
          <div class="queue-row-tail">
            <span class="${laneClass(lane)}">${escapeHtml(laneLabel(lane))}</span>
            <span class="queue-row-toggle">#${rank}</span>
          </div>
        </summary>
        <div class="queue-row-body">
          <div class="summary-label">근거 요약</div>
          <p class="summary-copy">${escapeHtml(koReasonSummary(evidence))}</p>
          ${reasonList(koReasons(evidence))}
          <div class="action-note">
            <div class="action-label">왜 먼저 검토?</div>
            <div class="action-copy">${escapeHtml(koRationale(evidence, lane))}</div>
          </div>
          <div class="detail-links">
            <a class="detail-link" href="${escapeHtml(portalSearchUrl(row.title))}" target="_blank" rel="noreferrer noopener">포털에서 제목으로 검색 ↗</a>
          </div>
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
      `후보 ${number(index.count)}건 전체를 여기서 검색·필터할 수 있습니다. 각 행을 펼치면 어떤 근거로 후보가 되었는지 확인할 수 있습니다.`;
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
      queueState.provider = "";
      queueState.lane = "";
      queueState.format = "";
      queueState.sort = "usage_signal";
      byId("queue-search").value = "";
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

  function init() {
    if (!data) {
      document.body.innerHTML = '<main class="app"><div class="empty">output/file_to_api_summary.js 가 없습니다. 요약 자산을 먼저 생성해야 합니다.</div></main>';
      return;
    }

    renderOverview();
    renderShape();
    renderProviders();
    renderShortlist();
    renderStrongest();
    renderReviewQueue();
    initReveal();

    byId("show-more").addEventListener("click", () => {
      visibleStrongCount += 12;
      renderStrongest();
    });
  }

  init();
})();
