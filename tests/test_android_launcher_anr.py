import importlib.util
import os
import unittest

MODULE = os.path.join(os.path.dirname(__file__), '..', 'scripts', 'android_launcher_anr.py')
spec = importlib.util.spec_from_file_location('android_launcher_anr', MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def fake_xml(title, close=True, clickable=True, bounds='[70,1170][1010,1296]'):
    button = (f'<node resource-id="android:id/aerr_close" clickable="{str(clickable).lower()}"'
              f' package="android" bounds="{bounds}"/>' if close else '')
    return f'<hierarchy><node resource-id="android:id/alertTitle" text="{title}"/>{button}</hierarchy>'


class ANRTriageTests(unittest.TestCase):
    def test_launcher_only(self):
        self.assertEqual(mod.inspect_ui(fake_xml("Pixel Launcher isn't responding")),
                         ('launcher_anr', (540, 1233)))
    def test_dont_dismiss_our_app_or_others(self):
        for app in ["Moneda Mundial DEMO", "Android System", "Unknown", "App"]:
            self.assertEqual(mod.inspect_ui(fake_xml(app + " isn't responding"))[0], 'other_anr')
    def test_invalid_or_ambiguous_dialog_fails_closed(self):
        self.assertEqual(mod.inspect_ui('<hierarchy>'), ('unknown', None))
        self.assertEqual(mod.inspect_ui('<hierarchy/>'), ('none', None))
        self.assertEqual(mod.inspect_ui(fake_xml("Pixel Launcher isn't responding", close=False))[0], 'unknown')
        self.assertEqual(mod.inspect_ui(fake_xml("Pixel Launcher isn't responding", clickable=False))[0], 'unknown')
        self.assertEqual(mod.inspect_ui(fake_xml("Pixel Launcher isn't responding", bounds='[0,0][0,1]'))[0], 'unknown')
    def test_previous_screen_without_anr(self):
        self.assertEqual(mod.inspect_ui('<hierarchy><node text="MONEDA MUNDIAL" /></hierarchy>'), ('none', None))


if __name__ == '__main__':
    unittest.main()
