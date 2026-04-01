(function () {
  const data = window.FILE_TO_API_DATA;
  let visibleStrongCount = 12;

  function byId(id) {
    return document.getElementById(id);
  }

  function number(value) {
    return new Intl.NumberFormat("en-US").format(value || 0);
  }

  function percent(value) {
    return `${((value || 0) * 100).toFixed(1)}%`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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
    return `lane lane-${String(lane || '').toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
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
      { label: "Signal", value: number(row.usage_total_signal) },
      { label: "Downloads", value: number(row.signal_downloads) },
      { label: "API applies", value: number(row.usage_openapi_apply_count_total) },
      { label: "Join", value: row.source_combo },
      { label: "Format", value: row.data_format || "-" },
      { label: "Years", value: String(yearText) },
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
    return `
      <article class="shortlist-card">
        <div class="card-head">
          <div>
            <span class="rank">${String(row.rank).padStart(2, "0")}</span>
          </div>
          <span class="${laneClass(row.inspect_lane)}">${escapeHtml(row.inspect_lane)}</span>
        </div>
        <h3 class="title">${escapeHtml(row.title)}</h3>
        <div class="provider">${escapeHtml(row.provider_name)}</div>
        <div class="tag-row">
          <span class="tag">${escapeHtml(row.source_combo_label)}</span>
          <span class="tag">richness ${escapeHtml(row.metadata_richness_score)}</span>
          ${row.has_response_fields ? '<span class="tag">response fields</span>' : ""}
          ${row.usage_openapi_apply_count_total ? `<span class="tag">api applies ${escapeHtml(number(row.usage_openapi_apply_count_total))}</span>` : ""}
        </div>
        <div class="meta-row">${metaItems(row)}</div>
        <p class="section-copy">${escapeHtml(row.candidate_reason_summary)}</p>
        <div class="action-note">
          <div class="action-label">Next move</div>
          <div class="action-copy">${escapeHtml(row.inspect_rationale)}</div>
        </div>
        ${reasonList(row.candidate_reasons)}
      </article>
    `;
  }

  function strongestCard(row) {
    return `
      <details class="strong-card"${row.rank <= 3 ? " open" : ""}>
        <summary class="strong-summary">
          <div class="detail-topline">
            <span class="rank">${String(row.rank).padStart(2, "0")}</span>
            <span class="tag">${escapeHtml(row.source_combo)}</span>
          </div>
          <div>
            <h3 class="title">${escapeHtml(row.title)}</h3>
            <div class="provider">${escapeHtml(row.provider_name)}</div>
          </div>
          <div class="meta-row">${metaItems(row)}</div>
          <p class="summary-copy">${escapeHtml(row.candidate_reason_summary)}</p>
        </summary>
        <div class="detail-body">
          <div class="tag-row">
            <span class="tag">${escapeHtml(row.source_combo_label)}</span>
            <span class="tag">richness ${escapeHtml(row.metadata_richness_score)}</span>
            ${row.has_response_fields ? '<span class="tag">response fields</span>' : ""}
            ${row.has_request_variables ? '<span class="tag">request vars</span>' : ""}
            <span class="tag">${escapeHtml(row.signal_download_basis)}</span>
          </div>
          ${reasonList(row.candidate_reasons)}
        </div>
      </details>
    `;
  }

  function providerRow(item) {
    return `
      <div class="provider-row">
        <div class="provider-topline">
          <div>
            <div class="provider-name">${escapeHtml(item.provider_name)}</div>
            <div class="muted">${escapeHtml(number(item.candidate_count))} candidates</div>
          </div>
          <div class="provider-metric">${escapeHtml(number(item.signal_total))}</div>
        </div>
        <div class="provider-meta">
          <div>
            <div class="mini-label">Response fields</div>
            <div class="mini-value">${escapeHtml(number(item.response_field_count))}</div>
          </div>
          <div>
            <div class="mini-label">All three joined</div>
            <div class="mini-value">${escapeHtml(number(item.joined_count))}</div>
          </div>
          <div>
            <div class="mini-label">Shortlist hits</div>
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
    const providerRollup = data.provider_rollup;
    byId("hero-lede").textContent =
      `${number(overview.candidate_count)} file rows clear the current file-to-API heuristic. ` +
      `This is now mostly a prioritization problem, not a raw join problem, because ${number(overview.joined_count)} already attach universe, metadata, and usage.`;
    byId("asset-note").textContent =
      `${number(data.source_assets.summary_js_bytes)} bytes from ${data.source_assets.summary_js_path} instead of ${number(data.source_assets.master_bytes)} bytes from ${data.source_assets.master_path}`;

    byId("hero-metrics").innerHTML = [
      {
        label: "Candidates",
        value: number(overview.candidate_count),
        note: `${percent(overview.share_of_merged)} of merged catalog`,
      },
      {
        label: "All three joined",
        value: percent(overview.joined_share),
        note: `${number(overview.joined_count)} rows already attach universe, metadata, and usage`,
      },
      {
        label: "Response fields",
        value: percent(overview.response_field_share),
        note: `${number(overview.response_field_count)} rows already show output fields`,
      },
      {
        label: "Top-10 providers",
        value: percent(providerRollup.top_10_share),
        note: "candidate concentration in the first provider cluster",
      },
    ]
      .map(metricCard)
      .join("");

    byId("priority-strip").innerHTML = [
      {
        label: "Inspect-first shortlist",
        value: `${number(data.shortlist.items.length)} rows`,
        note: "Balanced across metadata-ready, demand leader, cross-channel demand, and usage-gap checks.",
      },
      {
        label: "Immediate conversion surface",
        value: `${number(overview.response_field_count)} rows`,
        note: "These already expose response fields, so the contract is less speculative.",
      },
      {
        label: "Cross-channel demand",
        value: `${number(overview.api_applies_present_count)} rows`,
        note: "File demand is already paired with API-side demand in a meaningful minority of the queue.",
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
        label: "All three joined",
        value: percent(overview.joined_share),
        note: `${number(overview.joined_count)} rows already attach universe, metadata, and usage`,
      },
      {
        label: "Usage attached",
        value: percent(overview.usage_attached_share),
        note: `${number(overview.usage_attached_count)} rows carry usage history`,
      },
      {
        label: "Response fields",
        value: percent(overview.response_field_share),
        note: `${number(overview.response_field_count)} rows already show output fields`,
      },
      {
        label: "API applies present",
        value: percent(overview.api_applies_present_share),
        note: `${number(overview.api_applies_present_count)} rows already see some API-side demand`,
      },
    ]
      .map(metricCard)
      .join("");

    byId("source-combo-bars").innerHTML = barRows(
      data.slice_shape.source_combos.map((item) => ({
        label: item.label,
        value: percent(item.share),
        note: `${number(item.count)} rows`,
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
      `The top 10 providers account for ${percent(providerRollup.top_10_share)} of all file-to-API candidates. Start there if the goal is queue reduction, not tail coverage.`;
    byId("provider-list").innerHTML = providerRollup.providers.map(providerRow).join("");
  }

  function renderShortlist() {
    const metadataReady = data.shortlist.items.filter((item) => item.inspect_lane === 'Metadata-ready').length;
    const usageGap = data.shortlist.items.filter((item) => item.inspect_lane === 'Usage gap check').length;
    byId("shortlist-copy").textContent =
      `${data.shortlist.ranking_note} ${number(metadataReady)} rows are already metadata-ready, while ${number(usageGap)} rows are in the shortlist mainly because the join still needs a human check.`;
    byId("shortlist-grid").innerHTML = data.shortlist.items.map(shortlistCard).join("");
  }

  function renderStrongest() {
    const strongest = data.strongest_candidates.items;
    const shown = strongest.slice(0, visibleStrongCount);
    byId("strongest-copy").textContent =
      `${data.strongest_candidates.ranking_note} Showing ${number(shown.length)} of ${number(strongest.length)} rows in the light asset.`;
    byId("strongest-list").innerHTML = shown.map(strongestCard).join("");

    const button = byId("show-more");
    if (visibleStrongCount >= strongest.length) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    button.textContent = `Show ${Math.min(12, strongest.length - visibleStrongCount)} more`;
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
      document.body.innerHTML = '<main class="app"><div class="empty">Missing output/file_to_api_summary.js. Run `python3 scripts/build_file_to_api_assets.py` first.</div></main>';
      return;
    }

    renderOverview();
    renderShape();
    renderProviders();
    renderShortlist();
    renderStrongest();
    initReveal();

    byId("show-more").addEventListener("click", () => {
      visibleStrongCount += 12;
      renderStrongest();
    });
  }

  init();
})();
