"""Capture public SEO evidence without JavaScript or authenticated requests.

python tools/seo_snapshot.py --output outputs/seo/baseline
Use --base-url http://localhost:3000 for deployment-candidate checks.
"""
import argparse
import concurrent.futures
import datetime as dt
from html.parser import HTMLParser
import json
from pathlib import Path
import urllib.error
import urllib.request
import unicodedata
import re
import xml.etree.ElementTree as ET


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals, self.robots, self.links, self.headings = [], [], [], []
        self.in_heading = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs.get("href"))
        if tag == "meta" and attrs.get("name") == "robots":
            self.robots.append(attrs.get("content"))
        if tag == "a":
            self.links.append(attrs.get("href", ""))
        if tag == "h1":
            self.in_heading = True

    def handle_endtag(self, tag):
        if tag == "h1":
            self.in_heading = False

    def handle_data(self, data):
        if self.in_heading:
            self.headings.append(data)


class Redirects(urllib.request.HTTPRedirectHandler):
    def __init__(self):
        self.chain = []

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.chain.append({"url": req.full_url, "status": code, "location": newurl,
                           "headers": list(headers.items())})
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def capture(url, output):
    request = urllib.request.Request(url, headers={"User-Agent": "Souki-SEO-Verification/1.0"})
    redirects = Redirects()
    opener = urllib.request.build_opener(redirects)
    try:
        try:
            response = opener.open(request, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            body = response.read().decode("utf-8", errors="replace")
            page = Page()
            page.feed(body)
            result = {"url": url, "final_url": response.url, "status": response.status,
                      "redirects": redirects.chain,
                      "headers": list(response.headers.items()), "canonical": page.canonicals,
                      "robots": page.robots, "h1": "".join(page.headings),
                      "product_links": sorted(set(x for x in page.links if x.startswith("/produit/")))}
            name = url.split("://", 1)[-1].replace("/", "_").replace(":", "_") or "index"
            (output / f"{name}.html").write_text(body, encoding="utf-8")
            (output / f"{name}.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
            return result, body
    except Exception as error:
        return {"url": url, "error": str(error)}, ""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="https://souki.io")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--private", action="append", default=[])
    parser.add_argument("--strict", action="store_true", help="Fail on public crawlability, private indexing, cache, or duplicate security headers")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    base = args.base_url.rstrip("/")
    sitemap, xml = capture(base + "/sitemap.xml", args.output)
    catalogue_response, catalogue_json = capture(base + "/backend/api/catalogue", args.output)
    urls = [base + path for path in ("/", "/catalogue", "/checkout", "/robots.txt", "/produit/inconnu-999999999")]
    urls.extend(args.private)
    if base == "https://souki.io":
        urls.append("https://www.souki.io/")
    sitemap_urls = []
    try:
        sitemap_urls = [node.text.replace("https://souki.io", base) for node in ET.fromstring(xml).iter()
                        if node.tag.endswith("}loc") and node.text]
        urls.extend(sitemap_urls)
    except ET.ParseError:
        sitemap["xml_error"] = "Invalid or unavailable XML"
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        records = [r[0] for r in executor.map(lambda url: capture(url, args.output), sorted(set(urls)))]
    issues = []
    if sitemap.get("status") != 200 or sitemap.get("xml_error"):
        issues.append({"check": "sitemap_response", "status": sitemap.get("status"), "xml_error": sitemap.get("xml_error")})
    try:
        active = [product for product in json.loads(catalogue_json) if product.get("is_active")]
        def product_url(product):
            name = unicodedata.normalize("NFD", product["nom_fr"])
            name = "".join(char for char in name if not unicodedata.combining(char)).lower()
            slug = re.sub(r"[^a-z0-9]+", "-", name).strip("-") or "produit"
            return f"{base}/produit/{slug}-{product['id']}"
        expected = {product_url(product) for product in active} | {
            base + path for path in ("/", "/catalogue", "/a-propos", "/faq", "/abonnements", "/politique-confidentialite")
        }
        actual = set(sitemap_urls)
        if expected != actual:
            issues.append({"check": "active_catalogue_matches_sitemap", "missing": sorted(expected - actual), "unexpected": sorted(actual - expected)})
    except (ValueError, TypeError, AttributeError, KeyError):
        issues.append({"check": "catalogue_api", "status": "unavailable"})
    for record in [sitemap, *records]:
        url = record["url"]
        if record.get("error"):
            issues.append({"url": url, "check": "request", "error": record["error"]})
            continue
        for header in ("strict-transport-security", "x-content-type-options", "referrer-policy", "content-security-policy", "permissions-policy", "x-frame-options"):
            if sum(key.lower() == header for key, _ in record["headers"]) != 1:
                issues.append({"url": url, "check": "single_security_header", "header": header})
        cache = [value for key, value in record["headers"] if key.lower() == "cache-control"]
        if any("31536000" in value for value in cache):
            issues.append({"url": url, "check": "html_cache", "observed": cache})
        if url in sitemap_urls:
            tags = [value for key, value in record["headers"] if key.lower() == "x-robots-tag"]
            if record.get("status") != 200 or record.get("final_url") != url or any("noindex" in value for value in [*record["robots"], *tags]):
                issues.append({"url": url, "check": "public_indexability"})
            if [value.rstrip("/") for value in record["canonical"]] != [url.replace(base, "https://souki.io", 1).rstrip("/")]:
                issues.append({"url": url, "check": "canonical", "observed": record["canonical"]})
            if not record.get("h1"):
                issues.append({"url": url, "check": "public_content", "observed": "No H1 in raw HTML"})
        if url in (base + "/", base + "/catalogue") and not record.get("product_links"):
            issues.append({"url": url, "check": "crawlable_product_links", "observed": "No product anchors in raw HTML"})
        if url in args.private:
            tags = [value for key, value in record["headers"] if key.lower() == "x-robots-tag"]
            if tags != ["noindex, nofollow"]:
                issues.append({"url": url, "check": "private_x_robots_tag", "observed": tags})
    report = {"captured_at": dt.datetime.now(dt.timezone.utc).isoformat(), "base_url": base,
              "sitemap": sitemap, "catalogue_api": catalogue_response, "pages": records, "issues": issues}
    (args.output / "summary.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    for result in [sitemap, *records]:
        print(json.dumps({key: result.get(key) for key in ("url", "status", "error", "canonical", "robots")}, ensure_ascii=True))
    print(json.dumps({"issues": len(issues), "summary": str(args.output / "summary.json")}))
    if args.strict and issues:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
