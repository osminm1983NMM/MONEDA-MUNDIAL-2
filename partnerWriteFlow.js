// Ejecuta una escritura y distingue el fallo de escritura del fallo de lectura.
// No reintenta escrituras automáticamente: un fallo de red puede ocultar un COMMIT.
// Esta función no garantiza idempotencia; eso requiere soporte del servidor.
export async function writeThenRefresh(write, refresh) {
  let result;
  try {
    result = await write();
  } catch (error) {
    return { state: 'unknown', error };
  }
  try {
    await refresh(result);
    return { state: 'confirmed', result };
  } catch (error) {
    return { state: 'confirmed-refresh-failed', result, error };
  }
}
