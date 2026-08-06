#!/usr/bin/env python3
"""Validate published reader assets without third-party dependencies."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()

    repo = args.repo.resolve()
    output = repo / "output"
    summary = json.loads((output / "file_to_api_summary.json").read_text(encoding="utf-8"))
    index = json.loads((output / "file_to_api_index.json").read_text(encoding="utf-8"))

    count = index["count"]
    rows = index["rows"]
    for name, values in rows.items():
        assert len(values) == count, f"{name}: {len(values)} != {count}"

    assert len(set(rows["list_keys"])) == count, "list_keys must be unique"
    assert summary["overview"]["candidate_count"] == count
    assert summary["overview"]["priority_count"] == index["priority_count"]
    assert summary["generated_at"] == index["generated_at"]

    bits = index["flag_bits"]
    priority_count = sum(bool(flags & bits["is_priority"]) for flags in rows["flags"])
    core_count = sum(bool(flags & bits["is_core_data"]) for flags in rows["flags"])
    api_count = sum(value > 0 for value in rows["api_applies"])
    response_count = sum(bool(flags & bits["has_response_fields"]) for flags in rows["flags"])

    assert priority_count == index["priority_count"]
    assert core_count == summary["overview"]["core_data_count"]
    assert api_count == summary["overview"]["api_applies_present_count"]
    assert response_count == summary["overview"]["response_field_count"]
    assert len(summary["source_snapshots"]) == 3
    assert {item["code"] for item in summary["source_snapshots"]} == {"U", "M", "Y"}
    assert (repo / "index.html").read_bytes() == (repo / "file-to-api.html").read_bytes()

    print(
        json.dumps(
            {
                "generated_at": summary["generated_at"],
                "candidate_count": count,
                "priority_count": priority_count,
                "core_data_count": core_count,
                "api_signal_count": api_count,
                "response_field_count": response_count,
                "status": "ok",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
