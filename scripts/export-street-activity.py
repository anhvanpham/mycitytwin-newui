"""Export the research forecast into My City Twin's versioned public data asset.

Usage: python export_app.py --output /path/to/public/data/street-activity.json
This reads existing forecast outputs; it does not refresh upstream observations.
"""
import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def export(output, forecast_dir=ROOT):
    rows = list(csv.DictReader((forecast_dir / 'output/city_forecast.csv').open()))
    metadata = json.loads((forecast_dir / 'data/weather_metadata.json').read_text())
    grouped = {}
    for row in rows:
        grouped.setdefault(int(row['location_id']), []).append(row)
    first = next(iter(grouped.values()))
    times = [row['local_time'].replace(' ', 'T') for row in first]
    sensors = []
    for sid, records in grouped.items():
        if [row['local_time'].replace(' ', 'T') for row in records] != times:
            raise ValueError(f'Sensor {sid} has a different forecast time grid')
        row = records[0]
        sensors.append(dict(id=sid, name=row['name'], lat=float(row['latitude']), lon=float(row['longitude']),
                            lastObserved=row['last_complete_count'], model=row['prediction_model'],
                            counts=[float(r['predicted_count']) if r['predicted_count'] else None for r in records],
                            activity=[r['activity'] for r in records]))
    weather = [dict(temperature=float(r['temperature_2m']), rain=float(r['precipitation']),
                    wind=float(r['wind_speed_10m']),
                    bomChance=float(r['bom_daily_rain_chance']) if r['bom_daily_rain_chance'] else None,
                    bomPrecis=r['bom_precis'] or None) for r in first]
    events_path = forecast_dir / 'data/upcoming_events.json'
    events = json.loads(events_path.read_text()) if events_path.exists() else []
    event_metadata_path = forecast_dir / 'data/event_sources.json'
    event_metadata = json.loads(event_metadata_path.read_text()) if event_metadata_path.exists() else None
    event_coverage = (f'Official City of Melbourne What’s On listings and organiser sources: {event_metadata["sessionCount"]} dated sessions from {event_metadata["listingCount"]} listings. Incomplete coverage; explicit venue session times only. Events are warnings and do not change counts or recommendations.' if event_metadata else 'Curated verified event warnings; incomplete city-wide coverage. Events do not change predicted counts or recommendations.')
    sports_path = forecast_dir / 'data/sports_sources.json'
    sports = json.loads(sports_path.read_text()) if sports_path.exists() else None
    if sports:
        event_coverage += ' Sporting coverage also checks the official MCG and Marvel AFL calendars and Australian Open dates; date-only listings do not create hourly warnings.'
    quality_path = forecast_dir / 'output/city_quality.json'
    quality = json.loads(quality_path.read_text()) if quality_path.exists() else {}
    selection = quality.get('selection')
    coverage = None
    if selection:
        coverage = dict(reportingCount=selection['reportingCount'], insideCBDCount=len(selection['selectedIds']),
                        forecastCount=len(sensors), completeForecastCount=quality.get('completeForecastCount', len(sensors)), partial=quality.get('partial', []), excludedCount=len(selection['excluded']),
                        inventoryFetchedAt=selection['fetchedAt'], boundary=selection['boundary'],
                        unavailable=quality['skipped'])
    now = datetime.now(timezone.utc).isoformat()
    # Only events actually observed by this export; this is not a historical event archive.
    events = [e for e in events if datetime.fromisoformat(e['knownAt']) <= datetime.fromisoformat(now)]
    payload = dict(schemaVersion=1, exportedAt=now, forecastOrigin=times[0], weatherFetchedAt=metadata['fetched_at'],
                   weatherSource=metadata['hourly_source'], bomIssuedAt=metadata['bom_daily_issued_at'],
                   sensorsSource='https://data.melbourne.vic.gov.au/explore/dataset/pedestrian-counting-system-sensor-locations/',
                   countsSource='https://data.melbourne.vic.gov.au/explore/dataset/pedestrian-counting-system-monthly-counts-per-hour/',
                   weatherUrl='https://open-meteo.com/en/docs',
                   eventCoverage=event_coverage,
                   coverage=coverage,
                   eventsFetchedAt=event_metadata["fetchedAt"] if event_metadata else None,
                   times=times, sensors=sensors, weather=weather, events=events, sportsCoverage=sports)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, separators=(',', ':'), allow_nan=False))
    print(f'Exported {len(sensors)} sensors x {len(times)} hours to {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/street-activity.json')
    parser.add_argument('--forecast-dir', type=Path, default=ROOT)
    args = parser.parse_args()
    export(args.output, args.forecast_dir)
