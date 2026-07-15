#!/usr/bin/env python3
"""List Hermes provider/model inventory for the ecept portal backend.

Uses the same substrate as the Hermes dashboard Models picker
(``hermes_cli.inventory.build_models_payload``), NOT OpenAI ``GET /v1/models``.
"""

from __future__ import annotations

import argparse
import json
import os
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hermes-home", required=True)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument(
        "--include-unconfigured",
        action="store_true",
        help="Include providers that are not authenticated yet",
    )
    args = parser.parse_args()

    hermes_home = os.path.abspath(args.hermes_home)
    os.environ["HERMES_HOME"] = hermes_home

    # Ensure Hermes package imports resolve when invoked from the portal.
    agent_root = os.path.join(hermes_home, "hermes-agent")
    if agent_root not in sys.path and os.path.isdir(agent_root):
        sys.path.insert(0, agent_root)

    try:
        from hermes_cli.inventory import build_models_payload, load_picker_context
    except Exception as exc:  # noqa: BLE001
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": f"Failed to import Hermes inventory: {exc}",
                }
            ),
            flush=True,
        )
        return 1

    try:
        payload = build_models_payload(
            load_picker_context(),
            explicit_only=False,
            include_unconfigured=bool(args.include_unconfigured),
            picker_hints=True,
            canonical_order=True,
            pricing=False,
            capabilities=False,
            refresh=bool(args.refresh),
            probe_custom_providers=bool(args.refresh),
            probe_current_custom_provider=True,
        )
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}), flush=True)
        return 1

    providers = []
    for row in payload.get("providers") or []:
        models = list(row.get("models") or [])
        providers.append(
            {
                "slug": row.get("slug"),
                "name": row.get("name") or row.get("slug"),
                "authenticated": bool(row.get("authenticated", True)),
                "isCurrent": bool(row.get("is_current")),
                "models": models,
                "totalModels": int(row.get("total_models") or len(models)),
            }
        )

    print(
        json.dumps(
            {
                "ok": True,
                "provider": payload.get("provider"),
                "model": payload.get("model"),
                "providers": providers,
            }
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
