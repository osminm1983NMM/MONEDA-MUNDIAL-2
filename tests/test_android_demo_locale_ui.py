import importlib.util
import os
import unittest

MODULE=os.path.join(os.path.dirname(__file__),'..','scripts','android_demo_locale_ui.py')
spec=importlib.util.spec_from_file_location('android_demo_locale_ui',MODULE)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def document(language='en',warning=True,button=True):
    label='English' if language=='en' else 'Español'
    text_warning='DEMO ONLY • NO REAL MONEY' if language=='en' else 'SOLO DEMOSTRACIÓN • SIN DINERO REAL'
    login='Welcome to Moneda Mundial' if language=='en' else 'Accede a Moneda Mundial'
    b=(f'<node package="com.monedamundial.demo" class="android.widget.Button" '
       f'content-desc="{label}" enabled="true" clickable="true" bounds="[10,20][110,100]"/>') if button else ''
    return '<hierarchy>'+b+'<node package="com.monedamundial.demo" text="🌐 MONEDA MUNDIAL"/>'+(
      f'<node package="com.monedamundial.demo" text="{text_warning}"/>' if warning else '')+(
      f'<node package="com.monedamundial.demo" text="{login}"/>')+'</hierarchy>'

class LocaleAndroidTests(unittest.TestCase):
    def test_matching_screen_and_button(self):
        for lang in ('en','es'):
            self.assertTrue(mod.visible_language(document(lang),lang))
            self.assertEqual(mod.button_coordinates(document(lang),lang),(60,60))
            other='es' if lang=='en' else 'en'
            self.assertFalse(mod.visible_language(document(lang),other))
    def test_missing_warning_and_invalid_button(self):
        self.assertFalse(mod.visible_language(document('en',warning=False),'en'))
        self.assertIsNone(mod.button_coordinates(document('en',button=False),'en'))
        xml=document('es').replace('bounds="[10,20][110,100]"','bounds="[0,0][0,0]"')
        self.assertIsNone(mod.button_coordinates(xml,'es'))
        xml=document('en').replace('class="android.widget.Button"','class="android.widget.TextView"')
        self.assertIsNone(mod.button_coordinates(xml,'en'))
    def test_no_accidental_duplicates(self):
        xml=document('en')
        target='<node package="com.monedamundial.demo" class="android.widget.Button" content-desc="English" enabled="true" clickable="true" bounds="[10,20][110,100]"/>'
        self.assertIsNone(mod.button_coordinates(xml.replace(target,target+target),'en'))

if __name__=='__main__':
 unittest.main()
