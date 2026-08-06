#!/usr/bin/env python3
"""Refresh the public file-to-API review reader from official data.go.kr files.

The script uses only the Python standard library. It can either consume an
already downloaded source directory or discover and download the current files
from the three official dataset pages.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Iterable


KST = timezone(timedelta(hours=9))
DOWNLOAD_THRESHOLD = 1_000
CORE_DOWNLOAD_THRESHOLD = 2_000

SOURCES = {
    "U": {
        "list_key": "15062804",
        "label": "지원센터목록",
        "provider": "공공데이터활용지원센터",
        "page_url": "https://www.data.go.kr/data/15062804/fileData.do",
        "encoding": "utf-8-sig",
    },
    "M": {
        "list_key": "15121937",
        "label": "메타",
        "provider": "행정안전부",
        "page_url": "https://www.data.go.kr/data/15121937/fileData.do",
        "encoding": "cp949",
    },
    "Y": {
        "list_key": "15076332",
        "label": "이용이력",
        "provider": "행정안전부",
        "page_url": "https://www.data.go.kr/data/15076332/fileData.do",
        "encoding": "cp949",
    },
}

COMBO_LABELS = {
    "UMY": "Universe + metadata + usage",
    "UM-": "Universe + metadata",
    "-MY": "Metadata + usage",
    "U--": "Universe only",
    "U-Y": "Universe + usage",
    "-M-": "Metadata only",
    "--Y": "Usage only",
}

FLAG_BITS = {
    "has_response_fields": 1,
    "has_request_variables": 2,
    "source_usage": 4,
    "source_metadata": 8,
    "source_universe": 16,
    "is_priority": 32,
    "is_core_data": 64,
    "portal_hosted": 128,
    "license_restricted": 256,
}


def clean(value: Any) -> str:
    if value is None:
        return ""
    return unicodedata.normalize("NFKC", str(value)).strip()


def norm(value: Any) -> str:
    value = clean(value).casefold()
    return re.sub(r"[\s_·ㆍ\-–—()（）\[\]{}]+", "", value)


def canonical_title(value: Any) -> str:
    """Normalize a catalog title while ignoring API-only naming suffixes.

    The portal commonly publishes a file list and its API counterpart under
    names such as ``상가(상권)정보`` and ``상가(상권)정보_API``.  Removing only a
    trailing API marker lets those two channels share demand signals without
    collapsing unrelated titles that merely contain the letters ``api``.
    """

    value = clean(value).casefold()
    value = re.sub(r"(?:[\s_·ㆍ\-–—]*(?:open\s*api|오픈\s*api|api))+$", "", value, flags=re.IGNORECASE)
    return re.sub(r"[\s_·ㆍ\-–—()（）\[\]{}]+", "", value)


def safe_int(value: Any) -> int:
    text = re.sub(r"[^0-9-]", "", clean(value))
    if not text or text == "-":
        return 0
    try:
        return int(text)
    except ValueError:
        return 0


def ratio(count: int, total: int) -> float:
    return round(count / total, 4) if total else 0.0


def source_date_from_name(value: str) -> str:
    match = re.search(r"(20\d{6})", value or "")
    if not match:
        return ""
    date = match.group(1)
    return f"{date[:4]}-{date[4:6]}-{date[6:]}"


def iter_csv(path: Path, encoding: str) -> Iterable[dict[str, str]]:
    with path.open("r", encoding=encoding, newline="", errors="replace") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            yield {clean(k).lstrip("\ufeff"): clean(v) for k, v in raw.items() if k is not None}


def entity_key(provider: str, title: str) -> tuple[str, str]:
    return norm(provider), canonical_title(title)


def fetch_text(url: str, opener: urllib.request.OpenerDirector) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 pdpi-refresh/1.0"})
    with opener.open(request, timeout=90) as response:
        return response.read().decode("utf-8", errors="replace")


def discover_download(source: dict[str, str], opener: urllib.request.OpenerDirector) -> dict[str, str]:
    html = fetch_text(source["page_url"], opener)
    dpk_match = re.search(r'id="publicDataDetailPk"[^>]+value="([^"]+)"', html)
    onclick_match = re.search(
        rf"fn_fileDataDown\('{source['list_key']}',\s*'([^']+)',\s*'[^']*',\s*'(\d+)',\s*'(\d+)'\)",
        html,
    )
    if not dpk_match or not onclick_match:
        raise RuntimeError(f"download metadata not found for {source['list_key']}")

    dpk = dpk_match.group(1)
    file_detail_sn = onclick_match.group(2)
    payload = urllib.parse.urlencode(
        {
            "publicDataDetailPk": dpk,
            "publicDataPk": source["list_key"],
            "atchFileId": "",
            "fileDetailSn": file_detail_sn,
            "publicDataTyCode": "PR0051",
        }
    ).encode()
    request = urllib.request.Request(
        "https://www.data.go.kr/tcs/dss/selectFileDataDownload.do",
        data=payload,
        headers={
            "User-Agent": "Mozilla/5.0 pdpi-refresh/1.0",
            "Referer": source["page_url"],
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with opener.open(request, timeout=90) as response:
        info = json.loads(response.read().decode("utf-8"))
    if not info.get("status"):
        raise RuntimeError(f"download discovery failed for {source['list_key']}")

    detail = info.get("dataSetFileDetailInfo") or {}
    file_info = info.get("fileDataRegistVO") or {}
    file_id = info["atchFileId"]
    filename = clean(file_info.get("orginlFileNm")) or f"{source['list_key']}.csv"
    return {
        "download_url": (
            "https://www.data.go.kr/cmm/cmm/fileDownload.do?"
            + urllib.parse.urlencode(
                {"atchFileId": file_id, "fileDetailSn": file_detail_sn, "insertDataPrcus": "N"}
            )
        ),
        "filename": filename,
        "snapshot_date": source_date_from_name(clean(detail.get("dataNm")) or filename),
        "row_count_reported": clean(detail.get("atchFileCo")),
        "next_registration_date": clean(detail.get("nextRegistPrarnde")),
    }


def download_sources(source_dir: Path) -> dict[str, dict[str, str]]:
    source_dir.mkdir(parents=True, exist_ok=True)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    manifest: dict[str, dict[str, str]] = {}
    for code, source in SOURCES.items():
        found = discover_download(source, opener)
        suffix_date = found["snapshot_date"].replace("-", "") or "current"
        path = source_dir / f"{code}_{suffix_date}.csv"
        request = urllib.request.Request(
            found["download_url"], headers={"User-Agent": "Mozilla/5.0 pdpi-refresh/1.0", "Referer": source["page_url"]}
        )
        with opener.open(request, timeout=300) as response, path.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
        manifest[code] = {**source, **found, "path": str(path), "bytes": path.stat().st_size}
        print(f"downloaded {code}: {path.name} ({path.stat().st_size:,} bytes)", file=sys.stderr)
    return manifest


def locate_sources(source_dir: Path) -> dict[str, dict[str, str]]:
    manifest: dict[str, dict[str, str]] = {}
    for code, source in SOURCES.items():
        matches = sorted(source_dir.glob(f"{code}_*.csv"))
        if not matches:
            raise FileNotFoundError(f"missing {code}_*.csv in {source_dir}")
        path = matches[-1]
        manifest[code] = {
            **source,
            "path": str(path),
            "bytes": path.stat().st_size,
            "snapshot_date": source_date_from_name(path.name),
            "row_count_reported": "",
            "next_registration_date": "",
        }
    return manifest


@dataclass
class Usage:
    file_total: int = 0
    api_total: int = 0
    row_count: int = 0
    year_min: int = 0
    year_max: int = 0

    def add(self, row: dict[str, str]) -> None:
        count = safe_int(row.get("다운로드_활용신청 수"))
        kind = norm(row.get("구분"))
        if "파일" in kind:
            self.file_total += count
        elif "api" in kind or "오픈" in kind:
            self.api_total += count
        self.row_count += 1
        year = safe_int(row.get("통계연도"))
        if year:
            self.year_min = year if not self.year_min else min(self.year_min, year)
            self.year_max = max(self.year_max, year)


def build_reader(manifest: dict[str, dict[str, str]], previous: dict[str, Any] | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
    u_path = Path(manifest["U"]["path"])
    m_path = Path(manifest["M"]["path"])
    y_path = Path(manifest["Y"]["path"])

    universe: dict[str, dict[str, str]] = {}
    metadata: dict[str, dict[str, str]] = {}
    api_current_by_entity: dict[tuple[str, str], int] = defaultdict(int)
    api_current_by_title: dict[str, int] = defaultdict(int)

    u_row_count = 0
    for row in iter_csv(u_path, manifest["U"]["encoding"]):
        u_row_count += 1
        list_key = clean(row.get("목록키"))
        kind = clean(row.get("목록유형")).upper()
        title = clean(row.get("목록명"))
        provider = clean(row.get("제공기관"))
        if kind == "FILE" and list_key:
            universe[list_key] = row
        elif kind == "API":
            count = safe_int(row.get("다운로드_활용신청건수"))
            api_current_by_entity[entity_key(provider, title)] += count
            api_current_by_title[canonical_title(title)] += count

    m_row_count = 0
    for row in iter_csv(m_path, manifest["M"]["encoding"]):
        m_row_count += 1
        list_key = clean(row.get("목록키"))
        if clean(row.get("목록유형")).upper() == "FILE" and list_key:
            metadata[list_key] = row

    usage_by_entity: dict[tuple[str, str], Usage] = defaultdict(Usage)
    usage_by_title: dict[str, Usage] = defaultdict(Usage)
    y_row_count = 0
    for row in iter_csv(y_path, manifest["Y"]["encoding"]):
        y_row_count += 1
        key = entity_key(row.get("등록기관", ""), row.get("목록명", ""))
        usage_by_entity[key].add(row)
        usage_by_title[canonical_title(row.get("목록명"))].add(row)
    records: list[dict[str, Any]] = []
    all_keys = set(universe) | set(metadata)
    for list_key in all_keys:
        u = universe.get(list_key, {})
        m = metadata.get(list_key, {})
        title = clean(m.get("목록명") or u.get("목록명") or u.get("파일데이터명"))
        provider = clean(m.get("제공기관명") or u.get("제공기관"))
        key = entity_key(provider, title)
        entity_usage = usage_by_entity.get(key) or Usage()
        title_usage = usage_by_title.get(canonical_title(title)) or Usage()

        # File-use history is normally keyed by the catalog's owning provider.
        # API-use history often names 공공데이터활용지원센터 as the registrant,
        # so its cross-channel signal needs a title fallback even when the file
        # history already matched by provider.
        usage_file = entity_usage.file_total or title_usage.file_total
        usage_api = entity_usage.api_total or title_usage.api_total
        usage_rows = entity_usage.row_count or title_usage.row_count
        years_min = [year for year in (entity_usage.year_min, title_usage.year_min) if year]
        years_max = [year for year in (entity_usage.year_max, title_usage.year_max) if year]
        usage_year_min = min(years_min) if years_min else 0
        usage_year_max = max(years_max) if years_max else 0

        current_file = safe_int(u.get("다운로드_활용신청건수"))
        current_api = api_current_by_entity.get(key, 0)
        if not current_api:
            current_api = api_current_by_title.get(canonical_title(title), 0)

        downloads = usage_file or current_file
        api_signal = usage_api or current_api
        usage_total = downloads + api_signal
        has_u = bool(u)
        has_m = bool(m)
        has_y = usage_rows > 0
        combo = ("U" if has_u else "-") + ("M" if has_m else "-") + ("Y" if has_y else "-")

        data_format = clean(m.get("데이터포맷") or u.get("확장자(데이터포맷)"))
        update_cycle = clean(m.get("주기") or u.get("업데이트 주기"))
        total_rows = clean(m.get("전체행") or u.get("전체행"))
        has_request = bool(clean(m.get("요청변수")))
        has_response = bool(clean(m.get("출력결과")))
        metadata_score = sum([bool(data_format), bool(update_cycle), bool(total_rows), has_request, has_response])
        is_core = clean(u.get("국가중점여부")).upper() == "Y"
        portal_hosted = "공공데이터포털에서다운로드" in norm(u.get("제공형태"))
        license_text = clean(u.get("이용허락범위"))
        license_restricted = any(token in license_text for token in ("상업적 이용금지", "변경금지", "비영리"))
        is_priority = downloads >= DOWNLOAD_THRESHOLD or is_core

        if combo == "UM-":
            lane = "Usage gap check"
        elif has_response and metadata_score >= 4:
            lane = "Metadata-ready"
        elif api_signal > 0:
            lane = "Cross-channel demand"
        else:
            lane = "Demand leader"

        score = (
            usage_total
            + downloads
            + metadata_score * 10_000
            + (120_000 if has_response else 0)
            + (35_000 if has_request else 0)
            + (35_000 if combo == "UMY" else 0)
            + (500_000 if is_core else 0)
            + (25_000 if portal_hosted else 0)
            - (35_000 if license_restricted else 0)
        )
        flags = 0
        for enabled, name in [
            (has_response, "has_response_fields"),
            (has_request, "has_request_variables"),
            (has_y, "source_usage"),
            (has_m, "source_metadata"),
            (has_u, "source_universe"),
            (is_priority, "is_priority"),
            (is_core, "is_core_data"),
            (portal_hosted, "portal_hosted"),
            (license_restricted, "license_restricted"),
        ]:
            if enabled:
                flags |= FLAG_BITS[name]

        records.append(
            {
                "list_key": list_key,
                "title": title,
                "provider_name": provider,
                "source_combo": combo,
                "source_combo_label": COMBO_LABELS.get(combo, combo),
                "data_format": data_format or "-",
                "update_cycle": update_cycle or "-",
                "total_rows": total_rows,
                "metadata_richness_score": metadata_score,
                "usage_total_signal": usage_total,
                "signal_downloads": downloads,
                "signal_download_basis": "usage-rollup" if usage_file else "current-counter",
                "usage_file_download_count_total": usage_file,
                "current_file_download_count": current_file,
                "usage_openapi_apply_count_total": usage_api,
                "signal_api_applies": api_signal,
                "current_openapi_apply_count": current_api,
                "usage_row_count": usage_rows,
                "usage_year_min": usage_year_min,
                "usage_year_max": usage_year_max,
                "usage_year_span": (usage_year_max - usage_year_min + 1) if usage_year_min and usage_year_max else 0,
                "has_response_fields": has_response,
                "has_request_variables": has_request,
                "is_core_data": is_core,
                "portal_hosted": portal_hosted,
                "license_restricted": license_restricted,
                "is_priority": is_priority,
                "inspect_lane": lane,
                "shortlist_score": score,
                "flags": flags,
            }
        )

    records.sort(key=lambda row: (row["shortlist_score"], row["usage_total_signal"], row["signal_downloads"]), reverse=True)
    total = len(records)
    priority = [row for row in records if row["is_priority"]]

    combo_counts = Counter(row["source_combo"] for row in records)
    format_counts = Counter(row["data_format"] for row in records)
    cycle_counts = Counter(row["update_cycle"] for row in records)
    provider_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in records:
        provider_groups[row["provider_name"]].append(row)

    provider_rollup = []
    for provider, rows in provider_groups.items():
        provider_rollup.append(
            {
                "provider_name": provider,
                "candidate_count": len(rows),
                "share_of_candidates": ratio(len(rows), total),
                "signal_total": sum(row["usage_total_signal"] for row in rows),
                "response_field_count": sum(bool(row["has_response_fields"]) for row in rows),
                "joined_count": sum(row["source_combo"] == "UMY" for row in rows),
                "shortlist_count": 0,
                "top_examples": [
                    {"title": row["title"], "usage_total_signal": row["usage_total_signal"], "signal_downloads": row["signal_downloads"]}
                    for row in sorted(rows, key=lambda item: item["usage_total_signal"], reverse=True)[:2]
                ],
            }
        )
    provider_rollup.sort(key=lambda item: (item["candidate_count"], item["signal_total"]), reverse=True)

    def public_row(row: dict[str, Any], rank: int, include_score: bool = False) -> dict[str, Any]:
        result = {k: v for k, v in row.items() if k != "flags"}
        result["rank"] = rank
        result["candidate_reason_summary"] = candidate_summary(row)
        result["candidate_reasons"] = candidate_reasons(row)
        if not include_score:
            result.pop("shortlist_score", None)
        return result

    lane_quota = {"Metadata-ready": 4, "Demand leader": 4, "Cross-channel demand": 2, "Usage gap check": 2}
    shortlist: list[dict[str, Any]] = []
    provider_slots: Counter[str] = Counter()
    for lane, quota in lane_quota.items():
        for row in priority:
            if row["inspect_lane"] != lane or provider_slots[row["provider_name"]] >= 2:
                continue
            shortlist.append(row)
            provider_slots[row["provider_name"]] += 1
            if sum(item["inspect_lane"] == lane for item in shortlist) >= quota:
                break
    shortlist.sort(key=lambda row: row["shortlist_score"], reverse=True)
    for item in provider_rollup:
        item["shortlist_count"] = sum(row["provider_name"] == item["provider_name"] for row in shortlist)

    strong = sorted(priority, key=lambda row: (row["usage_total_signal"], row["signal_downloads"], row["metadata_richness_score"]), reverse=True)[:48]
    core_count = sum(row["is_core_data"] for row in records)
    dl_pass_count = sum(row["signal_downloads"] >= DOWNLOAD_THRESHOLD for row in records)
    core_added_count = sum(row["is_core_data"] and row["signal_downloads"] < DOWNLOAD_THRESHOLD for row in records)

    funnel_host = [row for row in priority if row["portal_hosted"] and not row["license_restricted"]]
    funnel_join = [row for row in funnel_host if row["source_combo"] == "UMY"]
    funnel_meta = [row for row in funnel_join if row["has_response_fields"]]
    funnel_download = [row for row in funnel_meta if row["signal_downloads"] >= CORE_DOWNLOAD_THRESHOLD]

    generated_at = datetime.now(KST).isoformat(timespec="seconds")
    source_snapshots = []
    for code in ("U", "M", "Y"):
        item = manifest[code]
        parsed_rows = {"U": u_row_count, "M": m_row_count, "Y": y_row_count}[code]
        source_snapshots.append(
            {
                "code": code,
                "label": item["label"],
                "list_key": item["list_key"],
                "provider": item["provider"],
                "snapshot_date": item.get("snapshot_date", ""),
                "page_url": item["page_url"],
                "row_count_reported": safe_int(item.get("row_count_reported")),
                "parsed_row_count": parsed_rows,
                "next_registration_date": item.get("next_registration_date", ""),
            }
        )

    overview = {
        "rule_label": "file_to_api_candidate",
        "rule_note": "Rows whose official catalog list type is FILE; priority when downloads >= 1,000 or designated as core data.",
        "candidate_count": total,
        "merged_count": len(set(universe) | set(metadata)),
        "share_of_merged": 1.0,
        "reviewed_universe_count": total,
        "reviewed_share": 1.0,
        "priority_count": len(priority),
        "priority_share": ratio(len(priority), total),
        "core_data_count": core_count,
        "criteria_funnel": [
            {"key": "host", "label": "호스팅", "stage_title": "운영·법적 부담이 가장 적은 데이터", "threshold_text": "포털 호스팅 + 자유 라이선스", "explanation": "공공데이터포털이 직접 파일을 호스팅하고 상업·변경 제약도 없는 우선 후보만 남깁니다.", "count": len(funnel_host)},
            {"key": "join", "label": "결합", "stage_title": "세 출처에 모두 기록이 일치하는 데이터", "threshold_text": "지원센터목록 + 메타 + 이용이력 3종 결합 (UMY)", "explanation": "목록·메타·이용이력이 모두 결합된 행만 남깁니다.", "count": len(funnel_join)},
            {"key": "meta", "label": "메타 노출", "stage_title": "출력 구조가 이미 알려진 데이터", "threshold_text": "응답 필드(컬럼 구조) 노출됨", "explanation": "응답 필드가 있어 API 출력 구조를 덜 추측적으로 검토할 수 있는 행만 남깁니다.", "count": len(funnel_meta)},
            {"key": "download", "label": "다운로드 신호 — 핵심 후보", "stage_title": "수요까지 누적된 핵심 후보군", "threshold_text": "누적 다운로드 ≥ 2,000건", "explanation": "운영·정합성·구조·수요 기준을 모두 통과한 핵심 후보입니다.", "count": len(funnel_download)},
        ],
        "priority_split": {"dl_threshold": DOWNLOAD_THRESHOLD, "dl_pass_count": dl_pass_count, "core_added_count": core_added_count, "total": len(priority)},
        "priority_highlights": {
            "pool_count": len(funnel_download),
            "api_count": sum(row["signal_api_applies"] >= 10 for row in funnel_download),
            "api_threshold": 10,
            "core_count": sum(row["is_core_data"] for row in funnel_download),
            "both_count": sum(row["signal_api_applies"] >= 10 and row["is_core_data"] for row in funnel_download),
        },
        "signal_total": sum(row["usage_total_signal"] for row in records),
        "provider_count": len(provider_groups),
        "joined_count": combo_counts["UMY"],
        "joined_share": ratio(combo_counts["UMY"], total),
        "usage_attached_count": sum("Y" in row["source_combo"] for row in records),
        "usage_attached_share": ratio(sum("Y" in row["source_combo"] for row in records), total),
        "metadata_attached_count": sum(row["source_combo"][1] == "M" for row in records),
        "metadata_attached_share": ratio(sum(row["source_combo"][1] == "M" for row in records), total),
        "response_field_count": sum(row["has_response_fields"] for row in records),
        "response_field_share": ratio(sum(row["has_response_fields"] for row in records), total),
        "api_applies_present_count": sum(row["signal_api_applies"] > 0 for row in records),
        "api_applies_present_share": ratio(sum(row["signal_api_applies"] > 0 for row in records), total),
        "top_signal": max((row["usage_total_signal"] for row in records), default=0),
        "top_downloads": max((row["signal_downloads"] for row in records), default=0),
        "historical_usage_through": max((row["usage_year_max"] for row in records), default=0),
    }

    previous_overview = (previous or {}).get("overview", {})
    changes = []
    for key, label in [
        ("candidate_count", "검토 후보"),
        ("priority_count", "우선 후보"),
        ("response_field_count", "응답 필드 노출"),
        ("api_applies_present_count", "교차수요 관찰"),
        ("core_data_count", "국가중점데이터"),
        ("provider_count", "제공기관"),
    ]:
        current_value = int(overview.get(key, 0))
        previous_value = int(previous_overview.get(key, 0))
        changes.append({"key": key, "label": label, "current": current_value, "previous": previous_value, "delta": current_value - previous_value})

    summary: dict[str, Any] = {
        "generated_at": generated_at,
        "source_snapshots": source_snapshots,
        "source_assets": {
            "summary_json_path": "output/file_to_api_summary.json",
            "summary_js_path": "output/file_to_api_summary.js",
            "index_json_path": "output/file_to_api_index.json",
            "index_js_path": "output/file_to_api_index.js",
        },
        "change_log": {
            "baseline_generated_at": (previous or {}).get("generated_at", ""),
            "metrics": changes,
            "methodology_note": (
                "이번 재산출은 최신 원천 교체와 함께 후보 모집단을 공식 목록유형=FILE로 고정하고, "
                "현재 파일 다운로드 수를 API 신청 수로 중복 집계하던 이전 집계 오류를 제거했습니다. "
                "따라서 이전판 대비 증감은 순수한 시계열 변화만을 뜻하지 않습니다."
            ),
        },
        "overview": overview,
        "slice_shape": {
            "source_combos": [{"code": code, "label": COMBO_LABELS[code], "count": count, "share": ratio(count, total)} for code, count in combo_counts.most_common()],
            "data_formats": [{"label": label, "count": count, "share": ratio(count, total)} for label, count in format_counts.most_common(8)],
            "update_cycles": [{"label": label, "count": count, "share": ratio(count, total)} for label, count in cycle_counts.most_common(8)],
        },
        "provider_rollup": {
            "provider_count": len(provider_rollup),
            "top_10_share": ratio(sum(item["candidate_count"] for item in provider_rollup[:10]), total),
            "providers": provider_rollup[:50],
        },
        "shortlist": {
            "ranking_note": "Lane-balanced shortlist: demand, metadata readiness, cross-channel demand, and usage-gap checks; max two rows per provider.",
            "items": [public_row(row, idx + 1, include_score=True) for idx, row in enumerate(shortlist)],
        },
        "strongest_candidates": {
            "ranking_note": "Demand-first: total signal, download signal, then metadata richness.",
            "display_limit": 48,
            "items": [public_row(row, idx + 1) for idx, row in enumerate(strong)],
        },
    }

    providers = [item["provider_name"] for item in provider_rollup]
    formats = [label for label, _ in format_counts.most_common()]
    combos = [code for code, _ in combo_counts.most_common()]
    provider_idx = {value: idx for idx, value in enumerate(providers)}
    format_idx = {value: idx for idx, value in enumerate(formats)}
    combo_idx = {value: idx for idx, value in enumerate(combos)}

    index = {
        "generated_at": generated_at,
        "candidate_threshold": DOWNLOAD_THRESHOLD,
        "count": total,
        "priority_count": len(priority),
        "providers": providers,
        "formats": formats,
        "combos": combos,
        "combo_labels": COMBO_LABELS,
        "lanes": ["Metadata-ready", "Demand leader", "Cross-channel demand", "Usage gap check"],
        "flag_bits": FLAG_BITS,
        "rows": {
            "list_keys": [row["list_key"] for row in records],
            "titles": [row["title"] for row in records],
            "provider_idx": [provider_idx[row["provider_name"]] for row in records],
            "format_idx": [format_idx[row["data_format"]] for row in records],
            "combo_idx": [combo_idx[row["source_combo"]] for row in records],
            "downloads": [row["signal_downloads"] for row in records],
            "usage_signal": [row["usage_total_signal"] for row in records],
            "api_applies": [row["signal_api_applies"] for row in records],
            "current_downloads": [row["current_file_download_count"] for row in records],
            "usage_year_max": [row["usage_year_max"] for row in records],
            "metadata_score": [row["metadata_richness_score"] for row in records],
            "flags": [row["flags"] for row in records],
        },
    }
    return summary, index


def candidate_summary(row: dict[str, Any]) -> str:
    base = f"다운로드 신호 {row['signal_downloads']:,}건"
    if row["has_response_fields"]:
        return f"{base}; 응답 필드가 이미 존재합니다."
    if row["metadata_richness_score"] >= 4:
        return f"{base}; 메타정보가 비교적 풍부합니다."
    return f"{base}; 현재는 구조 정보보다 수요 신호가 더 강합니다."


def candidate_reasons(row: dict[str, Any]) -> list[str]:
    reasons = [
        f"파일형 데이터이며 다운로드 신호는 {row['signal_downloads']:,}건입니다.",
        "공식 목록유형이 FILE인 행만 포함해 이미 API로 분류된 목록을 제외했습니다.",
    ]
    if row["has_response_fields"]:
        reasons.append("메타데이터에 응답 필드가 있어 출력 구조를 일부 가늠할 수 있습니다.")
    elif row["has_request_variables"]:
        reasons.append("메타데이터에 요청 변수가 있어 API 계약의 일부 단서가 보입니다.")
    else:
        reasons.append(f"메타정보는 {row['metadata_richness_score']}/5 수준이며 요청·응답 구조는 아직 얇습니다.")
    reasons.append(f"결합 상태는 {row['source_combo']}이며, 출처별 최신 시점 차이를 함께 확인해야 합니다.")
    return reasons


def write_assets(output_dir: Path, summary: dict[str, Any], index: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    compact_index = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
    (output_dir / "file_to_api_index.json").write_text(compact_index + "\n", encoding="utf-8")
    (output_dir / "file_to_api_index.js").write_text(f"window.FILE_TO_API_INDEX = {compact_index};\n", encoding="utf-8")

    # The summary reports its own published byte sizes. Iterate until those
    # values are stable so the method panel does not show a pre-update size.
    summary["source_assets"].update(
        {
            "index_json_bytes": (output_dir / "file_to_api_index.json").stat().st_size,
            "index_js_bytes": (output_dir / "file_to_api_index.js").stat().st_size,
        }
    )
    for _ in range(4):
        compact_summary = json.dumps(summary, ensure_ascii=False, separators=(",", ":"))
        summary_json = output_dir / "file_to_api_summary.json"
        summary_js = output_dir / "file_to_api_summary.js"
        summary_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        summary_js.write_text(f"window.FILE_TO_API_DATA = {compact_summary};\n", encoding="utf-8")
        actual = {
            "summary_json_bytes": summary_json.stat().st_size,
            "summary_js_bytes": summary_js.stat().st_size,
        }
        if all(summary["source_assets"].get(key) == value for key, value in actual.items()):
            break
        summary["source_assets"].update(actual)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True, help="directory containing U_*.csv, M_*.csv, Y_*.csv")
    parser.add_argument("--output-dir", type=Path, default=Path("output"))
    parser.add_argument("--download", action="store_true", help="discover and download current official source files first")
    parser.add_argument("--baseline", type=Path, help="previous summary JSON for change metrics")
    args = parser.parse_args()

    previous = None
    if args.baseline and args.baseline.exists():
        previous = json.loads(args.baseline.read_text(encoding="utf-8"))
    manifest = download_sources(args.source_dir) if args.download else locate_sources(args.source_dir)
    summary, index = build_reader(manifest, previous)
    write_assets(args.output_dir, summary, index)
    print(json.dumps({"generated_at": summary["generated_at"], "overview": summary["overview"], "sources": summary["source_snapshots"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
