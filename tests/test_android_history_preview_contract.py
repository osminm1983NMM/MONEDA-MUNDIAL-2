import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from android_history_preview_contract import read_nodes, locate, verify, BUTTONS


def node(text, clickable=False):
    return {'text':text, 'content-desc':'', 'clickable':'true' if clickable else 'false',
            'bounds':'[10,20][210,90]'}


class ContractTest(unittest.TestCase):
    def test_locate_accessible_button(self):
        self.assertEqual(locate([node('Explorar países'),node('Vista previa del Historial',True)],
                                BUTTONS['history-entry']),(110,55))
        with self.assertRaises(ValueError):
            locate([node('Vista previa del Historial',False)],BUTTONS['history-entry'])

    def test_fake_summary_and_filters(self):
        fake=[node(s) for s in ('Datos inventados','Tu actividad','MWD','Solo demostración',
            'Entradas','Salidas','Comercios','+126.90','−57.00','2 movimientos visibles',
            '3 movimientos visibles','+120.50','+6.40','−35.25','−12.75','−9.00',
            'Comprobante ficticio','Sin dinero real','Referencia:')]
        for step in ('overview','incoming','outgoing','merchant','receipt'):
            verify(step,fake)
        with self.assertRaises(ValueError):
            verify('receipt',fake+[node('Compartir comprobante ficticio')])

    def test_missing_filter_detected(self):
        with self.assertRaises(ValueError):
            verify('merchant',[node('2 movimientos visibles'),node('+6.40')])
        with self.assertRaises(ValueError):
            verify('outgoing',[node('3 movimientos visibles'),node('−35.25'),node('−12.75')])


if __name__=='__main__':
    unittest.main()
