"""Refresh official AFL/tennis event warnings without modifying forecasts.

MCG and Marvel calendars supply AFL fixtures. AO supplies confirmed tournament
dates; date-only records are calendar context, never hourly crowd warnings.
Run after refresh-street-events.py, before export-street-activity.py.
"""
import argparse
import hashlib
import html
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

LOCAL = ZoneInfo('Australia/Melbourne')
MCG = 'https://www.mcg.org.au/events'
MARVEL = 'https://www.marvelstadium.com.au/events'
MARVEL_API = 'https://aflapi.afl.com.au/eventmanagement/marvelstadium/events/1?contentFilter=&tagNames='
AO = 'https://ausopen.com/ticket-faqs'
AO_TRAVEL = 'https://ausopen.com/arrivals-gatetimes'
MCG_TRAVEL = 'https://www.mcg.org.au/plan-a-visit/get-to-the-mcg'
FLINDERS = dict(name='Flinders Street station approach', lat=-37.81827, lon=144.96708, radiusM=400)


def plain(text):
    return ' '.join(html.unescape(re.sub('<[^>]+>', ' ', text)).split())


def record(provider, name, venue, start, end, lat, lon, source, known, categories, timing, access=None):
    ident = hashlib.sha256(f'{provider}|{name}|{start.isoformat()}'.encode()).hexdigest()[:20]
    result = dict(id='sports-' + ident, provider=provider, name=name, venue=venue,
                  start=start.isoformat(), end=end.isoformat(), lat=lat, lon=lon,
                  sourceUrl=source, knownAt=known, categories=categories, timing=timing)
    if access:
        result['accessPoints'] = access
    return result


def mcg_events(page, known):
    cards = re.split(r'<div\s+class="card-event"', page)[1:]
    if not cards:
        raise ValueError('MCG calendar format changed; no event cards')
    events = []
    for card in cards:
        data = re.search(r"data-card-event='(.*?)'", card, re.S)
        link = re.search(r'href="(/events/(\d{4})/[^"]+)"', card)
        if not data or not link:
            continue
        info = json.loads(html.unescape(data.group(1)))
        tag_block = re.search(r'<div\s+class="card-tags"[^>]*>(.*?)</div>', card, re.S)
        tags = plain(tag_block.group(1)) if tag_block else ''
        name = info['eventName']
        if re.search(r'\bAFLW?\b', tags + ' ' + name, re.I):
            categories = ['Sport', 'AFLW' if 'AFLW' in tags.upper() else 'AFL']
        elif 'Marathon' in name:
            categories = ['Sport', 'Marathon']
        else:
            continue
        clock = info.get('eventDate', '').strip()
        try:
            start = datetime.strptime(f'{clock} {link.group(2)}', '%A %B %d, %I:%M%p %Y').replace(tzinfo=LOCAL)
        except ValueError:
            continue  # TBC and dates without times do not become hourly warnings.
        if start.strftime('%A') != clock.split()[0]:
            continue
        access = [dict(**FLINDERS, sourceUrl=MCG_TRAVEL)] if 'AFL' in categories or 'AFLW' in categories else None
        events.append(record('mcg', name, 'MCG', start, start, -37.81997, 144.98345,
                             'https://www.mcg.org.au' + link.group(1), known, categories, 'start', access))
    return list({e['id']: e for e in events}.values())


def marvel_events(payload, known):
    if not isinstance(payload.get('contents'), list):
        raise ValueError('Marvel calendar format changed; no contents list')
    events = []
    for item in payload['contents']:
        tags = [t.get('label', '').lower() for t in item.get('tags', [])]
        if item.get('status') != 'PUBLISHED' or not any(t in ('eventtype:afl', 'eventtype:aflw') for t in tags):
            continue
        module = next((m for m in item.get('modulesInContent', []) if m.get('title', '').lower().replace(' ', '') == 'eventdetails'), {})
        fields = {f['title']: (f.get('values') or [{}])[0].get('value') for f in module.get('fields', [])}
        try:
            start = datetime.fromisoformat(fields['Date & Time'])
            end = datetime.fromisoformat(fields['End Date & Time']) if fields.get('End Date & Time') else start
        except (KeyError, ValueError, TypeError):
            continue
        if start.tzinfo is None or end.tzinfo is None or end < start:
            continue
        # Retain the published local time, including the correct DST offset.
        start, end = start.astimezone(LOCAL), end.astimezone(LOCAL)
        events.append(record('marvel', item['title'], 'Marvel Stadium', start, end, -37.8165, 144.9476,
                             MARVEL, known, ['Sport', 'AFLW' if 'eventtype:aflw' in tags else 'AFL'],
                             'session' if end > start else 'start'))
    return events


def ao_events(page, known):
    # Current official site masthead: "11 - 31 Jan 2027". Read the published
    # year rather than inferring January from the forecast or server clock.
    text = plain(re.sub(r'<script\b.*?</script>', '', page, flags=re.S))
    dates = re.search(r'\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(Jan(?:uary)?)\s+(20\d{2})\b', text, re.I)
    if not dates or not re.search(r'AO\d{2}|Australian Open', text, re.I):
        raise ValueError('No confirmed Australian Open tournament dates')
    first, last, _, year = dates.groups()
    start = datetime(int(year), 1, int(first), tzinfo=LOCAL)
    last_day = datetime(int(year), 1, int(last), tzinfo=LOCAL)
    if last_day < start:
        raise ValueError('Invalid tournament date range')
    return [record('ao', f'Australian Open {year}', 'Melbourne Park', start, last_day + timedelta(days=1),
                   -37.8215, 144.9785, AO, known, ['Sport', 'Tennis'], 'date',
                   [dict(**FLINDERS, sourceUrl=AO_TRAVEL)])]


def refresh(asset, root, cached=False):
    doc = json.loads(asset.read_text())
    begin = datetime.fromisoformat(doc['times'][0])
    finish = datetime.fromisoformat(doc['times'][-1]) + timedelta(hours=1)
    now = datetime.now(timezone.utc).isoformat()
    archive = root / 'data/events_sources'; archive.mkdir(parents=True, exist_ok=True)
    event_path = root / 'data/upcoming_events.json'
    old = json.loads(event_path.read_text()) if event_path.exists() else []
    prior = {e['id']: e for e in old}
    # This refresh owns only its records, preserving comedy/concert/festival data.
    events = [e for e in old if e.get('provider') not in ('mcg', 'marvel', 'ao')]
    reports = []
    providers = [('mcg', 'MCG · AFL and major sport', MCG, MCG, 'sports-mcg.html', mcg_events),
                 ('marvel', 'Marvel Stadium · AFL', MARVEL, MARVEL_API, 'sports-marvel.json', marvel_events),
                 ('ao', 'Australian Open · tennis', AO, AO, 'sports-ao.html', ao_events)]
    for provider, name, source, url, filename, parse in providers:
        path = archive / filename
        stamp_path = path.with_suffix(path.suffix + '.checked.json')
        try:
            if cached:
                raw = path.read_text()
                checked = json.loads(stamp_path.read_text())['checkedAt']
            else:
                raw = urlopen(Request(url, headers={'User-Agent': 'MyCityTwin/1.0 public event research'}), timeout=30).read().decode('utf-8')
                checked = datetime.now(timezone.utc).isoformat()
            found = parse(json.loads(raw) if provider == 'marvel' else raw, checked)
            if not cached:
                path.write_text(raw)
                stamp_path.write_text(json.dumps(dict(checkedAt=checked)))
            # Keep upcoming dates beyond the weather horizon for calendar context.
            found = [e for e in found if datetime.fromisoformat(e['end']) >= begin - timedelta(hours=2)]
            for e in found:
                e['knownAt'] = prior.get(e['id'], e)['knownAt']
            overlap = [e for e in found if datetime.fromisoformat(e['start']) < finish and datetime.fromisoformat(e['end']) + timedelta(hours=2) > begin]
            events.extend(found)
            reports.append(dict(provider=provider, name=name, sourceUrl=source, checkedAt=checked,
                                status='checked', listedCount=len(found), inForecastCount=len(overlap)))
        except Exception as error:
            events.extend(e for e in old if e.get('provider') == provider)
            reports.append(dict(provider=provider, name=name, sourceUrl=source, status='unavailable',
                                reason=type(error).__name__ + ': ' + str(error)))
    events = sorted({e['id']: e for e in events}.values(), key=lambda e: (e['start'], e['id']))
    event_path.write_text(json.dumps(events, indent=2, ensure_ascii=False) + '\n')
    metadata = dict(fetchedAt=now, horizon=[begin.isoformat(), finish.isoformat()], sources=reports,
                    coverage='Official MCG/Marvel AFL calendars and Australian Open dates. Incomplete: AFLW and other venues are not comprehensively covered. Date-only listings are calendar context, not hourly crowd warnings. Start-only listings use a two-hour window around the published start, without an estimated finish.')
    (root / 'data/sports_sources.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(reports, indent=2))
    if all(r['status'] == 'unavailable' for r in reports):
        raise RuntimeError('All sporting sources unavailable; prior records preserved')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--asset', type=Path, required=True)
    p.add_argument('--root', type=Path, required=True)
    p.add_argument('--cached', action='store_true')
    args = p.parse_args()
    refresh(args.asset, args.root, args.cached)
