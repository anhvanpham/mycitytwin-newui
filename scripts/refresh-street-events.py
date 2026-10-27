"""Refresh venue-specific event warnings from official What's On Melbourne pages.

Only explicitly listed dated sessions with both start and end times are imported.
Festival date ranges and vague opening hours never become continuous warnings.
"""
import argparse
import concurrent.futures
import hashlib
import html
import json
import math
import re
from datetime import date as calendar_date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

BASE = 'https://whatson.melbourne.vic.gov.au'
INDEXES = {
    'Comedy': BASE + '/things-to-do/entertainment/comedy',
    'Music': BASE + '/things-to-do/entertainment/concerts-and-gigs',
    'Festival': BASE + '/things-to-do/festivals',
    'Sport': BASE + '/things-to-do/entertainment/sport',
    'Major events': BASE + '/things-to-do/major-events',
}
LOCAL = ZoneInfo('Australia/Melbourne')
ROOT = Path(__file__).resolve().parent


class Tiles(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        path = attrs.get('href', '')
        if tag == 'a' and attrs.get('data-gtm-trigger') == 'listing-tile-link' and path.startswith('/things-to-do/') and path.count('/') == 2:
            self.links.add(BASE + path)


def plain(text):
    return ' '.join(html.unescape(re.sub('<[^>]+>', ' ', text)).split())


def clock(text):
    match = re.fullmatch(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)', text.strip().lower())
    if not match:
        raise ValueError('No explicit clock time')
    hour, minute, period = match.groups()
    hour, minute = int(hour), int(minute or 0)
    if not 1 <= hour <= 12 or not 0 <= minute < 60:
        raise ValueError('Invalid clock time')
    return hour % 12 + (12 if period == 'pm' else 0), minute


def sessions(page, url, start, finish, known_at, categories):
    records = re.findall(r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>', page, re.S)
    event = next((d for raw in records if (d := json.loads(raw)).get('@type') == 'Event'), None)
    if not event:
        return [], 'Not an event listing'
    if event.get('eventStatus', '').endswith(('EventCancelled', 'EventPostponed')):
        return [], 'Cancelled or postponed'
    tags = re.search(r'<ul class="tag-list">(.*?)</ul>', page[page.find('<h1'):], re.S)
    categories = {plain(t) for t in re.findall(r'<li[^>]*>(.*?)</li>', tags.group(1), re.S)} if tags else set()
    if not categories.intersection({'Comedy', 'Music', 'Festival', 'Theatre', 'Cabaret', 'Market', 'Sport', 'Expo'}):
        return [], 'Not a performance, festival, market or sporting session'
    try:
        first_date = calendar_date.fromisoformat(event['startDate'][:10])
        last_date = calendar_date.fromisoformat(event['endDate'][:10])
    except (KeyError, ValueError, TypeError):
        return [], 'No explicit listing date range'
    if last_date < start.date() or first_date > finish.date():
        return [], 'Listing outside forecast horizon'
    location = re.search(r'data-listing-map-location-value=([\'"])(.*?)\1', page, re.S)
    table = re.search(r'<table[^>]*id="date-times-table"[^>]*>(.*?)</table>', page, re.S)
    venue = event.get('location', {}).get('name')
    if not location or not table or not venue:
        return [], 'No specific venue, coordinates or dated session table'
    geo = json.loads(html.unescape(location.group(2)))
    if not all(isinstance(geo.get(k), (int, float)) and math.isfinite(geo[k]) for k in ('lat', 'lng')):
        return [], 'Invalid venue coordinates'
    result = []
    for row in re.findall(r'<tr[^>]*>(.*?)</tr>', table.group(1), re.S):
        heading = re.search(r'<th[^>]*>(.*?)</th>', row, re.S)
        if not heading:
            continue
        date_text = plain(heading.group(1))
        # The year comes from the forecast horizon, then the listed weekday is checked.
        for year in range(start.year, finish.year + 1):
            try:
                date = datetime.strptime(f'{date_text} {year}', '%a %d %b %Y').date()
            except ValueError:
                continue
            if date.strftime('%a') != date_text.split()[0] or not start.date() <= date <= finish.date() or not first_date <= date <= last_date:
                continue
            for text in re.findall(r'<span[^>]*class="sr-only"[^>]*>(.*?)</span>', row, re.S):
                parts = re.split(r'\s+[-–]\s+', plain(text))
                if len(parts) != 2:
                    continue
                try:
                    h1, m1 = clock(parts[0]); h2, m2 = clock(parts[1])
                except ValueError:
                    continue
                begin = datetime(date.year, date.month, date.day, h1, m1, tzinfo=LOCAL)
                end = datetime(date.year, date.month, date.day, h2, m2, tzinfo=LOCAL)
                if end <= begin:
                    end += timedelta(days=1)
                if end <= start - timedelta(hours=2) or begin >= finish + timedelta(hours=2):
                    continue
                ident = hashlib.sha256(f'{url}|{begin.isoformat()}|{end.isoformat()}'.encode()).hexdigest()[:20]
                result.append(dict(id='whatson-' + ident, name=event['name'], venue=venue,
                                   start=begin.isoformat(), end=end.isoformat(), lat=geo['lat'], lon=geo['lng'],
                                   knownAt=known_at, sourceUrl=url, categories=sorted(categories)))
    return result, 'Imported explicit sessions' if result else 'No explicit timed sessions within forecast horizon'


def nearby(event, sensors):
    for sensor in sensors:
        r = math.pi / 180
        a = math.sin((event['lat'] - sensor['lat']) * r / 2) ** 2 + math.cos(event['lat'] * r) * math.cos(sensor['lat'] * r) * math.sin((event['lon'] - sensor['lon']) * r / 2) ** 2
        if 6371000 * 2 * math.asin(math.sqrt(min(1, a))) <= 1000:
            return True
    return False


def refresh(asset, root=ROOT, cached=False):
    doc = json.loads(asset.read_text())
    begin = datetime.fromisoformat(doc['times'][0]); finish = datetime.fromisoformat(doc['times'][-1]) + timedelta(hours=1)
    now = datetime.now(timezone.utc).isoformat()
    archive = root / 'data/events_sources'; archive.mkdir(parents=True, exist_ok=True)
    candidates = {}

    def fetch(url):
        path = archive / (url.rsplit('/', 1)[-1] + '.html')
        if cached:
            return path.read_text()
        request = Request(url, headers={'User-Agent': 'MyCityTwin/1.0 public event research'})
        data = urlopen(request, timeout=30).read().decode('utf-8')
        path.write_text(data)
        return data

    for category, url in INDEXES.items():
        tiles = Tiles(); tiles.feed(fetch(url))
        for link in tiles.links:
            candidates.setdefault(link, set()).add(category)
    old_path = root / 'data/upcoming_events.json'
    old = json.loads(old_path.read_text()) if old_path.exists() else []
    previous = {e['id']: e for e in old}
    events = [e for e in old if not e['sourceUrl'].startswith(BASE)]
    report = []
    old_metadata_path = root / 'data/event_sources.json'
    cached_at = json.loads(old_metadata_path.read_text())['fetchedAt'] if cached and old_metadata_path.exists() else now

    def read(url):
        try:
            page = fetch(url)
            observed = cached_at if cached else datetime.now(timezone.utc).isoformat()
            found, reason = sessions(page, url, begin, finish, observed, candidates[url])
            found = [e for e in found if nearby(e, doc['sensors'])]
            return found, dict(url=url, imported=len(found), reason=reason if found else 'No eligible nearby timed sessions')
        except Exception as error:
            return [], dict(url=url, imported=0, reason=type(error).__name__ + ': ' + str(error))

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for found, item in pool.map(read, sorted(candidates)):
            for event in found:
                event['knownAt'] = previous.get(event['id'], event)['knownAt']
            events.extend(found); report.append(item)
    if not any(e['sourceUrl'].startswith(BASE) for e in events):
        raise RuntimeError('No official sessions imported; existing event snapshot preserved')
    events = sorted({e['id']: e for e in events}.values(), key=lambda e: (e['start'], e['id']))
    old_path.write_text(json.dumps(events, indent=2, ensure_ascii=False) + '\n')
    metadata = dict(fetchedAt=cached_at if cached else datetime.now(timezone.utc).isoformat(), horizon=[begin.isoformat(), finish.isoformat()],
                    sources=[dict(name=k, url=v) for k, v in INDEXES.items()],
                    sessionCount=len(events), listingCount=len({e['sourceUrl'] for e in events}),
                    report=report, coverage='Official dated sessions only; incomplete coverage, no continuous festival-range warnings.')
    (root / 'data/event_sources.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f'Imported {len(events)} sessions from {metadata["listingCount"]} listings; checked {len(candidates)} listings', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--asset', type=Path, required=True)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--cached', action='store_true', help='Revalidate archived source pages without fetching')
    args = parser.parse_args()
    refresh(args.asset, args.root, args.cached)
