import sys,unittest
from types import SimpleNamespace
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from query_server import collect,extract_npp,number,bool_value

class FakeGood:
 @staticmethod
 def info(addr,timeout=5): return SimpleNamespace(server_name='Demo server',map_name='rp_sample',player_count=8,max_players=64)
 @staticmethod
 def rules(addr,timeout=5): return {'NC_Station_KW':'2150','Syndicate_CityPower_Load':'1900','Syndicate_City_Blackout':'0','sv_cheats':'0'}
class FakeTimeout:
 @staticmethod
 def info(addr,timeout=5): raise TimeoutError('no UDP response')

class Tests(unittest.TestCase):
 def test_good_status(self):
  r=collect(FakeGood)
  self.assertTrue(r['infoOk']);self.assertTrue(r['rulesOk'])
  self.assertEqual(r['server']['players'],8)
  self.assertEqual(r['nppTelemetry']['s']['city']['station'],2150)
  self.assertFalse(r['nppTelemetry']['s']['city']['blackout'])
  self.assertNotIn('sv_cheats',r['nppRules'])
 def test_network_fail_closed(self):
  r=collect(FakeTimeout)
  self.assertFalse(r['infoOk']);self.assertIsNone(r['nppTelemetry']);self.assertIn('TimeoutError',r['queryError'])
 def test_no_fake_npp(self):
  rules={'hostname':'Example','gamemode':'darkrp','Syndicate_NPP_Fuel':'unknown units'}
  exposed,telemetry=extract_npp(rules)
  self.assertIn('Syndicate_NPP_Fuel',exposed)
  self.assertIsNone(telemetry)
 def test_nonfinite(self):
  for s in ('nan','inf','-inf','invalid'):self.assertIsNone(number(s))
 def test_unknown_bool(self):self.assertIsNone(bool_value('unknown'))

if __name__=='__main__':unittest.main()
