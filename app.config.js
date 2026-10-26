// Variante aislada para futuras pruebas en Samsung.
// Sin MWD_APP_VARIANT la identidad Android principal queda intacta.
const MAIN_PACKAGE = 'com.monedamundial.app';
const LAB_PACKAGE = 'com.monedamundial.app.samsunglab';

module.exports = ({config}) => {
  const variant = process.env.MWD_APP_VARIANT;
  if (!variant) return config;
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
      versionCode: 1,
    },
    extra: {
      ...config.extra,
      mwdLabOnly: true,
    },
  };
};
