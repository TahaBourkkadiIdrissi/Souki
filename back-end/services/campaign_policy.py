"""Shared route policy and traffic classification; no database or HTTP operations."""
import json
import re
from pathlib import Path

_backend = Path(__file__).resolve().parents[1]
_file = _backend / "campaign-routes.json"
if not _file.exists():
    _file = _backend.parent / "apps/client/lib/campaign-routes.json"
ROUTES = json.loads(_file.read_text(encoding="utf-8"))
RESERVED = frozenset(ROUTES["reserved"])
SLUG = re.compile(r"[a-z0-9](?:[a-z0-9-]{1,46})[a-z0-9]\Z")
# Do not exclude Instagram/FB in-app browsers: they also carry real human clicks.
AUTOMATED = re.compile(
    r"bot|crawler|spider|preview|facebookexternalhit|facebot|meta-externalagent|"
    r"meta-externalfetcher|whatsapp|headless|slurp|linkexpander|"
    r"googleimageproxy|google-inspectiontool|safelinks|proofpoint|barracuda|"
    r"mimecast|python-requests|curl/|wget/", re.I
)


def count_visit(user_agent, method="GET", purpose="", sec_purpose="", x_purpose="", x_moz=""):
    purposes = " ".join((purpose, sec_purpose, x_purpose, x_moz)).lower()
    return method.upper() == "GET" and bool(user_agent) and not AUTOMATED.search(user_agent) and not any(
        token in purposes for token in ("prefetch", "prerender", "preview")
    )
