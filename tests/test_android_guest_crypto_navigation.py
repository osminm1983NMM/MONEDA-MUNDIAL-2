import unittest
from pathlib import Path
import tempfile
from scripts.android_guest_tour_contract import (
 crypto_entry_coordinates,crypto_back_coordinates,verify_crypto_preview
)
def xml(*nodes):
 f=tempfile.NamedTemporaryFile(mode='w',suffix='.xml',delete=False)
 f.write('<hierarchy>'+''.join(nodes)+'</hierarchy>');f.close();return Path(f.name)
def node(text='',clickable=False):
 return '<node text="'+text+'" clickable="'+str(clickable).lower()+'" bounds="[10,20][110,120]"/>'
class CryptoGuestNavigationTest(unittest.TestCase):
 def test_spanish_navigation(self):
  entry=xml(node('Conocer Coin y Digital (investigación)',True))
  details=xml(node('Explorar Coin y Digital sin cuenta'),node('INVESTIGACIÓN SOLAMENTE'),
    node('Moneda Mundial Coin'),node('Moneda Mundial Digital'),node('NO EMITIDA'),
    node('Volver al recorrido de Moneda Mundial',True))
  try:
   self.assertEqual(crypto_entry_coordinates(entry),(60,70))
   verify_crypto_preview(details,details)
   self.assertEqual(crypto_back_coordinates(details),(60,70))
  finally: entry.unlink();details.unlink()
 def test_english_navigation(self):
  entry=xml(node('Explore Coin and Digital details',True))
  details=xml(node('Explore Coin and Digital without an account'),node('RESEARCH ONLY'),
    node('Moneda Mundial Coin'),node('Moneda Mundial Digital'),node('NOT ISSUED'),
    node('Back to the Moneda Mundial tour',True))
  try:
   self.assertEqual(crypto_entry_coordinates(entry),(60,70))
   verify_crypto_preview(details,details)
   self.assertEqual(crypto_back_coordinates(details),(60,70))
  finally: entry.unlink();details.unlink()
 def test_missing_warning_is_rejected(self):
  p=xml(node('Explorar Coin y Digital sin cuenta'),node('Moneda Mundial Coin'),
    node('Moneda Mundial Digital'),node('NO EMITIDA'),
    node('Volver al recorrido de Moneda Mundial',True))
  try:
   with self.assertRaisesRegex(ValueError,'advertencia'):verify_crypto_preview(p,p)
  finally:p.unlink()
 def test_buttons_must_be_clickable(self):
  p=xml(node('Conocer Coin y Digital'),node('Back to the Moneda Mundial tour'))
  try:
   with self.assertRaises(ValueError):crypto_entry_coordinates(p)
   with self.assertRaises(ValueError):crypto_back_coordinates(p)
  finally:p.unlink()
if __name__=='__main__':unittest.main()
