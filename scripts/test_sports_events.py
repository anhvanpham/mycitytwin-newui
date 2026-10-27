import importlib.util
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

spec = importlib.util.spec_from_file_location('sports', Path(__file__).with_name('refresh-sports-events.py'))
sports = importlib.util.module_from_spec(spec); spec.loader.exec_module(sports)
KNOWN = '2026-10-05T00:00:00+00:00'


class SportsTests(unittest.TestCase):
    def test_mcg_explicit_year_and_start_without_fabricated_finish(self):
        card = '<div class="card-event" data-card-event=\'{"eventName":"Home v Away","eventDate":"Saturday March 20, 7:30pm"}\'><div class="card-tags">AFL</div><div class="card-image"></div><a href="/events/2027/march/home-v-away">Details</a>'
        e = sports.mcg_events(card + card, KNOWN)
        self.assertEqual(len(e), 1)
        self.assertEqual(e[0]['start'], '2027-03-20T19:30:00+11:00')
        self.assertEqual(e[0]['end'], e[0]['start'])
        self.assertEqual(e[0]['timing'], 'start')
        self.assertEqual(e[0]['accessPoints'][0]['sourceUrl'], sports.MCG_TRAVEL)
        self.assertEqual(sports.mcg_events(card.replace('7:30pm', 'TBC'), KNOWN), [])
        cricket = card.replace('Home v Away', 'Victoria v Tasmania').replace('card-tags">AFL', 'card-tags">Sheffield Shield') + '<footer>AFL Grand Final Ticket Allocation</footer>'
        self.assertEqual(sports.mcg_events(cricket, KNOWN), [])

    def test_marvel_uses_published_utc_fields_and_rejects_unzoned_time(self):
        def item(start, end, tag='afl'):
            return dict(title='Home v Away', status='PUBLISHED', tags=[{'label':'eventType:'+tag}], modulesInContent=[dict(title='Event Details', fields=[dict(title='Date & Time', values=[{'value':start}]), dict(title='End Date & Time', values=[{'value':end}])])])
        e = sports.marvel_events({'contents':[item('2027-03-20T08:30:00Z', '2027-03-20T11:00:00Z'), item('2027-03-20T08:30:00', ''), item('2027-03-20T08:30:00Z', '', 'concert')]}, KNOWN)
        self.assertEqual(len(e), 1)
        self.assertEqual(e[0]['start'], '2027-03-20T19:30:00+11:00')
        self.assertEqual(e[0]['timing'], 'session')

    def test_tennis_dates_are_context_with_exclusive_last_day(self):
        e = sports.ao_events('<header>11 - 31 Jan 2027</header><h1>Australian Open ticket FAQs</h1>', KNOWN)[0]
        self.assertEqual(e['categories'], ['Sport', 'Tennis'])
        self.assertEqual(e['timing'], 'date')
        self.assertEqual(e['start'], '2027-01-11T00:00:00+11:00')
        self.assertEqual(e['end'], '2027-02-01T00:00:00+11:00')
        with self.assertRaises(ValueError): sports.ao_events('Australian Open dates TBC', KNOWN)

    def test_empty_afl_calendar_is_checked_not_failure_and_other_events_preserved(self):
        with TemporaryDirectory() as directory:
            root=Path(directory); archive=root/'data/events_sources'; archive.mkdir(parents=True)
            asset=root/'asset.json'; asset.write_text(json.dumps({'times':['2026-10-05T06:00:00+11:00','2026-10-20T10:00:00+11:00']}))
            old=dict(id='comedy', name='Comedy', start='2026-10-05T20:00:00+11:00')
            (root/'data/upcoming_events.json').write_text(json.dumps([old]))
            pages={'sports-mcg.html':'<div class="card-event" data-card-event=\'{"eventName":"Tour","eventDate":"TBC"}\'>', 'sports-marvel.json':'{"contents":[]}', 'sports-ao.html':'11 - 31 Jan 2027 Australian Open'}
            for filename,page in pages.items():
                p=archive/filename; p.write_text(page); p.with_suffix(p.suffix+'.checked.json').write_text(json.dumps({'checkedAt':KNOWN}))
            sports.refresh(asset, root, cached=True)
            events=json.loads((root/'data/upcoming_events.json').read_text())
            self.assertIn(old, events)
            self.assertEqual(len(events), 2)
            reports=json.loads((root/'data/sports_sources.json').read_text())['sources']
            self.assertTrue(all(s['status']=='checked' for s in reports))
            self.assertTrue(all(s['inForecastCount']==0 for s in reports))
            # A broken source cannot silently overwrite the prior AO listing.
            (archive/'sports-ao.html').write_text('TBC')
            sports.refresh(asset, root, cached=True)
            reports=json.loads((root/'data/sports_sources.json').read_text())['sources']
            self.assertEqual(reports[-1]['status'], 'unavailable')
            self.assertEqual(len(json.loads((root/'data/upcoming_events.json').read_text())), 2)


if __name__ == '__main__': unittest.main()
