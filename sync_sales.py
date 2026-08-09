"""Pull the 2026 Sales Google Sheet (SMS CB Escalated + Inbound tabs) -> data.js

Sheet ID + tab gids come from an environment variable / GitHub repo secret so
nothing sensitive is committed to the public repo:

    SALES_SHEET = "<SHEET_ID>|<SMSCB_GID>|<INBOUND_GID>"

Usage:  python sync_sales.py
"""
import csv, io, json, os, sys, datetime, urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
URL = "https://docs.google.com/spreadsheets/d/{}/export?format=csv&gid={}"
YEAR = 2026


def sheets_from_env():
    raw = os.environ.get("SALES_SHEET", "")
    parts = [p.strip() for p in raw.split("|") if p.strip()]
    if len(parts) != 3:
        raise RuntimeError(
            "Missing/!bad repo secret SALES_SHEET. Set it in GitHub > Settings > "
            "Secrets and variables > Actions with value SHEET_ID|SMSCB_GID|INBOUND_GID"
        )
    sid, smscb, inbound = parts
    return sid, [("SMS CB", smscb), ("Inbound", inbound)]


def fetch(sid, gid):
    req = urllib.request.Request(URL.format(sid, gid),
                                 headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read()
    if b"<html" in raw[:400].lower():
        raise RuntimeError("Google returned HTML, not CSV - sheet is not link-viewable.")
    return raw.decode("utf-8", errors="replace")


def norm(h):
    return " ".join(str(h).replace("\n", " ").replace("`", "").split()).strip().lower()


DATE_FMTS = ("%d-%b-%y", "%d-%b-%Y", "%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y",
             "%d/%m/%Y", "%b %d, %Y", "%B %d, %Y", "%Y/%m/%d", "%d-%B-%y")


def to_date(v):
    s = str(v or "").strip()
    if not s:
        return None
    for f in DATE_FMTS:
        try:
            return datetime.datetime.strptime(s, f).date()
        except ValueError:
            pass
    return None


def to_money(v):
    s = str(v or "").strip().replace("$", "").replace(",", "").replace("(", "-").replace(")", "")
    if not s:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def pick(idx, *names):
    for n in names:
        if n in idx:
            return idx[n]
    return None


def build():
    sid, tabs = sheets_from_env()
    records, issues = [], {}
    seen = set()

    def bad(k):
        issues[k] = issues.get(k, 0) + 1

    for channel, gid in tabs:
        print("fetching", channel, "...", flush=True)
        rdr = csv.reader(io.StringIO(fetch(sid, gid)))
        hdr = [norm(h) for h in next(rdr)]
        idx = {h: i for i, h in enumerate(hdr) if h}

        c_brand = pick(idx, "brand")
        # date fallback chain: callback date -> generic date -> escalated date -> week start
        c_dates = [i for i in (pick(idx, "date of callback"), pick(idx, "date"),
                               pick(idx, "date escalated"), pick(idx, "week start date"))
                   if i is not None]
        c_ws = pick(idx, "week start date")
        c_we = pick(idx, "week end date")
        c_amt = pick(idx, "order total", "total sales")
        c_ord = pick(idx, "order number", "remarks/ order number", "order created?")
        c_by = pick(idx, "placed by")
        n = 0
        for r in rdr:
            if not r or all(not str(x).strip() for x in r):
                continue
            g = lambda i: (r[i] if i is not None and i < len(r) else "")
            d = next((x for x in (to_date(g(i)) for i in c_dates) if x), None)
            if d is None:
                bad("invalid_or_missing_date"); continue
            if d.year != YEAR:
                bad("outside_2026"); continue
            amt = to_money(g(c_amt))
            ordno = str(g(c_ord) or "").strip()
            created = str(g(idx.get("order created?", -1)) if "order created?" in idx else "").strip().lower()
            # A "sale" = money on the row, or an explicit Order Created = Yes
            is_sale = amt > 0 or created in ("yes", "y", "true")
            if not is_sale:
                bad("non_sale_row"); continue
            if amt <= 0:
                bad("sale_without_amount")
            brand = " ".join(str(g(c_brand) or "").split()).strip() or "Unspecified"
            key = (channel, ordno, d.isoformat(), round(amt, 2))
            if ordno and key in seen:
                bad("duplicate_skipped"); continue
            seen.add(key)
            ws, we = to_date(g(c_ws)), to_date(g(c_we))
            records.append({
                "ch": channel,
                "d": d.isoformat(),
                "m": d.month,
                "b": brand,
                "amt": round(amt, 2),
                "ws": ws.isoformat() if ws else None,
                "we": we.isoformat() if we else None,
                "ord": ordno,
                "by": " ".join(str(g(c_by) or "").split()).strip(),
            })
            n += 1
        print("  ", channel, n, "sales rows", flush=True)

    if not records:
        raise RuntimeError("No 2026 sales parsed - aborting so data.js is not destroyed.")

    records.sort(key=lambda x: (x["d"], x["ch"]))
    payload = {
        "generated": datetime.datetime.now(datetime.timezone.utc)
                     .astimezone().isoformat(timespec="seconds"),
        "year": YEAR,
        "issues": issues,
        "rows": records,
    }
    out = os.path.join(BASE, "data.js")
    tmp = out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("window.SALES_DATA = ")
        json.dump(payload, f, separators=(",", ":"))
        f.write(";\n")
    os.replace(tmp, out)
    print("OK  %d sales  $%.2f  issues=%s" %
          (len(records), sum(r["amt"] for r in records), issues))
    print("wrote", out)


if __name__ == "__main__":
    try:
        build()
    except Exception as e:
        print("!! sync failed:", e); sys.exit(1)
