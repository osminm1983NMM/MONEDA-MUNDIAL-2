import unittest
import tempfile
from pathlib import Path
from scripts.android_guest_tour_contract import entry_coordinates, verify_tour, verify_return, return_button_coordinates, world_entry_coordinates, world_back_coordinates, verify_world_preview

def node(text='', desc='', clickable=False, bounds='[10,20][110,120]'):
    return (f'<node text="{text}" content-desc="{desc}" '
            f'clickable="{str(clickable).lower()}" bounds="{bounds}"/>')

def write_xml(data):
    f=tempfile.NamedTemporaryFile(mode='w',suffix='.xml',delete=False)
    f.write('<hierarchy>'+data+'</hierarchy>')
    f.close()
    return Path(f.name)

class GuestTourContractTest(unittest.TestCase):
    def test_english_button_accessible(self):
        p=write_xml(node(desc='Explore without an account (demo only)',clickable=True))
        try: self.assertEqual(entry_coordinates(p),(60,70))
        finally: p.unlink()
    def test_spanish_button_accessible(self):
        p=write_xml(node(desc='Conocer la aplicación sin cuenta (solo demostración)',clickable=True))
        try: self.assertEqual(entry_coordinates(p),(60,70))
        finally: p.unlink()
    def test_not_clickable_fails(self):
        p=write_xml(node(text='Explore without an account (demo only)'))
        try:
            with self.assertRaises(ValueError): entry_coordinates(p)
        finally: p.unlink()
    def test_english_tour(self):
        p=write_xml(''.join([
            node(text='Explore Moneda Mundial'),node(text='DEMO ONLY No real money'),
            node(text='International transfers'),node(text='Digital and Coin'),
            node(desc='Back to sign in',clickable=True)
        ]))
        try: verify_tour(p,p)
        finally: p.unlink()
    def test_spanish_tour(self):
        p=write_xml(''.join([
            node(text='Conoce Moneda Mundial'),node(text='DEMOSTRACIÓN sin dinero'),
            node(text='Transferencias internacionales'),node(text='Digital y Coin'),
            node(desc='Volver a iniciar sesión',clickable=True)
        ]))
        try: verify_tour(p,p)
        finally: p.unlink()
    def test_tour_fails_without_warning(self):
        p=write_xml(''.join([
            node(text='Explore Moneda Mundial'),node(text='International transfers'),
            node(text='Digital and Coin'),node(desc='Back to sign in',clickable=True)
        ]))
        try:
            with self.assertRaisesRegex(ValueError,'advertencia'): verify_tour(p)
        finally: p.unlink()
    def test_return_requires_login(self):
        p=write_xml(node(text='MONEDA MUNDIAL')+node(text='Sign in to Moneda Mundial')+
                    node(desc='Explore without an account (demo only)',clickable=True))
        try: verify_return(p)
        finally: p.unlink()
    def test_return_fails_if_stuck_in_tour(self):
        p=write_xml(node(text='MONEDA MUNDIAL')+node(text='Explore Moneda Mundial'))
        try:
            with self.assertRaises(ValueError): verify_return(p)
        finally: p.unlink()


    def test_scrolled_tour_content_combined(self):
        top=write_xml(node(text='Explore Moneda Mundial')+node(text='DEMO ONLY')+node(text='International transfers'))
        bottom=write_xml(node(text='Digital and Coin')+node(desc='Back to sign in',clickable=True))
        try:
            verify_tour(top,bottom)
            self.assertEqual(return_button_coordinates(bottom),(60,70))
        finally:
            top.unlink()
            bottom.unlink()
    def test_not_clickable_return_fails(self):
        bottom=write_xml(node(text='Back to sign in'))
        try:
            with self.assertRaises(ValueError): return_button_coordinates(bottom)
        finally: bottom.unlink()

    def test_world_catalogue_complete_and_no_real_money(self):
        top=write_xml(node(text='Explorar países del mundo')+
            node(text='SOLO INVESTIGACIÓN · NINGÚN PAÍS ADMITE ENVÍOS REALES')+
            node(text='Países y territorios en el catálogo: 249'))
        bottom=write_xml(node(text='Honduras (HN)')+node(text='Nicaragua (NI)')+
            node(text='Sin proveedor autorizado, cotización real, envío ni retiro disponible.')+
            node(desc='Volver al recorrido de Moneda Mundial',clickable=True))
        try:
            verify_world_preview(top,bottom)
            self.assertEqual(world_back_coordinates(bottom),(60,70))
        finally:
            top.unlink()
            bottom.unlink()

    def test_world_catalogue_fails_without_nicaragua_or_warning(self):
        top=write_xml(node(text='Explorar países del mundo')+
            node(text='Países y territorios en el catálogo: 249')+
            node(text='Honduras (HN)'))
        bottom=write_xml(node(desc='Volver al recorrido de Moneda Mundial',clickable=True))
        try:
            with self.assertRaisesRegex(ValueError,'sin fondos reales|Nicaragua'):
                verify_world_preview(top,bottom)
        finally:
            top.unlink()
            bottom.unlink()

    def test_world_entry_requires_clickable_button(self):
        target=write_xml(node(desc='Explorar países del mundo',clickable=True))
        missing=write_xml(node(text='Explorar países del mundo'))
        try:
            self.assertEqual(world_entry_coordinates(target),(60,70))
            with self.assertRaises(ValueError):world_entry_coordinates(missing)
        finally:
            target.unlink()
            missing.unlink()

if __name__=='__main__':
    unittest.main()
