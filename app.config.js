// Variantes Android aisladas para pruebas sin reemplazar la app principal.
// Sin MWD_APP_VARIANT la identidad Android principal queda intacta.
const MAIN_PACKAGE = 'com.monedamundial.app';
const LAB_PACKAGE = 'com.monedamundial.app.samsunglab';
const ISOLATED_PACKAGE = 'com.monedamundial.app.test20261029';

module.exports = ({config}) => {
  const variant = process.env.MWD_APP_VARIANT;
  if (!variant) return config;

  if (variant === 'isolated-test') {
    if (config?.android?.package !== MAIN_PACKAGE) {
      throw new Error('El paquete Android principal cambió; variante de prueba bloqueada');
    }
    return {
      ...config,
      name: 'Moneda Mundial TEST',
      scheme: 'monedamundialtest',
      android: {
        ...config.android,
        package: ISOLATED_PACKAGE,
        versionCode: 1,
      },
      extra: {
        ...config.extra,
        mwdLabOnly: true,
      },
    };
  }

  if (variant !== 'samsung-lab') {
    throw new Error('MWD_APP_VARIANT desconocida; compilación bloqueada');
  }
  if (config?.android?.package !== MAIN_PACKAGE) {
    throw new Error('El paquete Android principal cambió; variante LAB bloqueada');
  }

  return {
    ...config,
    name: 'Moneda Mundial LAB DEMO',
    scheme: 'monedamundiallab',
    android: {
      ...config.android,
      package: LAB_PACKAGE,
      // Permite actualizar la APK LAB instalada sin borrar sus datos locales.
      versionCode: 2,
    },
    extra: {
      ...config.extra,
      mwdLabOnly: true,
    },
  };
};
