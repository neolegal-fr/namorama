#!/usr/bin/env python3
"""Rattrapage de `visitor_session.pricingViewed` / `checkoutStarted` depuis les logs.

Les drapeaux n'existent en base que depuis la migration du 24/09/2026 ; les
ouvertures antérieures du dialogue des packs ne sont que dans les logs NDJSON
(`credits_dialog_opened`, `pack_checkout_started`, émis depuis le 12/09/2026).

N'écrit RIEN en base : imprime un SQL à relire, puis à appliquer à la main.
Des UPDATE sur les visites existantes, et rien d'autre — une session absente
de `visitor_session` n'a pas de `firstSeenAt` fiable, on ne l'invente pas.

    ssh namorama-prod "python3 -" < scripts/rattraper-tarifs-consultes.py > rattrapage.sql
"""
import json
import re
from glob import glob

LOG_GLOB = "/var/snap/docker/common/namorama/logs/api/app-*.ndjson"
FORMAT_SESSION = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
DRAPEAUX = {
    "credits_dialog_opened": "pricingViewed",
    "pack_checkout_started": "checkoutStarted",
}

sessions = {col: set() for col in DRAPEAUX.values()}
for path in sorted(glob(LOG_GLOB)):
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            col = DRAPEAUX.get(row.get("context")) if row.get("kind") == "event" else None
            sid = row.get("sessionId")
            if col and isinstance(sid, str) and FORMAT_SESSION.match(sid):
                sessions[col].add(sid)

print("-- Rattrapage produit par scripts/rattraper-tarifs-consultes.py")
for col, ids in sessions.items():
    print(f"-- {col} : {len(ids)} session(s) dans les logs")
    if ids:
        liste = ", ".join(f"'{s}'" for s in sorted(ids))
        print(f"UPDATE visitor_session SET {col} = 1 WHERE {col} = 0 AND sessionId IN ({liste});")
