"""Save PageSpeed mobile lab and field results separately, without assuming success."""
import argparse
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request


def run(url, output):
    api = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + urllib.parse.urlencode({"url": url, "strategy": "mobile", "category": "performance"})
    try:
        with urllib.request.urlopen(api, timeout=180) as response:
            data = json.load(response)
        name = "catalogue" if url.endswith("/catalogue") else "home"
        (output / f"{name}.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
        lighthouse = data.get("lighthouseResult", {})
        audits = lighthouse.get("audits", {})
        return {"url": url, "fetch_time": lighthouse.get("fetchTime"),
                "lab_score": lighthouse.get("categories", {}).get("performance", {}).get("score"),
                "lab_lcp_ms": audits.get("largest-contentful-paint", {}).get("numericValue"),
                "lab_cls": audits.get("cumulative-layout-shift", {}).get("numericValue"),
                "field": data.get("loadingExperience", {"status": "unavailable"}),
                "origin_field": data.get("originLoadingExperience", {"status": "unavailable"})}
    except Exception as error:
        return {"url": url, "error": str(error), "field": {"status": "unavailable"}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda url: run(url, args.output), ("https://souki.io/", "https://souki.io/catalogue")))
    report = {"captured_at": dt.datetime.now(dt.timezone.utc).isoformat(), "results": results}
    (args.output / "summary.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
