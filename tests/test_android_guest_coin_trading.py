import unittest
import tempfile
from pathlib import Path
from scripts.android_guest_tour_contract import (
 coin_trade_entry_coordinates,coin_trade_sell_coordinates,
 coin_trade_back_coordinates,verify_coin_trade_preview
)

def make_xml(*labels):
 f=tempfile.NamedTemporaryFile(mode='w',suffix='.xml',delete=False)
 f.write('<hierarchy>'+''.join(
  '<node text="'+label+'" clickable="'+('true' if clickable else 'false')+'" bounds="[10,20][110,120]"/>'
  for label,clickable in labels)+'</hierarchy>')
 f.close()
 return Path(f.name)

class CoinTradingGuestContract(unittest.TestCase):
 def test_navigation_buy_and_sell_requires_safe_text(self):
  entry=make_xml(('Simular compra y venta de Coin',True))
  buy=make_xml(
   ('Simular compra o venta de Coin',False),
   ('NO EXISTEN COIN EMITIDAS NI PRECIOS OFICIALES',False),
   ('Comprar (simulación)',True),('Vender (simulación)',True),
   ('Valor bruto hipotético en USD',False),
   ('Costo total hipotético del comprador',False),
   ('No se puede comprar, vender, retirar ni convertir Coin',False),
   ('Volver a Coin y Digital',True))
  sell=make_xml(
   ('Simular compra o venta de Coin',False),
   ('NO EXISTEN COIN EMITIDAS',False),
   ('Comprar (simulación)',True),('Vender (simulación)',True),
   ('Valor bruto hipotético en USD',False),
   ('Resultado hipotético del vendedor',False),
   ('No se puede comprar, vender ni retirar',False),
   ('Volver a Coin y Digital',True))
  try:
   self.assertEqual(coin_trade_entry_coordinates(entry),(60,70))
   self.assertEqual(coin_trade_sell_coordinates(buy),(60,70))
   self.assertEqual(coin_trade_back_coordinates(buy),(60,70))
   verify_coin_trade_preview(buy,buy,side='buy')
   verify_coin_trade_preview(sell,sell,side='sell')
  finally:
   for file in (entry,buy,sell): file.unlink()

 def test_missing_risk_notice_rejected(self):
  doc=make_xml(
   ('Simular compra o venta de Coin',False),
   ('Comprar (simulación)',True),('Vender (simulación)',True),
   ('Valor bruto hipotético',False),('Costo total hipotético',False),
   ('No se puede comprar, vender',False),('Volver a Coin y Digital',True))
  try:
   with self.assertRaisesRegex(ValueError,'sin emisión'):verify_coin_trade_preview(doc,doc)
  finally:doc.unlink()

if __name__=='__main__':unittest.main()
