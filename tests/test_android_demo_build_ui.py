import importlib.util
import os
import unittest
PATH=os.path.join(os.path.dirname(__file__),'..','scripts','android_demo_build_ui.py')
spec=importlib.util.spec_from_file_location('build_check',PATH)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
SHA='a'*40
RUN='39333246828'
def node(text='',**kw):
    attrs={'package':'com.monedamundial.demo','text':text,**kw}
    return '<node '+''.join(f'{k}="{v}" ' for k,v in attrs.items())+'/>'
def screen(run=RUN,sha=SHA,notice=True):
    warning=node('DEMO ONLY — NO REAL MONEY') if notice else ''
    return '<hierarchy>'+node('App diagnostics (DEMO)')+node('Version: 2.0.0')+node('Git commit: '+sha)+node('GitHub Actions: '+run)+warning+'</hierarchy>'
class TestBuildInfo(unittest.TestCase):
    def test_exact_provenance(self):
        self.assertTrue(mod.diagnostic_matches(screen(),SHA,RUN))
        self.assertFalse(mod.diagnostic_matches(screen(run='1234'),SHA,RUN))
        self.assertFalse(mod.diagnostic_matches(screen(notice=False),SHA,RUN))
        self.assertFalse(mod.diagnostic_matches(screen(sha='b'*40),SHA,RUN))
    def test_only_one_visible_button(self):
        button=node('',**{'class':'android.widget.Button','content-desc':'View build info (DEMO)','clickable':'true','enabled':'true','bounds':'[10,30][110,130]'})
        self.assertEqual(mod.diag_button_coordinates('<hierarchy>'+button+'</hierarchy>'),(60,80))
        self.assertIsNone(mod.diag_button_coordinates('<hierarchy>'+button+button+'</hierarchy>'))
if __name__=='__main__':unittest.main()
