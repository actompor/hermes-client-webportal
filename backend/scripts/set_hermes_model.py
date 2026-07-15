#!/usr/bin/env python3
"""Set Hermes main provider/model (same effect as dashboard POST /api/model/set)."""

from __future__ import annotations

import argparse
import json
import os
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hermes-home", required=True)
    parser.add_argument("--provider", required=True)
    parser.add_argument("--model", required=True)
    args = parser.parse_args()

    hermes_home = os.path.abspath(args.hermes_home)
    os.environ["HERMES_HOME"] = hermes_home

    agent_root = os.path.join(hermes_home, "hermes-agent")
    if agent_root not in sys.path and os.path.isdir(agent_root):
        sys.path.insert(0, agent_root)

    try:
        from hermes_cli.config import load_config, save_config
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": f"import failed: {exc}"}), flush=True)
        return 1

    provider = args.provider.strip()
    model = args.model.strip()
    if not provider or not model:
        print(json.dumps({"ok": False, "error": "provider and model required"}), flush=True)
        return 1

    try:
        cfg = load_config()
        model_cfg = cfg.get("model") if isinstance(cfg.get("model"), dict) else {}
        model_cfg = dict(model_cfg)
        model_cfg["provider"] = provider
        model_cfg["default"] = model
        # Keep name in sync when present in older configs.
        if "name" in model_cfg:
            model_cfg["name"] = model
        cfg["model"] = model_cfg
        save_config(cfg)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}), flush=True)
        return 1

    print(
        json.dumps(
            {
                "ok": True,
                "provider": provider,
                "model": model,
            }
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
