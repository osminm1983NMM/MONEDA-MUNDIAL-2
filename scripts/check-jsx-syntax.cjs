// Analiza la sintaxis JavaScript/JSX sin iniciar Expo, compilar ni acceder a Supabase.
// Ejecutar después de instalar las dependencias: npm run check:syntax
const fs = require('node:fs');
const path = require('node:path');
let parser;
try {
  parser = require('@babel/parser');
} catch {
  console.error('Falta @babel/parser. Instala primero las dependencias del proyecto.');
  process.exit(1);
}
let failed = false;
for (const name of ['App.js', 'PartnerRegistryScreen.js']) {
  const file = path.join(__dirname, '..', name);
  try {
    parser.parse(fs.readFileSync(file, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx'],
      errorRecovery: false,
    });
    console.log('Sintaxis válida:', name);
  } catch (error) {
    failed = true;
    console.error('Error de sintaxis en ' + name + ': ' + error.message);
  }
}
if (failed) process.exitCode = 1;
else console.log('Análisis JSX completado. No sustituye la compilación Android.');
