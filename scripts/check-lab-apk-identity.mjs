// Auditoría de identidad de APK Samsung LAB efímera.
// Solo lectura; nunca autoriza distribución ni altera datos de Android.
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {leerIdentidadAndroid} from './comprobar-actualizacion-android.mjs';

const archivo = process.argv[2];
if (!archivo || process.argv.length !== 3) {
  console.error('Uso: node scripts/check-lab-apk-identity.mjs APK_DEMO');
  process.exit(1);
}

try {
  const informe = execFileSync(process.env.AAPT_PATH || 'aapt',
    ['dump', 'badging', resolve(archivo)], {
      encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
    });
  const id = leerIdentidadAndroid(informe);
  if (id.paquete !== 'com.monedamundial.app.samsunglab' || id.versionCode !== 2) {
    throw new Error('Identidad LAB inesperada: APK no aceptada para el ensayo');
  }
  console.log(JSON.stringify({
    paquete: id.paquete, versionCode: id.versionCode,
    soloLaboratorio: true, autorizaDistribucion: false,
  }, null, 2));
} catch (error) {
  console.error('::error::' + error.message);
  process.exitCode = 1;
}
