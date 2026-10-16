// Localización inicial de Moneda Mundial DEMO.
// Los códigos de país y los símbolos de activos no se traducen.
// Los mensajes que devuelve Supabase pueden seguir apareciendo en español.
const translations = {
  "en": {
    "Idioma de la aplicación": "Application language",
    "Detectar automáticamente": "Detect automatically",
    "SOLO DEMOSTRACIÓN • SIN DINERO REAL": "DEMO ONLY • NO REAL MONEY",
    "Accede a Moneda Mundial": "Sign in to Moneda Mundial",
    "Crea una cuenta de prueba o inicia sesión.": "Create a demo account or sign in.",
    "Correo electrónico": "Email address",
    "Contraseña (8 caracteres mínimo)": "Password (minimum 8 characters)",
    "Espera...": "Please wait...",
    "Iniciar sesión": "Sign in",
    "Crear cuenta de prueba": "Create demo account",
    "Cada cuenta nueva recibe 10,000 MWD ficticios. Si Supabase solicita confirmar el correo, revisa tu bandeja de entrada.": "Every new account receives 10,000 demo MWD credits. Check your inbox if email confirmation is required.",
    "← Volver al inicio": "← Back to home",
    "TU CUENTA PERSONAL DE PRUEBA": "YOUR DEMO ACCOUNT",
    "Saldo ficticio en Supabase": "Demo balance in Supabase",
    "Cargando identificador...": "Loading account identifier...",
    "Transferir MWD entre usuarios": "Transfer MWD between users",
    "Registrar aportación ficticia": "Record demo contribution",
    "Mis movimientos": "Transaction history",
    "Mi cuenta / recibir": "My account / receive",
    "Actualizar saldo e historial": "Refresh balance and history",
    "Convertir Coin ↔ Estable (prueba)": "Convert Coin ↔ Stable (demo)",
    "Entrega sin teléfono (DEMO)": "No-phone pickup (demo)",
    "Administración": "Administration",
    "Cerrar sesión": "Sign out",
    "Transferencia de prueba": "Demo transfer",
    "Pide a la otra persona su código MWD para enviarle créditos de demostración.": "Ask the recipient for their MWD account code to send demo credits.",
    "Ejemplo: MWD-0123456789ABCDEF": "Example: MWD-0123456789ABCDEF",
    "Cantidad MWD": "MWD amount",
    "Procesando...": "Processing...",
    "Confirmar transferencia ficticia": "Confirm demo transfer",
    "Aportación de prueba": "Demo contribution",
    "La cantidad se descontará de tu saldo ficticio y quedará en el historial. No se recibirá dinero real.": "The amount is deducted from your demo balance and recorded in history. No real money is received.",
    "Confirmar aportación ficticia": "Confirm demo contribution",
    "Mi identificador para recibir": "My receiving account code",
    "Comparte este identificador con otra cuenta de prueba. No compartas tu contraseña.": "Share this code with another demo account. Never share your password.",
    "Correo:": "Email:",
    "Mis últimos movimientos": "My recent transactions",
    "Todavía no hay movimientos en línea.": "No transactions yet.",
    "Aportación ficticia": "Demo contribution",
    "Transferencia enviada": "Transfer sent",
    "Transferencia recibida": "Transfer received",
    "Administración MWD": "MWD administration",
    "Tu rol es:": "Your role:",
    "El registro de socios requiere permisos de propietario.": "Managing partners requires owner privileges.",
    "Esta cuenta no tiene permisos administrativos. Solo el propietario del proyecto podrá asignarlos desde un entorno seguro.": "This account has no administrative permissions. Only the project owner may assign them securely.",
    "Nunca se puede asignar el rol de administrador desde esta pantalla.": "Administrator privileges cannot be granted from this screen.",
    "Moneda Mundial • Prototipo conectado a Supabase • No es un servicio financiero": "Moneda Mundial • Supabase-connected prototype • Not a financial service",
    "Coin ↔ Estable": "Coin ↔ Stable",
    "DEMO": "DEMO",
    "No se mueve dinero real.": "No real money is transferred."
  },
  "pt": {
    "Idioma de la aplicación": "Idioma do aplicativo",
    "Detectar automáticamente": "Detectar automaticamente",
    "SOLO DEMOSTRACIÓN • SIN DINERO REAL": "APENAS DEMONSTRAÇÃO • SEM DINHEIRO REAL",
    "Accede a Moneda Mundial": "Acesse a Moneda Mundial",
    "Crea una cuenta de prueba o inicia sesión.": "Crie uma conta de teste ou entre.",
    "Correo electrónico": "E-mail",
    "Contraseña (8 caracteres mínimo)": "Senha (mínimo de 8 caracteres)",
    "Espera...": "Aguarde...",
    "Iniciar sesión": "Entrar",
    "Crear cuenta de prueba": "Criar conta de teste",
    "Cada cuenta nueva recibe 10,000 MWD ficticios. Si Supabase solicita confirmar el correo, revisa tu bandeja de entrada.": "Cada conta nova recebe 10.000 créditos MWD fictícios. Verifique seu e-mail se for necessário confirmar o cadastro.",
    "← Volver al inicio": "← Voltar ao início",
    "TU CUENTA PERSONAL DE PRUEBA": "SUA CONTA DE TESTE",
    "Saldo ficticio en Supabase": "Saldo fictício no Supabase",
    "Cargando identificador...": "Carregando identificador...",
    "Transferir MWD entre usuarios": "Transferir MWD entre usuários",
    "Registrar aportación ficticia": "Registrar contribuição fictícia",
    "Mis movimientos": "Meus movimentos",
    "Mi cuenta / recibir": "Minha conta / receber",
    "Actualizar saldo e historial": "Atualizar saldo e histórico",
    "Convertir Coin ↔ Estable (prueba)": "Converter Coin ↔ Estável (teste)",
    "Entrega sin teléfono (DEMO)": "Retirada sem telefone (DEMO)",
    "Administración": "Administração",
    "Cerrar sesión": "Sair",
    "Transferencia de prueba": "Transferência de teste",
    "Pide a la otra persona su código MWD para enviarle créditos de demostración.": "Peça à outra pessoa o código MWD para enviar créditos fictícios.",
    "Ejemplo: MWD-0123456789ABCDEF": "Exemplo: MWD-0123456789ABCDEF",
    "Cantidad MWD": "Valor em MWD",
    "Procesando...": "Processando...",
    "Confirmar transferencia ficticia": "Confirmar transferência fictícia",
    "Aportación de prueba": "Contribuição fictícia",
    "La cantidad se descontará de tu saldo ficticio y quedará en el historial. No se recibirá dinero real.": "O valor será descontado do saldo fictício e registrado no histórico. Não será recebido dinheiro real.",
    "Confirmar aportación ficticia": "Confirmar contribuição fictícia",
    "Mi identificador para recibir": "Meu código para receber",
    "Comparte este identificador con otra cuenta de prueba. No compartas tu contraseña.": "Compartilhe este código com outra conta de teste. Nunca compartilhe sua senha.",
    "Correo:": "E-mail:",
    "Mis últimos movimientos": "Movimentos recentes",
    "Todavía no hay movimientos en línea.": "Ainda não há movimentos.",
    "Aportación ficticia": "Contribuição fictícia",
    "Transferencia enviada": "Transferência enviada",
    "Transferencia recibida": "Transferência recebida",
    "Administración MWD": "Administração MWD",
    "Tu rol es:": "Sua função é:",
    "El registro de socios requiere permisos de propietario.": "O cadastro de parceiros requer permissões do proprietário.",
    "Esta cuenta no tiene permisos administrativos. Solo el propietario del proyecto podrá asignarlos desde un entorno seguro.": "Esta conta não tem permissões administrativas. Somente o proprietário do projeto pode concedê-las com segurança.",
    "Nunca se puede asignar el rol de administrador desde esta pantalla.": "Não é possível conceder permissão de administrador nesta tela.",
    "Moneda Mundial • Prototipo conectado a Supabase • No es un servicio financiero": "Moneda Mundial • Protótipo conectado ao Supabase • Não é serviço financeiro",
    "Coin ↔ Estable": "Coin ↔ Estável",
    "DEMO": "DEMO",
    "No se mueve dinero real.": "Nenhum dinheiro real é movimentado."
  }
};

const LANGUAGES = ['es','en','pt'];
const LANGUAGE_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
  { id: 'pt', label: 'Português' }
];

function inferLanguage(locale) {
  const language = String(locale || '').trim().toLowerCase().replace('_', '-').split('-')[0];
  return LANGUAGES.includes(language) ? language : 'en';
}

function detectDeviceLanguage() {
  try {
    // Usa el idioma regional proporcionado por el sistema sin pedir permisos.
    const intl = Intl?.DateTimeFormat?.().resolvedOptions?.().locale;
    if (intl) return inferLanguage(intl);
  } catch (_ignored) {}
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return inferLanguage(navigator.language);
    }
  } catch (_ignored) {}
  return 'es';
}

function normalizeLanguagePreference(value) {
  return value === 'auto' || LANGUAGES.includes(value) ? value : 'auto';
}

function resolveLanguage(preference, deviceLanguage) {
  return preference === 'auto'
    ? inferLanguage(deviceLanguage || detectDeviceLanguage())
    : inferLanguage(preference);
}

function translateText(spanishText, language) {
  if (typeof spanishText !== 'string') return '';
  const dictionary = translations[inferLanguage(language)];
  return dictionary?.[spanishText] || spanishText;
}

module.exports = { LANGUAGES, LANGUAGE_OPTIONS, translations, inferLanguage,
  detectDeviceLanguage, normalizeLanguagePreference, resolveLanguage, translateText };
