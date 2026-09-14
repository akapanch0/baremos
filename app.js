/* ============================================================
   BAREMO v5.9.29 - app.js COMPLETO

   v5.9.29 - dashboard, historial, combustible y guia de baremos.
   NO toca ni un dato guardado:
   no se borran almacenes, no se renombra la base y la migracion de
   IndexedDB es solo aditiva. Cambios: credencial de administrador con
   PBKDF2 (migrando la vieja sin dejar a nadie afuera), almacenamiento
   persistente, recordatorio de backup, librerias locales con respaldo
   en CDN, cache de geocodificacion y limpieza del service worker.
   ============================================================ */
const APP_VERSION = '5.9.50';

/* Control de versión de Términos y Condiciones */
const CURRENT_TERMS_VERSION = 1;

const State = {
  user: null,
  jornada: null,
  items: [],
  baremo: [],
  theme: 'light',
  currentVersion: null,
  histFilter: 'hoy',
  histSelected: new Set(),
  adminLoggedIn: false,
  adminReportType: 'todos',
  updateAvailable: false,
  remoteVersion: null,
  mensaje200kMostrado: false,
  mensaje150kMostrado: false,
  mensaje125kMostrado: false,
  mensaje100kMostrado: false,
  metaAlcanzada: false,
  pushSubscribed: false,
  pushPublicKey: null,
  avisosEmpresa: [],
  avisosCategoriaFiltro: 'todas'
};

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const fmt = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = n => new Intl.NumberFormat('es-AR').format(n || 0);

/* ============================================================
   LÓGICA CENTRALIZADA DE RANGOS Y COLORES
   ============================================================ */
function getConfigDia(monto) {
  if (monto > 200000) return { cls: 'bg-gold', hex: '#D4AF37', nombre: 'Excelente (>200k)' };
  if (monto >= 150000) return { cls: 'bg-green-intense', hex: '#16a34a', nombre: 'Muy Bueno (≥150k)' };
  if (monto >= 125000) return { cls: 'bg-green-soft', hex: '#65a30d', nombre: 'Bueno (≥125k)' };
  if (monto >= 100000) return { cls: 'bg-yellow-green', hex: '#ca8a04', nombre: 'Regular (≥100k)' };
  return { cls: 'bg-red', hex: '#ef4444', nombre: 'Bajo (<100k)' };
}

function getConfigMes(monto) {
  if (monto <= 1500000) return { cls: 'tac-red', hex: '#ef4444', nombre: 'Bajo (≤1.5M)' };
  if (monto <= 2000000) return { cls: 'tac-yellow', hex: '#facc15', nombre: 'Regular (≤2M)' };
  if (monto <= 2500000) return { cls: 'tac-green-soft', hex: '#4ade80', nombre: 'Bueno (≤2.5M)' };
  if (monto < 3000000) return { cls: 'tac-green-intense', hex: '#22c55e', nombre: 'Muy Bueno (<3M)' };
  return { cls: 'tac-gold', hex: '#fbbf24', nombre: 'Excelente (≥3M)' };
}

/* Meta mensual y mensajes motivacionales.
   Antes los umbrales estaban escritos dos veces (getConfigMes y el
   Dashboard): si se cambiaba uno, el color y el mensaje se contradecian.
   Ahora el mensaje se elige por la MISMA clase que pinta la tarjeta. */
const META_MENSUAL = 3000000;
const MENSAJES_META = {
  'tac-green-soft': '👏 ¡Sigue así!',
  'tac-green-intense': '🚀 Excelente rendimiento',
  'tac-gold': '🏆 ¡Sos Imparable!'
};

/* ============================================================
   CONTENIDO MENÚ LEGAL (FUENTE DE VERDAD)
   ============================================================ */
const INFO_CONTENT = {
  privacidad: {
    title: "Política de Privacidad",
    html: `<h3>1. Introducción</h3><p>La presente Política de Privacidad describe cómo se gestiona la información dentro del sitio web BAREMO y su aplicación asociada. Este proyecto es un desarrollo 100% freelance, sin asociaciones comerciales ni vínculos con terceros.</p><h3>2. No recopilación de datos personales</h3><p>BAREMO no recopila, almacena ni procesa datos personales de los usuarios.</p><p>El sitio y la aplicación no solicitan información identificatoria, no registran actividad del usuario y no acceden a datos del dispositivo.</p><h3>3. Información local</h3><p>Toda la información que el usuario ingresa en la aplicación se mantiene localmente en su dispositivo, sin ser enviada ni almacenada en servidores externos.</p><h3>4. Cookies y tecnologías de seguimiento</h3><p>Este sitio no utiliza cookies, herramientas de análisis, publicidad, ni tecnologías de rastreo.</p><h3>5. Compartición de información</h3><p>Dado que no se recopilan datos, no existe ningún tipo de cesión, venta o transferencia de información a terceros.</p><h3>6. Seguridad</h3><p>Aunque no se manejan datos personales, se aplican medidas básicas de seguridad para garantizar el funcionamiento correcto del sitio y la aplicación.</p><h3>7. Actualizaciones</h3><p>BAREMO puede modificar esta política en cualquier momento. Las actualizaciones se publicarán en este sitio web.</p>`
  },
  terminos: {
    title: "Términos y Condiciones",
    html: `<h3>1. Aceptación</h3><p>Al utilizar el sitio o la aplicación BAREMO, el usuario acepta estos Términos y Condiciones. Si no está de acuerdo, debe abstenerse de utilizar el servicio.</p><h3>2. Descripción del servicio</h3><p>BAREMO es una herramienta destinada al control y registro de ganancias diarias para contratistas del rubro eléctrico.</p><p>El servicio se ofrece “tal cual”, sin garantías de disponibilidad continua o ausencia de errores.</p><h3>3. Uso permitido</h3><p>El usuario se compromete a utilizar el sitio y la aplicación de manera legal y responsable. Queda prohibido:</p><ul><li>Manipular o intentar acceder a funciones no autorizadas.</li><li>Utilizar el servicio para actividades ilícitas.</li><li>Realizar ingeniería inversa, descompilación o extracción del código fuente.</li></ul><h3>4. Responsabilidad</h3><p>BAREMO no se responsabiliza por:</p><ul><li>Errores derivados del uso incorrecto del servicio.</li><li>Pérdida de información almacenada localmente en el dispositivo del usuario.</li><li>Fallas técnicas, interrupciones o indisponibilidad del servicio.</li></ul><h3>5. Modificaciones</h3><p>Los presentes términos pueden actualizarse sin previo aviso. Las modificaciones se publicarán en este sitio.</p>`
  },
  legal: {
    title: "Aviso Legal",
    html: `<p>BAREMO es un proyecto independiente y freelance, sin asociaciones con empresas, entidades o marcas del sector eléctrico.</p><p>La información presentada en el sitio y la aplicación tiene fines operativos y organizativos para contratistas.</p><p>No se garantiza la exactitud de los cálculos o registros generados por el usuario, ya que cada contratista maneja sus propios Baremos y estos pueden variar.</p><p>El desarrollador no asume responsabilidad por decisiones comerciales tomadas a partir del uso de la aplicación.</p>`
  },
  contacto: {
    title: "Contacto",
    html: `<p>Para consultas, sugerencias o reportes relacionados con la aplicación BAREMO, podés comunicarte a:</p><p>📧 Email: <a href="mailto:contacto@baremo.app">contacto@baremo.app</a><br>🌐 Desarrollador: Proyecto freelance AKAPANCH0<br>📍 Ubicación: Buenos Aires, Argentina</p>`
  },
  nosotros: {
    title: "Sobre Nosotros",
    html: `<p>BAREMO es un proyecto desarrollado de manera 100% freelance, sin asociaciones comerciales ni vínculos con terceros.</p><p>Nuestro objetivo es ofrecer una herramienta simple, clara y eficiente para contratistas del rubro eléctrico, permitiendo registrar y controlar sus ganancias diarias, tareas realizadas y organización operativa.</p><p>Creemos en soluciones prácticas, livianas y sin complicaciones. Por eso, nuestra aplicación funciona de manera local, sin recopilar datos personales y sin depender de servidores externos.</p><p>BAREMO es independiente, transparente y diseñado para profesionales que necesitan una herramienta confiable para su trabajo diario.</p>`
  }
};

function showInfoModal(key) {
  const data = INFO_CONTENT[key];
  if (!data) return;
  const title = $('#modalInfoTitle');
  const content = $('#modalInfoContent');
  const modal = $('#modalInfo');
  if (title && content && modal) {
    title.textContent = data.title;
    content.innerHTML = data.html;
    modal.classList.add('show');
  }
}

/* ============================================================
   ZONAS Y MAPAS
   ============================================================ */
const ZONA_MAPAS = {
  'Trujui': { archivo: 'trujui.png', nombre: 'Trujui' },
  'Cuartel V': { archivo: 'cuartelv.png', nombre: 'Cuartel V' },
  'Moreno': { archivo: 'moreno.png', nombre: 'Moreno' },
  'Gral. Rodríguez': { archivo: 'gralrodriguez.png', nombre: 'Gral. Rodríguez' },
  'Tigre': { archivo: 'tigre.png', nombre: 'Tigre' },
  'San Martín': { archivo: 'sanmartin.png', nombre: 'San Martín' },
  'Olivos': { archivo: 'olivos.png', nombre: 'Olivos' },
  'Pilar-Escobar': { archivo: 'pilarescobar.png', nombre: 'Pilar-Escobar' }
};

function mostrarMapaZona(zona) {
  const container = $('#zonaMapaContainer');
  const img = $('#zonaMapaImg');
  const placeholder = $('#zonaMapaPlaceholder');
  const titulo = $('#zonaMapaTitulo');
  const nombre = $('#zonaMapaNombre');
  if (!container) return;
  if (!zona || !ZONA_MAPAS[zona]) {
    container.classList.remove('show');
    return;
  }
  const mapa = ZONA_MAPAS[zona];
  titulo.textContent = `Zona: ${mapa.nombre}`;
  nombre.textContent = mapa.nombre;
  img.style.display = 'none';
  placeholder.innerHTML = `<div><span class="zmp-ico">⏳</span><span>Cargando mapa...</span></div>`;
  placeholder.style.display = 'grid';
  container.classList.remove('show');
  void container.offsetWidth;
  const nuevaImg = new Image();
  nuevaImg.onload = () => {
    img.src = `maps/${mapa.archivo}`;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    container.classList.add('show');
  };
  nuevaImg.onerror = () => {
    placeholder.innerHTML = `<div><span class="zmp-ico">⚠️</span><span>Mapa no disponible</span></div>`;
    placeholder.style.display = 'grid';
    container.classList.add('show');
  };
  nuevaImg.src = `maps/${mapa.archivo}`;
}

function setupMapaZona() {
  const s = $('#loginZona');
  if (s) s.addEventListener('change', e => mostrarMapaZona(e.target.value));
}

/* ============================================================
   FRASES MOTIVACIONALES
   ============================================================ */
const FRASES = ["Hoy es un nuevo día productivo","Tu esfuerzo es tu mayor recompensa","Cada tarea completada es un paso hacia el éxito","La disciplina vence al talento","Hacé que cada minuto cuente","El éxito es la suma de pequeños esfuerzos","Tu dedicación inspira a los demás","Cada baremo es una victoria","La constancia es la clave del progreso","Hoy vas a superar tus propios récords","El trabajo bien hecho no pasa desapercibido","Cada día es una nueva oportunidad","La excelencia es un hábito, no un acto","Tu compromiso marca la diferencia","Los grandes logros empiezan con un primer paso","La perseverancia convierte sueños en realidad","Hoy construyes el mañana que querés","Cada desafío es una oportunidad de crecer","Tu actitud define tu altitud","El esfuerzo de hoy es el éxito de mañana","Somos lo que hacemos día tras día","La pasión por el trabajo se nota en los resultados","Cada jornada es una página de tu historia","Tu determinación es tu superpoder","Los resultados llegan a quienes no se rinden","Hoy es el día perfecto para dar lo mejor","La calidad no es un acto, es un hábito","Cada meta alcanzada abre nuevas puertas","Tu trabajo duro tiene su recompensa","El éxito se construye día a día","Vos tenés el poder de hacer la diferencia","Cada tarea es una oportunidad de brillar","La motivación te pone en marcha, el hábito te mantiene","Hoy es tu día para destacar","El progreso, no la perfección, es lo que importa","Tu energía positiva transforma el entorno","Cada esfuerzo suma al gran objetivo","La acción es la clave fundamental de todo éxito","Vos podés lograr lo que te propongas","El trabajo en equipo multiplica los resultados","Cada día es una nueva chance de ser mejor","La dedicación abre todas las puertas","Tu constancia es admirada por todos","El éxito no es casualidad, es trabajo duro","Cada baremo completado es un logro personal","Hoy es un gran día para tener un gran día","La actitud positiva atrae resultados positivos","Tu esfuerzo construye tu futuro","Cada paso cuenta en el camino al éxito","La pasión convierte el trabajo en arte","Vos sos el arquitecto de tu propio destino","Cada jornada es una nueva aventura","El trabajo bien hecho es su propia recompensa","Tu compromiso inspira a todo el equipo","Hoy dejás huella con tu trabajo","La excelencia está en los detalles","Cada meta es un escalón hacia arriba","Tu esfuerzo diario construye grandes cosas","El éxito llega a quienes se preparan","Vos tenés todo lo necesario para triunfar","Cada día es una nueva página en blanco","La disciplina es el puente entre metas y logros","Tu trabajo es tu firma personal","Cada logro comienza con la decisión de intentarlo","El esfuerzo constante supera al talento natural","Hoy es el día de superar tus límites","Tu dedicación es la base de tu éxito","Cada tarea completada es una victoria","La paciencia y el esfuerzo todo lo pueden","Vos marcás la diferencia con tu trabajo","Cada día es una oportunidad de aprender","El éxito es la consecuencia del esfuerzo","Tu trabajo habla por vos","Cada jornada es un paso hacia la meta","La fortaleza viene de superar desafíos","Cada logro es un motivo para celebrar","El trabajo duro supera al talento cuando el talento no trabaja duro","Tu esfuerzo de hoy construye tu éxito de mañana","La pasión por lo que hacés es tu mejor herramienta","Vos sos capaz de lograr cosas increíbles","Cada tarea es una oportunidad de demostrar tu valor","El éxito se mide por el progreso, no por la perfección","Tu dedicación diaria hace la diferencia","Cada meta alcanzada es un nuevo comienzo","La actitud lo es todo","Vos escribís tu propia historia de éxito","El trabajo en equipo hace que los sueños funcionen","Tu esfuerzo es la semilla de tu éxito","Cada día es un regalo, por eso se llama presente","La perseverancia es la madre de la suerte","Vos tenés el poder de cambiar tu realidad","Cada tarea completada te acerca a tu meta","El coraje para continuar es lo que cuenta","Tu trabajo es tu mejor carta de presentación","Vos sos el protagonista de tu propia historia","Cada logro es un escalón hacia tu sueño","El esfuerzo de hoy es la tranquilidad de mañana","Tu compromiso es tu mayor fortaleza","Cada jornada es una nueva aventura por vivir","La dedicación convierte lo ordinario en extraordinario","El trabajo duro siempre paga","Tu esfuerzo diario construye tu legado","Cada día es una nueva oportunidad de triunfar","La pasión por el trabajo se refleja en los resultados","Vos sos la clave de tu propio éxito","Cada logro es un motivo de orgullo","El esfuerzo constante abre todas las puertas","Tu dedicación es tu mejor inversión","La actitud positiva es el primer paso al éxito","Cada tarea completada es un paso adelante","Tu esfuerzo es la base de tu futuro","La disciplina es la madre del éxito","Vos sos capaz de superar cualquier obstáculo","Cada logro es una celebración del esfuerzo","El trabajo duro convierte los sueños en realidad","La perseverancia es la clave de todo logro","Cada tarea es una oportunidad de demostrar tu capacidad","El éxito llega a quienes trabajan por él","La excelencia se logra con dedicación","Cada logro es un motivo para seguir adelante","El trabajo duro es el camino al éxito","Vos sos el autor de tu propio destino","El trabajo duro siempre da sus frutos","Tu dedicación es tu sello personal","La actitud positiva atrae cosas positivas","Cada tarea completada es una victoria personal","Hoy es un día para recordar","Tu esfuerzo marca la diferencia","Cada día cuenta en tu camino","La constancia es tu mejor aliada","Vos tenés todo lo que necesitás","El éxito está en tus manos","Cada jornada es una nueva oportunidad","Tu dedicación es admirable","La pasión te lleva lejos","Vos sos capaz de grandes cosas","El trabajo en equipo es tu fortaleza","Cada logro es un paso más","Tu esfuerzo inspira a otros","La excelencia es tu marca personal","Vos construís tu propio camino","Cada día es una nueva chance","Tu dedicación da frutos","El éxito es tu destino","Vos marcás la diferencia","Cada tarea es importante","Tu esfuerzo vale la pena","La perseverancia es tu fuerza","Vos sos un ejemplo a seguir","Cada logro te acerca a tu meta","Tu dedicación es tu mejor arma","El trabajo duro te define","Vos tenés el potencial","Cada día es una bendición","Tu esfuerzo construye tu futuro","La pasión es tu motor","Vos sos único y especial","Cada jornada es un regalo","Tu dedicación es tu legado","El éxito es tuyo","Vos podés con todo","Cada logro es una victoria","Tu esfuerzo es tu firma","La excelencia es tu hábito","Vos sos el mejor","Cada día es una oportunidad","Tu dedicación es tu fuerza","El éxito te espera","Vos sos imparable","Cada tarea es un paso","Tu esfuerzo es tu mejor inversión","La perseverancia es tu clave","Vos sos un ganador","Cada logro es tuyo","Tu dedicación es tu sello","El éxito es tu recompensa","Vos sos extraordinario","Cada día es para brillar","Tu esfuerzo es tu orgullo","La excelencia es tu camino","Vos sos inspirador","Cada jornada es una victoria","Tu dedicación es tu poder","El éxito está cerca","Vos sos capaz de todo","Cada logro es un triunfo","Tu esfuerzo es tu mejor aliado","La perseverancia es tu virtud","Vos sos un líder","Cada día es para crecer","Tu dedicación es tu fuerza interior","El éxito es tu destino final","Vos sos imbatible","Cada tarea es una oportunidad","Tu esfuerzo es tu mejor carta","La excelencia es tu marca","Vos sos un campeón","Cada logro es un escalón","Tu dedicación es tu mejor inversión","El éxito es tu recompensa merecida","Vos sos inolvidable","Cada día es una nueva página","Tu esfuerzo es tu mayor tesoro","La perseverancia es tu mejor amiga","Vos sos una estrella","Cada jornada es un nuevo comienzo","Tu dedicación es tu mejor legado","El éxito es tu destino asegurado","Vos sos una inspiración","Cada logro es una bendición","Tu esfuerzo es tu mejor inversión","La excelencia es tu sello personal","Vos sos un triunfador","Cada día es para destacar","Tu dedicación es tu mayor fortaleza","El éxito es tu recompensa","Vos sos un ejemplo","Cada tarea es una victoria","Tu esfuerzo es tu mejor aliado","La perseverancia es tu mejor virtud","Vos sos un genio","Cada logro es un paso al éxito","Tu dedicación es tu mejor inversión","El éxito es tu destino","Vos sos extraordinario","Cada día es una oportunidad de oro","Tu esfuerzo es tu mejor legado","La excelencia es tu mejor marca","Vos sos una leyenda","Cada jornada es una nueva aventura","Tu dedicación es tu mejor inversión","El éxito es tu destino asegurado","Vos sos un maestro","Cada logro es una bendición","Tu esfuerzo es tu mejor inversión","La perseverancia es tu mejor virtud","Vos sos un héroe","Cada día es para triunfar","Tu dedicación es tu mejor legado","El éxito es tu recompensa","Vos sos un líder nato"];

function obtenerFraseDelDia() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return FRASES[Math.floor((now - start) / 86400000) % FRASES.length];
}

function renderFraseMotivacional() {
  const c = $('#fraseContainer');
  if (c) c.innerHTML = `<div class="frase-card"><div class="frase-texto">${obtenerFraseDelDia()}</div><div class="frase-autor">— BAREMO</div></div>`;
}

/* ============================================================
   MENSAJES SEGÚN UMBRALES DIARIOS
   ============================================================ */
const MENSAJES_100K = ["No es suficiente para Objetivo", "Vamos, tu puedes."];
const MENSAJES_125K = ["Estas cerca de tu objetivo", "Vamos, ya casi lo logras", "Vas Bien!", "Sigue así."];
const MENSAJES_150K = ["Sos el mejor", "Imparable!", "Que Grande! Objetivo Superado!", "Ve a descansar."];
const MENSAJES_200K = ["Imparable", "Tu esfuerzo tiene recompensa", "Nadie mejor que vos"];

function mostrarMensajeDiario(mensajes, bgColor) {
  const mensaje = mensajes[Math.floor(Math.random() * mensajes.length)];
  const el = document.createElement('div');
  el.className = 'mensaje-impulso';
  el.textContent = mensaje;
  if (bgColor) el.style.background = bgColor;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 100);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 500);
  }, 3500);
}

function mostrarMensaje100k() {
  State.mensaje100kMostrado = true;
  mostrarMensajeDiario(MENSAJES_100K, 'linear-gradient(135deg, #f59e0b, #d97706)');
}
function mostrarMensaje125k() {
  State.mensaje125kMostrado = true;
  mostrarMensajeDiario(MENSAJES_125K, 'linear-gradient(135deg, #22c55e, #16a34a)');
}
function mostrarMensaje150k() {
  State.mensaje150kMostrado = true;
  mostrarMensajeDiario(MENSAJES_150K, 'linear-gradient(135deg, #10b981, #047857)');
}
function mostrarMensaje200k() {
  State.mensaje200kMostrado = true;
  mostrarMensajeDiario(MENSAJES_200K, 'linear-gradient(135deg, #ffd700, #ff6b6b, #4ecdc4)');
  lanzarConfeti();
}

function lanzarConfeti() {
  let cont = document.querySelector('.confeti-container');
  if (!cont) {
    cont = document.createElement('div');
    cont.className = 'confeti-container';
    document.body.appendChild(cont);
  }
  cont.innerHTML = '';
  const colores = ['#ffd700', '#ff6b6b', '#4ecdc4', '#a78bfa', '#f472b6', '#34d399'];
  for (let i = 0; i < 80; i++) {
    const conf = document.createElement('div');
    conf.className = 'confeti';
    conf.style.left = Math.random() * 100 + '%';
    conf.style.background = colores[Math.floor(Math.random() * colores.length)];
    conf.style.animationDelay = Math.random() * 2 + 's';
    conf.style.animationDuration = (Math.random() * 2 + 2) + 's';
    conf.style.width = (Math.random() * 8 + 6) + 'px';
    conf.style.height = (Math.random() * 8 + 6) + 'px';
    conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    cont.appendChild(conf);
  }
  setTimeout(() => { cont.innerHTML = ''; }, 5000);
}

function lanzarBengalas() {
  const total = $('#totalGeneralCard');
  if (!total) return;
  const rect = total.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const colores = ['#ffd700', '#ff6b6b', '#4ecdc4', '#a78bfa', '#f472b6'];
  for (let b = 0; b < 3; b++) {
    setTimeout(() => {
      const bx = centerX + (Math.random() - 0.5) * rect.width;
      const by = centerY + (Math.random() - 0.5) * rect.height;
      for (let i = 0; i < 20; i++) {
        const bengala = document.createElement('div');
        bengala.className = 'bengala';
        bengala.style.left = bx + 'px';
        bengala.style.top = by + 'px';
        bengala.style.background = colores[Math.floor(Math.random() * colores.length)];
        const angle = (Math.PI * 2 * i) / 20;
        const distance = 60 + Math.random() * 40;
        bengala.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
        bengala.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
        document.body.appendChild(bengala);
        setTimeout(() => bengala.remove(), 2000);
      }
    }, b * 400);
  }
}

/* ============================================================
   FUNCIONES DE FECHA
   ============================================================ */
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function ahora() { return new Date().toISOString(); }
function fechaLegible(f) {
  const [y,m,d] = f.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}
function fechaCorta(f) {
  const [y,m,d] = f.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('es-AR');
}
function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
/* ------------------------------------------------------------
   Aritmetica de meses con texto, no con Date.

   EL BUG QUE HABIA: mesAnterior() hacia d.setMonth(d.getMonth()-1)
   sobre la fecha de hoy. El 31 de marzo eso da "31 de febrero", que
   JavaScript corrige a 3 de marzo: devolvia 2026-03 en lugar de
   2026-02. O sea que los dias 29, 30 y 31 el dashboard comparaba el
   mes contra si mismo. Trabajando con el texto "YYYY-MM" el problema
   desaparece porque no existe el dia.
   ------------------------------------------------------------ */
function mesPrevioDe(ms) {
  const [y, m] = ms.split('-').map(Number);
  const y2 = m === 1 ? y - 1 : y;
  const m2 = m === 1 ? 12 : m - 1;
  return `${y2}-${String(m2).padStart(2, '0')}`;
}
function mesSiguienteDe(ms) {
  const [y, m] = ms.split('-').map(Number);
  const y2 = m === 12 ? y + 1 : y;
  const m2 = m === 12 ? 1 : m + 1;
  return `${y2}-${String(m2).padStart(2, '0')}`;
}
function mesAnterior() {
  return mesPrevioDe(mesActual());
}
function nombreMes(ms) {
  const [y,m] = ms.split('-').map(Number);
  return new Date(y,m-1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
}
function nombreMesCorto(ms) {
  const [y,m] = ms.split('-').map(Number);
  return new Date(y,m-1,1).toLocaleDateString('es-AR',{month:'short',year:'2-digit'});
}
function diasDelMes(ms) {
  const [y,m] = ms.split('-').map(Number);
  return new Date(y,m,0).getDate();
}

/* ============================================================
   DÍAS HÁBILES ARGENTINA
   ============================================================ */
function calcularPascua(anio) {
  const a = anio % 19, b = Math.floor(anio/100), c = anio % 100;
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
  const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
  const i = Math.floor(c/4), k = c % 4, l = (32+2*e+2*i-h-k) % 7;
  const m = Math.floor((a+11*h+22*l)/451);
  const mes = Math.floor((h+l-7*m+114)/31);
  const dia = ((h+l-7*m+114) % 31) + 1;
  return new Date(anio, mes-1, dia);
}
function esFeriadoArgentino(fecha) {
  const d = fecha.getDate(), m = fecha.getMonth()+1, a = fecha.getFullYear();
  const fijos = [[1,1],[3,24],[5,1],[5,25],[6,20],[7,9],[8,17],[10,12],[11,20],[12,8],[12,25]];
  for (const [fm,fd] of fijos) {
    if (m===fm && d===fd) return true;
  }
  const pascua = calcularPascua(a);
  const vs = new Date(pascua);
  vs.setDate(vs.getDate()-2);
  if (fecha.toDateString() === vs.toDateString()) return true;
  const cl = new Date(pascua);
  cl.setDate(cl.getDate()-48);
  const cm = new Date(cl);
  cm.setDate(cm.getDate()+1);
  if (fecha.toDateString() === cl.toDateString() || fecha.toDateString() === cm.toDateString()) return true;
  return false;
}
function esDiaHabil(fecha) {
  const dow = fecha.getDay();
  return dow !== 0 && dow !== 6 && !esFeriadoArgentino(fecha);
}
function obtenerPosicionDiaHabil(fecha) {
  const m = fecha.getMonth(), a = fecha.getFullYear();
  const diasMes = new Date(a, m+1, 0).getDate();
  let count = 0;
  for (let dia = 1; dia <= diasMes; dia++) {
    const f = new Date(a, m, dia);
    if (esDiaHabil(f)) {
      count++;
      if (f.toDateString() === fecha.toDateString()) return count;
    }
  }
  return -1;
}
/* ------------------------------------------------------------
   VENTANA DE REGISTRO DE LA 2da QUINCENA (regla real, v5.9.29)

   La 2da quincena SIEMPRE se registra en el mes siguiente, dentro de
   los primeros 10 dias corridos, porque la empresa paga 5 dias
   HABILES despues del cierre de la quincena. Con 10 dias corridos la
   ventana cubre el pago aunque caiga fin de semana o feriado largo.

   El descuento NO pertenece al mes en que se cobra: pertenece al mes
   ya cerrado que se esta liquidando. De eso se ocupa mesPeriodoQ2().
   ------------------------------------------------------------ */
const Q2_DIA_LIMITE = 10;

// Devuelve la fecha del enesimo dia habil de un mes "YYYY-MM".
function diaHabilDelMes(ms, n) {
  const [y, m] = ms.split('-').map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  let cuenta = 0;
  for (let dia = 1; dia <= ultimo; dia++) {
    const f = new Date(y, m - 1, dia);
    if (esDiaHabil(f)) {
      cuenta++;
      if (cuenta === n) return f;
    }
  }
  return null;
}

/* Fechas de la Q2 de un mes: se cobra en el mes siguiente, al 5to dia
   habil (regla de la empresa), y se puede registrar hasta el dia 10. */
function fechasCobroQ2(mesPeriodo) {
  const mesPago = mesSiguienteDe(mesPeriodo);
  const [py, pm] = mesPago.split('-').map(Number);
  return {
    mesPago,
    cuarto: diaHabilDelMes(mesPago, 4),
    quinto: diaHabilDelMes(mesPago, 5),
    pago: diaHabilDelMes(mesPago, 5),
    limite: new Date(py, pm - 1, Q2_DIA_LIMITE)
  };
}

// Del 1 al 10 (corridos) del mes siguiente se registra la Q2 del mes cerrado.
function esDiaRegistroQ2() {
  return new Date().getDate() <= Q2_DIA_LIMITE;
}

/* El mes al que PERTENECE la Q2 que se puede registrar hoy: siempre el
   mes ya cerrado. Es la pieza que evita que el descuento caiga en el
   mes nuevo. */
function mesPeriodoQ2() {
  return esDiaRegistroQ2() ? mesAnterior() : mesActual();
}
function mesQuincenaActual() {
  return esDiaRegistroQ2() ? mesAnterior() : mesActual();
}
function obtenerSemanaDeFecha(fechaStr) {
  const [y,m,d] = fechaStr.split('-').map(Number);
  const fecha = new Date(y, m-1, d);
  const diaSemana = fecha.getDay();
  const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() + diffLunes);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return {
    lunes: lunes.toISOString().slice(0,10),
    domingo: domingo.toISOString().slice(0,10)
  };
}

/* ============================================================
   UI HELPERS Y CONFIRMACIONES GLOBALES
   ============================================================ */
function toast(msg, type='info') {
  const w = $('.toast-wrap');
  if (!w) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type==='success'?'✅':type==='error'?'❌':type==='warn'?'⚠️':'ℹ️'}</span><span>${msg}</span>`;
  w.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* v5.9.41 - espera corta, para dejar ver una animacion antes de seguir. */
function esperar(ms) {
  return new Promise(res => setTimeout(res, ms));
}

/* v5.9.41 - CARTEL ANIMADO DE JORNADA CERRADA
   Aparece en el centro: el circulo se dibuja, el tilde se traza y el texto
   confirma el cierre. Se va solo, no bloquea la pantalla y no espera clics. */
function mostrarCierreDeJornadaOk(mensaje) {
  try {
    const previo = document.getElementById('cierreOkCartel');
    if (previo) previo.remove();

    const el = document.createElement('div');
    el.id = 'cierreOkCartel';
    el.className = 'cierre-ok';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span class="cok-aro" aria-hidden="true"></span>'
      + '<span class="cok-ico" aria-hidden="true">'
      + '<svg viewBox="0 0 52 52" focusable="false" aria-hidden="true">'
      + '<circle class="cok-circ" cx="26" cy="26" r="23"/>'
      + '<path class="cok-tilde" pathLength="100" d="M15 27.5l7.5 7.5L37 20"/>'
      + '</svg></span>'
      + '<span class="cok-txt">' + (mensaje || 'Tu jornada ha sido cerrada satisfactoriamente') + '</span>';

    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('ver'));
    setTimeout(() => {
      el.classList.remove('ver');
      setTimeout(() => { if (el.parentNode) el.remove(); }, 420);
    }, 2800);
  } catch (e) {
    toast('Tu jornada ha sido cerrada satisfactoriamente', 'success');
  }
}

function confirmDialog(msg) {
  return new Promise(res => {
    const m = $('#modalConfirm');
    const activeModals = $$('.modal-backdrop.show').filter(mod => mod.id !== 'modalConfirm');
    activeModals.forEach(mod => mod.classList.remove('show'));

    $('#modalConfirmMsg').textContent = msg;
    m.classList.add('show');

    $('#confirmOk').onclick = () => {
      m.classList.remove('show');
      res(true);
    };
    
    $('#confirmCancel').onclick = () => {
      m.classList.remove('show');
      activeModals.forEach(mod => mod.classList.add('show'));
      res(false);
    };
  });
}

function parsePrecio(v) {
  if (typeof v === 'number' && !isNaN(v)) return v;
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/[$€£\s]/g, '');
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc === -1 && ld === -1) return parseFloat(s) || 0;
  if (lc > ld) {
    const ac = s.slice(lc + 1);
    if (/^\d{1,2}$/.test(ac)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else s = s.replace(/,/g, '');
  return parseFloat(s) || 0;
}
function getField(r, ...keys) {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k];
  }
  const rk = Object.keys(r);
  for (const k of keys) {
    const found = rk.find(x => x.toLowerCase() === k.toLowerCase());
    if (found !== undefined) return r[found];
  }
  return '';
}

/* ============================================================
   SEGURIDAD - HASH SHA-256
   ============================================================ */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
/* ------------------------------------------------------------
   CREDENCIAL DE ADMINISTRADOR (v5.9.28)

   Antes la contraseña inicial viajaba en texto plano dentro de este
   archivo y el hash era SHA-256 pelado. Ahora:
     - Ya NO hay contraseña por defecto escrita en el codigo.
     - Se guarda con PBKDF2-SHA256, 210.000 vueltas y sal aleatoria.
     - Quien ya tenia contraseña la sigue usando igual: al primer
       ingreso correcto se migra sola al formato nuevo. NADIE queda
       afuera del panel y ningun dato se toca.
     - Si la contraseña era todavia la de fabrica, se obliga a
       cambiarla en ese mismo momento.
   ------------------------------------------------------------ */
const PBKDF2_ITERACIONES = 210000;
const CLAVE_CREDENCIAL = 'adminCredencial';
const CLAVE_CREDENCIAL_LEGADO = 'adminPasswordHash';
// Hash SHA-256 de la contraseña de fabrica que usaban las versiones previas.
// Solo sirve para detectar que sigue sin cambiarse y exigir el cambio.
const HASH_DEFECTO_LEGADO = '059a50ce956b7ec61527c7ecc0c55b5a009dc54ab4acddce8852b46baa2aba30';

function bytesAHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexABytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function derivarPBKDF2(pass, saltBytes, iteraciones) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: iteraciones, hash: 'SHA-256' },
    base, 256
  );
  return bytesAHex(bits);
}

/* Comparacion en tiempo constante: no filtra cuantos caracteres coinciden. */
function igualSeguro(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

async function guardarCredencialAdmin(pass, debeCambiar) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivarPBKDF2(pass, salt, PBKDF2_ITERACIONES);
  await dbPut('config', {
    key: CLAVE_CREDENCIAL,
    value: {
      algo: 'PBKDF2-SHA256',
      iter: PBKDF2_ITERACIONES,
      salt: bytesAHex(salt),
      hash,
      debeCambiar: !!debeCambiar,
      actualizado: ahora()
    }
  });
}

async function leerCredencialAdmin() {
  const c = await dbGet('config', CLAVE_CREDENCIAL);
  return (c && c.value) ? c.value : null;
}

/* Devuelve el estado del panel sin exponer nada:
   { existe, debeCambiar }  */
async function estadoCredencialAdmin() {
  const nueva = await leerCredencialAdmin();
  if (nueva) return { existe: true, debeCambiar: !!nueva.debeCambiar };
  const vieja = await dbGet('config', CLAVE_CREDENCIAL_LEGADO);
  return { existe: !!(vieja && vieja.value), debeCambiar: false };
}

/* Verifica la contraseña primero remotamente en el servidor (Clave Maestra desde cualquier celular)
   y luego con respaldo local si está sin conexión. */
async function verificarPasswordAdmin(pass) {
  // 1. Verificación remota contra el servidor central
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ok) {
        if (data.token) {
          sessionStorage.setItem('baremo_admin_token', data.token);
        }
        try { await guardarCredencialAdmin(pass, !!data.debeCambiar); } catch (e) {}
        return { ok: true, debeCambiar: !!data.debeCambiar, sinCredencial: false, token: data.token, remoto: true };
      }
    } else if (res.status === 401) {
      return { ok: false, debeCambiar: false, sinCredencial: false, remoto: true };
    }
  } catch (err) {
    console.warn('[Admin] Servidor remoto no disponible, usando validación local:', err.message);
  }

  // 2. Fallback de verificación local (modo offline)
  const nueva = await leerCredencialAdmin();
  if (nueva) {
    const hash = await derivarPBKDF2(pass, hexABytes(nueva.salt), nueva.iter || PBKDF2_ITERACIONES);
    return { ok: igualSeguro(hash, nueva.hash), debeCambiar: !!nueva.debeCambiar, sinCredencial: false };
  }

  const vieja = await dbGet('config', CLAVE_CREDENCIAL_LEGADO);
  if (vieja && vieja.value) {
    const hashViejo = await sha256(pass);
    if (!igualSeguro(hashViejo, vieja.value)) {
      return { ok: false, debeCambiar: false, sinCredencial: false };
    }
    const eraDeFabrica = igualSeguro(vieja.value, HASH_DEFECTO_LEGADO);
    await guardarCredencialAdmin(pass, eraDeFabrica);
    try { await dbDelete('config', CLAVE_CREDENCIAL_LEGADO); } catch (e) {}
    return { ok: true, debeCambiar: eraDeFabrica, migrada: true, sinCredencial: false };
  }

  // Si no hay credenciales locales y coincide con claves de fábrica conocidas
  if (pass === 'admin' || pass === 'baremo2026') {
    await guardarCredencialAdmin(pass, true);
    return { ok: true, debeCambiar: true, sinCredencial: false };
  }

  return { ok: false, debeCambiar: false, sinCredencial: true };
}

/* ============================================================
   SISTEMA DE ACTUALIZACIONES
   ============================================================ */
let swRegistration = null;

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register('./service-worker.js');
    
    if (swRegistration.waiting) {
        checkForUpdate(true);
    }

    swRegistration.addEventListener('updatefound', () => {
      const newWorker = swRegistration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          checkForUpdate(true);
        }
      });
    });
  } catch(e) { console.warn('[SW]', e); }
}

function isNewerVersion(remote, local) {
  const rParts = remote.split('.').map(Number);
  const lParts = local.split('.').map(Number);
  for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

function dismissKeyFor(version) {
  return 'baremos_update_dismissed_' + (version || 'x');
}

/* v5.9.41 - "mas tarde" ya no silencia para siempre: el aviso vuelve solo
   pasadas unas horas, asi la version nueva no queda olvidada sin instalar. */
const HORAS_SILENCIO_UPDATE = 8;

function updateDismissed(version) {
  try {
    const v = localStorage.getItem(dismissKeyFor(version));
    if (!v) return false;
    const desde = parseInt(v, 10);
    // Marca vieja ('1') o ilegible: se ignora, asi el aviso vuelve a salir.
    if (!desde || isNaN(desde) || desde < 946684800000) return false;
    return (Date.now() - desde) < HORAS_SILENCIO_UPDATE * 3600 * 1000;
  } catch (e) { return false; }
}

function dismissUpdate(version) {
  try { localStorage.setItem(dismissKeyFor(version), String(Date.now())); } catch (e) {}
}

/* Aviso de actualizacion DISCRETO.
   - Barra chica abajo, no bloquea la pantalla ni tapa el contenido.
   - Se muestra una sola vez por version: si el usuario la cierra, no vuelve.
   - forzado = true cuando el usuario lo pidio desde Ajustes. */
function showUpdateNotification(forzado) {
  if (!State.updateAvailable) return;
  if (document.getElementById('updateNotification')) return;
  const remota = State.remoteVersion || '';
  if (!forzado && updateDismissed(remota)) return;

  // El aviso se muestra DENTRO de la app: si todavia esta el splash, la
  // pantalla no esta liberada o hay que aceptar los terminos, se espera.
  const splashVisible = document.querySelector('.splash:not(.hide)');
  const pantallaBloqueada = document.documentElement.hasAttribute('data-gate');
  const terminosAbiertos = document.querySelector('#modalTerms.show');
  if (splashVisible || pantallaBloqueada || terminosAbiertos) {
    setTimeout(() => showUpdateNotification(forzado), 1500);
    return;
  }

  const bar = document.createElement('div');
  bar.id = 'updateNotification';
  bar.className = 'update-bar';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `
    <span class="ub-dot" aria-hidden="true"></span>
    <span class="ub-txt">Nueva version disponible${remota ? ' v' + remota : ''}</span>
    <button type="button" class="ub-go" id="updateNowBtn">Actualizar</button>
    <button type="button" class="ub-x" id="updateLaterBtn" aria-label="Cerrar aviso">×</button>
  `;
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add('show'));

  const cerrar = () => {
    bar.classList.remove('show');
    setTimeout(() => { if (bar.parentNode) bar.remove(); }, 260);
  };

  document.getElementById('updateLaterBtn').onclick = () => {
    dismissUpdate(remota);
    State.updateAvailable = false;
    cerrar();
  };

  document.getElementById('updateNowBtn').onclick = async () => {
    const go = document.getElementById('updateNowBtn');
    if (go) { go.textContent = 'Actualizando...'; go.disabled = true; }
    try {
      // Queda registrada como version instalada: el usuario la acepto.
      guardarVersionInstalada(remota || APP_VERSION);
      try { localStorage.removeItem(dismissKeyFor(remota)); } catch (e) {}

      // Notificar al Service Worker que tome el control
      if (swRegistration && swRegistration.waiting) {
        swRegistration.waiting.postMessage('APLICAR_ACTUALIZACION');
        swRegistration.waiting.postMessage('SKIP_WAITING');
      } else if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage('APLICAR_ACTUALIZACION');
        navigator.serviceWorker.controller.postMessage('SKIP_WAITING');
      }

      // Vaciar cachés locales de la app
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter(k => /^baremos?[-_]/i.test(k))
            .map(k => caches.delete(k).catch(() => false))
        );
      }

      // Desregistrar service workers para garantizar descarga fresca de la nueva versión
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister().catch(() => false)));
      }
    } catch (e) {
      console.warn('[Actualizar]', e);
    }

    // Breve pausa para asegurar sincronización en almacenamiento
    await new Promise(r => setTimeout(r, 250));

    // Recargar con bypass de caché HTTP
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('nocache', String(Date.now()));
      u.searchParams.set('v', remota || APP_VERSION);
      u.searchParams.set('updated', '1');
      window.location.replace(u.toString());
    } catch (e) {
      window.location.reload();
    }
  };
}

/* La version INSTALADA (la que el usuario acepto) se guarda aparte de la
   version de los archivos. Asi, si los archivos nuevos llegaran al telefono
   sin que el usuario acepte la actualizacion, el splash sigue mostrando la
   version que el usuario tiene y el aviso aparece DENTRO de la app. */
const LS_VERSION_INSTALADA = 'baremo_version_instalada';

function versionInstalada() {
  try { return localStorage.getItem(LS_VERSION_INSTALADA) || null; } catch (e) { return null; }
}

function guardarVersionInstalada(v) {
  try { if (v) localStorage.setItem(LS_VERSION_INSTALADA, String(v)); } catch (e) {}
}

function loadVersion() {
  // Si la página viene de una actualización recién ejecutada (?updated=1 o ?v=...)
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('updated') || (params.has('v') && params.get('v') === APP_VERSION)) {
      guardarVersionInstalada(APP_VERSION);
      State.currentVersion = APP_VERSION;
      State.updateAvailable = false;
      State.remoteVersion = null;
      return;
    }
  } catch (e) {}

  const guardada = versionInstalada();

  // Primera vez: la version de los archivos pasa a ser la instalada.
  if (!guardada) {
    guardarVersionInstalada(APP_VERSION);
    State.currentVersion = APP_VERSION;
    return;
  }

  // Los archivos son mas nuevos que lo que el usuario acepto: NO se muestra
  // la version nueva en el splash, se anuncia adentro de la app.
  if (isNewerVersion(APP_VERSION, guardada)) {
    State.currentVersion = guardada;
    State.updateAvailable = true;
    // v5.9.41 - queda anotada la version nueva que YA esta en el telefono, asi
    // el aviso de abajo puede salir solo aunque no haya conexion.
    State.remoteVersion = APP_VERSION;
    return;
  }

  State.currentVersion = APP_VERSION;
  if (isNewerVersion(guardada, APP_VERSION)) guardarVersionInstalada(APP_VERSION);
}

async function checkForUpdate(silent = false) {
  if (!silent) toast('Buscando actualizaciones...', 'info');
  try {
    if (swRegistration) await swRegistration.update();
    
    const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    const remoteData = await r.json();
    
    // Se compara contra la version INSTALADA, no contra los archivos.
    const local = State.currentVersion || versionInstalada() || APP_VERSION;

    if (isNewerVersion(remoteData.version, local)) {
      State.updateAvailable = true;
      State.remoteVersion = remoteData.version;
      showUpdateNotification(!silent);
    } else {
      State.updateAvailable = false;
      State.remoteVersion = null;
      if (!silent) toast(`Ya tenés la última versión (${local})`, 'success');
    }
  } catch (e) {
    if (!silent) toast('Error al buscar actualizaciones', 'error');
  }
}

/* ============================================================
   VIGILANCIA AUTOMATICA DE ACTUALIZACIONES
   La app se fija sola si hay una version nueva y muestra el aviso
   discreto de abajo. El usuario no tiene que entrar a Ajustes.
   Se revisa: al arrancar, cada 15 minutos, al volver a la app y al
   recuperar la conexion. Siempre en silencio: si no hay novedad no
   se muestra nada.
   ============================================================ */
const VIGILANCIA_INTERVALO_MS = 5 * 60 * 1000;
const VIGILANCIA_MIN_ENTRE_CHEQUEOS_MS = 60 * 1000;
let _ultimoChequeoUpdate = 0;
let _vigilanciaUpdateActiva = false;

async function chequeoAutomaticoDeVersion(motivo) {
  // v5.9.41 - si la version nueva ya se detecto no se vuelve a consultar la
  // red, pero SI se reintenta mostrar la barra: antes quedaba escondida para
  // siempre si no se habia podido dibujar (splash, terminos, pantalla
  // bloqueada) o si el usuario la habia cerrado alguna vez.
  if (State.updateAvailable) {
    showUpdateNotification(false);
    return;
  }
  const ahoraMs = Date.now();
  if (ahoraMs - _ultimoChequeoUpdate < VIGILANCIA_MIN_ENTRE_CHEQUEOS_MS) return;
  _ultimoChequeoUpdate = ahoraMs;
  try { await checkForUpdate(true); } catch (e) {}
}

function iniciarVigilanciaDeActualizaciones() {
  if (_vigilanciaUpdateActiva) return;
  _vigilanciaUpdateActiva = true;

  setInterval(() => chequeoAutomaticoDeVersion('intervalo'), VIGILANCIA_INTERVALO_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') chequeoAutomaticoDeVersion('volvio');
  });
  window.addEventListener('focus', () => chequeoAutomaticoDeVersion('foco'));
  window.addEventListener('online', () => chequeoAutomaticoDeVersion('conexion'));

  // Si el service worker instala una version nueva mientras la app esta
  // abierta, se avisa en el momento.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      chequeoAutomaticoDeVersion('sw');
    });
  }
}

/* ============================================================
   TÉRMINOS Y PRIVACIDAD (CONTROL SEGURO)
   ============================================================ */
function getAcceptedTermsVersion() {
  try {
    return parseInt(localStorage.getItem('baremos_terms_version')) || 0;
  } catch(e) {
    console.warn('No se pudo leer localStorage para términos:', e);
    return 0;
  }
}

function setAcceptedTermsVersion() {
  try {
    localStorage.setItem('baremos_terms_version', CURRENT_TERMS_VERSION.toString());
  } catch(e) {
    console.warn('No se pudo guardar en localStorage:', e);
  }
}

function mostrarPopupTerminos() {
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  
  const modal = $('#modalTerms');
  const content = $('#termsModalContent');
  
  if (!modal) {
    console.error('CRÍTICO: No se encontró el modal de términos en el DOM.');
    continuarInicio();
    return;
  }
  
  if (content && INFO_CONTENT && INFO_CONTENT.terminos) {
    content.innerHTML = INFO_CONTENT.terminos.html;
  }
  
  modal.classList.add('show');
}

/* ============================================================
   INICIALIZACIÓN (FLUJO ESTRICTO Y PROTEGIDO)
   ============================================================ */
async function init() {
  try {
    await openDB();
    await loadTheme();
    await loadBaremo();
    loadVersion();
    const sv = $('#splashVersion');
    if (sv && State.currentVersion) sv.textContent = `v${State.currentVersion}`;
    await loadUser();
  } catch(e) {
    console.error('[Init Error]', e);
    toast('Error al cargar datos iniciales: ' + e.message, 'error');
  }
  
  setTimeout(() => {
    const splash = $('.splash');
    if (splash) splash.classList.add('hide');
    
    const acceptedVersion = getAcceptedTermsVersion();
    if (acceptedVersion < CURRENT_TERMS_VERSION) {
      mostrarPopupTerminos();
    } else {
      continuarInicio();
    }
  }, 2150);
  
  // Se le pide al navegador que NO borre la base por falta de espacio.
  // Es lo unico que protege el historial cargado en el telefono.
  try {
    const p = await pedirAlmacenamientoPersistente();
    if (p.soportado && !p.persistente) {
      console.warn('[Storage] El navegador no concedio almacenamiento persistente');
    }
  } catch (e) {}

  // Recordatorio de backup (no bloquea nada, solo avisa).
  setTimeout(() => { revisarRecordatorioDeBackup(); }, 6000);

  try {
    await registerSW();
    // v5.9.41 - si al leer las versiones ya se vio que los archivos son mas
    // nuevos que la version aceptada, el aviso sale solo, sin esperar la red
    // y sin pasar por Ajustes.
    if (State.updateAvailable) showUpdateNotification(false);
    setTimeout(() => {
      _ultimoChequeoUpdate = Date.now();
      checkForUpdate(true);
    }, 1200);
    iniciarVigilanciaDeActualizaciones();
    iniciarRecordatorioDeCierre();
    iniciarAvisosLocales();
  } catch(e) {
    console.warn('[SW Error]', e);
  }
}

async function continuarInicio() {
  if (State.user) {
    try {
      await loadOrCreateJornada();
    } catch (e) {
      console.error('[Jornada Error]', e);
    }
    showApp();

    // Si se abrió desde la notificación tocando una acción
    try {
      if (window.location.search) {
        const search = window.location.search;
        if (search.includes('ats=1')) {
          history.replaceState({}, '', window.location.pathname);
          setTimeout(() => {
            if (typeof abrirModalATS === 'function') abrirModalATS({ obligatorio: true });
          }, 300);
        } else if (search.includes('avisos=1') || search.includes('vista=AvisosEmpresa')) {
          history.replaceState({}, '', window.location.pathname);
          setTimeout(() => {
            if (typeof abrirModalAvisosEmpresa === 'function') abrirModalAvisosEmpresa();
          }, 300);
        } else if (search.includes('accion=cerrar_jornada')) {
          history.replaceState({}, '', window.location.pathname);
          setTimeout(() => {
            if (typeof atenderJornadaPendientePush === 'function') atenderJornadaPendientePush();
          }, 300);
        }
      }
    } catch (e) {}

    // Recordatorio local de ATS al abrir la aplicación si no se ha completado
    setTimeout(() => {
      try { revisarRecordatorioATSAlAbrir(); } catch (e) {}
    }, 700);

    // Inicializaciones de notificaciones push, verificación de jornadas pendientes y avisos de empresa
    setTimeout(() => {
      try { if (typeof inicializarPushNotifications === 'function') inicializarPushNotifications(); } catch (e) {}
      try { if (typeof verificarJornadasPendientes === 'function') verificarJornadasPendientes(); } catch (e) {}
      try { if (typeof cargarAvisosEmpresa === 'function') cargarAvisosEmpresa(); } catch (e) {}
      try { if (typeof sincronizarJornadasAlServidor === 'function') sincronizarJornadasAlServidor(); } catch (e) {}
      try { if (typeof iniciarLiveAlertsPoller === 'function') iniciarLiveAlertsPoller(); } catch (e) {}
    }, 850);
  } else { 
    showLogin(); 
  }
}

async function loadTheme() {
  const c = await dbGet('config', 'theme');
  State.theme = c?.value || 'light';
  document.documentElement.setAttribute('data-theme', State.theme);
}
/* v5.9.39 - el modo ya no se alterna a ciegas: se elige desde el panel de
   Apariencia, que vive en el mismo boton del encabezado que la piel. */
const MODOS_TEMA = [
  { id: 'light', nombre: 'Claro',  ico: '☀️', desc: 'Fondo blanco, ideal de dia' },
  { id: 'dark',  nombre: 'Oscuro', ico: '🌙', desc: 'Descansa la vista de noche' }
];

function setTheme(modo) {
  State.theme = (modo === 'dark') ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', State.theme);
  dbPut('config', { key: 'theme', value: State.theme });
  pintarApariencia();
  toast(`Modo ${State.theme === 'light' ? 'claro' : 'oscuro'}`, 'success');
}

function toggleTheme() {
  setTheme(State.theme === 'light' ? 'dark' : 'light');
}

/* ============================================================
   NORMALIZACIÓN SEGURA Y CARGA DE BAREMO PRECARGADOS
   ============================================================ */
async function loadBaremo() {
  let d = await dbGetAll('baremo');
  
  const normalizeArray = (arr) => {
    return arr.map(r => ({
      baremo: String(getField(r, 'BAREMO', 'baremo', 'Codigo', 'codigo', 'Código', 'CÓDIGO')).trim(),
      descripcion: String(getField(r, 'DESCRIPCION', 'descripcion', 'Descripción', 'Descripcion', 'DETALLE')).trim(),
      precio: parsePrecio(getField(r, 'PRECIO', 'precio', 'Precio', 'VALOR'))
    })).filter(r => r.baremo !== '' && r.baremo !== 'undefined');
  };

  let precargado = [];
  try {
    const r = await fetch('baremo.json', { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      precargado = normalizeArray(Array.isArray(j) ? j : (j.baremos || j.data || [j]));
    }
  } catch(e) {
    console.warn('Error cargando baremo.json:', e);
  }

  const needsRepair = d.some(b => b.descripcion === undefined || b.precio === undefined);
  const needsSeed = d.length === 0;
  const needsRefresh = precargado.length > d.length;

  if (precargado.length > 0 && (needsSeed || needsRepair || needsRefresh)) {
    for (const o of d) {
      if (o.baremo) await dbDelete('baremo', o.baremo);
    }
    for (const i of precargado) await dbPut('baremo', i);
    d = await dbGetAll('baremo');
  }
  
  State.baremo = normalizeArray(d);
}

async function updateBaremoFromFile(file) {
  const n = file.name.toLowerCase();
  let d = [];
  try {
    if (n.endsWith('.json')) d = JSON.parse(await file.text());
    else if (n.endsWith('.xlsx') || n.endsWith('.xls')) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellText: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      d = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
    } else if (n.endsWith('.csv')) {
      const txt = await file.text();
      const sep = txt.includes(';') ? ';' : ',';
      d = txt.trim().split(/\r?\n/).map(line => line.split(sep)).filter(row => row.length);
      const headers = d.shift().map(h => h.trim());
      d = d.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] || ''])));
    } else { toast('Formato no soportado', 'error'); return; }
    const old = await dbGetAll('baremo');
    for (const o of old) await dbDelete('baremo', o.baremo);
    const norm = d.map(r => ({
      baremo: String(getField(r, 'BAREMO', 'baremo', 'Codigo', 'codigo', 'Código', 'CÓDIGO')).trim(),
      descripcion: String(getField(r, 'DESCRIPCION', 'descripcion', 'Descripción', 'Descripcion', 'DETALLE')).trim(),
      precio: parsePrecio(getField(r, 'PRECIO', 'precio', 'Precio', 'VALOR'))
    })).filter(r => r.baremo);
    if (!norm.length) { toast('Sin datos válidos', 'error'); return; }
    for (const i of norm) await dbPut('baremo', i);
    State.baremo = await dbGetAll('baremo');
    toast(`Baremo: ${norm.length} ítems`, 'success');
  } catch(e) { toast('Error', 'error'); }
}

async function loadUser() {
  const c = await dbGet('config', 'activeUser');
  if (c?.value) State.user = await dbGet('usuarios', c.value);
}

function showLogin() {
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  $('#viewLogin')?.classList.add('active');

  const f = $('#loginForm');
  if (f) {
    f.onsubmit = async e => {
      e.preventDefault();
      const n = $('#loginNombre').value.trim();
      const l = $('#loginLegajo').value.trim();
      const z = $('#loginZona').value;
      if (!n || !l) { toast('Completá todos los campos', 'warn'); return; }
      if (!z) { toast('Seleccioná zona', 'warn'); return; }
      await dbPut('usuarios', { nombre: n, legajo: l, zona: z, creado: ahora() });
      await dbPut('config', { key: 'activeUser', value: l });
      State.user = { nombre: n, legajo: l, zona: z };
      $('#viewLogin').classList.remove('active');
      await loadOrCreateJornada();
      showApp();
      toast(`¡Bienvenido ${n}!`, 'success');
    };
  }
}

async function cerrarSesion() {
  if (!await confirmDialog('¿Cerrar sesión?\n\n⚠️ Deberás ingresar con NOMBRE y LEGAJO.\n\nTus datos se mantendrán.')) return;
  try { await limpiarNotificacionATS(); } catch (e) {}
  await dbPut('config', { key: 'activeUser', value: '' });
  State.user = null; State.jornada = null; State.items = [];
  const h = $('#headerUser');
  if (h) h.textContent = 'Ingresar';
  const hz = $('#headerUserZona');
  if (hz) hz.textContent = '';
  const bz = $('#btnChangeZona');
  if (bz) bz.style.display = 'none';
  
  $('#modalSwitchUser')?.classList.remove('show');
  showLogin();
  toast('Sesión cerrada', 'success');
}

async function eliminarUsuario(leg) {
  const u = await dbGet('usuarios', leg);
  if (!u) return;
  
  if (!await confirmDialog(`🗑️ ¿Eliminar "${u.nombre}"?\n\n⚠️ IRREVERSIBLE. Se borrarán jornadas, combustible, quincenas y perfil.`)) return;
  
  for (const j of await dbGetByIndex('jornadas', 'legajo', leg)) await dbDelete('jornadas', j.id);
  for (const c of await dbGetByIndex('combustible', 'legajo', leg)) await dbDelete('combustible', c.id);
  for (const q of await dbGetByIndex('quincenas', 'legajo', leg)) await dbDelete('quincenas', q.id);
  await dbDelete('usuarios', leg);
  
  if (State.user?.legajo === leg) {
    await dbPut('config', { key: 'activeUser', value: '' });
    State.user = null; State.jornada = null; State.items = [];
    $('#modalSwitchUser')?.classList.remove('show');
    showLogin();
    toast('Usuario eliminado', 'success');
  } else {
    toast(`${u.nombre} eliminado`, 'success');
    switchUser();
  }
}

async function switchUser() {
  const users = await dbGetAll('usuarios');
  const m = $('#modalSwitchUser');
  const lst = $('#userList');
  if (!lst) return;
  lst.innerHTML = '';
  users.forEach(u => {
    const div = document.createElement('div');
    div.className = 'jornada-item';
    const act = State.user?.legajo === u.legajo;
    div.innerHTML = `<div class="ji-left"><div class="fecha">${u.nombre} ${act ? '<span style="font-size:10px;background:var(--success-soft);color:var(--success);padding:2px 6px;border-radius:8px;margin-left:6px">ACTIVO</span>' : ''}</div><div class="meta">Legajo ${u.legajo} · ${u.zona || 'Sin zona'}</div></div><div class="user-actions"><button class="mini-btn logout" data-act="logout">🚪</button><button class="mini-btn del" data-act="del" data-legajo="${u.legajo}">🗑️</button><div style="font-size:20px;cursor:pointer" data-act="switch">➡️</div></div>`;
    div.onclick = async e => {
      const a = e.target.dataset.act || e.target.closest('[data-act]')?.dataset.act;
      const lg = e.target.dataset.legajo || e.target.closest('[data-legajo]')?.dataset.legajo;
      if (a === 'del') { e.stopPropagation(); await eliminarUsuario(lg); }
      else if (a === 'logout') { e.stopPropagation(); await cerrarSesion(); }
      else {
        State.user = u;
        await dbPut('config', { key: 'activeUser', value: u.legajo });
        m.classList.remove('show');
        await loadOrCreateJornada();
        showApp();
        toast(`Sesión: ${u.nombre}`, 'success');
      }
    };
    lst.appendChild(div);
  });
  const ab = document.createElement('button');
  ab.className = 'btn btn-primary';
  ab.style.marginTop = '10px';
  ab.innerHTML = '➕ Nuevo usuario';
  ab.onclick = () => { 
      m.classList.remove('show'); 
      showLogin(); 
  };
  lst.appendChild(ab);
  m.classList.add('show');
}

/* ------------------------------------------------------------
   APERTURA DE JORNADA (v5.9.28)

   ANTES: entrar con el legajo ya creaba una jornada. Con solo abrir la app
   para mirar el historial quedaba una jornada abierta, con hora de inicio
   falsa, contando tiempo que nadie trabajo.

   AHORA: iniciar sesion NO abre jornada. La jornada arranca unicamente
   cuando se toca "Iniciar jornada", asi la hora de inicio es la real.

   Al entrar solo se RECUPERA la jornada que haya quedado abierta (por
   ejemplo si se cerro la app en el medio del dia). Nunca se crea sola.
   ------------------------------------------------------------ */
async function loadOrCreateJornada() {
  // v5.9.28: antes de leer nada, se sanean los totales guardados. Cubre las
  // tres rutas de ingreso (sesion recuperada, usuario nuevo y cambio de
  // usuario) porque todas pasan por aca. Solo reescribe campos calculados.
  try {
    await repararTotalesDeJornadas();
  } catch (e) {
    console.error('[Totales]', e);
  }
  const f = hoy();
  const ex = await dbGetByIndex('jornadas', 'fechaLegajo', [f, State.user.legajo]);
  const ab = ex.filter(j => !j.cerrada);
  State.mensaje200kMostrado = false;
  State.mensaje150kMostrado = false;
  State.mensaje125kMostrado = false;
  State.mensaje100kMostrado = false;

  if (ab.length > 0) {
    // Jornada que ya estaba abierta: se retoma tal cual, sin tocar horaInicio.
    State.jornada = ab[ab.length - 1];
    State.items = State.jornada.items || [];
    State.tareas = State.jornada.tareas || [];
  } else {
    // No hay jornada abierta. Se espera a que la persona la inicie a mano.
    State.jornada = null;
    State.items = [];
    State.tareas = [];
  }
  actualizarBotoneraJornada();
}

/* Apertura manual de la jornada, desde el boton "Iniciar jornada". */
async function iniciarJornada() {
  if (!State.user) { toast('Primero ingresá con tu legajo', 'warn'); return; }

  if (State.jornada && !State.jornada.cerrada) {
    toast('⏱️ La jornada ya está abierta', 'info');
    return;
  }

  // Si ya hubo una jornada cerrada hoy, se avisa antes de abrir otra.
  try {
    const previas = await dbGetByIndex('jornadas', 'fechaLegajo', [hoy(), State.user.legajo]);
    if (previas.some(j => j.cerrada)) {
      if (!await confirmDialog('Hoy ya cerraste una jornada.\n\n¿Iniciar una nueva? Va a quedar registrada por separado.')) return;
    }
  } catch (e) {}

  await crearJornadaNueva();
  actualizarBotoneraJornada();
  renderAll();

  const h = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  toast('▶️ Jornada iniciada a las ' + h, 'success');

  try { iniciarRecordatorioDeCierre(); } catch (e) {}
  try { iniciarAvisosLocales(); } catch (e) {}
  try { pedirPermisoNotificaciones(); } catch (e) {}

  // Notificación y apertura del formulario ATS obligatorio antes de la primera tarea
  setTimeout(() => {
    try { notificarAtsPendienteViaSW({ forzar: true }); } catch (e) {}
    if (typeof abrirModalATS === 'function') abrirModalATS({ obligatorio: true });
  }, 350);

  const inp = $('#baremoInput');
  if (inp) inp.focus();
}

/* ------------------------------------------------------------
   ESTADO DE LA BOTONERA
   Con la jornada cerrada solo se puede iniciar. Con la jornada abierta
   se puede agregar, finalizar tarea y cerrar. Asi el boton que no
   corresponde no queda disponible para tocarlo por error.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   La botonera tiene 3 lugares fijos:
     [ Agregar ] [ Finalizar tarea ] [ Iniciar / Cerrar jornada ]

   El tercer lugar es compartido. Sin jornada abierta muestra
   "Iniciar jornada"; al iniciarla, en ese mismo punto aparece
   "Cerrar jornada". Uno sustituye al otro sin mover nada de lugar.

   Agregar y Finalizar NO se esconden: quedan deshabilitados. Asi la
   botonera siempre se ve igual y no salta el contenido de abajo.
   ------------------------------------------------------------ */
function actualizarBotoneraJornada() {
  const abierta = !!(State.jornada && !State.jornada.cerrada);

  const bIni = $('#btnIniciarJornada');
  const bAgr = $('#btnAgregar');
  const bFin = $('#btnFinalizarTarea');
  const bCer = $('#btnCerrarJornada');
  const fila = $('#btnRowJornada');

  if (fila) fila.classList.toggle('jornada-abierta', abierta);

  // Lugar compartido: se ve uno solo de los dos.
  if (bIni) bIni.style.display = abierta ? 'none' : '';
  if (bCer) bCer.style.display = abierta ? '' : 'none';

  // Visibles siempre, pero sin uso hasta que haya jornada.
  [bAgr, bFin].forEach(b => {
    if (!b) return;
    b.disabled = !abierta;
    b.title = abierta ? '' : 'Primero tocá "Iniciar jornada"';
  });

  const wrap = $('#viewInicio');
  if (wrap) wrap.classList.toggle('sin-jornada', !abierta);

  if (typeof renderATSStatus === 'function') {
    renderATSStatus();
  }
}

async function crearJornadaNueva() {
  State.mensaje200kMostrado = false;
  State.mensaje150kMostrado = false;
  State.mensaje125kMostrado = false;
  State.mensaje100kMostrado = false;
  const j = { fecha: hoy(), horaInicio: ahora(), ultimaMod: ahora(), legajo: State.user.legajo, usuario: State.user.nombre, zona: State.user.zona, items: [], tareas: [], cerrada: false, total: 0 };
  j.id = await dbAdd('jornadas', j);
  State.jornada = j; State.items = []; State.tareas = [];
}

/* ============================================================
   v5.9.28 - TOTALES DE JORNADA A PRUEBA DE FALLAS

   EL BUG QUE HABIA: el total se calculaba con
       fin.reduce((a, i) => a + i.subtotal, 0)
   sin proteger el valor. Si UN solo item tenia subtotal
   undefined/null/texto (baremo sin precio, dato viejo, o item que
   volvio de un backup/importacion), la suma daba NaN. Ese NaN se
   guardaba en la jornada, y el historial lo mostraba con
       fmt(j.total || 0)
   Como NaN es falsy, NaN || 0 === 0  =>  la jornada aparecia en $0
   AUNQUE tuviera tareas finalizadas. De ahi el error reportado.

   Ademas se perdia el total cuando la marca item.tareaId se
   extraviaba (por ejemplo al restaurar un backup viejo): los items
   quedaban sin dueño y ninguno contaba como finalizado.

   Regla de negocio que NO cambia: al Total del dia solo suman los
   baremos de tareas finalizadas.
   ============================================================ */

// Convierte cualquier cosa en un numero usable. Nunca devuelve NaN.
function numero(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// Subtotal confiable de un item. Si viene roto, se reconstruye con
// precio x cantidad en lugar de contaminar la suma con NaN.
function subtotalDeItem(it) {
  if (!it) return 0;
  const s = numero(it.subtotal);
  if (s) return s;
  return numero(it.precio) * (numero(it.cantidad) || 1);
}

function cantidadDeItem(it) {
  const c = numero(it && it.cantidad);
  return c > 0 ? c : 1;
}

/* Determina que items de una jornada corresponden a tareas finalizadas,
   con varios respaldos para no perder plata ya trabajada. */
function itemsFinalizadosDeJornada(j) {
  const items = (j && Array.isArray(j.items)) ? j.items : [];
  const tareas = (j && Array.isArray(j.tareas)) ? j.tareas : [];
  if (!items.length) return [];

  // 1) Camino normal: la marca tareaId que pone crearTareaFinalizada.
  let fin = items.filter(it => !!it.tareaId);
  if (fin.length) return fin;

  if (tareas.length) {
    // 2) Hay tareas cerradas pero los items perdieron la marca:
    //    se reconstruye el vinculo con los itemIds que guarda la tarea.
    const ids = new Set();
    tareas.forEach(t => {
      (Array.isArray(t.itemIds) ? t.itemIds : []).forEach(id => ids.add(String(id)));
    });
    if (ids.size) {
      fin = items.filter(it => ids.has(String(it.id)));
      if (fin.length) return fin;
    }
    // 3) Hay tareas cerradas y no se pudo vincular nada: la jornada se
    //    trabajo, asi que se cuenta completa antes que mostrar $0.
    return items;
  }

  // 4) Jornada cerrada de un formato viejo, sin tareas: todo lo
  //    registrado se considera trabajado.
  if (j && j.cerrada) return items;

  // Jornada abierta sin ninguna tarea finalizada: total 0 es correcto.
  return [];
}

/* Unica fuente de verdad de los totales derivados de una jornada. */
function totalesDeJornada(j) {
  const items = (j && Array.isArray(j.items)) ? j.items : [];
  const fin = itemsFinalizadosDeJornada(j);
  const marcados = new Set(fin.map(it => it && it.id));
  const pend = items.filter(it => !marcados.has(it && it.id));

  let total = fin.reduce((a, it) => a + subtotalDeItem(it), 0);

  // Ultimo respaldo: si los items no dan nada pero las tareas guardan
  // su propio total, se usa ese valor.
  if (!total) {
    const tareas = (j && Array.isArray(j.tareas)) ? j.tareas : [];
    const porTareas = tareas.reduce((a, t) => a + numero(t && t.total), 0);
    if (porTareas) total = porTareas;
  }

  return {
    total,
    cantidadRegistros: fin.length,
    cantidadItems: fin.reduce((a, it) => a + cantidadDeItem(it), 0),
    totalEnCurso: pend.reduce((a, it) => a + subtotalDeItem(it), 0),
    baremosEnCurso: pend.length
  };
}

/* Cantidad de tareas cerradas de una jornada. Las jornadas viejas no
   guardaban tareas: si esta cerrada y tiene baremos, se cuenta como una. */
function tareasCerradasDeJornada(j) {
  const tareas = (j && Array.isArray(j.tareas)) ? j.tareas : [];
  if (tareas.length) return tareas.length;
  const items = (j && Array.isArray(j.items)) ? j.items : [];
  return (j && j.cerrada && items.length) ? 1 : 0;
}

/* Resumen agregado de un conjunto de jornadas.
   TODO sale de totalesDeJornada() / itemsFinalizadosDeJornada(), asi que
   el Dashboard, el Historial y el detalle muestran siempre el mismo
   numero y ningun subtotal roto puede volver a ensuciar la suma. */
function resumenDeJornadas(lista) {
  const jornadas = Array.isArray(lista) ? lista : [];
  const porDia = new Map();
  const cantPorCodigo = new Map();
  const importePorCodigo = new Map();
  let total = 0, tareas = 0, lineas = 0, unidades = 0;

  jornadas.forEach(j => {
    const t = totalesDeJornada(j);
    total += t.total;
    lineas += t.cantidadRegistros;
    unidades += t.cantidadItems;
    tareas += tareasCerradasDeJornada(j);
    const f = j && j.fecha ? j.fecha : '';
    porDia.set(f, (porDia.get(f) || 0) + t.total);
    itemsFinalizadosDeJornada(j).forEach(it => {
      const cod = String((it && it.codigo) || 'S/C');
      cantPorCodigo.set(cod, (cantPorCodigo.get(cod) || 0) + cantidadDeItem(it));
      importePorCodigo.set(cod, (importePorCodigo.get(cod) || 0) + subtotalDeItem(it));
    });
  });

  // Maximo y minimo por DIA calendario: si un dia tiene dos jornadas,
  // se compara la suma del dia, no cada jornada por separado.
  let maxDia = null, minDia = null;
  porDia.forEach((monto, fecha) => {
    if (!maxDia || monto > maxDia.total) maxDia = { fecha, total: monto };
    if (!minDia || monto < minDia.total) minDia = { fecha, total: monto };
  });

  const orden = m => [...m.entries()].sort((a, b) => b[1] - a[1]);
  const topUso = orden(cantPorCodigo)[0] || null;
  const topFact = orden(importePorCodigo)[0] || null;

  return {
    jornadas: jornadas.length,
    dias: porDia.size,
    tareas, lineas, unidades, total,
    promedioDia: porDia.size ? total / porDia.size : 0,
    promedioJornada: jornadas.length ? total / jornadas.length : 0,
    codigos: cantPorCodigo.size,
    porDia, cantPorCodigo, importePorCodigo,
    topUso, topFact, maxDia, minDia
  };
}

/* Revisa TODAS las jornadas guardadas y corrige los totales que
   quedaron en NaN, en 0 o desactualizados.
   No borra ni modifica items, tareas, fechas ni ubicaciones: solo
   reescribe los campos calculados. */
async function repararTotalesDeJornadas(opciones) {
  const verboso = !!(opciones && opciones.verboso);
  const reporte = { revisadas: 0, corregidas: 0, recuperado: 0, detalle: [] };

  let todas = [];
  try {
    todas = await dbGetAll('jornadas');
  } catch (e) {
    if (verboso) toast('No se pudo leer el historial', 'error');
    return reporte;
  }

  for (const j of (todas || [])) {
    if (!j) continue;
    reporte.revisadas++;

    const t = totalesDeJornada(j);
    const antes = numero(j.total);
    const roto = !Number.isFinite(j.total);
    const cambia = roto
      || antes !== t.total
      || numero(j.cantidadRegistros) !== t.cantidadRegistros
      || numero(j.cantidadItems) !== t.cantidadItems;
    if (!cambia) continue;

    j.total = t.total;
    j.cantidadRegistros = t.cantidadRegistros;
    j.cantidadItems = t.cantidadItems;
    j.totalEnCurso = t.totalEnCurso;
    j.baremosEnCurso = t.baremosEnCurso;
    j.totalesReparados = ahora();

    try {
      await dbPut('jornadas', j);
      reporte.corregidas++;
      reporte.recuperado += (t.total - antes);
      reporte.detalle.push({ fecha: j.fecha, antes: roto ? 'NaN' : antes, ahora: t.total });
    } catch (e) { /* si una falla, se sigue con el resto */ }
  }

  if (verboso) {
    if (!reporte.corregidas) {
      toast('✅ Totales verificados: ' + reporte.revisadas + ' jornada(s), todo correcto', 'success');
    } else {
      toast('🔧 ' + reporte.corregidas + ' jornada(s) corregida(s) · ' + fmt(reporte.recuperado) + ' recuperado', 'success');
    }
  }
  return reporte;
}

async function saveJornada() {
  if (!State.jornada) return;
  State.jornada.items = State.items;
  State.jornada.tareas = Array.isArray(State.tareas) ? State.tareas : (State.jornada.tareas || []);
  State.jornada.ultimaMod = ahora();
  // El total de la jornada cuenta unicamente los baremos de tareas
  // finalizadas, ahora con sumas protegidas contra NaN.
  const t = totalesDeJornada(State.jornada);
  State.jornada.total = t.total;
  State.jornada.cantidadRegistros = t.cantidadRegistros;
  State.jornada.cantidadItems = t.cantidadItems;
  State.jornada.totalEnCurso = t.totalEnCurso;
  State.jornada.baremosEnCurso = t.baremosEnCurso;
  await dbPut('jornadas', State.jornada);
}

async function cerrarJornada() {
  if (!State.jornada) { toast('No hay jornada', 'warn'); return; }
  // Si quedan baremos sin finalizar, se avisa: no forman parte del total
  const sinFinalizar = (State.items || []).filter(i => !i.tareaId);
  if (sinFinalizar.length) {
    const okPend = await confirmDialog('Hay ' + sinFinalizar.length + ' baremo(s) en una tarea sin finalizar '
      + '(' + fmt(sinFinalizar.reduce((a, i) => a + subtotalDeItem(i), 0)) + '). '
      + 'Si cerrás la jornada NO se suman al total. ¿Cerrar igual?');
    if (!okPend) return;
  }
  if (!await confirmDialog('¿Cerrar jornada? No podrá editarse.')) return;

  // v5.9.41 - el boton acusa el cierre con una animacion leve (se comprime,
  // el candado traba y el borde pasa a verde) y recien despues sale el cartel.
  const btnCierre = $('#btnCerrarJornada');
  if (btnCierre) {
    btnCierre.disabled = true;
    btnCierre.classList.add('bcj-cerrando');
  }

  State.jornada.cerrada = true;
  State.jornada.horaCierre = ahora();
  await saveJornada();
  limpiarRecordatorioDeCierre();
  limpiarAvisoDeJornada();
  try { await limpiarNotificacionATS(); } catch (e) {}

  // se deja ver la animacion del boton antes de redibujar la botonera
  await esperar(560);
  mostrarCierreDeJornadaOk();

  State.jornada = null; State.items = []; State.tareas = [];
  // v5.9.28: ya NO se abre otra jornada automaticamente. Si hay que seguir
  // trabajando, se toca "Iniciar jornada" y la hora de inicio queda real.
  actualizarBotoneraJornada();
  renderAll();

  // Sincronización remota al servidor central para que el supervisor pueda descargar reportes
  try {
    if (typeof sincronizarJornadasAlServidor === 'function') {
      sincronizarJornadasAlServidor();
    }
  } catch (e) {}
}

/* ============================================================
   SETUP REGISTRO (CON NORMALIZACIÓN DE BÚSQUEDA)
   ============================================================ */
function setupRegistro() {
  const input = $('#baremoInput');
  const lst = $('#searchList');
  const qtyInput = $('#qtyInput');
  if (!input || !lst || !qtyInput) return;
  let baremoSeleccionado = null;
  let ultimoTexto = '';
  
  function dest(t, q) {
    if (!q) return t;
    return String(t).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
  }
  
  function render(m) {
    if (!m.length) {
      lst.innerHTML = '<div class="sr-empty">❌ No encontrado</div>';
      lst.classList.add('show');
      return;
    }
    lst.innerHTML = m.slice(0, 10).map(b => `<div class="sr-item" data-code="${b.baremo}"><div class="sr-item-top"><span class="sr-code">${dest(String(b.baremo || ''), input.value)}</span><span class="sr-price">${fmt(b.precio)}</span></div><div class="sr-desc">${dest(String(b.descripcion || ''), input.value)}</div></div>`).join('');
    lst.querySelectorAll('.sr-item').forEach(el => {
      el.onclick = () => {
        const codigo = el.dataset.code;
        const encontrado = State.baremo.find(b => String(b.baremo) === codigo);
        if (encontrado) {
          baremoSeleccionado = encontrado;
          input.value = encontrado.baremo;
          ultimoTexto = encontrado.baremo;
          lst.classList.remove('show');
          qtyInput.focus();
          qtyInput.select();
          toast(`${encontrado.baremo} · ${fmt(encontrado.precio)}`, 'success');
        }
      };
    });
    lst.classList.add('show');
  }
  
  input.addEventListener('input', () => {
    const v = input.value.trim();
    if (v !== ultimoTexto) baremoSeleccionado = null;
    if (!v) { lst.classList.remove('show'); return; }
    
    const up = v.toUpperCase();
    const m = State.baremo.filter(b => {
        const cod = String(b.baremo || '').toUpperCase();
        const desc = String(b.descripcion || '').toUpperCase();
        return cod.includes(up) || desc.includes(up);
    }).sort((a, b) => {
        const codA = String(a.baremo || '').toUpperCase();
        const codB = String(b.baremo || '').toUpperCase();
        return (codA.startsWith(up) ? 0 : 1) - (codB.startsWith(up) ? 0 : 1);
    });
    
    const ex = State.baremo.find(b => String(b.baremo || '').toUpperCase() === up);
    if (ex) baremoSeleccionado = ex;
    render(m);
  });
  
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) lst.classList.remove('show');
  });
  
  function agregar() {
    if (!baremoSeleccionado) {
      const v = input.value.trim().toUpperCase();
      baremoSeleccionado = State.baremo.find(b => String(b.baremo || '').toUpperCase() === v);
    }
    if (!baremoSeleccionado) { toast('Seleccioná un baremo válido de la lista', 'warn'); input.focus(); return; }
    if (!State.jornada || State.jornada.cerrada) {
      toast('▶️ Primero tocá "Iniciar jornada"', 'warn');
      return;
    }

    // Validación de ATS antes de iniciar la primera tarea del día
    const cantTareasFinalizadas = (State.jornada.tareas || []).length;
    if (cantTareasFinalizadas === 0 && (!State.jornada.ats || !State.jornada.ats.completado)) {
      toast('⚠️ Debés completar el ATS antes de iniciar la primera tarea de la jornada', 'warn');
      if (typeof abrirModalATS === 'function') abrirModalATS({ obligatorio: true });
      return;
    }

    const c = Math.max(1, parseInt(qtyInput.value) || 1);
    const newItem = {
      id: Date.now() + Math.random(),
      codigo: baremoSeleccionado.baremo,
      descripcion: baremoSeleccionado.descripcion,
      precio: baremoSeleccionado.precio,
      cantidad: c,
      subtotal: baremoSeleccionado.precio * c
    };
    State.items.push(newItem);
    marcarBaremoPendiente();
    pedirPermisoNotificaciones();
    saveJornada();
    renderItems();
    renderTotales();
    input.value = '';
    qtyInput.value = 1;
    lst.classList.remove('show');
    baremoSeleccionado = null;
    ultimoTexto = '';
    input.focus();
    toast(`Agregado x${c}`, 'success');
  }
  
  $('#btnAgregar').onclick = agregar;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (!baremoSeleccionado) {
        const f = lst.querySelector('.sr-item');
        if (f) { f.click(); return; }
      }
      agregar();
    }
  });
  qtyInput.addEventListener('keydown', e => { if (e.key === 'Enter') agregar(); });
}

function renderItems() {
  const tb = $('#itemsBody');
  if (!tb) return;
  // Solo los baremos de la tarea en curso (los ya finalizados se muestran en TAREAS DEL DÍA)
  const pendientes = typeof itemsPendientes === 'function' ? itemsPendientes() : State.items;
  if (!pendientes.length) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-soft)">Sin registros</td></tr>';
    return;
  }
  tb.innerHTML = pendientes.map((it, i) => `<tr class="adding"><td class="hide-mob">${i + 1}</td><td><strong>${it.codigo}</strong></td><td class="td-desc" style="font-size:11px" title="${it.descripcion}">${it.descripcion}</td><td class="hide-mob">${fmt(it.precio)}</td><td><input type="number" min="1" class="qty-input" value="${it.cantidad}" data-id="${it.id}"></td><td><strong>${fmt(it.subtotal)}</strong></td><td><button class="del-btn" data-id="${it.id}">🗑️</button></td></tr>`).join('');
  tb.querySelectorAll('.qty-input').forEach(inp => {
    inp.onchange = async e => {
      const it = State.items.find(i => i.id === parseFloat(e.target.dataset.id));
      if (!it) return;
      it.cantidad = parseInt(e.target.value) || 1;
      it.subtotal = it.precio * it.cantidad;
      await saveJornada();
      renderTotales();
      e.target.closest('tr').children[5].innerHTML = `<strong>${fmt(it.subtotal)}</strong>`;
    };
  });
  tb.querySelectorAll('.del-btn').forEach(btn => {
    btn.onclick = async e => {
      const id = parseFloat(e.target.dataset.id);
      const ok = await confirmDialog('¿Eliminar?');
      if (!ok) return;
      State.items = State.items.filter(i => i.id !== id);
      await saveJornada();
      renderItems();
      renderTotales();
      toast('Eliminado', 'success');
    };
  });
}

/* El Total del día refleja SOLO las tareas finalizadas.
   Los baremos que se van agregando quedan en "tarea en curso" y se suman
   recién cuando se presiona FINALIZAR TAREA. */
function renderTotales() {
  const fin = typeof itemsFinalizados === 'function'
    ? itemsFinalizados()
    : (State.items || []).filter(i => i.tareaId);
  const pend = typeof itemsPendientes === 'function'
    ? itemsPendientes()
    : (State.items || []).filter(i => !i.tareaId);

  const r = fin.length;
  const it = fin.reduce((a, i) => a + cantidadDeItem(i), 0);
  const t = fin.reduce((a, i) => a + subtotalDeItem(i), 0);
  renderEnCurso(pend);
  const tr = $('#totalRegs');
  if (tr) tr.textContent = fmtNum(r);
  const ti = $('#totalItems');
  if (ti) ti.textContent = fmtNum(it);
  const tg = $('#totalGeneral');
  if (tg) tg.textContent = fmt(t);
  const tgb = $('#totalGeneralBig');
  if (tgb) tgb.textContent = fmt(t);
  
  const tgc = $('#totalGeneralCard');
  if (tgc) {
    tgc.className = 'total-general';
    const cfg = getConfigDia(t);
    tgc.classList.add(cfg.cls);
    
    if (t > 200000) {
      tgc.classList.add('imparables');
      if (!State.mensaje200kMostrado) mostrarMensaje200k();
    } else if (t >= 150000) {
      tgc.classList.add('imparables');
      if (!State.mensaje150kMostrado) mostrarMensaje150k();
    } else if (t >= 125000) {
      if (!State.mensaje125kMostrado) mostrarMensaje125k();
    } else if (t >= 100000) {
      if (!State.mensaje100kMostrado) mostrarMensaje100k();
    } else if (t >= 50000) {
      // Entre 50.000 y 100.000: aliento para no aflojar (una vez por jornada)
      avisarBajoRendimiento(t);
    }
  }
}

/* Aviso de la tarea en curso: deja claro que esos baremos todavía no suman */
function renderEnCurso(pend) {
  const card = $('#totalGeneralCard');
  if (!card || !card.parentNode) return;
  let box = document.getElementById('totalEnCurso');
  if (!box) {
    box = document.createElement('div');
    box.id = 'totalEnCurso';
    box.className = 'total-en-curso';
    card.parentNode.insertBefore(box, card.nextSibling);
  }
  const lista = pend || [];
  if (!lista.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  const sub = lista.reduce((a, i) => a + (i.subtotal || 0), 0);
  const cant = lista.reduce((a, i) => a + (i.cantidad || 0), 0);

  // Singular / plural de verdad, en vez de "baremo(s)" y "item(s)".
  const txtBaremos = lista.length === 1 ? '1 baremo' : lista.length + ' baremos';
  const txtItems   = cant === 1 ? '1 ítem' : cant + ' ítems';

  box.style.display = 'grid';

  // El reloj de arena es un elemento propio (no un emoji) para poder animarlo:
  // la arena cae y el reloj gira cuando se vacia. Ver .tec-reloj en styles.css
  box.innerHTML =
      '<span class="tec-lbl">'
    +   '<span class="tec-reloj" aria-hidden="true"><span class="tec-reloj-arena"></span></span>'
    +   '<span class="tec-lbl-txt">Tarea en curso</span>'
    + '</span>'
    + '<span class="tec-meta">' + txtBaremos + ' · ' + txtItems + '</span>'
    + '<span class="tec-val">' + fmt(sub) + '</span>'
    + '<span class="tec-nota">Este importe se suma al Total del día cuando finalices la tarea.</span>';
}

function showView(n) {
  if (!n) return;
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view${n}`)?.classList.add('active');
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === n));
  if (n === 'Dashboard') renderDashboard();
  if (n === 'Historial') renderHistorial();
  if (n === 'Combustible') renderCombustible();
  if (n === 'Quincenas') renderQuincenas();
  if (n === 'Ajustes') renderAjustes();
  if (n === 'Admin') renderAdmin();
  if (n === 'Inicio') {
    renderFraseMotivacional();
    try { if (typeof actualizarIndicadorAvisos === 'function') actualizarIndicadorAvisos(); } catch (e) {}
  } else {
    try { if (typeof detenerTimerCarruselAvisos === 'function') detenerTimerCarruselAvisos(); } catch (e) {}
  }
}

function renderMiniCalendar() {
  const mc = $('#miniCalendar');
  if (!mc) return;
  const n = new Date();
  const dows = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
  const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  mc.innerHTML =
    `<span class="mc-dow">${dows[n.getDay()]}</span>` +
    `<span class="mc-day">${n.getDate()}</span>` +
    `<span class="mc-month">${meses[n.getMonth()]}</span>`;

  let largo = '';
  try {
    largo = n.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    largo = largo.charAt(0).toUpperCase() + largo.slice(1);
  } catch (e) { largo = `${n.getDate()}/${n.getMonth() + 1}/${n.getFullYear()}`; }

  mc.setAttribute('title', largo);
  mc.setAttribute('aria-label', 'Hoy es ' + largo);
  mc.onclick = () => { try { toast(largo, 'info'); } catch (e) {} };
}

function showApp() {
  if (!State.user) return;
  const h = $('#headerUser');
  const hz = $('#headerUserZona');
  const bz = $('#btnChangeZona');
  
  if (h) {
    h.textContent = `${State.user.nombre} · ${State.user.legajo}`;
  }
  if (hz && bz) {
    if (State.user.zona) {
      hz.textContent = State.user.zona;
      bz.style.display = 'inline-flex';
    } else {
      bz.style.display = 'none';
    }
  }
  
  renderMiniCalendar();
  renderAll();
  showView('Inicio');
}

function renderAll() {
  renderItems();
  renderTotales();
  if (typeof renderTareas === 'function') renderTareas();
  if (typeof actualizarBotoneraJornada === 'function') actualizarBotoneraJornada();
}

/* ============================================================
   HISTORIAL: ORDEN Y ZONAS DE LA JORNADA
   ============================================================ */

/* Marca temporal de la jornada, para desempatar cuando hay varias el mismo dia
   (al cerrar una jornada se crea otra, asi que es habitual). */
function tsJornada(j) {
  const t = j.horaInicio || j.horaCierre || j.ultimaMod;
  const ms = t ? Date.parse(t) : NaN;
  return isNaN(ms) ? 0 : ms;
}

/* Orden del historial: la jornada mas reciente siempre primero.
   Ordenar solo por fecha dejaba las jornadas del mismo dia empatadas y, al ser
   sort estable, quedaban en el orden de insercion de IndexedDB (la mas vieja
   arriba). Ahora se desempata por hora de inicio y, si tambien empata, por id. */
function compararJornadasDesc(a, b) {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
  const ta = tsJornada(a), tb = tsJornada(b);
  if (ta !== tb) return tb - ta;
  return (b.id || 0) - (a.id || 0);
}

/* Zonas de una jornada: SOLO las zonas donde realmente se cerraron tareas.
   La zona del login no se usa a proposito. Mientras la jornada no tenga ningun
   cierre no hay zona que informar, asi que no se muestra nada. Cada tarea
   guarda la zona en la que se cerro, de modo que si el usuario cambio de zona
   durante el dia aparecen todas, en orden de aparicion y sin repetir. */
function zonasDeJornada(j) {
  const zonas = [];
  (j.tareas || []).forEach(t => {
    const v = String(t && t.zona != null ? t.zona : '').trim();
    if (v && zonas.indexOf(v) === -1) zonas.push(v);
  });
  return zonas;
}

function textoZonasJornada(j) {
  const zonas = zonasDeJornada(j);
  if (!zonas.length) return '';
  return '\ud83d\udccdJornada con cierres en: ' + zonas.map(escapeHtml).join(', ');
}

/* Texto plano de una jornada para el buscador del historial.
   El campo #histSearch existia desde antes pero renderHistorial() nunca
   leia su valor: escribir no filtraba nada. Ahora si. */
function textoBusquedaJornada(j) {
  const items = Array.isArray(j.items) ? j.items : [];
  return [
    j.fecha || '',
    fechaCorta(j.fecha || ''),
    j.usuario || '',
    j.legajo || '',
    j.zona || '',
    textoZonasJornada(j) || '',
    items.map(it => `${(it && it.codigo) || ''} ${(it && it.descripcion) || ''}`).join(' ')
  ].join(' ').toLowerCase();
}

/* ============================================================
   HISTORIAL (rediseño v5.9.29)

   Misma logica de siempre: mismos filtros, misma seleccion multiple,
   mismos exports y los totales SIEMPRE recalculados con
   totalesDeJornada(). Lo que cambia es la presentacion:
     - barra de balance del periodo filtrado (lo que antes habia que
       sumar a mano jornada por jornada);
     - buscador que ahora si filtra;
     - cada jornada pasa a ser una tarjeta con franja de color segun
       el rango del dia, igual que el resto de la app.
   ============================================================ */
let _nubeJornadasMap = new Map();

async function renderHistorial() {
  const all = await dbGetAll('jornadas');
  const cuadrillaFilter = $('#histCuadrillaFilter')?.value || 'mi_usuario';
  
  let dataset = [];
  if (cuadrillaFilter === 'todas_nube') {
    const mapaUnificado = new Map();
    all.forEach(j => {
      const key = String(j.id || `${j.legajo}_${j.fecha}_${j.horaInicio}`);
      mapaUnificado.set(key, j);
      _nubeJornadasMap.set(key, j);
    });

    try {
      const res = await fetchAdminAPI('/api/admin/reportes/datos?tipo=todos');
      if (res.ok) {
        const json = await res.json();
        if (json && json.ok && Array.isArray(json.datos)) {
          json.datos.forEach(j => {
            const key = String(j.remoteId || j.syncId || j.localId || j.id || `${j.legajo}_${j.fecha}_${j.horaInicio}`);
            mapaUnificado.set(key, j);
            _nubeJornadasMap.set(key, j);
          });
        }
      }
    } catch (e) {}
    dataset = Array.from(mapaUnificado.values());
  } else {
    dataset = all.filter(j => String(j.legajo) === String(State.user.legajo));
  }

  let f = dataset;
  if (State.histFilter === 'hoy') f = f.filter(j => j.fecha === hoy());
  else if (State.histFilter === 'mes') f = f.filter(j => j.fecha.startsWith(mesActual()));
  else if (State.histFilter === 'mesAnterior') f = f.filter(j => j.fecha.startsWith(mesAnterior()));

  const inp = $('#histSearch');
  const q = inp ? inp.value.trim().toLowerCase() : '';
  if (q) {
    const terminos = q.split(/\s+/).filter(Boolean);
    f = f.filter(j => {
      const txt = (textoBusquedaJornada(j) + ' ' + (j.nombreUsuario || '') + ' ' + (j.legajo || '')).toLowerCase();
      return terminos.every(t => txt.includes(t));
    });
  }

  f.sort(compararJornadasDesc);

  // v5.9.36 - franja del mes (solo con los filtros de mes).
  renderPanelMes(f);

  const lst = $('#historialList');
  const ab = $('#histActionsBar');
  if (!lst) return;

  if (ab) {
    if (State.histSelected.size > 0) {
      ab.classList.add('show');
      const cnt = $('#habCount');
      if (cnt) cnt.textContent = `${State.histSelected.size} seleccionada(s)`;
    } else {
      ab.classList.remove('show');
    }
  }

  // v5.9.31 - el Historial no repite informacion: los ingresos del dia ya se
  // ven en Registro y las metricas del mes en Dashboard. Aca solo la lista.

  if (!f.length) {
    lst.innerHTML = q
      ? `<div class="empty"><div class="ico">🔍</div><p>Sin resultados para “${q}”</p></div>`
      : '<div class="empty"><div class="ico">📭</div><p>Sin jornadas registradas</p></div>';
    return;
  }

  lst.innerHTML = f.map(j => {
    const is = State.histSelected.has(j.id);
    const zonasHtml = textoZonasJornada(j);
    // Se recalcula al vuelo: si el valor guardado quedo en NaN o en 0,
    // el historial igual muestra el importe real de las tareas cerradas.
    const tj = totalesDeJornada(j);
    const cfg = getConfigDia(tj.total);
    const tareas = tareasCerradasDeJornada(j);
    const esOtroUsuario = j.legajo && String(j.legajo) !== String(State.user.legajo);
    const jId = j.id || `${j.legajo}_${j.fecha}_${j.horaInicio}`;

    return `<div class="jornada-card ${is ? 'selected' : ''} ${j.cerrada ? '' : 'is-abierta'}" data-id="${jId}">
      <span class="jc-franja" style="background:${cfg.hex}"></span>
      <div class="jc-body">
        <div class="jc-top">
          <div class="jc-fecha">${fechaCorta(j.fecha)}</div>
          <div class="jc-total">${fmt(tj.total)}</div>
        </div>
        ${esOtroUsuario || cuadrillaFilter === 'todas_nube' ? `
          <div style="font-size:11px;color:var(--text);margin-top:2px;font-weight:600;">
            👤 ${escapeHTML(j.nombreUsuario || j.usuario || ('Legajo ' + j.legajo))}
            <span style="font-weight:normal;color:var(--text-soft);font-size:10px;">· Leg. ${escapeHTML(j.legajo)} · Zona ${escapeHTML(j.zona || '-')}</span>
          </div>
        ` : ''}
        ${zonasHtml ? `<div class="jc-zonas">${zonasHtml}</div>` : ''}
        <div class="jc-chips">
          <span class="jc-chip">${fmtNum(tareas)} tarea(s)</span>
          <span class="jc-chip">${fmtNum(tj.cantidadRegistros)} baremos</span>
          <span class="jc-chip">${fmtNum(tj.cantidadItems)} u.</span>
        </div>
        <div class="jc-foot">
          <span class="jc-estado ${j.cerrada ? 'cerrada' : 'abierta'}">${j.cerrada ? 'CERRADA' : 'ABIERTA'}</span>
          <span class="jc-rango">${cfg.nombre}</span>
          <div class="ji-actions">
            <div class="check-box ${is ? 'checked' : ''}" data-act="select" data-id="${jId}"></div>
            <button class="mini-btn view" data-act="view" data-id="${jId}" title="Ver detalle">👁️</button>
            ${j.ats ? `<button class="mini-btn ats" data-act="ats-pdf" data-id="${jId}" title="Exportar formulario ATS en PDF">🛡️</button>` : ''}
            ${j.cerrada ? `<button class="mini-btn export" data-act="export" data-id="${jId}" title="Generar PDF">📄</button>` : ''}
            ${j.cerrada ? `<button class="mini-btn wa" data-act="wa" data-id="${jId}" title="Generar PDF y enviar por WhatsApp">${iconoWhatsApp()}</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  lst.querySelectorAll('[data-act="select"]').forEach(el => {
    el.onclick = e => {
      e.stopPropagation();
      const rawId = el.dataset.id;
      const id = isNaN(Number(rawId)) ? rawId : Number(rawId);
      if (State.histSelected.has(id)) State.histSelected.delete(id);
      else State.histSelected.add(id);
      renderHistorial();
    };
  });
  lst.querySelectorAll('[data-act="view"]').forEach(el => {
    el.onclick = e => {
      e.stopPropagation();
      const rawId = el.dataset.id;
      const id = isNaN(Number(rawId)) ? rawId : Number(rawId);
      openJornada(id);
    };
  });
  lst.querySelectorAll('[data-act="ats-pdf"]').forEach(el => {
    el.onclick = async e => {
      e.stopPropagation();
      const rawId = el.dataset.id;
      const id = isNaN(Number(rawId)) ? rawId : Number(rawId);
      let jor = await dbGet('jornadas', id);
      if (!jor && _nubeJornadasMap.has(String(id))) jor = _nubeJornadasMap.get(String(id));
      if (jor && jor.ats) {
        await exportarAtsPDF(jor.ats);
      } else {
        toast('Esta jornada no cuenta con formulario ATS registrado', 'info');
      }
    };
  });
  lst.querySelectorAll('[data-act="export"]').forEach(el => {
    el.onclick = async e => {
      e.stopPropagation();
      const rawId = el.dataset.id;
      const id = isNaN(Number(rawId)) ? rawId : Number(rawId);
      await exportarJornadaPDF(id);
    };
  });
  // v5.9.31 - mismo PDF, pero se abre la mensajeria para enviarlo.
  lst.querySelectorAll('[data-act="wa"]').forEach(el => {
    el.onclick = async e => {
      e.stopPropagation();
      el.disabled = true;
      try {
        const rawId = el.dataset.id;
        const id = isNaN(Number(rawId)) ? rawId : Number(rawId);
        await exportarJornadaPDF(id, true);
      }
      finally { el.disabled = false; }
    };
  });
  lst.querySelectorAll('.jornada-card').forEach(el => {
    el.onclick = () => openJornada(parseInt(el.dataset.id));
  });
}
/* ============================================================
   v5.9.36 - EL MES COMPLETO, EN UN CLIC

   Los dos botones sueltos y el desplegable se fueron: quedaban
   cruzados arriba de la lista y ensuciaban el Historial. Ahora,
   cuando el filtro es "Este mes" o "Mes anterior", aparece una sola
   franja al tono del resto de las tarjetas con el mes, sus jornadas
   y su total, y dos acciones a la derecha: marcar el mes entero de
   un clic y bajar el reporte mensual completo en un unico PDF.
   Con los filtros Hoy y Todas la franja no existe: el Historial
   queda exactamente como estaba.
   ============================================================ */
function mesDelFiltro() {
  if (State.histFilter === 'mes') return mesActual();
  if (State.histFilter === 'mesAnterior') return mesAnterior();
  return null;
}

function renderPanelMes(lista) {
  const cont = $('#histMesPanel');
  if (!cont) return;
  const mes = mesDelFiltro();
  const cerradas = (lista || []).filter(j => j && j.cerrada);
  if (!mes || !cerradas.length) {
    cont.classList.remove('show');
    cont.innerHTML = '';
    return;
  }
  const ids = cerradas.map(j => j.id);
  const total = cerradas.reduce((a, j) => a + totalesDeJornada(j).total, 0);
  const todas = ids.every(id => State.histSelected.has(id));
  cont.classList.add('show');
  cont.innerHTML = `<div class="hmp-info">
      <span class="hmp-mes">${nombreMes(mes)}</span>
      <span class="hmp-meta">${fmtNum(cerradas.length)} jornada(s) cerrada(s) · ${fmt(total)}</span>
    </div>
    <div class="hmp-acciones">
      <button type="button" class="hmp-btn${todas ? ' activo' : ''}" id="hmpSel">${todas ? 'Quitar selección' : 'Seleccionar mes'}</button>
      <button type="button" class="hmp-btn primary" id="hmpPdf">Reporte del mes</button>
    </div>`;
  const bs = $('#hmpSel');
  if (bs) bs.onclick = () => alternarSeleccionMes(ids);
  const bp = $('#hmpPdf');
  if (bp) bp.onclick = async () => {
    bp.disabled = true;
    try { await exportarReporteMensual(mes); }
    finally { bp.disabled = false; }
  };
}

/* Un clic marca el mes entero; otro clic lo desmarca. */
function alternarSeleccionMes(ids) {
  if (!ids || !ids.length) return;
  const todas = ids.every(id => State.histSelected.has(id));
  if (todas) ids.forEach(id => State.histSelected.delete(id));
  else ids.forEach(id => State.histSelected.add(id));
  renderHistorial();
}

/* Todas las jornadas cerradas del mes, en un unico PDF. */
async function exportarReporteMensual(mes) {
  try {
    const todas = await dbGetAll('jornadas');
    const j = todas
      .filter(x => x && x.legajo === State.user.legajo && x.cerrada && (x.fecha || '').startsWith(mes))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (!j.length) { toast('Sin jornadas cerradas en ' + nombreMes(mes), 'warn'); return; }
    toast('Armando el reporte de ' + nombreMes(mes) + '…', 'info');
    await exportarMultiplesPDF(j.map(x => x.id), nombreMes(mes).replace(' ', '_'));
  } catch (e) { toast('No se pudo armar el reporte', 'error'); }
}

function setHistFilter(f) {
  State.histFilter = f;
  State.histSelected.clear();
  $$('.hist-filtro-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
  renderHistorial();
}
async function openJornada(id) {
  let j = await dbGet('jornadas', id);
  if (!j && typeof id === 'string' && !isNaN(Number(id))) {
    j = await dbGet('jornadas', Number(id));
  }
  if (!j && _nubeJornadasMap && _nubeJornadasMap.has(String(id))) {
    j = _nubeJornadasMap.get(String(id));
  }
  if (!j) return;
  const tj = totalesDeJornada(j);
  $('#mjFecha').textContent = fechaLegible(j.fecha);
  $('#mjTotal').textContent = fmt(tj.total);
  $('#mjMeta').textContent = `${tj.cantidadRegistros} reg · ${tj.cantidadItems} ítems · ${j.cerrada ? 'CERRADA' : 'ABIERTA'}`;
  const mjZ = $('#mjZonas');
  if (mjZ) {
    const zh = textoZonasJornada(j);
    mjZ.innerHTML = zh ? '<b>' + zh + '</b>' : '';
  }
  // Vista previa agrupada: cada TAREA con su ubicación y SUS baremos debajo
  renderDetalleJornadaPorTarea(j);
  $('#modalJornada').classList.add('show');
}

/* Agrupa la jornada por tarea: encabezado de la tarea (hora, tipo, zona,
   dirección, mapa) y a continuación SOLO los baremos de esa tarea.
   Reemplaza la tabla plana + el bloque separado de ubicaciones. */
function renderDetalleJornadaPorTarea(j) {
  const modal = document.querySelector('#modalJornada .modal');
  if (!modal) return;

  // La tabla plana y el bloque suelto de ubicaciones ya no se usan
  const tabla = modal.querySelector('.table-wrap');
  if (tabla) tabla.style.display = 'none';
  const viejo = document.getElementById('mjUbicaciones');
  if (viejo) viejo.remove();

  let box = document.getElementById('mjTareas');
  if (!box) {
    box = document.createElement('div');
    box.id = 'mjTareas';
    box.className = 'mj-tareas';
    if (tabla) modal.insertBefore(box, tabla);
    else modal.appendChild(box);
  }

  const items = j.items || [];
  const tareas = (Array.isArray(j.tareas) ? j.tareas : []).slice().sort((a, b) =>
    String(a.correlativo || '').localeCompare(String(b.correlativo || '')));

  const filas = its => its.length
    ? '<table class="mj-tabla"><thead><tr><th>#</th><th>Cód</th><th>Descripción</th>'
      + '<th class="num">Precio</th><th class="num">Cant</th><th class="num">Subtotal</th></tr></thead><tbody>'
      + its.map((it, i) => '<tr><td>' + (i + 1) + '</td><td><strong>' + escapeHtml(it.codigo) + '</strong></td>'
        + '<td class="td-desc" title="' + escapeHtml(it.descripcion) + '">' + escapeHtml(it.descripcion) + '</td>'
        + '<td class="num">' + fmt(it.precio) + '</td><td class="num">' + it.cantidad + '</td>'
        + '<td class="num"><strong>' + fmt(it.subtotal) + '</strong></td></tr>').join('')
      + '</tbody></table>'
    : '<div class="mj-sin">Sin baremos asociados</div>';

  let html = '';

  tareas.forEach(t => {
    const its = items.filter(it => it.tareaId === t.id);
    const tipo = t.tipoUbicacion === 'gps' ? 'gps' : (t.tipoUbicacion === 'manual' ? 'manual' : 'ninguna');
    const etiqueta = tipo === 'gps' ? 'GPS' : (tipo === 'manual' ? 'MANUAL' : 'SIN UBICACIÓN');
    const url = typeof urlMapaTarea === 'function' ? urlMapaTarea(t) : null;
    const cant = its.reduce((a, i) => a + (i.cantidad || 0), 0);
    html += '<div class="mj-tarea ubic-' + tipo + '">'
      + '<div class="mj-tarea-head">'
      + '<span class="mj-t-num">TAREA ' + escapeHtml(t.correlativo || '') + '</span>'
      + (t.tipoTrabajo ? '<span class="mj-t-tipo">' + escapeHtml(t.tipoTrabajo) + '</span>' : '')
      + '<span class="mj-t-badge ' + tipo + '">' + etiqueta + '</span>'
      + '<span class="mj-t-total">' + fmt(t.total || 0) + '</span>'
      + '</div>'
      + '<div class="mj-tarea-meta">🕒 ' + escapeHtml(fechaCorta(t.fecha)) + ' ' + escapeHtml(t.hora || '')
      + ' · 📍 Zona: ' + escapeHtml(t.zona || '-')
      + ' · ' + its.length + ' baremo(s) · ' + cant + ' ítem(s)</div>'
      + '<div class="mj-tarea-dir">📌 ' + escapeHtml(textoUbicacionTarea(t))
      + (url ? ' · <a href="' + url + '" target="_blank" rel="noopener noreferrer">🗺️ Ver mapa</a>' : '')
      + '</div>'
      + filas(its)
      + '</div>';
  });

  const sueltos = items.filter(it => !it.tareaId);
  if (sueltos.length) {
    const sub = sueltos.reduce((a, i) => a + (i.subtotal || 0), 0);
    html += '<div class="mj-tarea sin-tarea">'
      + '<div class="mj-tarea-head"><span class="mj-t-num">TAREA SIN FINALIZAR</span>'
      + '<span class="mj-t-badge ninguna">NO SUMA AL TOTAL</span>'
      + '<span class="mj-t-total">' + fmt(sub) + '</span></div>'
      + '<div class="mj-tarea-meta">Estos baremos quedaron sin finalizar, por eso no integran el total del día.</div>'
      + filas(sueltos) + '</div>';
  }

  if (!html) html = '<div class="mj-sin">La jornada no tiene tareas registradas</div>';
  box.innerHTML = html;
}

/* Logo para la cabecera del PDF: se lee una sola vez y se reutiliza.
   Si por cualquier motivo no se puede cargar, el PDF se genera sin logo. */
let _logoPDF = null;
let _logoPDFIntentado = false;

async function obtenerLogoPDF() {
  if (_logoPDFIntentado) return _logoPDF;
  _logoPDFIntentado = true;
  try {
    const resp = await fetch('icons/icon-512.png?v=' + APP_VERSION, { cache: 'force-cache' });
    if (!resp.ok) throw new Error('logo no disponible');
    const blob = await resp.blob();
    _logoPDF = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(new Error('no se pudo leer el logo'));
      fr.readAsDataURL(blob);
    });
  } catch (e) {
    _logoPDF = null;
  }
  return _logoPDF;
}

/* Pie de página elegante con paginado */
function drawPiePDF(doc) {
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(214, 224, 240);
    doc.setLineWidth(0.4);
    doc.line(14, 283, 196, 283);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(122, 138, 166);
    doc.text('BAREMO · Reporte generado el ' + fechaCorta(hoy()) + ' ' + horaCorta(), 14, 288);
    doc.text('Página ' + p + ' de ' + total, 196, 288, { align: 'right' });
  }
}

/* Cabecera elegante: banda azul con degradado, logo de la app a la izquierda,
   título y datos del operario a la derecha, y filete celeste inferior. */
function drawElegantHeader(doc, title, subtitle, rightText1, rightText2) {
  // Degradado simulado con franjas horizontales (jsPDF no tiene gradientes)
  const alto = 38;
  for (let i = 0; i < alto; i++) {
    const k = i / alto;
    doc.setFillColor(
      Math.round(8 + 22 * k),
      Math.round(48 + 60 * k),
      Math.round(120 + 78 * k)
    );
    doc.rect(0, i, 210, 1.02, 'F');
  }
  // Filete de acento
  doc.setFillColor(255, 193, 7);
  doc.rect(0, alto, 210, 1.6, 'F');

  let xTexto = 14;
  if (_logoPDF) {
    try {
      // Disco blanco de apoyo para que el logo respire sobre el azul
      doc.setFillColor(255, 255, 255);
      doc.circle(26, 19, 13.2, 'F');
      doc.addImage(_logoPDF, 'PNG', 13.5, 6.5, 25, 25);
      xTexto = 46;
    } catch (e) {
      xTexto = 14;
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(21);
  doc.setFont('helvetica', 'bold');
  doc.text(title, xTexto, 18);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(214, 228, 250);
  doc.text(subtitle, xTexto, 26);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(String(rightText1 || ''), 196, 18, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(214, 228, 250);
  doc.text(String(rightText2 || ''), 196, 25, { align: 'right' });
  doc.setTextColor(33, 41, 54);
}

/* Tarjeta de resumen bajo la cabecera */
function drawResumenPDF(doc, y, datos) {
  doc.setFillColor(243, 247, 253);
  doc.setDrawColor(214, 226, 244);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, 182, 16, 2.5, 2.5, 'FD');
  const ancho = 182 / datos.length;
  datos.forEach((d, i) => {
    const x = 14 + ancho * i;
    if (i) {
      doc.setDrawColor(222, 232, 246);
      doc.line(x, y + 3, x, y + 13);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 128, 158);
    doc.text(String(d.lbl).toUpperCase(), x + ancho / 2, y + 6.4, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(11, 61, 145);
    doc.text(String(d.val), x + ancho / 2, y + 12.6, { align: 'center' });
  });
  doc.setTextColor(33, 41, 54);
  return y + 22;
}

/* Bloque de UNA tarea: encabezado con su ubicación + tabla de SUS baremos.
   Devuelve la nueva coordenada Y. */
function bloqueTareaPDF(doc, j, t, its, y) {
  const nuevaPagina = () => {
    doc.addPage();
    return 20;
  };
  if (y > 232) y = nuevaPagina();

  const tipo = t.tipoUbicacion === 'gps' ? 'GPS'
    : (t.tipoUbicacion === 'manual' ? 'MANUAL' : 'SIN UBICACIÓN');
  const cant = its.reduce((a, i) => a + (i.cantidad || 0), 0);
  const sub = its.reduce((a, i) => a + (i.subtotal || 0), 0);

  // Encabezado de la tarea
  doc.setFillColor(11, 61, 145);
  doc.roundedRect(14, y, 182, 9, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('TAREA ' + (t.correlativo || '') + (t.tipoTrabajo ? '  ·  ' + t.tipoTrabajo : ''), 18, y + 6.2);
  doc.text(fmt(sub), 192, y + 6.2, { align: 'right' });
  y += 9;

  // Datos de la tarea (fecha, hora, zona, ubicación)
  doc.setFillColor(240, 245, 252);
  doc.setDrawColor(219, 230, 246);
  doc.setLineWidth(0.3);
  const dir = doc.splitTextToSize('Ubicación (' + tipo + '): ' + textoUbicacionTarea(t), 168);
  const altoCaja = 8 + dir.length * 3.6;
  doc.rect(14, y, 182, altoCaja, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(60, 76, 104);
  doc.text(fechaCorta(t.fecha) + '  ' + (t.hora || '') + '   |   Zona: ' + (t.zona || '-')
    + '   |   ' + its.length + ' baremo(s) · ' + cant + ' ítem(s)', 18, y + 4.6);
  doc.text(dir, 18, y + 8.4);
  y += altoCaja;

  // Baremos de ESTA tarea
  doc.autoTable({
    startY: y,
    head: [['#', 'Código', 'Descripción', 'Cant', 'Precio', 'Subtotal']],
    body: its.length
      ? its.map((it, i) => [i + 1, it.codigo, it.descripcion, it.cantidad, fmt(it.precio), fmt(it.subtotal)])
      : [['', '', 'Sin baremos asociados', '', '', '']],
    foot: [['', '', 'Subtotal de la tarea', cant, '', fmt(sub)]],
    theme: 'grid',
    styles: { fontSize: 7.6, cellPadding: 1.7, lineColor: [220, 230, 244], textColor: [40, 50, 66] },
    headStyles: { fillColor: [37, 99, 201], textColor: 255, fontSize: 7.6 },
    footStyles: { fillColor: [235, 241, 250], textColor: [11, 61, 145], fontStyle: 'bold', fontSize: 7.8 },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 22 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' }
    },
    margin: { left: 14, right: 14, bottom: 22 }
  });

  return doc.lastAutoTable.finalY + 7;
}

/* Recorre TODAS las tareas de la jornada (y los baremos sin finalizar) */
function bloquesJornadaPDF(doc, j, y) {
  const items = j.items || [];
  const tareas = (Array.isArray(j.tareas) ? j.tareas : []).slice().sort((a, b) =>
    String(a.correlativo || '').localeCompare(String(b.correlativo || '')));

  tareas.forEach(t => {
    y = bloqueTareaPDF(doc, j, t, items.filter(it => it.tareaId === t.id), y);
  });

  const sueltos = items.filter(it => !it.tareaId);
  if (sueltos.length) {
    y = bloqueTareaPDF(doc, j, {
      correlativo: 'SIN FINALIZAR',
      tipoTrabajo: '',
      fecha: j.fecha,
      hora: '',
      zona: j.zona || '',
      tipoUbicacion: 'ninguna',
      direccion: 'Tarea sin finalizar: estos baremos no integran el total'
    }, sueltos, y);
  }

  if (!tareas.length && !sueltos.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 134, 160);
    doc.text('La jornada no tiene tareas registradas.', 16, y + 4);
    doc.setTextColor(33, 41, 54);
    y += 10;
  }
  return y;
}

/* Franja de total */
function drawTotalPDF(doc, y, etiqueta, valor) {
  if (y > 252) { doc.addPage(); y = 20; }
  for (let i = 0; i < 14; i++) {
    const k = i / 14;
    doc.setFillColor(Math.round(8 + 20 * k), Math.round(48 + 56 * k), Math.round(120 + 72 * k));
    doc.rect(14, y + i, 182, 1.02, 'F');
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(etiqueta, 19, y + 9);
  doc.setFontSize(14);
  doc.text(valor, 191, y + 9.3, { align: 'right' });
  doc.setTextColor(33, 41, 54);
  return y + 20;
}

/* ============================================================
   v5.9.31 - ENVIAR EL REPORTE POR WHATSAPP
   El PDF se arma exactamente igual que con el boton de documento.
   Si el navegador soporta compartir archivos (Android/iOS actuales),
   se abre el selector del sistema con el PDF ya adjunto y ahi se
   elige WhatsApp. Si no lo soporta (escritorio), el PDF se descarga
   y se abre WhatsApp con el resumen escrito para adjuntarlo.
   ============================================================ */
function iconoWhatsApp() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38c1.45.79 3.08 1.2 4.79 1.2 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.02c-1.5 0-2.97-.4-4.26-1.16l-.31-.18-3.12.82.84-3.04-.2-.32a8.06 8.06 0 0 1-1.24-4.31c0-4.46 3.63-8.09 8.09-8.09s8.09 3.63 8.09 8.09-3.63 8.19-8.09 8.19zm4.44-6.06c-.24-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.54.12-.16.24-.62.79-.76.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.55-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.68 2.68 4.08 3.66.57.24 1.02.39 1.37.5.58.18 1.1.16 1.52.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28z"/></svg>';
}

function textoReporteJornada(j, total) {
  const partes = [
    '*BAREMO* – Reporte de jornada',
    'Fecha: ' + fechaLegible(j.fecha),
    'Operario: ' + (j.usuario || State.user.nombre) + ' (Legajo ' + (j.legajo || State.user.legajo) + ')'
  ];
  const zonas = (textoZonasJornada(j) || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (zonas) partes.push('Zona: ' + zonas);
  partes.push('Total del día: ' + fmt(total));
  partes.push('Reporte en PDF adjunto.');
  return partes.join('\n');
}

async function compartirPDFWhatsApp(doc, nombre, texto) {
  let archivo = null;
  try {
    const blob = doc.output('blob');
    archivo = new File([blob], nombre, { type: 'application/pdf' });
  } catch (e) {
    archivo = null;
  }

  if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: 'Reporte BAREMO', text: texto });
      toast('Elegí WhatsApp para enviar el reporte', 'success');
      return;
    } catch (err) {
      // Si el usuario cancela no hay nada que avisar.
      if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return;
    }
  }

  // Respaldo para navegadores sin compartir archivos: se baja el PDF y se
  // abre WhatsApp con el resumen listo para adjuntarlo a mano.
  doc.save(nombre);
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
  toast('PDF descargado: adjuntalo en WhatsApp', 'warn');
}

async function exportarJornadaPDF(id, compartir) {
  let j = await dbGet('jornadas', id);
  if (!j && typeof id === 'string' && !isNaN(Number(id))) {
    j = await dbGet('jornadas', Number(id));
  }
  if (!j && _nubeJornadasMap && _nubeJornadasMap.has(String(id))) {
    j = _nubeJornadasMap.get(String(id));
  }
  if (!j || !window.jspdf) return;
  const { jsPDF } = window.jspdf;
  await obtenerLogoPDF();
  const doc = new jsPDF();

  const nombreOp = j.nombreUsuario || j.usuario || State.user.nombre;
  const legajoOp = j.legajo || State.user.legajo;
  const zonaOp = j.zona || State.user.zona || '-';

  drawElegantHeader(doc, 'BAREMO', 'Jornada del ' + fechaLegible(j.fecha),
    nombreOp, 'Legajo: ' + legajoOp + ' | Zona: ' + zonaOp);

  const tareas = Array.isArray(j.tareas) ? j.tareas : [];
  const finalizados = (j.items || []).filter(it => it.tareaId);
  const totalDia = tareas.length
    ? finalizados.reduce((a, i) => a + (i.subtotal || 0), 0)
    : (j.total || 0);

  let y = drawResumenPDF(doc, 46, [
    { lbl: 'Tareas', val: tareas.length },
    { lbl: 'Baremos', val: finalizados.length || (j.items || []).length },
    { lbl: 'Ítems', val: (finalizados.length ? finalizados : (j.items || [])).reduce((a, i) => a + (i.cantidad || 0), 0) },
    { lbl: 'Total del día', val: fmt(totalDia) }
  ]);

  // Cada tarea con SUS baremos y SU ubicación, en un mismo bloque
  y = bloquesJornadaPDF(doc, j, y);
  drawTotalPDF(doc, y, 'TOTAL DEL DÍA', fmt(totalDia));
  drawPiePDF(doc);

  const nombre = 'baremos_' + j.fecha + '_' + j.legajo + '.pdf';
  if (compartir) {
    await compartirPDFWhatsApp(doc, nombre, textoReporteJornada(j, totalDia));
    return;
  }
  doc.save(nombre);
  avisarPDFGenerado('de la jornada del ' + fechaLegible(j.fecha));
}

async function exportarSeleccionadasPDF() {
  if (!State.histSelected.size) { toast('Seleccioná jornadas', 'warn'); return; }
  await exportarMultiplesPDF([...State.histSelected].sort((a, b) => a - b), 'seleccionadas');
}

async function exportarMesCompletoPDF() {
  const mes = State.histFilter === 'mesAnterior' ? mesAnterior() : mesActual();
  const j = (await dbGetAll('jornadas')).filter(j => j.legajo === State.user.legajo && j.cerrada && j.fecha.startsWith(mes)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!j.length) { toast('Sin jornadas en este mes', 'warn'); return; }
  await exportarMultiplesPDF(j.map(x => x.id), nombreMes(mes).replace(' ', '_'));
}

async function exportarMultiplesPDF(ids, nom) {
  if (!window.jspdf) return;
  const { jsPDF } = window.jspdf;
  await obtenerLogoPDF();
  const doc = new jsPDF();
  
  const jornadas = [];
  for (const id of ids) {
    const j = await dbGet('jornadas', id);
    if (j) jornadas.push(j);
  }
  jornadas.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const mesLabel = nom !== 'seleccionadas' ? nom.replace('_', ' ').toUpperCase() : 'SELECCIÓN MÚLTIPLE';
  drawElegantHeader(doc, "BAREMO", `Reporte de Producción: ${mesLabel}`, State.user.nombre, `Legajo: ${State.user.legajo} | Zona: ${State.user.zona || '-'}`);

  const totalGeneral = jornadas.reduce((a, j) => a + totalFinalizadoDe(j), 0);
  const tareasTotales = jornadas.reduce((a, j) => a + ((Array.isArray(j.tareas) ? j.tareas : []).length), 0);

  let currentY = drawResumenPDF(doc, 46, [
    { lbl: 'Jornadas', val: jornadas.length },
    { lbl: 'Tareas', val: tareasTotales },
    { lbl: 'Promedio x día', val: fmt(jornadas.length ? Math.round(totalGeneral / jornadas.length) : 0) },
    { lbl: 'Total acumulado', val: fmt(totalGeneral) }
  ]);
  let totalAcu = 0;

  for (const j of jornadas) {
    if (currentY > 236) { doc.addPage(); currentY = 20; }

    const subDia = totalFinalizadoDe(j);
    totalAcu += subDia;

    // Cabecera de la jornada
    doc.setFillColor(232, 239, 250);
    doc.setDrawColor(206, 221, 244);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, currentY, 182, 9, 2, 2, 'FD');
    doc.setTextColor(11, 61, 145);
    doc.setFontSize(9.8);
    doc.setFont('helvetica', 'bold');
    doc.text('JORNADA · ' + fechaLegible(j.fecha), 18, currentY + 6.2);
    doc.text('Total del día: ' + fmt(subDia), 192, currentY + 6.2, { align: 'right' });
    currentY += 12;

    // Cada tarea con SUS baremos y SU ubicación
    currentY = bloquesJornadaPDF(doc, j, currentY);
    currentY += 2;
  }

  drawTotalPDF(doc, currentY, 'TOTAL ACUMULADO', fmt(totalAcu));
  drawPiePDF(doc);

  doc.save(`baremos_${nom}_${State.user.legajo}.pdf`);
  avisarPDFGenerado('de ' + nom);
  State.histSelected.clear();
  renderHistorial();
}

async function exportarMesExcel() {
  if (!window.XLSX) return;
  const mes = State.histFilter === 'mesAnterior' ? mesAnterior() : mesActual();
  const j = (await dbGetAll('jornadas')).filter(x => x.legajo === State.user.legajo && x.cerrada && x.fecha.startsWith(mes)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!j.length) { toast('Sin jornadas', 'warn'); return; }
  const wb = XLSX.utils.book_new();
  const res = j.map(x => ({ Fecha: fechaCorta(x.fecha), Usuario: x.usuario, Total: x.total || 0 }));
  res.push({});
  res.push({ Fecha: 'TOTAL', Total: j.reduce((a, x) => a + (x.total || 0), 0) });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(res), 'Resumen');
  j.forEach(x => {
    const d = (x.items || []).map((it, i) => ({ '#': i + 1, Código: it.codigo, Descripción: it.descripcion, Precio: it.precio, Cantidad: it.cantidad, Subtotal: it.subtotal }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d), `Dia_${x.fecha}`.substring(0, 31));
  });
  XLSX.writeFile(wb, `baremos_${nombreMes(mes).replace(' ', '_')}.xlsx`);
  toast('Excel generado', 'success');
}

async function renderDashboard() {
  const leg = State.user.legajo;
  const mes = mesActual();
  const mesAnt = mesAnterior();
  const todas = (await dbGetAll('jornadas')).filter(j => j.legajo === leg && j.cerrada);
  const jMes = todas.filter(j => j.fecha.startsWith(mes));
  const jAnt = todas.filter(j => j.fecha.startsWith(mesAnt));
  const comb = (await dbGetAll('combustible')).filter(c => c.legajo === leg);
  const quinc = (await dbGetAll('quincenas')).filter(q => q.legajo === leg);

  /* v5.9.29: TODOS los numeros salen de resumenDeJornadas(), que recalcula
     con totalesDeJornada(). Antes el Dashboard leia el total guardado y el
     Historial recalculaba: podian mostrar importes distintos. */
  const rMes = resumenDeJornadas(jMes);
  const rAnt = resumenDeJornadas(jAnt);

  const dias = rMes.dias;                 // dias calendario distintos
  const jornadasCerradas = rMes.jornadas; // jornadas cerradas del mes
  const tareasCerradas = rMes.tareas;     // tareas finalizadas
  const baremosCargados = rMes.lineas;    // baremos de tareas finalizadas
  const tot = rMes.total;
  const prom = rMes.promedioDia;
  const tu = rMes.topUso;
  const tf = rMes.topFact;
  const mx = rMes.maxDia;
  const mn = rMes.minDia;

  /* "Dia anterior": ultimo DIA calendario trabajado antes de hoy, con la
     suma de todas las jornadas de esa fecha. Antes tomaba una sola
     jornada, asi que un dia con dos jornadas mostraba de menos. */
  const dHoy = hoy();
  const pasadas = new Map();
  todas.filter(j => j.fecha < dHoy).forEach(j => {
    pasadas.set(j.fecha, (pasadas.get(j.fecha) || 0) + totalesDeJornada(j).total);
  });
  const fechasPasadas = [...pasadas.keys()].sort((a, b) => b.localeCompare(a));
  const prodAyer = fechasPasadas.length ? pasadas.get(fechasPasadas[0]) : 0;
  const fecAyer = fechasPasadas.length ? `(${fechaCorta(fechasPasadas[0])})` : '';

  const elAyer = $('#statDiaAnterior');
  if (elAyer) elAyer.textContent = fmt(prodAyer);
  const elLblAyer = $('#lblFechaAyer');
  if (elLblAyer) elLblAyer.textContent = fecAyer;

  const dac = $('#cardDiaAnterior');
  if (dac) {
    dac.className = 'stat-card dac-interactive';
    dac.classList.add(getConfigDia(prodAyer).cls);
  }

  const cMin = $('#cardMinDia');
  if (cMin) {
    cMin.className = 'stat-card dac-interactive';
    cMin.classList.add(getConfigDia(mn ? mn.total : 0).cls);
  }

  /* ==========================================================
     ATRIBUCION DE DESCUENTOS POR MES (regla estricta)

     Cada mes se cierra con SUS PROPIOS descuentos:
       neto del mes = produccion del mes
                      - combustible del mes (el marcado a descontar)
                      - Q1 del mes
                      - Q2 del mes

     La Q2 de un mes se registra y se cobra en el mes siguiente (dentro
     de los primeros 10 dias; la empresa paga al 5to dia habil), pero
     PERTENECE al mes cerrado. El combustible tambien cierra con el mes:
     cada carga queda atada al mes en que se hizo y el contador arranca
     en cero el 1ro.
     ========================================================== */
  const pAnt = rAnt.total;

  const cierreDelMes = (ms, produccion) => {
    const cm = comb.filter(c => c.mes === ms);
    const cDesc = cm.filter(c => c.descontar !== false).reduce((a, c) => a + numero(c.monto), 0);
    const cNoDesc = cm.filter(c => c.descontar === false).reduce((a, c) => a + numero(c.monto), 0);
    const rq1 = quinc.find(q => q.mes === ms && q.tipo === 1 && q.bloqueada);
    const rq2 = quinc.find(q => q.mes === ms && q.tipo === 2 && q.bloqueada);
    const vq1 = rq1 ? numero(rq1.total) : 0;
    const vq2 = rq2 ? numero(rq2.total) : 0;
    return {
      ms, produccion, cDesc, cNoDesc,
      q1: vq1, q2: vq2,
      q1Reg: !!rq1, q2Reg: !!rq2,
      neto: produccion - cDesc - vq1 - vq2
    };
  };

  const cMes = cierreDelMes(mes, tot);
  const cAnt = cierreDelMes(mesAnt, pAnt);
  const ventanaQ2 = esDiaRegistroQ2();
  const saldoFinal = cMes.neto;

  const tacCard = $('#tacCard');
  if (tacCard) {
    const meta = META_MENSUAL;
    const progreso = Math.max(0, Math.min((tot / meta) * 100, 100));
    const faltan = Math.max(meta - tot, 0);

    const elTac = $('#tacAmount');
    if (elTac) elTac.textContent = fmt(tot);
    const barra = $('#tacProgressBar');
    if (barra) barra.style.width = progreso + '%';
    const txtProg = $('#tacProgressText');
    if (txtProg) txtProg.textContent = `Progreso: ${progreso.toFixed(1)}%`;
    const txtFalta = $('#tacFaltanText');
    if (txtFalta) txtFalta.textContent = `Faltan: ${fmt(faltan)}`;

    const overlay = $('#tacOverlayMsg');
    const cfgMes = getConfigMes(tot);
    tacCard.className = 'total-acumulado-card ' + cfgMes.cls;
    if (overlay) {
      overlay.classList.remove('show');
      // Los mensajes salen del MISMO rango que pinta la tarjeta: una sola
      // fuente de verdad, sin umbrales repetidos.
      const msg = MENSAJES_META[cfgMes.cls];
      if (msg) { overlay.textContent = msg; overlay.classList.add('show'); }
    }
    if (tot >= meta) {
      if (!State.metaAlcanzada) {
        lanzarConfeti();
        lanzarBengalas();
        State.metaAlcanzada = true;
      }
    } else {
      State.metaAlcanzada = false;
    }
  }

  const s = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
  // Orden logico: volumen de trabajo primero, plata despues.
  s('statDias', fmtNum(dias));
  s('statJornadas', fmtNum(jornadasCerradas));
  s('statTareas', fmtNum(tareasCerradas));
  s('statBaremos', fmtNum(baremosCargados));
  s('statBaremosSub', rMes.codigos ? `${fmtNum(rMes.codigos)} códigos` : '');
  s('statProm', fmt(prom));
  // v5.9.30 - el promedio vive solo aca; el historial ya no lo duplica.
  s('statPromSub', rMes.promedioJornada
    ? `${fmt(Math.round(rMes.promedioJornada))} por jornada`
    : 'por día trabajado');
  s('statTopUso', tu ? `${tu[0]} (${fmtNum(tu[1])})` : '-');
  s('statTopFact', tf ? `${tf[0]} · ${fmt(tf[1])}` : '-');
  s('statMaxDia', mx ? `${fechaCorta(mx.fecha)} · ${fmt(mx.total)}` : '-');
  s('statMinDia', mn ? `${fechaCorta(mn.fecha)} · ${fmt(mn.total)}` : '-');
  s('statMesAnterior', fmt(pAnt));

  const am = $('#statCobrar');
  const det = $('#statCobrarDetail');
  if (am) {
    am.textContent = fmt(saldoFinal);
    am.style.color = saldoFinal < 0 ? '#fca5a5' : '';
  }
  if (det) {
    const rojo = 'color: #fca5a5;';
    const suave = 'color: #cbd5e1;';
    const cobro = fechasCobroQ2(mesAnt);
    const dd = f => f ? f.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '?';

    // --- Mes en curso: solo lo que le corresponde a este mes ---
    let html = `
      <div class="pc-titulo">${nombreMes(mes)} · en curso</div>
      <div class="pc-line"><span>Producción</span><span>${fmt(cMes.produccion)}</span></div>
      <div class="pc-line"><span>− Combustible del mes</span><span style="${rojo}">${fmt(cMes.cDesc)}</span></div>
      <div class="pc-line" style="${suave}"><span>ℹ️ Combustible sin descuento</span><span style="font-weight:700">${fmt(cMes.cNoDesc)}</span></div>
      <div class="pc-line"><span>− 1ra quincena</span><span style="${rojo}">${cMes.q1Reg ? fmt(cMes.q1) : 'pendiente'}</span></div>
      <div class="pc-line"><span>− 2da quincena</span><span style="${cMes.q2Reg ? rojo : suave}">${cMes.q2Reg ? fmt(cMes.q2) : 'se carga en ' + nombreMes(mesSiguienteDe(mes))}</span></div>
      <div class="pc-line pc-sub"><span>↳ se registra en ${nombreMes(mesSiguienteDe(mes))}, pero descuenta de la producción de ${nombreMes(mes)}</span><span></span></div>
      <div class="pc-line total"><span>= Saldo de ${nombreMes(mes)}</span><span style="${cMes.neto < 0 ? rojo : 'color:#bbf7d0;'}">${fmt(cMes.neto)}</span></div>
    `;

    // --- Mes cerrado: su Q2 se cobra ahora pero se descuenta ACA ---
    if (cAnt.produccion > 0 || cAnt.q1Reg || cAnt.q2Reg || cAnt.cDesc > 0 || cAnt.cNoDesc > 0) {
      html += `
        <div class="pc-titulo">${nombreMes(mesAnt)} · cerrado</div>
        <div class="pc-line"><span>Producción</span><span>${fmt(cAnt.produccion)}</span></div>
        <div class="pc-line"><span>− Combustible del mes</span><span style="${rojo}">${fmt(cAnt.cDesc)}</span></div>
        <div class="pc-line"><span>− 1ra quincena</span><span style="${rojo}">${cAnt.q1Reg ? fmt(cAnt.q1) : 'sin registrar'}</span></div>
        <div class="pc-line"><span>− 2da quincena</span><span style="${cAnt.q2Reg ? rojo : suave}">${cAnt.q2Reg ? fmt(cAnt.q2) : (ventanaQ2 ? 'se carga hasta el ' + dd(cobro.limite) : 'sin registrar')}</span></div>
        <div class="pc-line pc-sub"><span>↳ se registra en ${nombreMes(mes)} (del 1 al ${Q2_DIA_LIMITE}), pero descuenta de ${nombreMes(mesAnt)}</span><span></span></div>
        <div class="pc-line total"><span>= Saldo de ${nombreMes(mesAnt)}</span><span style="${cAnt.neto < 0 ? rojo : 'color:#bbf7d0;'}">${fmt(cAnt.neto)}</span></div>
      `;
    }

    // v5.9.32 - la regla se explica SIEMPRE, este abierta o no la ventana de
    // carga, porque es lo que mas confusion genera: la Q2 se registra en el
    // mes siguiente pero el descuento cae en la produccion del mes anterior.
    html += `<div class="pc-nota">ℹ️ <b>2da quincena:</b> se registra en el <b>mes siguiente</b>, del 1 al ${Q2_DIA_LIMITE}, porque la empresa paga 5 días hábiles después del cierre. Ese importe <b>se descuenta siempre de la producción del mes anterior</b>, nunca de la del mes en curso.</div>`;
    if (ventanaQ2) {
      html += `<div class="pc-nota">🗓️ Ventana abierta: la 2da quincena de ${nombreMes(mesAnt)} se puede registrar hasta el ${dd(cobro.limite)} y se cobra el ${dd(cobro.pago)} (5to día hábil), pero descuenta de ${nombreMes(mesAnt)}. No toca el saldo de ${nombreMes(mes)}.</div>`;
    }

    html += `<div class="pc-alerta">⚠️ <b>¡ATENCIÓN!</b> La producción final puede variar a favor o en contra por tema de Baremos mal usados o Baremos faltantes en actividades realizadas.</div>`;

    det.innerHTML = html;
    setupDetalleProduccion();
  }

  renderCharts(todas, mes);
}

/* ---------- COMBUSTIBLE: PATENTE PREREGISTRADA ----------
   La patente vigente se guarda una sola vez por usuario en el store `config`.
   Cada carga guarda ademas su propia patente, por lo que cambiar la patente
   vigente nunca altera ni borra las cargas ya registradas. */

function patenteKey() {
  return 'combPatente_' + (State.user ? State.user.legajo : '');
}

function normalizarPatente(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function cargarPatenteGuardada() {
  if (!State.user) { State.combPatente = ''; return ''; }
  const c = await dbGet('config', patenteKey());
  State.combPatente = (c && c.value) ? c.value : '';
  return State.combPatente;
}

async function guardarPatente(p) {
  State.combPatente = p;
  await dbPut('config', { key: patenteKey(), value: p });
}

// modoEdicion=true fuerza el input (cambio pedido). Sin patente guardada,
// el input se muestra siempre: es la primera carga.
function renderPatenteUI(modoEdicion) {
  const box = $('#combPatenteBox'), field = $('#combPatenteField');
  if (!box || !field) return;
  const tiene = !!State.combPatente;
  const editar = !!modoEdicion || !tiene;
  box.hidden = editar;
  field.hidden = !editar;
  const val = $('#combPatenteActual');
  if (val) val.textContent = tiene ? State.combPatente : '—';
  const hint = $('#combPatenteHint');
  if (hint) hint.hidden = !(editar && tiene);
  const cancel = $('#btnCancelarPatente');
  if (cancel) cancel.hidden = !(editar && tiene);
  const inp = $('#combPatente');
  if (inp && editar) inp.value = '';
}

function setupCombustible() {
  const f = $('#formComb');
  if (!f) return;

  const btnCambiar = $('#btnCambiarPatente');
  if (btnCambiar) btnCambiar.onclick = async () => {
    const ant = State.combPatente;
    const ok = await confirmDialog(`⚠️ ¿Cambiar la patente ${ant}?\n\nLas próximas cargas se registrarán con la patente nueva.\n\nLas cargas ya registradas con ${ant} NO se borran ni se modifican: siguen en el historial y en los totales.`);
    if (!ok) return;
    renderPatenteUI(true);
    const inp = $('#combPatente');
    if (inp) inp.focus();
  };

  const btnCancelar = $('#btnCancelarPatente');
  if (btnCancelar) btnCancelar.onclick = () => renderPatenteUI(false);

  f.onsubmit = async e => {
    e.preventDefault();
    const field = $('#combPatenteField');
    const editando = !field || !field.hidden;
    const anterior = State.combPatente;
    const p = editando ? normalizarPatente($('#combPatente').value) : anterior;
    const m = parseFloat($('#combMonto').value) || 0;
    const checkbox = $('#combDescontar');
    const desc = checkbox ? checkbox.checked : true;

    if (!p) { toast('Ingresá la patente', 'warn'); if (editando && $('#combPatente')) $('#combPatente').focus(); return; }
    if (p.length < 5 || p.length > 10) { toast('Patente inválida', 'warn'); return; }
    if (m <= 0) { toast('Ingresá el monto', 'warn'); return; }

    const ticketComb = { patente: p, monto: m, descontar: desc, fecha: hoy(), mes: mesActual(), legajo: State.user.legajo, creado: ahora() };
    ticketComb.id = await dbAdd('combustible', ticketComb);
    if (p !== anterior) await guardarPatente(p);
    // Solo se limpia el monto: la patente queda preregistrada.
    if ($('#combMonto')) $('#combMonto').value = '';
    if ($('#combDescontar')) $('#combDescontar').checked = true;
    toast(anterior && p !== anterior ? `Carga registrada · patente ${p}` : 'Carga registrada', 'success');
    renderPatenteUI(false);
    renderCombustible();
  };
}

/* Tarjeta de una carga de combustible (se reutiliza en el mes en curso
   y dentro de los cierres de meses anteriores). */
function tarjetaCargaCombustible(c) {
  const noDesc = c.descontar === false;
  return `
    <div class="registro-item${noDesc ? ' comb-nodesc' : ''}">
      <div>
        <div style="font-weight:700">${fmt(numero(c.monto))}</div>
        <div class="muted" style="font-size:12px">${fechaCorta(c.fecha)}${c.patente ? ' · ' + c.patente : ''}</div>
      </div>
      <div class="comb-tag ${noDesc ? 'no' : 'si'}">${noDesc ? 'No descuenta' : 'Descuenta'}</div>
    </div>`;
}

/* ============================================================
   COMBUSTIBLE (v5.9.29)

   El combustible CIERRA con el mes: el 1ro el contador arranca en cero.
   Las cargas del mes anterior no se borran ni se suman al mes nuevo:
   quedan guardadas en el cierre mensual, en este mismo menu, para no
   sobrecargar el Dashboard.
   ============================================================ */
async function renderCombustible() {
  await cargarPatenteGuardada();
  renderPatenteUI(false);

  const mes = mesActual();
  const all = (await dbGetAll('combustible'))
    .filter(c => c.legajo === State.user.legajo)
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

  const mesDe = c => c.mes || String(c.fecha || '').slice(0, 7);
  const delMes = all.filter(c => mesDe(c) === mes);
  const anteriores = all.filter(c => mesDe(c) !== mes);

  // ---- Mes en curso ----
  const lst = $('#combList');
  if (lst) {
    lst.innerHTML = delMes.length
      ? delMes.map(tarjetaCargaCombustible).join('')
      : '<div class="comb-vacio"><div class="cv-ico">⛽</div><div class="cv-txt">Sin cargas este mes</div><div class="cv-sub">El contador arranca en cero cada 1ro</div></div>';
  }

  const descMes = delMes.filter(c => c.descontar !== false).reduce((a, c) => a + numero(c.monto), 0);
  const noDescMes = delMes.filter(c => c.descontar === false).reduce((a, c) => a + numero(c.monto), 0);

  const t = $('#combTotalMes');
  if (t) t.textContent = fmt(descMes);

  const sub = $('#combTotalMesSub');
  if (sub) {
    const partes = [`${nombreMes(mes)} · ${fmtNum(delMes.length)} carga(s)`];
    if (noDescMes > 0) partes.push(`${fmt(noDescMes)} sin descuento`);
    sub.textContent = partes.join(' · ');
  }

  // ---- Cierres de meses anteriores ----
  const cont = $('#combCierres');
  if (!cont) return;

  if (!anteriores.length) {
    cont.innerHTML = '<div class="cc-vacio">Todavía no hay meses cerrados.</div>';
    return;
  }

  const porMes = new Map();
  anteriores.forEach(c => {
    const ms = mesDe(c);
    if (!porMes.has(ms)) porMes.set(ms, { ms, cargas: [], desc: 0, noDesc: 0 });
    const reg = porMes.get(ms);
    reg.cargas.push(c);
    if (c.descontar === false) reg.noDesc += numero(c.monto);
    else reg.desc += numero(c.monto);
  });

  const cierres = [...porMes.values()].sort((a, b) => b.ms.localeCompare(a.ms));
  const totalHist = cierres.reduce((a, m) => a + m.desc, 0);

  cont.innerHTML = cierres.map(m => `
    <details class="comb-cierre">
      <summary>
        <span class="cc-mes">${nombreMes(m.ms)}</span>
        <span class="cc-tot">${fmt(m.desc)}</span>
        <span class="cc-meta">${fmtNum(m.cargas.length)} carga(s)${m.noDesc > 0 ? ' · ' + fmt(m.noDesc) + ' sin desc.' : ''}</span>
      </summary>
      <div class="cc-body">${m.cargas.map(tarjetaCargaCombustible).join('')}</div>
    </details>`).join('')
    + `<div class="cc-hist">Histórico descontado: <b>${fmt(totalHist)}</b></div>`;
}

async function renderQuincenas() {
  const leg = State.user.legajo;
  const mes = mesActual();
  const mesQ = mesQuincenaActual();
  const quinc = (await dbGetAll('quincenas')).filter(q => q.legajo === leg);

  /* ----------------------------------------------------------
     La Q1 que se muestra es siempre la del mes en curso (periodo
     01 al 15, se cobra el 20). La Q2 que se muestra pertenece al
     mes que corresponda: durante la ventana de cobro es la del mes
     YA CERRADO.

     EL BUG QUE HABIA: para decidir si la Q2 se desbloqueaba se
     miraba la Q1 del MES EN CURSO. Pero en los primeros dias
     habiles del mes nuevo esa Q1 todavia no existe (se registra
     cerca del dia 20). Resultado: la Q2 del mes cerrado quedaba
     bloqueada con el cartel "Se habilita al registrar la 1ra
     quincena" y NO SE PODIA REGISTRAR NUNCA, justo en los unicos
     dias en que se podia hacer.

     LA CORRECCION: la Q2 se libera con la Q1 DE SU MISMO PERIODO.
     ---------------------------------------------------------- */
  const mesQ1 = mes;
  const mesQ2 = mesQ;
  const q1 = quinc.find(q => q.mes === mesQ1 && q.tipo === 1);
  const q2 = quinc.find(q => q.mes === mesQ2 && q.tipo === 2);
  // La llave que desbloquea la Q2: la Q1 de su propio mes.
  const q1Periodo2 = quinc.find(q => q.mes === mesQ2 && q.tipo === 1);

  /* ----------------------------------------------------------
     v5.9.36 - ORDEN OBLIGADO AL ENTRAR AL MES NUEVO
     Al abrirse la ventana del 1 al 10 quedaban los DOS formularios
     abiertos: el de la 1ra del mes en curso y el de la 2da del mes
     ya cerrado. Asi era facil cargar la 1ra creyendo que se estaba
     cargando la 2da. Ahora, mientras la 2da del mes cerrado este
     pendiente, la 1ra queda en espera; se habilita sola apenas la
     2da queda registrada (o cuando la ventana se cierra).
     ---------------------------------------------------------- */
  const q2Lista = !!(q2 && q2.bloqueada);
  const q2SePuedeCargar = !!(q1Periodo2 && q1Periodo2.bloqueada) &&
    esDiaRegistroQ2() && mesQ2 !== mesQ1;
  const q1EnEspera = q2SePuedeCargar && !q2Lista && !(q1 && q1.bloqueada);
  const bQ1 = $('#bloqueQ1');
  const bQ2 = $('#bloqueQ2');
  const titQ1 = bQ1?.querySelector('.qb-title');
  const titQ2 = bQ2?.querySelector('.qb-title');
  if (titQ1) titQ1.textContent = `📅 1ra Quincena de ${nombreMes(mesQ1)}`;
  if (titQ2) titQ2.textContent = `📅 2da Quincena de ${nombreMes(mesQ2)}`;
  const fQ1 = $('#fechasQ1');
  const fQ2 = $('#fechasQ2');
  if (fQ1) fQ1.textContent = `Período: 01 al 15 de ${nombreMes(mesQ1)} · Pago día 20`;
  if (fQ2) {
    const cobro = fechasCobroQ2(mesQ2);
    const dd = f => f ? f.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '?';
    fQ2.textContent = `Período: 16 al ${diasDelMes(mesQ2)} de ${nombreMes(mesQ2)} · Se cobra al 5to día hábil de ${nombreMes(cobro.mesPago)} (${dd(cobro.pago)}) · Se descuenta de ${nombreMes(mesQ2)}`;
  }
  const aQ1 = $('#alertaQ1');
  const aQ2 = $('#alertaQ2');
  const fQ1f = $('#formQ1');
  const fQ2f = $('#formQ2');
  const btnQ1 = $('#btnQ1');
  const btnQ2 = $('#btnQ2');
  const tQ1 = $('#totalQ1');
  const tQ2 = $('#totalQ2');
  if (q1 && q1.bloqueada) {
    bQ1.classList.add('bloqueada');
    bQ1.classList.remove('deshabilitada');
    $('#badgeQ1').className = 'qb-badge bloqueada';
    $('#badgeQ1').textContent = '🔒 BLOQUEADA';
    aQ1.innerHTML = `<span>✅</span><span>Registrada ${fechaCorta(q1.fechaRegistro)}. No editable.</span>`;
    fQ1f.style.display = 'none';
    tQ1.style.display = 'flex';
    $('#totalQ1Value').textContent = fmt(q1.total);
    $('#q1o1').disabled = true;
    $('#q1o2').disabled = true;
    $('#q1o1').value = q1.oficial1;
    $('#q1o2').value = q1.oficial2;
  } else if (q1EnEspera) {
    // Primero la 2da del mes cerrado; esta se abre sola despues.
    bQ1.classList.add('deshabilitada');
    bQ1.classList.remove('bloqueada');
    $('#badgeQ1').className = 'qb-badge deshabilitada';
    $('#badgeQ1').textContent = 'EN ESPERA';
    aQ1.innerHTML = `<span>⏳</span><span>Primero registá la <strong>2da quincena de ${nombreMes(mesQ2)}</strong>. Apenas quede registrada se habilita esta <strong>1ra de ${nombreMes(mesQ1)}</strong>.</span>`;
    fQ1f.style.display = 'block';
    tQ1.style.display = 'none';
    $('#q1o1').value = '';
    $('#q1o2').value = '';
    $('#q1o1').disabled = true;
    $('#q1o2').disabled = true;
    if (btnQ1) btnQ1.disabled = true;
  } else {
    bQ1.classList.remove('bloqueada', 'deshabilitada');
    $('#badgeQ1').className = 'qb-badge pendiente';
    $('#badgeQ1').textContent = 'PENDIENTE';
    aQ1.innerHTML = `<span>⚠️</span><span>Una vez registrada quedará <strong>bloqueada permanentemente</strong>.</span>`;
    fQ1f.style.display = 'block';
    tQ1.style.display = 'none';
    $('#q1o1').disabled = false;
    $('#q1o2').disabled = false;
    if (btnQ1) btnQ1.disabled = false;
  }
  if (q2 && q2.bloqueada) {
    bQ2.classList.add('bloqueada');
    bQ2.classList.remove('deshabilitada');
    $('#badgeQ2').className = 'qb-badge bloqueada';
    $('#badgeQ2').textContent = '🔒 BLOQUEADA';
    aQ2.innerHTML = `<span>✅</span><span>Registrada ${fechaCorta(q2.fechaRegistro)}. No editable.</span>`;
    fQ2f.style.display = 'none';
    tQ2.style.display = 'flex';
    $('#totalQ2Value').textContent = fmt(q2.total);
    $('#q2o1').disabled = true;
    $('#q2o2').disabled = true;
    $('#q2o1').value = q2.oficial1;
    $('#q2o2').value = q2.oficial2;
  } else if (q1Periodo2 && q1Periodo2.bloqueada) {
    bQ2.classList.remove('deshabilitada', 'bloqueada');
    $('#badgeQ2').className = 'qb-badge pendiente';
    $('#badgeQ2').textContent = 'PENDIENTE';
    if (esDiaRegistroQ2()) {
      aQ2.innerHTML = q1EnEspera
        ? `<span>⚠️</span><span><strong>Es la que corresponde ahora.</strong> Quedará bloqueada permanentemente y recién ahí se habilita la <strong>1ra de ${nombreMes(mesQ1)}</strong>.</span>`
        : `<span>⚠️</span><span>Una vez registrada quedará <strong>bloqueada permanentemente</strong>.</span>`;
      fQ2f.style.display = 'block';
      tQ2.style.display = 'none';
      $('#q2o1').disabled = false;
      $('#q2o2').disabled = false;
      btnQ2.disabled = false;
    } else {
      aQ2.innerHTML = `<span>ℹ️</span><span>Se registra <strong>del 1 al ${Q2_DIA_LIMITE} del mes siguiente</strong> (la empresa paga 5 días hábiles después del cierre). Igual se descuenta de la producción de <strong>${nombreMes(mesQ2)}</strong>, no del mes en curso.</span>`;
      fQ2f.style.display = 'block';
      tQ2.style.display = 'none';
      $('#q2o1').disabled = true;
      $('#q2o2').disabled = true;
      btnQ2.disabled = true;
    }
  } else {
    bQ2.classList.add('deshabilitada');
    bQ2.classList.remove('bloqueada');
    $('#badgeQ2').className = 'qb-badge deshabilitada';
    $('#badgeQ2').textContent = 'BLOQUEADA';
    aQ2.innerHTML = `<span>⏳</span><span>Se habilita al registrar la <strong>1ra quincena de ${nombreMes(mesQ2)}</strong>.</span>`;
    fQ2f.style.display = 'block';
    tQ2.style.display = 'none';
    $('#q2o1').disabled = true;
    $('#q2o2').disabled = true;
    btnQ2.disabled = true;
  }
  const lst = $('#quiList');
  if (!lst) return;
  const hist = quinc.filter(q => q.bloqueada).sort((a, b) => a.mes !== b.mes ? b.mes.localeCompare(a.mes) : a.tipo - b.tipo);
  if (!hist.length) lst.innerHTML = '<div class="empty"><div class="ico">💰</div><p>Sin quincenas</p></div>';
  else lst.innerHTML = hist.map(q => `<div class="registro-item"><div class="ri-left"><div class="pat">💰 ${q.tipo === 1 ? '1ra' : '2da'} Q · ${nombreMes(q.mes)}</div><div class="fecha">O1: ${fmt(q.oficial1)} / O2: ${fmt(q.oficial2)} · ${fechaCorta(q.fechaRegistro)}</div></div><div class="ri-right"><div class="monto">${fmt(q.total)}</div></div></div>`).join('');
}
async function registrarQuincena(tipo) {
  const mes = mesActual();
  const mesQ = mesQuincenaActual();
  const leg = State.user.legajo;
  const mesReg = tipo === 1 ? mes : mesQ;
  const ex = await dbGetAll('quincenas');
  if (ex.find(q => q.legajo === leg && q.mes === mesReg && q.tipo === tipo)) { toast('Ya registrada', 'warn'); return; }
  if (tipo === 2 && !ex.find(q => q.legajo === leg && q.mes === mesReg && q.tipo === 1 && q.bloqueada)) { toast('Registrá primero la 1ra quincena', 'warn'); return; }
  if (tipo === 2 && !esDiaRegistroQ2()) { toast(`La Q2 se registra del 1 al ${Q2_DIA_LIMITE} del mes siguiente`, 'warn'); return; }
  // v5.9.36 - dentro de la ventana del mes nuevo va primero la 2da del mes
  // cerrado. Si no, es facil cargar la 1ra creyendo que se carga la 2da.
  if (tipo === 1 && esDiaRegistroQ2() && mesQ !== mes) {
    const q1Cerrado = ex.find(q => q.legajo === leg && q.mes === mesQ && q.tipo === 1 && q.bloqueada);
    const q2Cerrado = ex.find(q => q.legajo === leg && q.mes === mesQ && q.tipo === 2 && q.bloqueada);
    if (q1Cerrado && !q2Cerrado) {
      toast(`Registá primero la 2da quincena de ${nombreMes(mesQ)}`, 'warn');
      return;
    }
  }
  const o1 = parseFloat($(`#q${tipo}o1`).value) || 0;
  const o2 = parseFloat($(`#q${tipo}o2`).value) || 0;
  const tot = o1 + o2;
  if (tot <= 0) { toast('Ingresá montos', 'warn'); return; }
  const per = tipo === 1 ? '01 al 15' : `16 al ${diasDelMes(mesReg)}`;
  if (!await confirmDialog(`🔒 CONFIRMAR\n\n${tipo === 1 ? '1ra' : '2da'} Quincena de ${nombreMes(mesReg)}\nPeríodo: ${per}\n\nO1: ${fmt(o1)}\nO2: ${fmt(o2)}\nTotal: ${fmt(tot)}\n\n⚠️ Quedará BLOQUEADA. No editable.\n\n¿Confirmar?`)) return;
  try {
    const qData = { mes: mesReg, tipo, oficial1: o1, oficial2: o2, total: tot, fechaRegistro: hoy(), bloqueada: true, legajo: leg, creado: ahora() };
    qData.id = await dbAdd('quincenas', qData);
    toast(`${tipo === 1 ? '1ra' : '2da'} Q registrada y bloqueada`, 'success');
    renderQuincenas();
  } catch(e) { toast(e.name === 'ConstraintError' ? 'Ya registrada' : 'Error', 'error'); }
}
function setupQuincenas() {
  const f1 = $('#formQ1');
  const f2 = $('#formQ2');
  if (f1) f1.onsubmit = async e => { e.preventDefault(); await registrarQuincena(1); };
  if (f2) f2.onsubmit = async e => { e.preventDefault(); await registrarQuincena(2); };
}
async function handleChangePassword(e) {
  e.preventDefault();
  const current = $('#currentPass').value;
  const newPass = $('#newPass').value;
  const confirm = $('#confirmPass').value;
  if (newPass.length < 4) { toast('❌ La nueva clave debe tener al menos 4 caracteres', 'error'); return; }
  if (newPass !== confirm) { toast('❌ Las nuevas claves no coinciden', 'error'); return; }
  if (newPass === current) { toast('❌ La nueva clave tiene que ser distinta de la actual', 'error'); return; }

  const token = sessionStorage.getItem('baremo_admin_token') || '';
  let remotoOk = false;

  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify({ currentPassword: current, newPassword: newPass })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      if (data.token) sessionStorage.setItem('baremo_admin_token', data.token);
      remotoOk = true;
    } else {
      toast(`❌ ${data.error || 'No se pudo actualizar en el servidor'}`, 'error');
      return;
    }
  } catch (err) {
    console.warn('[Admin] Servidor no respondió al cambio de clave:', err.message);
  }

  await guardarCredencialAdmin(newPass, false);
  toast(remotoOk ? '✅ Clave Maestra actualizada en el servidor' : '✅ Contraseña actualizada localmente', 'success');
  $('#modalChangePassword').classList.remove('show');
  $('#formChangePassword').reset();
}

// ============================================================
// v5.9.39 - PIELES DE LA APP
// Tres identidades de color. Solo cambian variables CSS, asi que
// no hay riesgo de romper pantallas: la app entera se repinta sola.
// La eleccion queda en localStorage para que el proximo arranque
// (incluido el splash) ya salga con el color del usuario.
// ============================================================
const LS_PIEL = 'baremo_piel';
const PIELES = [
  { id: 'aurora',    nombre: 'Aurora',       desc: 'Indigo, violeta y cian electrico', g1: '#4338ca', g2: '#7c3aed', ac: '#22d3ee' },
  { id: 'esmeralda', nombre: 'Esmeralda',    desc: 'Verde petroleo con acento lima',   g1: '#0f766e', g2: '#10b981', ac: '#a3e635' },
  { id: 'grafito',   nombre: 'Grafito neon', desc: 'Oscuro con acento electrico',      g1: '#1f2937', g2: '#0b1120', ac: '#22d3ee' }
];

// ============================================================
// v5.9.39 - CAPTURAS DE LA GUIA, BLINDADAS
// Antes eran <img>: el navegador las abria en una pestana o mostraba su
// direccion al mantenerlas apretadas. Ahora son cajas con la captura de
// fondo, sin puntero y sin menu contextual, asi la ruta nunca queda a la
// vista ni se puede abrir el archivo suelto.
// ============================================================
function pintarCapturasAyuda() {
  document.querySelectorAll('.help-shot[data-shot]').forEach(el => {
    const ruta = el.getAttribute('data-shot');
    if (!ruta) return;
    el.style.backgroundImage = 'url("' + ruta + '")';
    el.removeAttribute('data-shot');
  });
}

function blindarCapturasAyuda() {
  pintarCapturasAyuda();
  const frenar = e => {
    const t = e.target;
    if (t && t.classList && t.classList.contains('help-shot')) e.preventDefault();
  };
  document.addEventListener('contextmenu', frenar);
  document.addEventListener('dragstart', frenar);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', blindarCapturasAyuda);
} else {
  blindarCapturasAyuda();
}

function pielActual() {
  const attr = document.documentElement.getAttribute('data-piel');
  if (PIELES.some(p => p.id === attr)) return attr;
  let g = null;
  try { g = localStorage.getItem(LS_PIEL); } catch (e) {}
  return PIELES.some(p => p.id === g) ? g : PIELES[0].id;
}

function aplicarPiel(id, avisar) {
  const p = PIELES.find(x => x.id === id) || PIELES[0];
  const raiz = document.documentElement;
  raiz.setAttribute('data-piel', p.id);
  raiz.className = (raiz.className || '').replace(/\bpiel-\w+\b/g, '').trim() + ' piel-' + p.id;
  try { localStorage.setItem(LS_PIEL, p.id); } catch (e) {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', p.g1);
  renderAjustes();
  pintarApariencia();
  // los graficos guardan los colores adentro del canvas: hay que repintarlos
  try { renderAll(); } catch (e) {}
  if (avisar) toast('Piel ' + p.nombre + ' activada', 'success');
}

// paleta de los graficos leida de la piel activa (con respaldo por si falla)
function paletaGraficos() {
  try {
    const cs = getComputedStyle(document.documentElement);
    const cols = [1, 2, 3, 4, 5, 6]
      .map(i => (cs.getPropertyValue('--chart-' + i) || '').trim())
      .filter(Boolean);
    if (cols.length === 6) return cols;
  } catch (e) {}
  return ['#4338ca', '#7c3aed', '#22d3ee', '#22a06b', '#f59e0b', '#94a3b8'];
}

function tarjetaPieles() {
  const act = pielActual();
  const activa = PIELES.find(p => p.id === act) || PIELES[0];
  const ops = PIELES.map(p => `
      <button type="button" class="piel-op${p.id === act ? ' activo' : ''}" data-piel="${p.id}" aria-label="Piel ${p.nombre}">
        <span class="piel-muestra" style="background:linear-gradient(135deg,${p.g1} 0%,${p.g2} 100%);--pm-ac:${p.ac}"></span>
        <span class="piel-nombre">${p.nombre}</span>
      </button>`).join('');
  return `
    <div class="piel-card apar-card">
      <div class="piel-head">
        <div class="piel-ico">🎨</div>
        <div>
          <div class="piel-title">${activa.nombre}</div>
          <div class="piel-desc">${activa.desc}</div>
        </div>
      </div>
      <div class="piel-grid">${ops}</div>
    </div>`;
}

/* ---------- v5.9.39: PANEL DE APARIENCIA ----------
   Antes Ajustes tenia dos filas de actualizacion y una tarjeta suelta de
   pieles. Ahora el boton del encabezado abre un solo panel con el modo
   claro/oscuro y las pieles juntos, y Ajustes queda liviano. */
function pintarApariencia() {
  const modos = $('#aparModos');
  const pieles = $('#aparPieles');
  if (!modos || !pieles) return;

  const act = (State.theme === 'dark') ? 'dark' : 'light';
  modos.innerHTML = MODOS_TEMA.map(m => `
    <button type="button" class="apar-modo${m.id === act ? ' activo' : ''}" data-modo="${m.id}" aria-pressed="${m.id === act}">
      <span class="apar-modo-ico">${m.ico}</span>
      <span class="apar-modo-txt">${m.nombre}</span>
      <span class="apar-modo-sub">${m.desc}</span>
    </button>`).join('');
  pieles.innerHTML = tarjetaPieles();

  modos.querySelectorAll('.apar-modo').forEach(b => {
    b.onclick = () => { if (b.dataset.modo !== act) setTheme(b.dataset.modo); };
  });
  pieles.querySelectorAll('.piel-op').forEach(b => {
    b.onclick = () => { if (b.dataset.piel !== pielActual()) aplicarPiel(b.dataset.piel, true); };
  });
}

function abrirApariencia() {
  const m = $('#modalApariencia');
  if (!m) { toggleTheme(); return; }   // respaldo: si falta el panel, al menos cambia el modo
  pintarApariencia();
  m.classList.add('show');
}

function cerrarApariencia() {
  const m = $('#modalApariencia');
  if (m) m.classList.remove('show');
}

function renderAjustes() {
  const lst = $('#ajustesList');
  if (!lst) return;
  lst.innerHTML = `
    <div class="ajuste-item" data-act="update"><div class="aj-ico">🔄</div><div class="aj-text"><div class="aj-title">Actualizaciones</div><div class="aj-desc">Tenés la v${State.currentVersion || '?'} · tocá para buscar una nueva</div><button type="button" class="aj-sub" data-sub="forzar">🧹 ¿Quedó trabada? Forzar actualización</button></div><div class="aj-arrow">›</div></div>
    <div class="ajuste-item" data-act="push"><div class="aj-ico">📡</div><div class="aj-text"><div class="aj-title">Notificaciones Push (Service Worker)</div><div class="aj-desc" id="ajPushDesc">Alertas de jornadas pendientes y avisos de empresa</div></div><div class="aj-arrow">›</div></div>
    <div class="ajuste-item" data-act="avisos"><div class="aj-ico">📢</div><div class="aj-text"><div class="aj-title">Avisos de la Empresa</div><div class="aj-desc">Comunicados oficiales y normativas de seguridad</div></div><div class="aj-arrow">›</div></div>
    <div class="ajuste-item" data-act="validar"><div class="aj-ico">🧮</div><div class="aj-text"><div class="aj-title">Validar totales del historial</div><div class="aj-desc">Recalcula jornadas que quedaron en $0</div></div><div class="aj-arrow">›</div></div>
    <div class="ajuste-item" data-act="baremo"><div class="aj-ico">📥</div><div class="aj-text"><div class="aj-title">Cargar Baremos actualizados</div><div class="aj-desc">Archivo JSON, Excel o CSV</div></div><div class="aj-arrow">›</div></div>
    <div class="ajuste-item" data-act="backup"><div class="aj-ico">💾</div><div class="aj-text"><div class="aj-title">Backup</div><div class="aj-desc">Guardá tus datos · te lo recordamos todos los lunes</div></div><div class="aj-arrow">›</div></div>
    <div class="ajuste-item" data-act="restore"><div class="aj-ico">📤</div><div class="aj-text"><div class="aj-title">Restaurar</div><div class="aj-desc">Recuperar datos</div></div><div class="aj-arrow">›</div></div>
    <div class="ajuste-item" data-act="notif"><div class="aj-ico">🔔</div><div class="aj-text"><div class="aj-title">Notificaciones Locales</div><div class="aj-desc" id="ajNotifDesc">Avisos de jornada y de inicio de mes</div></div><div class="aj-arrow">›</div></div>
    <div class="ajuste-item admin" data-act="admin"><div class="aj-ico">🛡️</div><div class="aj-text"><div class="aj-title">Panel de Supervisión</div><div class="aj-desc">Reportes consolidados, alertas y clave maestra</div></div><div class="aj-arrow">›</div></div>
    <div class="credits credits-min">
      <div class="credits-top">
        <span class="credits-emoji">🚀</span>
        <span class="credits-label">Desarrollado por</span>
        <span class="credits-author">Akapanch0</span>
        <span class="app-version">v${State.currentVersion || APP_VERSION}</span>
      </div>
      <details class="credits-legal">
        <summary>Aviso legal</summary>
        ${INFO_CONTENT.legal.html}
      </details>
    </div>
  `;
  pintarEstadoNotificaciones();
  if (typeof pintarEstadoPush === 'function') pintarEstadoPush();
  const sub = lst.querySelector('[data-sub="forzar"]');
  if (sub) sub.onclick = e => { e.stopPropagation(); forzarActualizacion(); };
  lst.querySelectorAll('.ajuste-item').forEach(item => {
    item.onclick = () => {
      const a = item.dataset.act;
      if (a === 'update') checkForUpdate();
      else if (a === 'push') {
        if (typeof abrirModalPushConfig === 'function') abrirModalPushConfig();
      }
      else if (a === 'avisos') {
        if (typeof abrirModalAvisosEmpresa === 'function') abrirModalAvisosEmpresa();
      }
      else if (a === 'validar') {
        repararTotalesDeJornadas({ verboso: true }).then(() => { renderAll(); });
      }
      else if (a === 'baremo') {
        const i = document.createElement('input');
        i.type = 'file';
        i.accept = '.json,.xlsx,.xls,.csv';
        i.onchange = e => updateBaremoFromFile(e.target.files[0]);
        i.click();
      }
      else if (a === 'backup') backup();
      else if (a === 'restore') restoreInput();
      else if (a === 'notif') activarNotificaciones();
      else if (a === 'admin') showView('Admin');
    };
  });
}

/* ============================================================
   FORZAR ACTUALIZACION (salida de emergencia)

   Para cuando se publico una version nueva y el telefono sigue
   mostrando la vieja. Limpia SOLO los archivos guardados en cache y
   da de baja el service worker, para que al recargar se bajen el
   index.html, el CSS y el JS nuevos desde el servidor.

   NO TOCA NINGUN DATO: jornadas, usuarios, baremo, combustible y
   quincenas viven en IndexedDB, que no se roza. Tampoco se toca la
   credencial de administrador. Es equivalente a vaciar la cache del
   navegador, nada mas.
   ============================================================ */
async function forzarActualizacion() {
  const ok = await confirmDialog(
    'Se van a volver a bajar los archivos de la app desde el servidor.\n\n'
    + 'Tus datos NO se tocan: jornadas, usuarios, combustible y quincenas quedan intactos.\n\n'
    + 'La app se va a reiniciar. ¿Continuamos?'
  );
  if (!ok) return;

  toast('Limpiando archivos guardados...', 'info');

  // 1) Se borran las caches de archivos de la app (nunca IndexedDB).
  try {
    if (window.caches && caches.keys) {
      const claves = await caches.keys();
      await Promise.all(
        claves
          .filter(k => /^baremos?[-_]/i.test(k))
          .map(k => caches.delete(k).catch(() => false))
      );
    }
  } catch (e) {}

  // 2) Se da de baja el service worker para que no siga sirviendo lo viejo.
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(() => false)));
    }
  } catch (e) {}

  // 3) Se olvida la version instalada, asi la proxima carga la redetecta.
  try { localStorage.removeItem(LS_VERSION_INSTALADA); } catch (e) {}

  toast('Listo. Reiniciando...', 'success');

  // 4) Recarga saltando la cache del navegador.
  setTimeout(() => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('nocache', String(Date.now()));
      window.location.replace(u.toString());
    } catch (e) {
      window.location.reload();
    }
  }, 900);
}

function restoreInput() {
  const i = document.createElement('input');
  i.type = 'file';
  i.accept = '.json';
  i.onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    // La restauracion FUSIONA: agrega lo que falta y actualiza lo que coincide.
    // Nunca borra lo que ya esta cargado en el dispositivo.
    if (!await confirmDialog('Se van a incorporar los datos del backup.\n\nLo que ya tenés cargado NO se borra: se agrega lo que falte y se actualizan los registros con el mismo identificador.\n\n¿Continuar?')) return;
    try {
      await importAllDB(JSON.parse(await f.text()));
      toast('Datos incorporados', 'success');
      setTimeout(() => location.reload(), 1000);
    } catch(e) { toast('Archivo inválido', 'error'); }
  };
  i.click();
}

async function renderAdmin() {
  await cargarUsuariosReporteAdmin();

  const fechaInput = $('#adminFecha');
  if (fechaInput && !fechaInput.value) fechaInput.value = hoy();
  actualizarLabelFecha();

  // Cargar estado en tiempo real del emisor push y comunicados remotos
  await cargarPanelAdminPush();
  await actualizarEstadoSyncNube();

  // Renderizar de inmediato el reporte multi-dispositivo consolidado
  await renderAdminReportesView();
}
function actualizarLabelFecha() {
  const label = $('#adminFechaLabel');
  const fechaInput = $('#adminFecha');
  const campoFecha = $('#adminCampoFecha');
  const campoQuincena = $('#adminCampoQuincena');
  if (!label || !fechaInput) return;

  if (State.adminReportType === 'diario') {
    if (campoFecha) campoFecha.style.display = 'block';
    if (campoQuincena) campoQuincena.style.display = 'none';
    label.textContent = '📅 Fecha del reporte';
    fechaInput.type = 'date';
  } else if (State.adminReportType === 'semanal') {
    if (campoFecha) campoFecha.style.display = 'block';
    if (campoQuincena) campoQuincena.style.display = 'none';
    label.textContent = '📆 Fecha de la semana';
    fechaInput.type = 'date';
  } else if (State.adminReportType === 'quincenal') {
    if (campoFecha) campoFecha.style.display = 'block';
    if (campoQuincena) campoQuincena.style.display = 'block';
    label.textContent = '🗓️ Mes de la quincena';
    fechaInput.type = 'month';
    if (fechaInput.value && fechaInput.value.length === 10) fechaInput.value = fechaInput.value.slice(0, 7);
  } else if (State.adminReportType === 'mensual') {
    if (campoFecha) campoFecha.style.display = 'block';
    if (campoQuincena) campoQuincena.style.display = 'none';
    label.textContent = '🗓️ Mes del reporte';
    fechaInput.type = 'month';
    if (fechaInput.value && fechaInput.value.length === 10) fechaInput.value = fechaInput.value.slice(0, 7);
  } else {
    // 'todos' / histórico
    if (campoFecha) campoFecha.style.display = 'none';
    if (campoQuincena) campoQuincena.style.display = 'none';
  }
}

function setupAdmin() {
  const btnLogin = $('#btnAdminLogin');
  const btnLogout = $('#btnAdminLogout');
  const btnChangePassword = $('#btnChangePassword');
  const cancelChangePass = $('#cancelChangePass');
  if (btnLogin) {
    btnLogin.onclick = async () => {
      const pass = $('#adminPassword').value.trim();
      if (!pass) { toast('❌ Ingresá la Clave Maestra', 'error'); return; }

      btnLogin.disabled = true;
      let r;
      try {
        r = await verificarPasswordAdmin(pass);
      } catch (e) {
        btnLogin.disabled = false;
        toast('❌ No se pudo verificar la Clave Maestra', 'error');
        return;
      }
      btnLogin.disabled = false;

      // Instalacion nueva: no hay clave definida todavía. La primera que
      // se escribe queda registrada como la de supervisión de este equipo.
      if (r.sinCredencial) {
        if (pass.length < 6) {
          toast('🔐 Definí la Clave Maestra de supervisión (mínimo 6 caracteres)', 'info');
          return;
        }
        if (!await confirmDialog('No hay Clave Maestra de supervisión en este equipo.\n\n¿Querés usar la que acabas de escribir como Clave Maestra definitiva?')) return;
        await guardarCredencialAdmin(pass, false);
        State.adminLoggedIn = true;
        sessionStorage.setItem('baremo_admin_pass', pass);
        $('#adminLogin').style.display = 'none';
        $('#adminPanel').style.display = 'block';
        $('#adminPassword').value = '';
        toast('✅ Clave Maestra de supervisión creada', 'success');
        await renderAdmin();
        return;
      }

      if (!r.ok) { toast('❌ Clave Maestra incorrecta', 'error'); return; }

      State.adminLoggedIn = true;
      sessionStorage.setItem('baremo_admin_pass', pass);
      $('#adminLogin').style.display = 'none';
      $('#adminPanel').style.display = 'block';
      $('#adminPassword').value = '';
      toast('✅ Acceso a Panel de Supervisión concedido', 'success');
      await renderAdmin();

      // Si requería cambio de clave inicial:
      if (r.debeCambiar) {
        setTimeout(() => {
          toast('⚠️ Por seguridad, definí una Clave Maestra personalizada.', 'warn');
          const m = $('#modalChangePassword');
          if (m) m.classList.add('show');
        }, 600);
      }
    };
    $('#adminPassword').addEventListener('keydown', e => {
      if (e.key === 'Enter') btnLogin.click();
    });
  }
  if (btnLogout) {
    btnLogout.onclick = () => {
      State.adminLoggedIn = false;
      sessionStorage.removeItem('baremo_admin_token');
      sessionStorage.removeItem('baremo_admin_pass');
      $('#adminLogin').style.display = 'block';
      $('#adminPanel').style.display = 'none';
      $('#adminPassword').value = '';
      toast('Sesión de supervisión cerrada', 'info');
    };
  }
  if (btnChangePassword) {
    btnChangePassword.onclick = () => {
      $('#modalChangePassword').classList.add('show');
    };
  }
  if (cancelChangePass) {
    cancelChangePass.onclick = () => {
      $('#modalChangePassword').classList.remove('show');
      $('#formChangePassword').reset();
    };
  }
  const formChange = $('#formChangePassword');
  if (formChange) formChange.onsubmit = handleChangePassword;
  $$('#adminReportType button').forEach(btn => {
    btn.onclick = () => {
      $$('#adminReportType button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.adminReportType = btn.dataset.type;
      actualizarLabelFecha();
      renderAdminReportesView();
    };
  });

  const btnRefrescarNube = $('#btnRefrescarDatosNube');
  if (btnRefrescarNube) {
    btnRefrescarNube.onclick = async () => {
      btnRefrescarNube.disabled = true;
      btnRefrescarNube.textContent = '🔄 Consultando...';
      try {
        await cargarUsuariosReporteAdmin();
        await actualizarEstadoSyncNube();
        await renderAdminReportesView();
        toast('☁️ Reportes consolidados actualizados desde la nube', 'success');
      } catch (err) {
        toast('Error al consultar nube: ' + err.message, 'error');
      } finally {
        btnRefrescarNube.disabled = false;
        btnRefrescarNube.textContent = '🔄 Actualizar Nube';
      }
    };
  }

  const btnDescargarNube = $('#btnDescargarNubeLocal');
  if (btnDescargarNube) {
    btnDescargarNube.onclick = async () => {
      btnDescargarNube.disabled = true;
      btnDescargarNube.textContent = '⏳ Descargando...';
      try {
        const res = await fetchAdminAPI('/api/sync/descargar-todas');
        if (!res.ok) throw new Error('Error al conectar con servidor');
        const json = await res.json();
        if (!json.ok || !Array.isArray(json.jornadas)) throw new Error(json.error || 'Respuesta inválida');
        
        let guardadas = 0;
        for (const j of json.jornadas) {
          try {
            await dbPut('jornadas', j);
            guardadas++;
          } catch (e) {}
        }
        await cargarUsuariosReporteAdmin();
        await actualizarEstadoSyncNube();
        await renderAdminReportesView();
        toast(`✅ Se sincronizaron ${guardadas} jornadas de la nube a este equipo`, 'success');
      } catch (err) {
        toast(`❌ Error al descargar: ${err.message}`, 'error');
      } finally {
        btnDescargarNube.disabled = false;
        btnDescargarNube.textContent = '📥 Traer Nube a Este Equipo';
      }
    };
  }

  const btnSyncAhora = $('#btnSincronizarAhora');
  if (btnSyncAhora) {
    btnSyncAhora.onclick = async () => {
      btnSyncAhora.disabled = true;
      btnSyncAhora.textContent = '☁️ Subiendo...';
      try {
        await sincronizarJornadasAlServidor();
        await cargarUsuariosReporteAdmin();
        await actualizarEstadoSyncNube();
        await renderAdminReportesView();
        toast('☁️ Tus jornadas cerradas se subieron con éxito a la nube', 'success');
      } catch (err) {
        toast('Error al subir: ' + err.message, 'error');
      } finally {
        btnSyncAhora.disabled = false;
        btnSyncAhora.textContent = '☁️ Subir Mis Datos';
      }
    };
  }

  const selAdminUser = $('#adminUsuario');
  if (selAdminUser) selAdminUser.onchange = () => renderAdminReportesView();
  const selAdminEstado = $('#adminEstadoJornada');
  if (selAdminEstado) selAdminEstado.onchange = () => renderAdminReportesView();
  const selAdminFecha = $('#adminFecha');
  if (selAdminFecha) selAdminFecha.onchange = () => renderAdminReportesView();
  const selAdminQuincena = $('#adminQuincenaSel');
  if (selAdminQuincena) selAdminQuincena.onchange = () => renderAdminReportesView();

  $('#btnExportAllData').onclick = async () => {
    const legajo = State.user.legajo;
    const nombre = State.user.nombre;
    const todasJornadas = await dbGetAll('jornadas');
    const jornadasUsuario = todasJornadas.filter(j => j.legajo === legajo);
    const data = {
      version: State.currentVersion || APP_VERSION,
      exportDate: ahora(),
      usuario: { legajo, nombre },
      jornadas: jornadasUsuario,
      totalJornadas: jornadasUsuario.length,
      totalProduccion: jornadasUsuario.reduce((a, j) => a + (j.total || 0), 0)
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `datos_${legajo}_${nombre.replace(/ /g, '_')}_${hoy()}.json`;
    a.click();
    URL.revokeObjectURL(u);
    toast('Datos exportados', 'success');
  };
  $('#btnImportData').onclick = () => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = '.json';
    i.multiple = true;
    i.onchange = async (ev) => {
      const files = Array.from(ev.target.files);
      if (!files.length) return;
      let totalImportado = 0;
      let totalJornadas = 0;
      for (const file of files) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (!data.jornadas || !Array.isArray(data.jornadas)) {
            toast(`Archivo inválido: ${file.name}`, 'error');
            continue;
          }
          const usuario = data.usuario || { legajo: 'desconocido', nombre: 'Desconocido' };
          const jornadasExistentes = await dbGetAll('jornadas');
          const idsExistentes = new Set(jornadasExistentes.map(j => j.id));
          let importadas = 0;
          for (const jornada of data.jornadas) {
            if (!idsExistentes.has(jornada.id)) {
              await dbAdd('jornadas', jornada);
              importadas++;
            }
          }
          totalImportado++;
          totalJornadas += importadas;
          toast(`✅ ${usuario.nombre}: ${importadas} jornadas importadas`, 'success');
        } catch (err) {
          toast(`Error en ${file.name}: ${err.message}`, 'error');
        }
      }
      if (totalImportado > 0) {
        toast(`🎉 Consolidación: ${totalJornadas} jornadas de ${totalImportado} usuarios`, 'success');
        await renderAdmin();
      }
    };
    i.click();
  };
  $('#btnAdminPreview').onclick = async () => {
    await renderAdminReportesView();
    toast('✓ Reportes consolidados actualizados', 'success');
  };
  $('#btnAdminPDF').onclick = async () => {
    if (!window.jspdf) { toast('jsPDF no disponible', 'error'); return; }
    const { datos, periodoLabel, fechaDesde, fechaHasta, tipo } = await obtenerDatosReporteAdmin();
    if (!datos.length) { toast('Sin datos para el período', 'warn'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    drawElegantHeader(doc, "REPORTE ADMINISTRATIVO", periodoLabel, "BAREMO", `Generado: ${fechaCorta(hoy())}`);
    
    const totalProduccion = datos.reduce((a, d) => a + (Number(d.total) || Number(d.totalEnCurso) || 0), 0);
    const totalItems = datos.reduce((a, d) => a + (Number(d.cantidadItems) || (Array.isArray(d.items) ? d.items.length : 0) || 0), 0);
    const usuariosUnicos = [...new Set(datos.map(d => d.legajo))].length;
    
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text('Resumen Ejecutivo', 14, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`• Total jornadas: ${datos.length}`, 14, 55);
    doc.text(`• Usuarios: ${usuariosUnicos}`, 14, 61);
    doc.text(`• Ítems totales: ${totalItems}`, 14, 67);
    doc.text(`• Producción total: ${fmt(totalProduccion)}`, 14, 73);
    
    const body = datos.map((d, i) => [
      i + 1,
      fechaCorta(d.fecha),
      d.nombreUsuario,
      d.legajo,
      d.zona,
      d.cantidadRegistros || (Array.isArray(d.tareas) ? d.tareas.length : 0) || 0,
      d.cantidadItems || (Array.isArray(d.items) ? d.items.length : 0) || 0,
      fmt(Number(d.total) || Number(d.totalEnCurso) || 0)
    ]);
    doc.autoTable({
      startY: 80,
      head: [['#', 'Fecha', 'Usuario', 'Legajo', 'Zona', 'Regs', 'Ítems', 'Total']],
      body,
      theme: 'grid',
      styles: { fontSize: 7 },
      headStyles: { fillColor: [11, 61, 145], fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8 }, 1: { cellWidth: 20 }, 2: { cellWidth: 35 }, 3: { cellWidth: 15 },
        4: { cellWidth: 25 }, 5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 12, halign: 'center' }, 7: { cellWidth: 25, halign: 'right' }
      }
    });
    
    const usuariosAgrupados = {};
    datos.forEach(d => {
      if (!usuariosAgrupados[d.legajo]) usuariosAgrupados[d.legajo] = { nombre: d.nombreUsuario, jornadas: [] };
      usuariosAgrupados[d.legajo].jornadas.push(d);
    });
    for (const [leg, info] of Object.entries(usuariosAgrupados)) {
      doc.addPage();
      drawElegantHeader(doc, "DETALLE POR USUARIO", `${info.nombre} (Legajo ${leg})`, "BAREMO", periodoLabel);
      
      let currentY = 45;
      for (const jornada of info.jornadas) {
        if (currentY > 250) { 
            doc.addPage(); 
            drawElegantHeader(doc, "DETALLE POR USUARIO (Cont.)", `${info.nombre} (Legajo ${leg})`, "BAREMO", periodoLabel);
            currentY = 45; 
        }
        doc.setFillColor(240, 243, 249);
        doc.rect(14, currentY, 182, 8, 'F');
        doc.setTextColor(11, 61, 145);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`▶ Jornada ${fechaLegible(jornada.fecha)} - Total: ${fmt(jornada.total || 0)}`, 16, currentY + 6);
        currentY += 10;
        
        const detalle = (jornada.items || []).map((it, idx) => [idx + 1, it.codigo, it.descripcion, it.cantidad, fmt(it.precio), fmt(it.subtotal)]);
        doc.autoTable({
          startY: currentY,
          head: [['#', 'Código', 'Descripción', 'Cant', 'Precio', 'Subtotal']],
          body: detalle,
          theme: 'striped',
          styles: { fontSize: 6 },
          headStyles: { fillColor: [37, 99, 201], fontSize: 6 },
          columnStyles: {
            0: { cellWidth: 8 }, 1: { cellWidth: 18 }, 2: { cellWidth: 75 },
            3: { cellWidth: 12, halign: 'center' }, 4: { cellWidth: 22, halign: 'right' },
            5: { cellWidth: 22, halign: 'right' }
          },
          margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 6;
      }
    }
    const fileName = `reporte_${tipo}_${fechaDesde}_${fechaHasta}.pdf`.replace(/ /g, '_');
    doc.save(fileName);
    avisarPDFGenerado(`${tipo} con ${datos.length} jornada(s)`);
  };
  $('#btnAdminExcel').onclick = async () => {
    if (!window.XLSX) { toast('XLSX no disponible', 'error'); return; }
    const { datos, fechaDesde, fechaHasta, tipo } = await obtenerDatosReporteAdmin();
    if (!datos.length) { toast('Sin datos para el período', 'warn'); return; }
    const wb = XLSX.utils.book_new();
    const resumen = datos.map((d, i) => ({
      '#': i + 1,
      Fecha: fechaCorta(d.fecha),
      Usuario: d.nombreUsuario,
      Legajo: d.legajo,
      Zona: d.zona,
      Estado: d.cerrada ? 'Cerrada' : 'En Curso',
      Registros: d.cantidadRegistros || (Array.isArray(d.tareas) ? d.tareas.length : 0) || 0,
      Ítems: d.cantidadItems || (Array.isArray(d.items) ? d.items.length : 0) || 0,
      Total: Number(d.total) || Number(d.totalEnCurso) || 0,
      ATS: d.ats ? (d.ats.ot ? `OT ${d.ats.ot}` : 'Firmado') : 'No'
    }));
    resumen.push({});
    resumen.push({
      Fecha: 'TOTAL',
      Total: datos.reduce((a, d) => a + (Number(d.total) || Number(d.totalEnCurso) || 0), 0)
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');
    const usuariosAgrupados = {};
    datos.forEach(d => {
      if (!usuariosAgrupados[d.legajo]) usuariosAgrupados[d.legajo] = { nombre: d.nombreUsuario, jornadas: [] };
      usuariosAgrupados[d.legajo].jornadas.push(d);
    });
    for (const [leg, info] of Object.entries(usuariosAgrupados)) {
      const detalle = [];
      for (const jornada of info.jornadas) {
        detalle.push({ Fecha: fechaCorta(jornada.fecha), Tipo: 'ENCABEZADO', Total: jornada.total || 0 });
        (jornada.items || []).forEach((it, idx) => {
          detalle.push({
            '#': idx + 1, Código: it.codigo, Descripción: it.descripcion,
            Precio: it.precio, Cantidad: it.cantidad, Subtotal: it.subtotal
          });
        });
        detalle.push({});
      }
      const sheetName = `${leg}_${info.nombre}`.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), sheetName);
    }
    const fileName = `reporte_${tipo}_${fechaDesde}_${fechaHasta}.xlsx`.replace(/ /g, '_');
    XLSX.writeFile(wb, fileName);
    toast(`Reporte Excel generado: ${datos.length} jornadas`, 'success');
  };

  setupAdminPushEvents();
}

/* ============================================================
   PANEL DE CONTROL REMOTO DE PUSH Y COMUNICADOS (ADMIN)
   ============================================================ */
function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* Helper universal para peticiones al servidor que requieren privilegios de Administrador / Supervisión */
async function fetchAdminAPI(url, options = {}) {
  let token = sessionStorage.getItem('baremo_admin_token') || localStorage.getItem('baremo_admin_token') || '';
  let pass = sessionStorage.getItem('baremo_admin_pass') || localStorage.getItem('baremo_admin_pass') || '';
  const headers = Object.assign({}, options.headers || {}, {
    'x-admin-token': token,
    'x-admin-password': pass
  });
  let res = await fetch(url, Object.assign({}, options, { headers }));
  if (res.status === 401 && pass) {
    try {
      const loginRes = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });
      if (loginRes.ok) {
        const d = await loginRes.json();
        if (d && d.token) {
          sessionStorage.setItem('baremo_admin_token', d.token);
          localStorage.setItem('baremo_admin_token', d.token);
          headers['x-admin-token'] = d.token;
          res = await fetch(url, Object.assign({}, options, { headers }));
        }
      }
    } catch (e) {}
  }
  return res;
}

/* Carga las cuadrillas y usuarios disponibles para reportes remotos y locales */
async function cargarUsuariosReporteAdmin() {
  const sel = $('#adminUsuario');
  if (!sel) return;

  const prevVal = sel.value || 'todos';

  // 1. Obtener usuarios locales
  const usuariosLocales = await dbGetAll('usuarios');
  const mapaUsuarios = new Map();
  usuariosLocales.forEach(u => {
    if (u && u.legajo) {
      mapaUsuarios.set(String(u.legajo), {
        legajo: String(u.legajo),
        nombre: u.nombre || 'Operario',
        zona: u.zona || '',
        origen: 'local'
      });
    }
  });

  // 2. Obtener cuadrillas registradas en el servidor remoto
  try {
    const res = await fetchAdminAPI('/api/admin/reportes/usuarios');
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.usuarios)) {
        data.usuarios.forEach(u => {
          if (u && u.legajo) {
            const key = String(u.legajo);
            const ya = mapaUsuarios.get(key);
            mapaUsuarios.set(key, {
              legajo: key,
              nombre: u.nombre || ya?.nombre || 'Operario Remoto',
              zona: u.zona || ya?.zona || '',
              totalJornadas: u.totalJornadas || 0,
              origen: ya ? 'sincronizado' : 'nube'
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn('[Admin Reportes] No se pudo consultar usuarios remotos:', err);
  }

  // 3. Reconstruir el selector
  sel.innerHTML = '<option value="todos">👥 Todas las cuadrillas (Reporte Consolidado)</option>';
  const listaOrdenada = Array.from(mapaUsuarios.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));

  for (const u of listaOrdenada) {
    const opt = document.createElement('option');
    opt.value = u.legajo;
    const extra = u.zona ? ` · ${u.zona}` : '';
    opt.textContent = `${u.nombre} (${u.legajo})${extra}`;
    sel.appendChild(opt);
  }

  // Restaurar valor previo si existe
  if (Array.from(sel.options).some(o => o.value === prevVal)) {
    sel.value = prevVal;
  } else {
    sel.value = 'todos';
  }
}

/* Actualiza las etiquetas de sincronización en la nube en el panel de reporte */
async function actualizarEstadoSyncNube() {
  const badge = $('#adminSyncStatusBadge') || $('#adminSyncEstadoBadge');
  const countSpan = $('#adminSyncInfo') || $('#adminSyncTotalJornadas');
  const lastSyncSpan = $('#adminSyncUltimaHora');

  try {
    const res = await fetch('/api/sync/estado');
    if (res.ok) {
      const d = await res.json();
      if (d.ok) {
        if (badge) {
          badge.textContent = `☁️ ${d.totalUsuarios} Cuadrillas Conectadas`;
          badge.style.background = 'rgba(22, 163, 74, 0.15)';
          badge.style.color = '#16a34a';
        }
        if (countSpan) {
          countSpan.textContent = `${d.totalJornadas} jornadas en servidor (${d.totalCerradas || d.totalJornadas} cerradas · ${d.totalAbiertas || 0} en curso)`;
        }
        if (lastSyncSpan) {
          const ahoraHora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          lastSyncSpan.textContent = `Actualizado ${ahoraHora}`;
        }
        return d;
      }
    }
  } catch (e) {
    // offline
  }

  if (badge) {
    badge.textContent = '☁️ Nube local / sin conexión';
    badge.style.background = 'rgba(100, 116, 139, 0.15)';
    badge.style.color = 'var(--text-soft)';
  }
  if (countSpan) {
    countSpan.textContent = 'Modo local: visualizando registros almacenados en este dispositivo';
  }
}

async function cargarPanelAdminPush() {
  const badge = $('#adminPushSubscribersBadge');
  const trayCount = $('#trayDispositivosCount');
  const trayList = $('#trayDispositivosList');
  const avisosCount = $('#adminAvisosCount');
  const avisosList = $('#adminAvisosList');
  const selDest = $('#adminPushDestinatario');

  try {
    const res = await fetchAdminAPI('/api/admin/push/stats');

    if (!res.ok) {
      if (res.status === 401) {
        console.warn('[Admin Push] Sesión administrativa expirada o no autenticada.');
      }
      return;
    }

    const data = await res.json();
    if (!data || !data.ok) return;

    // 1. Contador de dispositivos conectados en tiempo real
    if (badge) {
      badge.textContent = `📱 ${data.totalSuscriptores} celular${data.totalSuscriptores === 1 ? '' : 'es'} conectado${data.totalSuscriptores === 1 ? '' : 's'}`;
      if (data.totalSuscriptores > 0) {
        badge.classList.add('success');
      } else {
        badge.classList.remove('success');
      }
    }
    if (trayCount) {
      trayCount.textContent = `${data.totalSuscriptores} activos`;
    }

    // 2. Desplegable de celulares conectados
    if (trayList) {
      if (!data.dispositivos || data.dispositivos.length === 0) {
        trayList.innerHTML = '<div style="color:var(--text-soft);font-size:11px;padding:6px 0;">No hay celulares conectados aún. Las cuadrillas se vinculan automáticamente desde <em>Ajustes > Notificaciones Push</em> en cada dispositivo.</div>';
      } else {
        trayList.innerHTML = data.dispositivos.map(d => `
          <div class="admin-device-row">
            <div>
              <strong style="color:var(--text);">👤 Legajo ${escapeHTML(d.legajo)}</strong>
              <span style="color:var(--text-soft);margin-left:6px;">${escapeHTML(d.nombre)}</span>
            </div>
            <div style="font-size:10.5px;color:var(--text-soft);display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--success);"></span>
              <span>${escapeHTML(d.endpointCorto)}</span>
            </div>
          </div>
        `).join('');
      }
    }

    // 3. Población dinámica de destinatarios
    if (selDest) {
      const valorPrevio = selDest.value;
      selDest.innerHTML = '<option value="todos">👥 A todas las cuadrillas (Broadcast)</option>';
      const legajosAgregados = new Set();
      (data.dispositivos || []).forEach(d => {
        if (d.legajo && d.legajo !== 'Sin legajo' && !legajosAgregados.has(d.legajo)) {
          legajosAgregados.add(d.legajo);
          const opt = document.createElement('option');
          opt.value = d.legajo;
          opt.textContent = `👤 Legajo ${d.legajo} · ${d.nombre}`;
          selDest.appendChild(opt);
        }
      });
      try {
        const usuariosLocales = await dbGetAll('usuarios');
        for (const u of usuariosLocales) {
          if (u.legajo && !legajosAgregados.has(u.legajo)) {
            legajosAgregados.add(u.legajo);
            const opt = document.createElement('option');
            opt.value = u.legajo;
            opt.textContent = `👤 Legajo ${u.legajo} · ${u.nombre}`;
            selDest.appendChild(opt);
          }
        }
      } catch (e) {}
      if (valorPrevio && [...selDest.options].some(o => o.value === valorPrevio)) {
        selDest.value = valorPrevio;
      }
    }

    // 4. Lista de Comunicados Activos en el Servidor Central
    const avisos = data.avisos || [];
    if (avisosCount) {
      avisosCount.textContent = `(${avisos.length} comunicado${avisos.length === 1 ? '' : 's'})`;
    }

    if (avisosList) {
      if (avisos.length === 0) {
        avisosList.innerHTML = '<div style="text-align:center;color:var(--text-soft);font-size:12px;padding:16px;">No hay comunicados activos en el servidor.</div>';
      } else {
        avisosList.innerHTML = avisos.map(a => {
          const esAlta = a.prioridad === 'alta';
          const badgePrio = esAlta
            ? '<span style="background:rgba(239,68,68,0.15);color:#ef4444;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">🔴 ALTA</span>'
            : '<span style="background:rgba(234,179,8,0.15);color:#ca8a04;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">🟡 NORMAL</span>';

          const destInfo = (a.destinatario && a.destinatario !== 'todos')
            ? `<span style="font-size:10px;background:rgba(99,102,241,0.12);color:var(--primary);padding:2px 6px;border-radius:4px;">👤 Legajo: ${escapeHTML(a.destinatario)}</span>`
            : '<span style="font-size:10px;background:rgba(128,128,128,0.12);color:var(--text-soft);padding:2px 6px;border-radius:4px;">👥 Todas las cuadrillas</span>';

          const fechaFormateada = a.fecha ? (typeof fechaCorta === 'function' ? fechaCorta(a.fecha.slice(0, 10)) : a.fecha.slice(0, 10)) : '';

          return `
            <div class="admin-aviso-item" data-aviso-id="${a.id}">
              <div class="admin-aviso-item-header">
                <div style="font-weight:700;font-size:12.5px;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span>${escapeHTML(a.titulo)}</span>
                  ${badgePrio}
                  ${destInfo}
                </div>
                <span style="font-size:10.5px;color:var(--text-soft);white-space:nowrap;">${fechaFormateada}</span>
              </div>
              <div style="font-size:11.5px;color:var(--text-soft);line-height:1.4;">
                ${escapeHTML(a.cuerpo)}
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(128,128,128,0.1);padding-top:6px;margin-top:2px;">
                <span style="font-size:10.5px;color:var(--text-soft);">✍️ ${escapeHTML(a.autor || 'Supervisión')} · 🏷️ ${escapeHTML(a.categoria || 'General')}</span>
                <div class="admin-aviso-actions">
                  <button type="button" class="btn btn-ghost btn-xs btn-reenviar-push" data-id="${a.id}" title="Reenviar Push a todos los celulares" style="padding:3px 8px;font-size:11px;color:var(--primary);border:1px solid rgba(99,102,241,0.3);">
                    🔁 Reenviar
                  </button>
                  <button type="button" class="btn btn-ghost btn-xs btn-eliminar-aviso" data-id="${a.id}" title="Eliminar del servidor central" style="padding:3px 8px;font-size:11px;color:var(--danger);border:1px solid rgba(239,68,68,0.3);">
                    🗑️ Borrar
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Listeners para Reenviar y Eliminar
        avisosList.querySelectorAll('.btn-reenviar-push').forEach(btn => {
          btn.onclick = async () => {
            const id = btn.dataset.id;
            const targetAviso = avisos.find(x => x.id === id);
            if (!targetAviso) return;
            if (!await confirmDialog(`¿Reenviar notificación push de "${targetAviso.titulo}" a todos los celulares ahora mismo?`)) return;
            await enviarPushRemoto({
              tipo: 'aviso_empresa',
              titulo: targetAviso.titulo,
              cuerpo: targetAviso.cuerpo,
              prioridad: targetAviso.prioridad,
              categoria: targetAviso.categoria,
              destinatario: targetAviso.destinatario || 'todos',
              crearAviso: false,
              enviarPush: true
            });
          };
        });

        avisosList.querySelectorAll('.btn-eliminar-aviso').forEach(btn => {
          btn.onclick = async () => {
            const id = btn.dataset.id;
            const targetAviso = avisos.find(x => x.id === id);
            const titulo = targetAviso ? targetAviso.titulo : 'este comunicado';
            if (!await confirmDialog(`¿Eliminar "${titulo}" del servidor central?\n\nDesaparecerá automáticamente del carrusel de todos los celulares.`)) return;
            await eliminarAvisoRemoto(id);
          };
        });
      }
    }
  } catch (err) {
    console.error('[Admin Push] Error cargando stats:', err);
  }
}

let adminPushEventsInitialized = false;
function setupAdminPushEvents() {
  if (adminPushEventsInitialized) return;
  adminPushEventsInitialized = true;

  const btnSubmit = $('#btnAdminPushSubmit');
  const btnRefresh = $('#btnAdminPushRefresh');
  const btnToggle = $('#btnToggleDispositivos');
  const selTipo = $('#adminPushTipo');
  const inpTitulo = $('#adminPushTitulo');
  const txtMensaje = $('#adminPushMensaje');
  const selCat = $('#adminPushCategoria');
  const selPrio = $('#adminPushPrioridad');
  const selDest = $('#adminPushDestinatario');
  const chkPush = $('#adminPushCheckPush');
  const chkAviso = $('#adminPushCheckAviso');
  const statusMsg = $('#adminPushStatusMsg');

  // Toggle bandeja de celulares
  if (btnToggle) {
    btnToggle.onclick = () => {
      const tray = $('#trayDispositivos');
      if (!tray) return;
      const visible = tray.style.display !== 'none';
      tray.style.display = visible ? 'none' : 'block';
      btnToggle.textContent = visible ? '👥 Ver celulares' : '🔼 Ocultar';
    };
  }

  // Refrescar estado del servidor
  if (btnRefresh) {
    btnRefresh.onclick = () => {
      toast('🔄 Actualizando estado del servidor...', 'info');
      cargarPanelAdminPush();
    };
  }

  // Plantillas Rápidas
  $$('#adminTemplateGrid button').forEach(btn => {
    btn.onclick = () => {
      const tpl = btn.dataset.tpl;
      aplicarPlantillaAdminPush(tpl);
    };
  });

  // Selector de Tipo de Notificación
  if (selTipo) {
    selTipo.onchange = () => {
      const t = selTipo.value;
      if (t === 'jornada_pendiente') aplicarPlantillaAdminPush('jornada');
      else if (t === 'ats_pendiente') aplicarPlantillaAdminPush('ats');
      else if (t === 'seguridad_urgente') aplicarPlantillaAdminPush('seguridad');
      else if (t === 'clima_tormenta') aplicarPlantillaAdminPush('tormenta');
      else if (t === 'aviso_empresa') aplicarPlantillaAdminPush('comunicado');
    };
  }

  // Enviar Notificación Remota
  if (btnSubmit) {
    btnSubmit.onclick = async () => {
      const titulo = (inpTitulo ? inpTitulo.value : '').trim();
      const cuerpo = (txtMensaje ? txtMensaje.value : '').trim();
      const tipo = selTipo ? selTipo.value : 'aviso_empresa';
      const categoria = selCat ? selCat.value : 'Seguridad';
      const prioridad = selPrio ? selPrio.value : 'alta';
      const destinatario = selDest ? selDest.value : 'todos';
      const enviarPush = chkPush ? chkPush.checked : true;
      const crearAviso = chkAviso ? chkAviso.checked : true;

      if (!titulo) {
        toast('❌ Ingresá un título para la notificación', 'error');
        if (inpTitulo) inpTitulo.focus();
        return;
      }
      if (!cuerpo) {
        toast('❌ Ingresá el mensaje o instrucciones para las cuadrillas', 'error');
        if (txtMensaje) txtMensaje.focus();
        return;
      }
      if (!enviarPush && !crearAviso) {
        toast('⚠️ Seleccioná al menos Enviar Push o Publicar en Carrusel', 'warn');
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = '⏳ Emitiendo a los celulares conectados...';

      try {
        const res = await enviarPushRemoto({
          tipo,
          titulo,
          cuerpo,
          categoria,
          prioridad,
          destinatario,
          enviarPush,
          crearAviso
        });

        if (res && res.ok) {
          if (inpTitulo) inpTitulo.value = '';
          if (txtMensaje) txtMensaje.value = '';
          if (statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.style.background = 'rgba(16,185,129,0.12)';
            statusMsg.style.color = 'var(--success)';
            statusMsg.style.border = '1px solid rgba(16,185,129,0.25)';
            statusMsg.innerHTML = `✅ <strong>Notificación emitida con éxito.</strong> ${res.enviados || 0} celular/es conectado/s recibieron la alerta push en segundo plano.`;
            setTimeout(() => { statusMsg.style.display = 'none'; }, 6000);
          }
          toast(`🚀 Notificación enviada a ${res.enviados || 0} celulares`, 'success');
        } else {
          toast(`❌ Error: ${res?.error || 'No se pudo enviar la notificación'}`, 'error');
        }
      } catch (err) {
        toast(`❌ Error al conectar con el servidor: ${err.message}`, 'error');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = '🚀 Emitir Notificación Remota a Dispositivos';
      }
    };
  }
}

function aplicarPlantillaAdminPush(tpl) {
  const selTipo = $('#adminPushTipo');
  const inpTitulo = $('#adminPushTitulo');
  const txtMensaje = $('#adminPushMensaje');
  const selCat = $('#adminPushCategoria');
  const selPrio = $('#adminPushPrioridad');

  if (tpl === 'jornada') {
    if (selTipo) selTipo.value = 'jornada_pendiente';
    if (inpTitulo) inpTitulo.value = '⏰ Recordatorio de Cierre de Jornada Diaria';
    if (txtMensaje) txtMensaje.value = 'Tenés una jornada sin cerrar. Por favor controlá tus tareas y cerrala desde la pantalla de inicio para asegurar el cómputo correcto de tus baremos.';
    if (selCat) selCat.value = 'Operaciones';
    if (selPrio) selPrio.value = 'alta';
  } else if (tpl === 'ats') {
    if (selTipo) selTipo.value = 'ats_pendiente';
    if (inpTitulo) inpTitulo.value = '📋 Análisis de Trabajo Seguro (ATS) Obligatorio';
    if (txtMensaje) txtMensaje.value = 'Recordá completar y firmar el ATS con todo el equipo antes de iniciar cualquier tarea en la vía pública.';
    if (selCat) selCat.value = 'Procedimiento';
    if (selPrio) selPrio.value = 'alta';
  } else if (tpl === 'seguridad') {
    if (selTipo) selTipo.value = 'seguridad_urgente';
    if (inpTitulo) inpTitulo.value = '⚠️ Alerta de Seguridad Urgente: Protocolo de EPP';
    if (txtMensaje) txtMensaje.value = 'Uso obligatorio de arnés con doble cabo de vida y verificación de ausencia de tensión en líneas MT/BT. Prohibido operar sin EPP completo.';
    if (selCat) selCat.value = 'Seguridad';
    if (selPrio) selPrio.value = 'alta';
  } else if (tpl === 'tormenta') {
    if (selTipo) selTipo.value = 'clima_tormenta';
    if (inpTitulo) inpTitulo.value = '⛈️ Alerta Meteorológica: Protocolo de Tormenta';
    if (txtMensaje) txtMensaje.value = 'Se registran condiciones climáticas adversas en la zona de trabajo. Suspender de inmediato trabajos en altura o líneas aéreas y resguardar a la cuadrilla.';
    if (selCat) selCat.value = 'Seguridad';
    if (selPrio) selPrio.value = 'alta';
  } else if (tpl === 'comunicado') {
    if (selTipo) selTipo.value = 'aviso_empresa';
    if (inpTitulo) inpTitulo.value = '📢 Comunicado Oficial de la Empresa';
    if (txtMensaje) txtMensaje.value = '';
    if (selCat) selCat.value = 'General';
    if (selPrio) selPrio.value = 'media';
  }
}

async function enviarPushRemoto(payload) {
  const token = sessionStorage.getItem('baremo_admin_token') || '';
  try {
    const res = await fetch('/api/admin/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      await cargarPanelAdminPush();
      if (payload.crearAviso && typeof cargarAvisosEmpresa === 'function') {
        await cargarAvisosEmpresa();
        if (typeof renderCarruselAvisos === 'function') renderCarruselAvisos();
      }
      return data;
    }
    return { ok: false, error: data.error || 'Error al emitir notificación' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function eliminarAvisoRemoto(id) {
  const token = sessionStorage.getItem('baremo_admin_token') || '';
  try {
    const res = await fetch(`/api/admin/avisos/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token }
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      toast('Aviso eliminado del servidor central', 'success');
      await cargarPanelAdminPush();
      if (typeof cargarAvisosEmpresa === 'function') {
        await cargarAvisosEmpresa();
        if (typeof renderCarruselAvisos === 'function') renderCarruselAvisos();
      }
      return true;
    }
    toast(`❌ Error: ${data.error || 'No autorizado'}`, 'error');
    return false;
  } catch (err) {
    toast(`❌ Error al conectar: ${err.message}`, 'error');
    return false;
  }
}

let _adminViewModo = 'jornadas';

async function renderAdminReportesView() {
  const summary = $('#adminSummary');
  const content = $('#adminSummaryContent');
  const badge = $('#adminSummaryPeriodoBadge');
  if (!summary || !content) return;

  summary.style.display = 'block';
  content.innerHTML = `
    <div style="text-align:center;padding:24px 16px;color:var(--text-soft);font-size:12px;">
      <div style="display:inline-block;animation:spin 1s linear infinite;margin-bottom:6px;font-size:18px;">⏳</div>
      <div>Consultando reportes consolidados de todos los dispositivos...</div>
    </div>
  `;

  const { datos, periodoLabel } = await obtenerDatosReporteAdmin();
  if (badge) badge.textContent = periodoLabel;

  if (!datos || !datos.length) {
    content.innerHTML = `
      <div style="text-align:center;padding:24px 16px;color:var(--text-soft);background:var(--bg);border-radius:8px;">
        <div style="font-size:28px;margin-bottom:6px;">📭</div>
        <div style="font-weight:700;font-size:13.5px;color:var(--text);margin-bottom:4px;">No hay jornadas para el filtro seleccionado</div>
        <div style="font-size:11.5px;color:var(--text-soft);margin-bottom:12px;">No se registraron jornadas en la nube ni localmente con este criterio.</div>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" id="btnAdminVerHistorico" style="font-size:11.5px;padding:4px 10px;">
            🗂️ Ver Histórico Completo
          </button>
          <button class="btn btn-ghost btn-sm" id="btnAdminRefrescarVacio" style="font-size:11.5px;padding:4px 10px;">
            🔄 Refrescar Nube
          </button>
        </div>
      </div>
    `;
    const btnHist = $('#btnAdminVerHistorico');
    if (btnHist) {
      btnHist.onclick = () => {
        const btnTodos = $(`#adminReportType button[data-type="todos"]`);
        if (btnTodos) btnTodos.click();
      };
    }
    const btnRef = $('#btnAdminRefrescarVacio');
    if (btnRef) {
      btnRef.onclick = () => renderAdminReportesView();
    }
    return;
  }

  const totalProduccionCerrada = datos.filter(d => d.cerrada).reduce((a, d) => a + (Number(d.total) || 0), 0);
  const totalProduccionEnCurso = datos.filter(d => !d.cerrada).reduce((a, d) => a + (Number(d.totalEnCurso || d.total) || 0), 0);
  const totalItems = datos.reduce((a, d) => a + (Number(d.cantidadItems) || (Array.isArray(d.items) ? d.items.length : 0) || 0), 0);
  const totalTareas = datos.reduce((a, d) => a + (Number(d.cantidadRegistros) || (Array.isArray(d.tareas) ? d.tareas.length : 0) || 0), 0);
  const totalAtsFirmados = datos.filter(d => d.ats && (d.ats.completado || d.ats.firmadoPor || d.ats.ot)).length;
  const usuariosUnicos = [...new Set(datos.map(d => String(d.legajo)))];
  const totalCerradas = datos.filter(d => d.cerrada).length;
  const totalEnCurso = datos.length - totalCerradas;

  // Tarjetas KPI
  let kpisHtml = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;margin-bottom:12px;">
      <div style="background:var(--bg);padding:8px 10px;border-radius:8px;border:1px solid var(--border);">
        <div style="font-size:10.5px;color:var(--text-soft);font-weight:600;">Producción Total</div>
        <div style="font-size:16px;font-weight:800;color:#16a34a;">${fmt(totalProduccionCerrada)}</div>
        ${totalProduccionEnCurso > 0 ? `<div style="font-size:10px;color:#ca8a04;">+ ${fmt(totalProduccionEnCurso)} en curso</div>` : `<div style="font-size:10px;color:var(--text-soft);">${totalCerradas} cerradas</div>`}
      </div>
      <div style="background:var(--bg);padding:8px 10px;border-radius:8px;border:1px solid var(--border);">
        <div style="font-size:10.5px;color:var(--text-soft);font-weight:600;">Jornadas Totales</div>
        <div style="font-size:16px;font-weight:800;color:var(--text);">${fmtNum(datos.length)}</div>
        <div style="font-size:10px;color:var(--text-soft);">${totalCerradas} cerradas · ${totalEnCurso} en curso</div>
      </div>
      <div style="background:var(--bg);padding:8px 10px;border-radius:8px;border:1px solid var(--border);">
        <div style="font-size:10.5px;color:var(--text-soft);font-weight:600;">Cuadrillas Conectadas</div>
        <div style="font-size:16px;font-weight:800;color:var(--primary);">${fmtNum(usuariosUnicos.length)} cuadrillas</div>
        <div style="font-size:10px;color:var(--text-soft);">${fmtNum(totalTareas)} tareas registradas</div>
      </div>
      <div style="background:var(--bg);padding:8px 10px;border-radius:8px;border:1px solid var(--border);">
        <div style="font-size:10.5px;color:var(--text-soft);font-weight:600;">Ítems & ATS</div>
        <div style="font-size:16px;font-weight:800;color:#0284c7;">${fmtNum(totalItems)} ítems</div>
        <div style="font-size:10px;color:var(--text-soft);">${totalAtsFirmados} con ATS firmado</div>
      </div>
    </div>
  `;

  // Barra de pestañas
  let tabsHtml = `
    <div style="display:flex;gap:6px;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:8px;">
      <button class="btn btn-sm ${_adminViewModo === 'jornadas' ? 'btn-primary' : 'btn-ghost'}" id="btnAdminTabJornadas" style="font-size:11px;padding:4px 10px;">
        📋 Lista de Jornadas de Todos los Dispositivos (${datos.length})
      </button>
      <button class="btn btn-sm ${_adminViewModo === 'cuadrillas' ? 'btn-primary' : 'btn-ghost'}" id="btnAdminTabCuadrillas" style="font-size:11px;padding:4px 10px;">
        👥 Resumen por Cuadrilla (${usuariosUnicos.length})
      </button>
    </div>
  `;

  let detalleHtml = '';

  if (_adminViewModo === 'jornadas') {
    detalleHtml += `<div style="display:flex;flex-direction:column;gap:8px;">`;
    datos.forEach((j, idx) => {
      const jornadaKey = `jornada_row_${idx}`;
      const itemsList = Array.isArray(j.items) ? j.items : [];
      const cantItems = j.cantidadItems || itemsList.length || 0;
      const cantTareas = j.cantidadRegistros || (Array.isArray(dTareas => dTareas.length) ? j.tareas.length : (Array.isArray(j.tareas) ? j.tareas.length : 0)) || 0;
      const tieneAts = j.ats && (j.ats.completado || j.ats.firmadoPor || j.ats.ot);
      const montoTotal = Number(j.total) || Number(j.totalEnCurso) || 0;
      const estadoBadge = j.cerrada 
        ? `<span style="background:rgba(22,163,74,0.12);color:#16a34a;font-weight:700;font-size:10.5px;padding:2px 8px;border-radius:12px;">🟢 Cerrada</span>`
        : `<span style="background:rgba(234,179,8,0.15);color:#ca8a04;font-weight:700;font-size:10.5px;padding:2px 8px;border-radius:12px;">🟡 En Curso</span>`;

      detalleHtml += `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
            <div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="font-weight:700;font-size:12.5px;color:var(--text);">📅 ${fechaLegible(j.fecha)}</span>
                ${estadoBadge}
              </div>
              <div style="font-size:12px;color:var(--text);margin-top:3px;">
                👤 <strong>${escapeHTML(j.nombreUsuario || 'Operador')}</strong>
                <span style="color:var(--text-soft);font-size:11px;"> · Legajo ${escapeHTML(j.legajo)} · Zona ${escapeHTML(j.zona || '-')}</span>
              </div>
              <div style="font-size:11px;color:var(--text-soft);margin-top:2px;">
                ⏰ ${escapeHTML(j.horaInicio || '--:--')} a ${escapeHTML(j.horaFin || '--:--')} · ${cantItems} ítem(s) de baremo · ${cantTareas} tarea(s)
              </div>
              ${tieneAts ? `
                <div style="font-size:11px;color:#16a34a;font-weight:600;margin-top:3px;display:flex;align-items:center;gap:4px;">
                  <span>✅ ATS: OT ${escapeHTML(j.ats.ot || 'S/N')}</span>
                  ${j.ats.obra ? `<span>· ${escapeHTML(j.ats.obra)}</span>` : ''}
                </div>
              ` : `
                <div style="font-size:11px;color:var(--text-soft);margin-top:3px;">⏳ Sin ficha ATS registrada</div>
              `}
            </div>
            <div style="text-align:right;min-width:110px;">
              <div style="font-size:10.5px;color:var(--text-soft);">Producción</div>
              <div style="font-size:16px;font-weight:800;color:var(--primary);">${fmt(montoTotal)}</div>
              <button class="btn btn-ghost btn-sm btn-toggle-detalle-jornada" data-target="${jornadaKey}" style="margin-top:4px;padding:3px 8px;font-size:10.5px;border:1px solid var(--border);">
                👁️ Ver Baremos y ATS
              </button>
            </div>
          </div>

          <!-- Acordeon desplegable de la jornada -->
          <div id="${jornadaKey}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);">
            ${itemsList.length > 0 ? `
              <div style="font-weight:700;font-size:11px;color:var(--text);margin-bottom:6px;">📋 Desglose de Códigos de Baremo Cargados:</div>
              <div style="overflow-x:auto;margin-bottom:8px;">
                <table style="width:100%;font-size:10.5px;border-collapse:collapse;">
                  <thead>
                    <tr style="background:var(--bg);border-bottom:1px solid var(--border);text-align:left;">
                      <th style="padding:4px 6px;">Código</th>
                      <th style="padding:4px 6px;">Descripción</th>
                      <th style="padding:4px 6px;text-align:center;">Cant.</th>
                      <th style="padding:4px 6px;text-align:right;">P. Unit</th>
                      <th style="padding:4px 6px;text-align:right;">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsList.map(it => `
                      <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:4px 6px;font-family:monospace;font-weight:700;color:var(--primary);">${escapeHTML(it.codigo)}</td>
                        <td style="padding:4px 6px;">${escapeHTML(it.descripcion || '-')}</td>
                        <td style="padding:4px 6px;text-align:center;">${it.cantidad || 1}</td>
                        <td style="padding:4px 6px;text-align:right;color:var(--text-soft);">${fmt(it.precio || 0)}</td>
                        <td style="padding:4px 6px;text-align:right;font-weight:700;">${fmt(it.subtotal || 0)}</td>
                      </tr>
                    `).join('')}
                    <tr style="background:var(--bg);font-weight:700;">
                      <td colspan="4" style="padding:4px 6px;text-align:right;">Total Calculado:</td>
                      <td style="padding:4px 6px;text-align:right;color:var(--primary);">${fmt(montoTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="color:var(--text-soft);font-size:11px;padding:4px 0;">No contiene ítems detallados de baremo guardados.</div>
            `}

            ${tieneAts ? `
              <div style="background:var(--bg);padding:8px 10px;border-radius:6px;border:1px solid var(--border);margin-top:6px;font-size:11px;">
                <div style="font-weight:700;color:var(--primary);margin-bottom:4px;display:flex;justify-content:space-between;">
                  <span>📋 Ficha Técnica ATS (Análisis de Trabajo Seguro)</span>
                  <span style="color:#16a34a;font-weight:600;">Firmado</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:4px;color:var(--text-soft);">
                  <div><strong>OT:</strong> ${escapeHTML(j.ats.ot || '-')}</div>
                  <div><strong>Obra:</strong> ${escapeHTML(j.ats.obra || '-')}</div>
                  <div><strong>Pedido:</strong> ${escapeHTML(j.ats.pedido || '-')}</div>
                  <div><strong>Sector:</strong> ${escapeHTML(j.ats.sector || '-')}</div>
                  <div style="grid-column:1/-1;"><strong>Dirección:</strong> ${escapeHTML(j.ats.direccion || '-')}</div>
                  <div style="grid-column:1/-1;"><strong>Trabajo Asignado:</strong> ${escapeHTML(j.ats.trabajo || '-')}</div>
                  ${Array.isArray(j.ats.cuadrilla) && j.ats.cuadrilla.length > 0 ? `
                    <div style="grid-column:1/-1;"><strong>Cuadrilla Firmante:</strong> ${j.ats.cuadrilla.map(c => escapeHTML(c.nombre || c)).join(', ')}</div>
                  ` : ''}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });
    detalleHtml += `</div>`;
  } else {
    // Modo 2: Consolidado por Cuadrilla
    const porUsuario = {};
    datos.forEach(d => {
      const leg = d.legajo || 'Sin Legajo';
      if (!porUsuario[leg]) {
        porUsuario[leg] = {
          nombre: d.nombreUsuario || 'Desconocido',
          zona: d.zona || '-',
          jornadas: 0,
          cerradas: 0,
          abiertas: 0,
          items: 0,
          total: 0
        };
      }
      porUsuario[leg].jornadas += 1;
      if (d.cerrada) porUsuario[leg].cerradas += 1;
      else porUsuario[leg].abiertas += 1;
      porUsuario[leg].items += (Number(d.cantidadItems) || (Array.isArray(d.items) ? d.items.length : 0) || 0);
      porUsuario[leg].total += (Number(d.total) || Number(d.totalEnCurso) || 0);
    });

    detalleHtml += `
      <div style="overflow-x:auto;">
        <table style="width:100%;font-size:11.5px;border-collapse:collapse;">
          <thead>
            <tr style="background:var(--card);border-bottom:1.5px solid var(--border);text-align:left;">
              <th style="padding:6px 8px;">Cuadrilla / Operario</th>
              <th style="padding:6px 8px;text-align:center;">Jornadas</th>
              <th style="padding:6px 8px;text-align:center;">Ítems</th>
              <th style="padding:6px 8px;text-align:right;">Producción</th>
              <th style="padding:6px 8px;text-align:right;">Promedio/Jornada</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(porUsuario).map(([leg, uInfo]) => {
              const prom = uInfo.jornadas > 0 ? Math.round(uInfo.total / uInfo.jornadas) : 0;
              return `
                <tr style="border-bottom:1px solid var(--border);">
                  <td style="padding:6px 8px;">
                    <strong>${escapeHTML(uInfo.nombre)}</strong>
                    <div style="font-size:10px;color:var(--text-soft);">Legajo ${escapeHTML(leg)} · ${escapeHTML(uInfo.zona)}</div>
                  </td>
                  <td style="padding:6px 8px;text-align:center;">
                    ${uInfo.jornadas}
                    <div style="font-size:9.5px;color:var(--text-soft);">${uInfo.cerradas} cerradas · ${uInfo.abiertas} en curso</div>
                  </td>
                  <td style="padding:6px 8px;text-align:center;">${uInfo.items}</td>
                  <td style="padding:6px 8px;text-align:right;font-weight:700;color:#16a34a;">${fmt(uInfo.total)}</td>
                  <td style="padding:6px 8px;text-align:right;color:var(--text-soft);">${fmt(prom)}</td>
                </tr>
              `;
            }).join('')}
            <tr style="background:var(--bg);font-weight:800;border-top:2px solid var(--border);">
              <td style="padding:8px;">TOTAL CONSOLIDADO (${usuariosUnicos.length} cuadrillas)</td>
              <td style="padding:8px;text-align:center;">${datos.length}</td>
              <td style="padding:8px;text-align:center;">${totalItems}</td>
              <td style="padding:8px;text-align:right;color:#16a34a;">${fmt(totalProduccionCerrada + totalProduccionEnCurso)}</td>
              <td style="padding:8px;text-align:right;">${fmt(datos.length > 0 ? Math.round((totalProduccionCerrada + totalProduccionEnCurso) / datos.length) : 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  content.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px;color:var(--primary);font-size:13px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
      <span>${periodoLabel}</span>
      <span style="font-size:11px;font-weight:normal;color:var(--text-soft);">${datos.length} jornada(s) registradas</span>
    </div>
    ${kpisHtml}
    ${tabsHtml}
    ${detalleHtml}
  `;

  const tabJornadas = $('#btnAdminTabJornadas');
  const tabCuadrillas = $('#btnAdminTabCuadrillas');
  if (tabJornadas) tabJornadas.onclick = () => { _adminViewModo = 'jornadas'; renderAdminReportesView(); };
  if (tabCuadrillas) tabCuadrillas.onclick = () => { _adminViewModo = 'cuadrillas'; renderAdminReportesView(); };

  $$('.btn-toggle-detalle-jornada').forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        const isHidden = targetEl.style.display === 'none';
        targetEl.style.display = isHidden ? 'block' : 'none';
        btn.textContent = isHidden ? '🔼 Ocultar Baremos' : '👁️ Ver Baremos y ATS';
      }
    };
  });
}

async function obtenerDatosReporteAdmin() {
  const tipo = State.adminReportType || 'todos';
  const usuarioSel = $('#adminUsuario')?.value || 'todos';
  const estadoSel = $('#adminEstadoJornada')?.value || 'todos';
  const fechaInputVal = $('#adminFecha')?.value || hoy();
  const quincenaSel = $('#adminQuincenaSel')?.value || '1';

  let fechaDesde, fechaHasta, periodoLabel;

  if (tipo === 'diario') {
    fechaDesde = fechaInputVal;
    fechaHasta = fechaInputVal;
    periodoLabel = `Reporte Diario - ${fechaCorta(fechaDesde)}`;
  } else if (tipo === 'semanal') {
    const semana = obtenerSemanaDeFecha(fechaInputVal);
    fechaDesde = semana.lunes;
    fechaHasta = semana.domingo;
    periodoLabel = `Reporte Semanal - ${fechaCorta(semana.lunes)} al ${fechaCorta(semana.domingo)}`;
  } else if (tipo === 'quincenal') {
    const mesRef = fechaInputVal.length >= 7 ? fechaInputVal.slice(0, 7) : mesActual();
    const [y, m] = mesRef.split('-');
    if (quincenaSel === '1') {
      fechaDesde = `${y}-${m}-01`;
      fechaHasta = `${y}-${m}-15`;
      periodoLabel = `Reporte 1ª Quincena - ${nombreMes(mesRef)} (01 al 15)`;
    } else {
      const ultDia = diasDelMes(mesRef);
      fechaDesde = `${y}-${m}-16`;
      fechaHasta = `${y}-${m}-${String(ultDia).padStart(2, '0')}`;
      periodoLabel = `Reporte 2ª Quincena - ${nombreMes(mesRef)} (16 al ${ultDia})`;
    }
  } else if (tipo === 'mensual') {
    const mesRef = fechaInputVal.length >= 7 ? fechaInputVal.slice(0, 7) : mesActual();
    const [y, m] = mesRef.split('-');
    const ultDia = diasDelMes(mesRef);
    fechaDesde = `${y}-${m}-01`;
    fechaHasta = `${y}-${m}-${String(ultDia).padStart(2, '0')}`;
    periodoLabel = `Reporte Mensual - ${nombreMes(mesRef)}`;
  } else {
    // 'todos' / histórico consolidado
    fechaDesde = '2000-01-01';
    fechaHasta = '2099-12-31';
    periodoLabel = 'Reporte Histórico Consolidado (Todos los dispositivos)';
  }

  // 1. Obtener datos remotos de la nube
  let datosRemotos = null;
  try {
    const qParams = new URLSearchParams({
      legajo: usuarioSel,
      tipo,
      fecha: fechaInputVal,
      desde: fechaDesde,
      hasta: fechaHasta,
      quincena: quincenaSel,
      estado: estadoSel
    });
    const res = await fetchAdminAPI(`/api/admin/reportes/datos?${qParams.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.ok && Array.isArray(json.datos)) {
        datosRemotos = json.datos;
      }
    }
  } catch (errRemoto) {
    console.warn('[Admin Reportes] Servidor no respondió, usando datos locales:', errRemoto.message);
  }

  // 2. Unificar con datos de IndexedDB local sin duplicar
  const todasJornadasLocales = await dbGetAll('jornadas');
  const usuariosLocales = await dbGetAll('usuarios');
  const jornadasMap = new Map();

  if (Array.isArray(datosRemotos)) {
    datosRemotos.forEach(j => {
      const idKey = String(j.remoteId || j.syncId || j.localId || j.id || j.horaInicio || '1').trim();
      const key = `jornada__${String(j.legajo).trim()}__${String(j.fecha).trim()}__${idKey}`;
      jornadasMap.set(key, j);
    });
  }

  let localesFiltradas = todasJornadasLocales;
  if (estadoSel === 'cerradas') {
    localesFiltradas = localesFiltradas.filter(j => j.cerrada);
  } else if (estadoSel === 'abiertas') {
    localesFiltradas = localesFiltradas.filter(j => !j.cerrada);
  }

  if (usuarioSel !== 'todos') {
    localesFiltradas = localesFiltradas.filter(j => String(j.legajo) === String(usuarioSel));
  }
  if (tipo !== 'todos') {
    localesFiltradas = localesFiltradas.filter(j => j.fecha >= fechaDesde && j.fecha <= fechaHasta);
  }

  localesFiltradas.forEach(j => {
    const idKey = String(j.id || j.horaInicio || '1').trim();
    const key = `jornada__${String(j.legajo).trim()}__${String(j.fecha).trim()}__${idKey}`;
    if (!jornadasMap.has(key)) {
      const u = usuariosLocales.find(u => String(u.legajo) === String(j.legajo));
      jornadasMap.set(key, {
        ...j,
        nombreUsuario: u?.nombre || j.nombreUsuario || j.usuario || State.user?.nombre || 'Operador',
        zona: u?.zona || j.zona || State.user?.zona || '-',
        origenLocal: true
      });
    }
  });

  const datos = Array.from(jornadasMap.values());
  datos.sort((a, b) => b.fecha.localeCompare(a.fecha) || String(a.legajo).localeCompare(String(b.legajo)));

  return { datos, periodoLabel, fechaDesde, fechaHasta, tipo };
}

let chartDiario = null, chartMensual = null, chartPie = null;
/* ---------- v5.9.34: DETALLE FINAL PRODUCCION COMPACTO ----------
   La tarjeta arranca cerrada y muestra solo el titulo, el saldo y el
   estado. Todo el desglose (mes en curso, mes cerrado, reglas de la 2da
   quincena y el aviso) se abre con el boton EXPANDIR, para no obligar a
   scrollear el dashboard entero. El estado abierto/cerrado se recuerda
   mientras dura la sesion, asi un refresco de datos no lo cierra solo. */
function pintarBotonDetalleProduccion() {
  const btn = $('#pcToggle');
  const card = $('#cardProduccionCobrar');
  if (!btn || !card) return;
  const abierta = card.classList.contains('expandida');
  btn.textContent = abierta ? 'CONTRAER' : 'EXPANDIR';
  btn.setAttribute('aria-expanded', abierta ? 'true' : 'false');
}

function setupDetalleProduccion() {
  const btn = $('#pcToggle');
  const card = $('#cardProduccionCobrar');
  if (!btn || !card) return;
  if (State.detalleProduccionAbierto) card.classList.add('expandida');
  else card.classList.remove('expandida');
  if (btn.dataset.listo !== '1') {
    btn.dataset.listo = '1';
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      card.classList.toggle('expandida');
      State.detalleProduccionAbierto = card.classList.contains('expandida');
      pintarBotonDetalleProduccion();
    });
  }
  pintarBotonDetalleProduccion();
}

/* ---------- v5.9.33: EJES DE LOS GRAFICOS HORIZONTALES ----------
   Los graficos de barras crecian hacia arriba y obligaban a scrollear.
   Ahora el monto va en el eje X (abreviado) y las etiquetas en el eje Y:
   las barras crecen a lo ancho y el alto de la tarjeta queda fijo.
   Los valores, los colores por rango y los tooltips son los mismos. */
function montoCorto(v) {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const sg = n < 0 ? '-' : '';
  if (a >= 1000000) return sg + '$' + (a / 1000000).toFixed(a >= 10000000 ? 0 : 1).replace('.', ',') + 'M';
  if (a >= 1000) return sg + '$' + Math.round(a / 1000) + 'k';
  return sg + '$' + Math.round(a);
}

function escalasBarraHorizontal() {
  return {
    x: {
      beginAtZero: true,
      grid: { color: 'rgba(120,130,150,.15)' },
      ticks: { font: { size: 9 }, maxTicksLimit: 5, callback: v => montoCorto(v) }
    },
    y: {
      grid: { display: false },
      ticks: { font: { size: 10, weight: '700' }, autoSkip: false }
    }
  };
}

async function renderCharts(jornadas, mesFoco) {
  if (typeof Chart === 'undefined') return;
  const lista = Array.isArray(jornadas) ? jornadas : [];
  const mes = mesFoco || mesActual();
  try {
      /* ---------- 1) Produccion de los ultimos 7 dias ----------
         Se suma por fecha exacta, asi dos jornadas del mismo dia quedan
         en la misma barra. */
      const totalPorFecha = new Map();
      lista.forEach(j => {
        const f = j && j.fecha ? j.fecha : '';
        totalPorFecha.set(f, (totalPorFecha.get(f) || 0) + totalesDeJornada(j).total);
      });

      const hoyD = new Date();
      const dias = [];
      for (let i = 6; i >= 0; i--) {
        // Se construye la fecha por componentes: nunca desborda de mes.
        const d = new Date(hoyD.getFullYear(), hoyD.getMonth(), hoyD.getDate() - i);
        dias.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }
      const dd = dias.map(d => totalPorFecha.get(d) || 0);
      const ld = dias.map(d => fechaCorta(d).substring(0, 5));

      const sum7 = dd.reduce((a, b) => a + b, 0);
      const elSum7 = $('#total7Dias');
      if (elSum7) elSum7.textContent = `Total 7 días: ${fmt(sum7)}`;

      if (chartDiario) { chartDiario.destroy(); chartDiario = null; }
      const c1 = $('#chartDiario');
      if (c1) {
        const ctx = c1.getContext('2d');
        const bgColors = dd.map(v => getConfigDia(v).hex);

        chartDiario = new Chart(ctx, {
          type: 'bar',
          data: {
              labels: ld,
              datasets: [{
                  data: dd,
                  backgroundColor: bgColors,
                  borderRadius: 4,
                  borderSkipped: false,
                  barPercentage: .82,
                  categoryPercentage: .84
              }]
          },
          options: {
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  legend: { display: false },
                  tooltip: {
                      callbacks: {
                          label: function(context) {
                              const cfg = getConfigDia(context.raw);
                              return `${fmt(context.raw)} - Rango: ${cfg.nombre}`;
                          }
                      }
                  }
              },
              scales: escalasBarraHorizontal(),
              animation: { duration: 1000, easing: 'easeOutQuart' }
          }
        });
      }

      /* ---------- 2) Produccion mensual (6 meses) ----------
         Los meses se encadenan con mesPrevioDe() sobre texto "YYYY-MM".
         Con Date.setMonth() los dias 29, 30 y 31 duplicaban un mes y se
         comian otro (31 de mayo - 1 mes = 1 de mayo). */
      const meses = [];
      let cursor = mes;
      for (let i = 0; i < 6; i++) { meses.unshift(cursor); cursor = mesPrevioDe(cursor); }

      const totalPorMes = new Map();
      lista.forEach(j => {
        const ms = String(j && j.fecha ? j.fecha : '').slice(0, 7);
        totalPorMes.set(ms, (totalPorMes.get(ms) || 0) + totalesDeJornada(j).total);
      });
      const dm = meses.map(m => totalPorMes.get(m) || 0);
      const lm = meses.map(m => nombreMesCorto(m));

      if (chartMensual) { chartMensual.destroy(); chartMensual = null; }
      const c2 = $('#chartMensual');
      if (c2) {
        const ctx2 = c2.getContext('2d');
        const colorMeses = dm.map(v => getConfigMes(v).hex);

        chartMensual = new Chart(ctx2, {
          // v5.9.33 - antes era una linea vertical. Ahora barra horizontal con
          // los mismos 6 meses, los mismos totales y el color de cada rango.
          type: 'bar',
          data: {
            labels: lm,
            datasets: [{
              data: dm,
              backgroundColor: colorMeses,
              borderRadius: 4,
              borderSkipped: false,
              barPercentage: .8,
              categoryPercentage: .82
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const cfg = getConfigMes(context.raw);
                            return `${fmt(context.raw)} - Rango: ${cfg.nombre}`;
                        }
                    }
                }
            },
            scales: escalasBarraHorizontal(),
            animation: { duration: 1200, easing: 'easeOutQuart' }
          }
        });
      }

      /* ---------- 3) Circulo: top baremos DEL MES ----------
         Antes mezclaba todo el historial y contaba tambien los baremos de
         tareas sin finalizar, asi que nunca cerraba con el total del mes.
         Ahora: solo el mes en curso, solo tareas finalizadas, top 5 mas
         "Otros" para que la torta sume el 100% de la produccion. */
      const jMes = lista.filter(j => String(j && j.fecha ? j.fecha : '').startsWith(mes));
      const rMes = resumenDeJornadas(jMes);

      const descripciones = new Map();
      jMes.forEach(j => itemsFinalizadosDeJornada(j).forEach(it => {
        const cod = String((it && it.codigo) || 'S/C');
        if (!descripciones.has(cod) && it && it.descripcion) descripciones.set(cod, String(it.descripcion));
      }));

      const entradas = [...rMes.importePorCodigo.entries()]
        .filter(e => e[1] > 0)
        .sort((a, b) => b[1] - a[1]);
      const totalMes = entradas.reduce((a, e) => a + e[1], 0);
      const top = entradas.slice(0, 5);
      const resto = entradas.slice(5);
      const montoResto = resto.reduce((a, e) => a + e[1], 0);

      const labels = top.map(e => e[0]);
      const valores = top.map(e => e[1]);
      if (montoResto > 0) { labels.push(`Otros (${resto.length})`); valores.push(montoResto); }

      const elResumenPie = $('#pieResumen');
      if (elResumenPie) {
        const concentracion = totalMes ? (top.reduce((a, e) => a + e[1], 0) / totalMes) * 100 : 0;
        elResumenPie.textContent = entradas.length
          ? `${fmtNum(entradas.length)} códigos · Top 5 = ${concentracion.toFixed(1)}% de ${fmt(totalMes)}`
          : '';
      }
      const elVacioPie = $('#pieVacio');
      if (elVacioPie) elVacioPie.style.display = entradas.length ? 'none' : 'block';

      if (chartPie) { chartPie.destroy(); chartPie = null; }
      const c3 = $('#chartPie');
      if (c3) {
        c3.style.display = entradas.length ? '' : 'none';
        if (entradas.length) {
          const paleta = paletaGraficos();
          chartPie = new Chart(c3, {
            type: 'doughnut',
            data: {
              labels,
              datasets: [{
                data: valores,
                backgroundColor: labels.map((_, i) => paleta[i] || '#94a3b8'),
                borderWidth: 0
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '58%',
              plugins: {
                legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10, padding: 8 } },
                tooltip: {
                  callbacks: {
                    label: ctx => {
                      const v = numero(ctx.raw);
                      const pct = totalMes ? (v / totalMes) * 100 : 0;
                      return `${fmt(v)} · ${pct.toFixed(1)}%`;
                    },
                    afterLabel: ctx => {
                      const cod = labels[ctx.dataIndex];
                      const cant = rMes.cantPorCodigo.get(cod);
                      const desc = descripciones.get(cod);
                      const partes = [];
                      if (cant) partes.push(`${fmtNum(cant)} u.`);
                      if (desc) partes.push(desc.length > 42 ? desc.slice(0, 42) + '…' : desc);
                      return partes.join(' · ');
                    }
                  }
                }
              },
              animation: { duration: 900, easing: 'easeOutQuart' }
            }
          });
        }
      }
  } catch(err) {
      console.error("Error renderizando gráficos", err);
  }
}

async function backup() {
  const d = await exportAllDB();
  const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u;
  a.download = `baremos_backup_${hoy()}.json`;
  a.click();
  URL.revokeObjectURL(u);
  try { await dbPut('config', { key: 'ultimoBackup', value: ahora() }); } catch (e) {}
  toast('Backup generado', 'success');
  try { await agendarBackupSemanal(); } catch (e) {}
}

/* ------------------------------------------------------------
   RECORDATORIO DE BACKUP - TODOS LOS LUNES (v5.9.39)

   Los datos viven solo en el telefono. Si se desinstala la app, se
   limpian los datos del navegador, se cambia de equipo o el dia de
   manana la PWA pasa a ser una app de Android, lo unico que viaja con
   el usuario es el archivo de backup.

   Por eso el recordatorio dejo de ser "cada 7 dias desde el ultimo
   backup" (que se apagaba solo apenas hacia uno) y pasa a ser un
   habito fijo y RECURRENTE: todos los lunes a la manana, semana tras
   semana, aunque la semana pasada lo haya hecho.

   - Queda agendado en la base de avisos con un id fijo, asi el service
     worker lo puede mostrar con la app cerrada y se vuelve a agendar
     para el lunes siguiente.
   - Con la app abierta ademas se ofrece generar el backup en el acto.
   - Si el lunes paso sin que se abriera la app, el aviso sale igual el
     primer dia que se entra (una sola vez por semana).
   ------------------------------------------------------------ */
const DIA_BACKUP_SEMANAL = 1;          // 1 = lunes
const HORA_BACKUP_SEMANAL = 9;
const MIN_JORNADAS_BACKUP = 3;         // antes de eso no hay nada valioso que perder
const DIAS_ATRASO_BACKUP = 7;
const TAG_BACKUP_SEMANAL = 'baremo-backup-semanal';
const ID_BACKUP_SEMANAL = 'backup-semanal';
const LS_BACKUP_SEMANAL = 'baremo_aviso_backup_lunes';

/* Fecha (YYYY-MM-DD) del lunes de la semana de una fecha dada: es la clave
   que garantiza un solo aviso por semana. */
function lunesDeLaSemana(d) {
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const corr = (base.getDay() - DIA_BACKUP_SEMANAL + 7) % 7;
  base.setDate(base.getDate() - corr);
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${base.getFullYear()}-${mm}-${dd}`;
}

function claveBackupSemanal(d) {
  return LS_BACKUP_SEMANAL + '_' + lunesDeLaSemana(d || new Date());
}

/* El proximo lunes a la hora del aviso. Si hoy es lunes y todavia no dieron
   las 9, se agenda para hoy mismo. */
function proximoLunes() {
  const ahoraD = new Date();
  const obj = new Date(ahoraD.getFullYear(), ahoraD.getMonth(), ahoraD.getDate(), HORA_BACKUP_SEMANAL, 0, 0, 0);
  let saltos = (DIA_BACKUP_SEMANAL - ahoraD.getDay() + 7) % 7;
  if (saltos === 0 && obj.getTime() <= ahoraD.getTime()) saltos = 7;
  obj.setDate(obj.getDate() + saltos);
  return obj;
}

function textoBackupSemanal(cantidad, ultimo) {
  const nombre = (State.user && State.user.nombre) ? State.user.nombre : '';
  const leg = (State.user && State.user.legajo) ? State.user.legajo : '';
  let quien = '';
  if (nombre && leg) quien = nombre + ' (Legajo ' + leg + ')';
  else if (nombre) quien = nombre;
  else if (leg) quien = 'Legajo ' + leg;

  const dias = ultimo ? Math.floor((Date.now() - ultimo) / 86400000) : null;
  const cuando = (dias === null)
    ? 'Todavia no generaste ninguno.'
    : (dias <= 0 ? 'El ultimo lo hiciste hoy.' : 'El ultimo fue hace ' + dias + (dias === 1 ? ' dia.' : ' dias.'));

  return {
    titulo: 'BAREMO · Respaldo semanal',
    cuerpo: 'Hola' + (quien ? ' ' + quien : '') + ', hoy toca tu backup semanal. ' +
      'Tenés ' + cantidad + (cantidad === 1 ? ' jornada guardada' : ' jornadas guardadas') +
      ' solo en este teléfono: guardalas para poder llevarlas con vos.',
    dialogo: 'Respaldo semanal de tus datos.\n\n' +
      'Tenés ' + cantidad + (cantidad === 1 ? ' jornada guardada' : ' jornadas guardadas') +
      ' solo en este teléfono. ' + cuando + '\n\n' +
      'Con el backup podés recuperar todo si cambiás de equipo, si se desinstala la app ' +
      'o cuando la app pase a Android.\n\n¿Generar el backup ahora?'
  };
}

/* Deja agendado el aviso del proximo lunes. El id es fijo: se pisa solo, asi
   el recordatorio nunca se corta y no se acumulan avisos viejos. */
async function agendarBackupSemanal() {
  try {
    if (!State.user) return;
    const cuando = proximoLunes();
    const jornadas = await dbGetAll('jornadas');
    const cantidad = (jornadas || []).length;
    if (cantidad < MIN_JORNADAS_BACKUP) return;

    const reg = await dbGet('config', 'ultimoBackup');
    const ultimo = reg && reg.value ? Date.parse(reg.value) : 0;
    const t = textoBackupSemanal(cantidad, ultimo);

    await guardarAvisoProgramado({
      id: ID_BACKUP_SEMANAL,
      vence: cuando.getTime(),
      expira: cuando.getTime() + 3 * 24 * 60 * 60 * 1000,
      titulo: t.titulo,
      cuerpo: t.cuerpo,
      tag: TAG_BACKUP_SEMANAL,
      requiereInteraccion: true,
      datos: { tipo: 'backup-semanal', vista: 'Ajustes' },
      mostrado: false
    });
    registrarDespertadorDeAvisos();
  } catch (e) {}
}

/* Limpia las marcas de semanas pasadas para no llenar el almacenamiento. */
function limpiarMarcasDeBackup(actual) {
  try {
    localStorage.removeItem('baremo_aviso_backup');   // marca vieja, de la version anterior
    const fuera = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(LS_BACKUP_SEMANAL) === 0 && k !== actual) fuera.push(k);
    }
    fuera.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

async function revisarRecordatorioDeBackup() {
  try {
    if (!State.user) return;

    const jornadas = await dbGetAll('jornadas');
    if (!jornadas || jornadas.length < MIN_JORNADAS_BACKUP) return;

    const hoyD = new Date();
    const clave = claveBackupSemanal(hoyD);
    limpiarMarcasDeBackup(clave);

    // Si el service worker ya lo mostro con la app cerrada, se toma nota.
    const agendados = await leerAvisosProgramados();
    const ag = agendados.find(a => a && a.id === ID_BACKUP_SEMANAL);
    if (ag && ag.mostrado) {
      lsSet(clave, Date.now());
      await borrarAvisoProgramado(ID_BACKUP_SEMANAL);
    }

    if (!lsNum(clave)) {
      const reg = await dbGet('config', 'ultimoBackup');
      const ultimo = reg && reg.value ? Date.parse(reg.value) : 0;
      const hechoHoy = !!ultimo && new Date(ultimo).toDateString() === hoyD.toDateString();
      const dias = ultimo ? (Date.now() - ultimo) / 86400000 : Infinity;

      const esLunes = hoyD.getDay() === DIA_BACKUP_SEMANAL;
      const yaEsHora = hoyD.getHours() >= HORA_BACKUP_SEMANAL;
      // Si el lunes paso sin abrir la app, el aviso sale igual (una vez por semana).
      const atrasado = !esLunes && dias >= DIAS_ATRASO_BACKUP;

      if (!hechoHoy && ((esLunes && yaEsHora) || atrasado)) {
        lsSet(clave, Date.now());
        await borrarAvisoProgramado(ID_BACKUP_SEMANAL);

        const t = textoBackupSemanal(jornadas.length, ultimo);
        await notificarLocal({
          titulo: t.titulo,
          cuerpo: t.cuerpo,
          tag: TAG_BACKUP_SEMANAL,
          requiereInteraccion: true,
          tipoToast: 'warn',
          toast: t.cuerpo,
          datos: { tipo: 'backup-semanal', vista: 'Ajustes' }
        });

        if (document.visibilityState === 'visible' && await confirmDialog(t.dialogo)) {
          await backup();
        }
      }
    }

    await agendarBackupSemanal();
  } catch (e) { /* el recordatorio nunca puede romper la app */ }
}

function showAyuda() {
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#viewAyuda').classList.add('active');
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  cerrarAyudaTema();
  window.scrollTo(0, 0);
}

function hideAyuda() {
  cerrarAyudaTema();
  if (State.user) {
    showView('Inicio');
  } else {
    showLogin();
  }
}

/* ============================================================
   CENTRO DE AYUDA: UN MODAL POR TEMA
   Antes los 11 temas estaban apilados en un solo articulo y el indice de anclas
   empujaba la pagina hasta el fondo. Ahora cada tarjeta abre su contenido en un
   modal que arranca siempre desde arriba y scrollea por dentro.
   ============================================================ */
function abrirAyudaTema(id) {
  const sec = id ? document.getElementById(id) : null;
  const modal = $('#modalAyuda');
  const cuerpo = $('#mayBody');
  const titulo = $('#mayTitulo');
  if (!sec || !modal || !cuerpo || !titulo) return;
  // Se clona para no vaciar la fuente original, que se reutiliza en cada apertura.
  const clon = sec.cloneNode(true);
  const h2 = clon.querySelector('h2');
  titulo.textContent = h2 ? h2.textContent.trim() : 'Ayuda';
  if (h2) h2.remove();
  cuerpo.innerHTML = clon.innerHTML;
  cuerpo.scrollTop = 0;
  modal.classList.add('show');
  document.body.classList.add('modal-abierto');
}

function cerrarAyudaTema() {
  const modal = $('#modalAyuda');
  if (modal) modal.classList.remove('show');
  // Se limpia siempre, incluso si el modal ya lo habia cerrado el handler generico
  // de .modal-backdrop, para no dejar el scroll de la pagina bloqueado.
  document.body.classList.remove('modal-abierto');
  const cuerpo = $('#mayBody');
  if (cuerpo) cuerpo.innerHTML = '';
}

document.addEventListener('DOMContentLoaded', async () => {
  $$('.tab-btn').forEach(b => { b.onclick = () => showView(b.dataset.view); });
  const bt = $('#btnTheme'); if (bt) bt.onclick = abrirApariencia;
  const bac = $('#btnAparClose'); if (bac) bac.onclick = cerrarApariencia;
  const bs = $('#btnSwitchUser'); if (bs) bs.onclick = switchUser;
  const bc = $('#btnCerrarJornada'); if (bc) bc.onclick = cerrarJornada;
  const bi = $('#btnIniciarJornada'); if (bi) bi.onclick = iniciarJornada;
  setupMapaZona();
  $$('.hist-filtro-btn').forEach(b => { b.onclick = () => setHistFilter(b.dataset.filter); });
  const hc = $('#habClear'); if (hc) hc.onclick = () => { State.histSelected.clear(); renderHistorial(); };
  
  const btnExportSelected = $('#habExportSelected');
  if (btnExportSelected) btnExportSelected.onclick = exportarSeleccionadasPDF;
  
  const btnExportMonth = $('#habExportMonth');
  if (btnExportMonth) btnExportMonth.onclick = exportarMesCompletoPDF;
  
  const btnExportExcel = $('#habExportExcel');
  if (btnExportExcel) btnExportExcel.onclick = exportarMesExcel;

  const btnAcceptTerms = $('#btnAcceptTerms');
  if (btnAcceptTerms) {
    btnAcceptTerms.onclick = async () => {
      setAcceptedTermsVersion();
      $('#modalTerms').classList.remove('show');
      await continuarInicio();
    };
  }
  
  const btnChangeZona = $('#btnChangeZona');
  if (btnChangeZona) {
    btnChangeZona.onclick = () => {
      $('#newZonaSelect').value = State.user.zona || '';
      $('#modalChangeZona').classList.add('show');
    };
  }
  
  const cancelChangeZona = $('#cancelChangeZona');
  if (cancelChangeZona) cancelChangeZona.onclick = () => $('#modalChangeZona').classList.remove('show');
  
  const formChangeZona = $('#formChangeZona');
  if (formChangeZona) {
    formChangeZona.onsubmit = async (e) => {
      e.preventDefault();
      const nz = $('#newZonaSelect').value;
      if (!nz) return;
      State.user.zona = nz;
      await dbPut('usuarios', State.user);
      
      if (State.jornada && !State.jornada.cerrada) {
         State.jornada.zona = nz;
         await saveJornada();
      }
      
      $('#modalChangeZona').classList.remove('show');
      showApp();
      toast('Zona actualizada a ' + nz, 'success');
    };
  }

  const btnHelp = $('#btnHelp');
  if (btnHelp) btnHelp.onclick = showAyuda;
  
  const btnVolverAyuda = $('#btnVolverAyuda');
  if (btnVolverAyuda) btnVolverAyuda.onclick = hideAyuda;

  $$('.ayuda-card').forEach(c => { c.onclick = () => abrirAyudaTema(c.dataset.help); });
  const mayClose = $('#mayClose');
  if (mayClose) mayClose.onclick = cerrarAyudaTema;
  const mayBackdrop = $('#modalAyuda');
  if (mayBackdrop) mayBackdrop.onclick = e => { if (e.target === mayBackdrop) cerrarAyudaTema(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarAyudaTema(); });

  $$('.modal-backdrop').forEach(m => {
    m.addEventListener('click', e => { 
        if (e.target === m && m.id !== 'modalTerms' && m.id !== 'modalConfirm') m.classList.remove('show'); 
    });
  });
  $('#btnInfoClose')?.addEventListener('click', () => $('#modalInfo').classList.remove('show'));
  
  const hse = $('#histSearch'); if (hse) hse.addEventListener('input', renderHistorial);
  const hcf = $('#histCuadrillaFilter'); if (hcf) hcf.addEventListener('change', renderHistorial);
  const mc = $('#mjClose'); if (mc) mc.onclick = () => $('#modalJornada').classList.remove('show');
  setupRegistro();
  setupCombustible();
  setupQuincenas();
  setupAdmin();
  await init();
});

/* ============================================================================
   BAREMO — BOTÓN "📲 INSTALAR APP" (PWA)
   Módulo aislado y offline-first: no realiza ninguna petición de red,
   no toca el Service Worker, la caché, la navegación ni otros botones.
   ========================================================================== */
(function () {
  'use strict';

  var BTN_ID  = 'btnInstallApp';
  var LS_KEY  = 'baremos_pwa_installed';

  var deferredPrompt = null;   // evento beforeinstallprompt guardado
  var promptInFlight = false;  // evita diálogos duplicados

  function btn() { return document.getElementById(BTN_ID); }

  /* ---------- Detección del modo de ejecución ---------- */
  function isStandalone() {
    var modes = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'];
    try {
      if (window.matchMedia) {
        for (var i = 0; i < modes.length; i++) {
          if (window.matchMedia('(display-mode: ' + modes[i] + ')').matches) return true;
        }
      }
    } catch (e) {}
    // iOS / iPadOS Safari
    if (window.navigator && window.navigator.standalone === true) return true;
    // Android WebAPK (TWA)
    try {
      if (document.referrer && document.referrer.indexOf('android-app://') === 0) return true;
    } catch (e) {}
    return false;
  }

  function markInstalled()  { try { localStorage.setItem(LS_KEY, '1'); } catch (e) {} }
  function clearInstalled() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }
  function wasInstalled()   { try { return localStorage.getItem(LS_KEY) === '1'; } catch (e) { return false; } }

  var ua       = (navigator.userAgent || '');
  var isIOS    = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
  var isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  // iOS no expone beforeinstallprompt: la instalación es manual (Compartir → Añadir a inicio)
  var iosManualInstall = isIOS && isSafari;

  /* ---------- Mostrar / ocultar sin dejar hueco ---------- */
  function showBtn() {
    var b = btn();
    if (!b) return;
    b.hidden = false;
    b.classList.add('is-visible');
  }
  function hideBtn() {
    var b = btn();
    if (!b) return;
    b.classList.remove('is-visible');
    b.hidden = true; // display:none → el flex de .header-actions se reajusta solo
  }

  /* ---------- Decisión central de visibilidad ---------- */
  function refresh() {
    if (!btn()) return;

    // 1) Ejecutándose como aplicación instalada → nunca mostrar
    if (isStandalone()) {
      markInstalled();
      deferredPrompt = null;
      hideBtn();
      return;
    }

    // 2) El navegador ofrece instalación → no está instalada en este contexto
    if (deferredPrompt) {
      clearInstalled();
      showBtn();
      return;
    }

    // 3) Ya se instaló anteriormente → no volver a insistir
    if (wasInstalled()) {
      hideBtn();
      return;
    }

    // 4) iOS Safari: sin beforeinstallprompt pero sí instalable manualmente
    if (iosManualInstall) {
      showBtn();
      return;
    }

    // 5) Resto de casos: esperamos beforeinstallprompt antes de mostrar
    hideBtn();
  }

  /* ---------- Comprobación adicional (no asumir por ausencia de evento) ---------- */
  function checkRelatedApps() {
    if (!navigator.getInstalledRelatedApps) return;
    try {
      navigator.getInstalledRelatedApps().then(function (apps) {
        if (apps && apps.length > 0) { markInstalled(); }
        refresh();
      }).catch(function () {});
    } catch (e) {}
  }

  /* ---------- Click del usuario (única vía de instalación) ---------- */
  function onClick() {
    if (isStandalone()) { refresh(); return; }

    if (deferredPrompt) {
      if (promptInFlight) return;
      promptInFlight = true;
      var dp = deferredPrompt;
      try {
        dp.prompt(); // diálogo NATIVO del navegador
        Promise.resolve(dp.userChoice).then(function (res) {
          deferredPrompt = null; // el evento sólo puede usarse una vez
          if (res && res.outcome === 'accepted') {
            markInstalled();
            hideBtn();
          }
          promptInFlight = false;
          refresh();
        }).catch(function () {
          deferredPrompt = null;
          promptInFlight = false;
          refresh();
        });
      } catch (e) {
        deferredPrompt = null;
        promptInFlight = false;
        refresh();
      }
      return;
    }

    // Sin API de instalación disponible (iOS u otros): breve indicación en la propia app
    var msg = iosManualInstall
      ? 'Tocá Compartir ⤴ y luego “Agregar a inicio” para instalar BAREMO'
      : 'Usá el menú del navegador y elegí “Instalar aplicación”';
    if (typeof toast === 'function') { toast(msg, 'info'); }
  }

  /* ---------- Eventos estándar de PWA ---------- */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();          // nunca lanzar el diálogo automáticamente
    deferredPrompt = e;
    refresh();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    markInstalled();
    hideBtn();
    if (typeof toast === 'function') { toast('BAREMO instalada correctamente', 'success'); }
  });

  // Cambio de contexto navegador ↔ aplicación instalada
  try {
    var mq = window.matchMedia('(display-mode: standalone)');
    if (mq.addEventListener) mq.addEventListener('change', refresh);
    else if (mq.addListener) mq.addListener(refresh);
  } catch (e) {}

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { refresh(); checkRelatedApps(); }
  });
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);

  /* ---------- Arranque ---------- */
  function init() {
    var b = btn();
    if (!b) return;
    b.addEventListener('click', onClick);
    refresh();
    checkRelatedApps();
    // Reevaluación breve: algunos navegadores emiten beforeinstallprompt con retardo
    setTimeout(refresh, 1200);
    setTimeout(refresh, 3500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* ============================================================================
   BAREMO — TAREAS CON UBICACIÓN GPS (módulo aditivo)
   ---------------------------------------------------------------------------
   DISEÑO NO DESTRUCTIVO:
   - jornada.items[] sigue siendo la ÚNICA fuente de verdad económica.
     Los totales, Dashboard, Historial, PDF y Excel se calculan igual que antes.
   - Al finalizar una tarea NO se mueve ni se copia ningún ítem: solo se les
     agrega el campo nuevo `tareaId`.
   - jornada.tareas[] es un array NUEVO con la metadata de cada tarea
     (correlativo, hora, ubicación, estado). Si no existe se trata como [].
   - Las jornadas y ítems creados antes de esta versión funcionan sin cambios:
     los ítems sin `tareaId` son simplemente "tarea en curso".
   - No se modifica DB_NAME, DB_VERSION ni el esquema de IndexedDB.
   ========================================================================== */

const GEO_LS_ONBOARDING = 'baremos_geo_onboarding_v1';
const GEO_LS_EN_PROCESO = 'baremos_tarea_en_proceso';
const GEO_MAX_AGE_MS = 60000;   // reutiliza un fix reciente: no pide GPS a cada momento
const GEO_TIMEOUT_MS = 15000;

let _finalizandoTarea = false;
const _tareasAbiertas = new Set();
const TIPOS_TRABAJO = ['Mide', 'Dime', 'Morosidad', 'Reclamos', 'NNSS Denuncias'];
const TIPO_LS = 'baremos_tipo_trabajo';
let _filtroTipo = null;   // null = ver todas

/* Checks de tipo de trabajo: se comportan como opcion unica (solo uno marcado) */
function tipoChecksInputs() {
  return Array.prototype.slice.call(document.querySelectorAll('.tipo-check-input'));
}

function tipoTrabajoSeleccionado() {
  const marcado = tipoChecksInputs().filter(i => i.checked)[0];
  if (marcado && marcado.value) return marcado.value;
  try { const v = localStorage.getItem(TIPO_LS); if (v && TIPOS_TRABAJO.indexOf(v) !== -1) return v; } catch (e) {}
  return TIPOS_TRABAJO[0];
}

function marcarTipoTrabajo(valor) {
  const inputs = tipoChecksInputs();
  if (!inputs.length) return;
  let hay = false;
  inputs.forEach(i => {
    const on = i.value === valor;
    i.checked = on;
    i.setAttribute('aria-checked', on ? 'true' : 'false');
    const lab = i.closest('.tipo-check');
    if (lab) lab.classList.toggle('activo', on);
    if (on) hay = true;
  });
  // Nunca queda ninguno marcado: siempre hay exactamente una opcion activa
  if (!hay) marcarTipoTrabajo(TIPOS_TRABAJO[0]);
}

function setupTipoTrabajo() {
  const inputs = tipoChecksInputs();
  if (!inputs.length) return;
  let inicial = TIPOS_TRABAJO[0];
  try { const v = localStorage.getItem(TIPO_LS); if (v && TIPOS_TRABAJO.indexOf(v) !== -1) inicial = v; } catch (e) {}
  marcarTipoTrabajo(inicial);
  inputs.forEach(inp => {
    inp.addEventListener('change', () => {
      // Seleccion exclusiva: al marcar uno se desmarcan los demas y no se puede dejar vacio
      marcarTipoTrabajo(inp.checked ? inp.value : tipoTrabajoSeleccionado());
      try { localStorage.setItem(TIPO_LS, tipoTrabajoSeleccionado()); } catch (e) {}
    });
  });
}
document.addEventListener('DOMContentLoaded', setupTipoTrabajo);

/* Chips por tipo de trabajo junto al título: contador + filtro */
function renderChipsTipos(tareas) {
  const box = document.getElementById('tareasDiaTipos');
  if (!box) return;
  const conteo = {};
  const totales = {};
  tareas.forEach(t => {
    const k = t.tipoTrabajo || 'Sin tipo';
    conteo[k] = (conteo[k] || 0) + 1;
    totales[k] = (totales[k] || 0) + (t.total || 0);
  });
  const extras = Object.keys(conteo).filter(k => TIPOS_TRABAJO.indexOf(k) === -1);
  const lista = TIPOS_TRABAJO.concat(extras);

  box.innerHTML = '<button class="tipo-chip todas' + (_filtroTipo ? '' : ' activo') + '" data-tipo="">Todas '
      + '<span class="tc-n">' + tareas.length + '</span></button>'
    + lista.map(k => {
      const n = conteo[k] || 0;
      return '<button class="tipo-chip' + (_filtroTipo === k ? ' activo' : '') + (n ? '' : ' vacio')
        + '" data-tipo="' + escapeHtml(k) + '" title="' + escapeHtml(k) + ': ' + n + ' tarea(s) · ' + fmt(totales[k] || 0) + '">'
        + escapeHtml(k) + ' <span class="tc-n">' + n + '</span></button>';
    }).join('');

  box.querySelectorAll('[data-tipo]').forEach(b => {
    b.onclick = () => {
      const v = b.dataset.tipo || null;
      _filtroTipo = (_filtroTipo === v) ? null : v;
      renderTareas();
    };
  });
}  // candado anti doble clic / anti duplicados
let _ultimaPosicion = null;     // { lat, lon, precision, ts }
let _ubicPendiente = null;      // contexto del modal manual

/* ---------------------------------------------------------------- helpers */

function tareasJornada() {
  if (!State.jornada) return [];
  if (!Array.isArray(State.tareas)) State.tareas = State.jornada.tareas || [];
  return State.tareas;
}

// Ítems todavía no asignados a ninguna tarea = tarea en curso
function itemsPendientes() {
  return (State.items || []).filter(it => !it.tareaId);
}

// Ítems que YA pertenecen a una tarea finalizada: son los únicos que suman
// al Total del día. Los baremos en curso recién se suman al finalizar la tarea.
function itemsFinalizados() {
  return (State.items || []).filter(it => !!it.tareaId);
}

// Mismo criterio pero sobre una jornada guardada (Historial, PDF, Excel)
function itemsFinalizadosDe(j) {
  return ((j && j.items) || []).filter(it => !!it.tareaId);
}

function totalFinalizadoDe(j) {
  // Se delega en la unica fuente de verdad, que ya resiste subtotales
  // roros, marcas tareaId perdidas y formatos viejos.
  return totalesDeJornada(j).total;
}

function itemsDeTarea(jornada, tareaId) {
  return (jornada.items || []).filter(it => it.tareaId === tareaId);
}

function siguienteCorrelativo() {
  const t = tareasJornada();
  let max = 0;
  t.forEach(x => {
    const n = parseInt(String(x.correlativo || '0'), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return String(max + 1).padStart(3, '0');
}

function horaCorta(iso) {
  try {
    const d = iso ? new Date(iso) : new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  } catch (e) { return ''; }
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ------------------------------------------------- persistencia de respaldo */
// Guarda un borrador del proceso para poder informar si el navegador se recarga.
// Los baremos ya están persistidos en IndexedDB, así que nunca se pierden.
function guardarBorradorProceso(estado) {
  try {
    const pend = itemsPendientes();
    localStorage.setItem(GEO_LS_EN_PROCESO, JSON.stringify({
      estado,
      jornadaId: State.jornada ? State.jornada.id : null,
      legajo: State.user ? State.user.legajo : null,
      usuario: State.user ? State.user.nombre : null,
      zona: State.user ? State.user.zona : null,
      fecha: State.jornada ? State.jornada.fecha : hoy(),
      hora: horaCorta(),
      cantidadBaremos: pend.length,
      cantidadItems: pend.reduce((a, i) => a + cantidadDeItem(i), 0),
      total: pend.reduce((a, i) => a + subtotalDeItem(i), 0),
      ts: Date.now()
    }));
  } catch (e) {}
}

function limpiarBorradorProceso() {
  try { localStorage.removeItem(GEO_LS_EN_PROCESO); } catch (e) {}
}

/* -------------------------------------------------------------- GPS + geo */

function obtenerPosicion() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject({ code: 'NO_API', message: 'Este dispositivo o navegador no permite obtener la ubicación.' });
      return;
    }
    // Reutiliza un fix reciente para no molestar al usuario en cada tarea
    if (_ultimaPosicion && (Date.now() - _ultimaPosicion.ts) < GEO_MAX_AGE_MS) {
      resolve(_ultimaPosicion);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          precision: typeof pos.coords.accuracy === 'number' ? Math.round(pos.coords.accuracy) : null,
          ts: Date.now()
        };
        _ultimaPosicion = p;
        resolve(p);
      },
      err => {
        let msg = 'No se pudo obtener la ubicación.';
        if (err && err.code === 1) msg = 'Permiso de ubicación denegado.';
        else if (err && err.code === 2) msg = 'GPS sin señal o desactivado.';
        else if (err && err.code === 3) msg = 'Se agotó el tiempo de espera del GPS.';
        reject({ code: err ? err.code : 'ERR', message: msg });
      },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS }
    );
  });
}

// Geocodificación inversa con Nominatim (OpenStreetMap). Nunca bloquea la tarea:
// si no hay Internet o falla, se conservan latitud y longitud como respaldo.
/* ------------------------------------------------------------
   CACHE Y FRENO DE CONSULTAS (v5.9.28)

   Nominatim es un servicio comunitario y gratuito: si se lo consulta
   sin control termina bloqueando la IP y las tareas se quedan sin
   direccion. Ahora:
     - Se recuerda cada direccion ya resuelta (redondeada a ~11 metros)
       durante 30 dias, asi la misma cuadra no se pregunta dos veces.
     - Nunca se hacen dos consultas seguidas con menos de 1,1 segundos
       de diferencia, que es lo que pide la politica de uso.
   El cache vive en localStorage, aparte de la base de jornadas: si se
   borra no se pierde ningun dato de trabajo.
   ------------------------------------------------------------ */
const GEO_CACHE_CLAVE = 'baremo_geo_cache';
const GEO_CACHE_MAX = 400;
const GEO_CACHE_DIAS = 30;
const GEO_ESPERA_MINIMA_MS = 1100;
let _geoUltimaConsulta = 0;

function geoClave(lat, lon) {
  return Number(lat).toFixed(4) + ',' + Number(lon).toFixed(4);
}

function geoCacheLeer() {
  try {
    const raw = localStorage.getItem(GEO_CACHE_CLAVE);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch (e) { return {}; }
}

function geoCacheBuscar(lat, lon) {
  const c = geoCacheLeer();
  const e = c[geoClave(lat, lon)];
  if (!e || !e.d) return null;
  if (Date.now() - (e.t || 0) > GEO_CACHE_DIAS * 86400000) return null;
  return e.d;
}

function geoCacheGuardar(lat, lon, datos) {
  try {
    const c = geoCacheLeer();
    c[geoClave(lat, lon)] = { t: Date.now(), d: datos };
    const claves = Object.keys(c);
    if (claves.length > GEO_CACHE_MAX) {
      claves.sort((a, b) => (c[a].t || 0) - (c[b].t || 0));
      for (let i = 0; i < claves.length - GEO_CACHE_MAX; i++) delete c[claves[i]];
    }
    localStorage.setItem(GEO_CACHE_CLAVE, JSON.stringify(c));
  } catch (e) {}
}

async function geocodificarInverso(lat, lon) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  if (lat == null || lon == null) return null;

  // 1) Si esta cuadra ya se resolvio antes, no se molesta al servicio.
  const enCache = geoCacheBuscar(lat, lon);
  if (enCache) return enCache;

  // 2) Freno: como minimo 1,1 s entre consultas.
  const desde = Date.now() - _geoUltimaConsulta;
  if (desde < GEO_ESPERA_MINIMA_MS) await esperar(GEO_ESPERA_MINIMA_MS - desde);
  _geoUltimaConsulta = Date.now();

  const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1'
    + '&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon) + '&accept-language=es';
  let ctrl = null, timer = null;
  try {
    ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (ctrl) timer = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined,
      headers: { 'Accept': 'application/json' }
    });
    if (timer) clearTimeout(timer);
    if (!r.ok) return null;
    const d = await r.json();
    const a = (d && d.address) || {};
    // Solo se conserva lo que el servicio realmente devuelve: no se inventa nada
    const calle = a.road || a.pedestrian || a.residential || a.footway || null;
    const altura = a.house_number || null;
    const barrio = a.neighbourhood || a.suburb || a.quarter || a.hamlet || null;
    const localidad = a.city || a.town || a.village || a.municipality || null;
    const partido = a.county || a.state_district || a.city_district || null;
    const partes = [];
    if (calle) partes.push(altura ? (calle + ' ' + altura) : calle);
    if (barrio) partes.push(barrio);
    if (localidad) partes.push(localidad);
    if (partido && partido !== localidad) partes.push(partido);
    const texto = partes.join(', ');
    if (!texto) return null;
    const resultado = { texto, calle, altura, barrio, localidad, partido };
    geoCacheGuardar(lat, lon, resultado);
    return resultado;
  } catch (e) {
    if (timer) clearTimeout(timer);
    return null;
  }
}

/* --------------------------------------------------- alta de la tarea real */

async function crearTareaFinalizada(ubic) {
  const pend = itemsPendientes();
  if (!State.jornada || !pend.length) return null;

  const ahoraISO = ahora();
  const tareaId = 'T' + Date.now() + '_' + Math.floor(Math.random() * 1000);

  const tarea = {
    id: tareaId,
    correlativo: siguienteCorrelativo(),
    fecha: State.jornada.fecha,
    hora: horaCorta(ahoraISO),
    horaISO: ahoraISO,
    usuario: State.user ? State.user.nombre : (State.jornada.usuario || ''),
    legajo: State.user ? State.user.legajo : (State.jornada.legajo || ''),
    zona: (State.user && State.user.zona) || State.jornada.zona || '',
    itemIds: pend.map(i => i.id),
    cantidadBaremos: pend.length,
    cantidadItems: pend.reduce((a, i) => a + cantidadDeItem(i), 0),
    total: pend.reduce((a, i) => a + subtotalDeItem(i), 0),
    lat: ubic && ubic.lat != null ? ubic.lat : null,
    lon: ubic && ubic.lon != null ? ubic.lon : null,
    precision: ubic && ubic.precision != null ? ubic.precision : null,
    direccion: ubic && ubic.direccion ? ubic.direccion : null,
    direccionDetalle: ubic && ubic.direccionDetalle ? ubic.direccionDetalle : null,
    direccionPendiente: !!(ubic && ubic.direccionPendiente),
    tipoUbicacion: ubic && ubic.tipoUbicacion ? ubic.tipoUbicacion : 'ninguna',
    tipoTrabajo: tipoTrabajoSeleccionado(),
    estado: 'finalizada'
  };

  // Marca (no mueve ni borra) los ítems que pasan a formar parte de la tarea
  pend.forEach(it => { it.tareaId = tareaId; });

  // La tarea quedo cerrada: se corta el recordatorio y vuelve a contar desde cero.
  limpiarRecordatorioDeCierre();

  // Si es la primera tarea cerrada de la jornada, se agenda el aviso de las 7 horas.
  marcarPrimerCierreDeTarea();

  tareasJornada().push(tarea);
  await saveJornada();
  renderAll();
  return tarea;
}

/* ------------------------------------------------------ estado del botón */

function setBotonFinalizar(estado) {
  const b = $('#btnFinalizarTarea');
  if (!b) return;
  if (estado === 'buscando') {
    b.disabled = true;
    b.classList.add('gps-buscando');
    b.textContent = '📍 Obteniendo ubicación GPS....';
  } else {
    b.disabled = false;
    b.classList.remove('gps-buscando');
    b.textContent = '✅ FINALIZAR TAREA';
  }
}

/* ------------------------------------------------------ modal de respaldo */

function abrirModalUbicacionManual(motivo) {
  const pend = itemsPendientes();
  const total = pend.reduce((a, i) => a + subtotalDeItem(i), 0);
  const m = $('#ubicMotivo');
  if (m) m.textContent = '⚠️ ' + (motivo || 'No se pudo obtener la ubicación.');
  const r = $('#ubicResumen');
  if (r) {
    r.innerHTML = 'La tarea está <strong>intacta</strong> y sigue guardada: '
      + '<strong>' + pend.length + '</strong> baremo(s), '
      + '<strong>' + pend.reduce((a, i) => a + cantidadDeItem(i), 0) + '</strong> ítem(s), total '
      + '<strong>' + fmt(total) + '</strong>.<br>Zona: <strong>'
      + escapeHtml((State.user && State.user.zona) || '-') + '</strong> · '
      + escapeHtml(fechaCorta(State.jornada ? State.jornada.fecha : hoy())) + ' ' + horaCorta();
  }
  const inp = $('#ubicManualInput');
  if (inp) inp.value = '';
  _ubicPendiente = { motivo: motivo || '' };
  guardarBorradorProceso('modal_manual');
  $('#modalUbicacion').classList.add('show');
  setTimeout(() => { if (inp) inp.focus(); }, 150);
}

function cerrarModalUbicacion() {
  $('#modalUbicacion').classList.remove('show');
  _ubicPendiente = null;
}

/* --------------------------------------------------------- flujo principal */

async function finalizarTarea() {
  if (_finalizandoTarea) return;                       // evita ejecuciones simultáneas
  if (!State.jornada) { toast('▶️ Primero tocá "Iniciar jornada"', 'warn'); return; }
  if (State.jornada.cerrada) { toast('La jornada está cerrada', 'warn'); return; }

  // Validación de ATS antes de finalizar la tarea
  if (!State.jornada.ats || !State.jornada.ats.completado) {
    toast('⚠️ Debés completar el ATS antes de registrar la tarea', 'warn');
    if (typeof abrirModalATS === 'function') abrirModalATS({ obligatorio: true });
    return;
  }

  const pend = itemsPendientes();
  if (!pend.length) { toast('Agregá al menos un baremo para finalizar la tarea', 'warn'); return; }

  _finalizandoTarea = true;
  setBotonFinalizar('buscando');
  guardarBorradorProceso('obteniendo_gps');

  try {
    const pos = await obtenerPosicion();
    let direccion = null, detalle = null, pendiente = false;
    const geo = await geocodificarInverso(pos.lat, pos.lon);
    if (geo) { direccion = geo.texto; detalle = geo; }
    else { pendiente = true; }

    const tarea = await crearTareaFinalizada({
      lat: pos.lat,
      lon: pos.lon,
      precision: pos.precision,
      direccion,
      direccionDetalle: detalle,
      direccionPendiente: pendiente,
      tipoUbicacion: 'gps'
    });

    limpiarBorradorProceso();
    if (tarea) {
      toast('TAREA ' + tarea.correlativo + ' finalizada · ' + fmt(tarea.total)
        + (direccion ? '' : ' · coordenadas guardadas'), 'success');
    }
  } catch (err) {
    // La tarea NO se pierde: se ofrece el respaldo manual
    abrirModalUbicacionManual(err && err.message ? err.message : 'No se pudo obtener la ubicación.');
  } finally {
    setBotonFinalizar('normal');
    _finalizandoTarea = false;
  }
}

async function guardarUbicacionManual(texto) {
  if (_finalizandoTarea) return;
  const ref = String(texto || '').trim();
  if (!ref) { toast('Ingresá una dirección o referencia', 'warn'); return; }
  if (!itemsPendientes().length) { cerrarModalUbicacion(); toast('No hay baremos para finalizar', 'warn'); return; }

  _finalizandoTarea = true;
  try {
    const tarea = await crearTareaFinalizada({
      lat: null,               // nunca se inventan coordenadas para una ubicación manual
      lon: null,
      precision: null,
      direccion: ref,
      direccionPendiente: false,
      tipoUbicacion: 'manual'
    });
    limpiarBorradorProceso();
    cerrarModalUbicacion();
    if (tarea) toast('TAREA ' + tarea.correlativo + ' finalizada con ubicación manual', 'success');
  } finally {
    _finalizandoTarea = false;
    setBotonFinalizar('normal');
  }
}

/* ------------------------------------------------------------- ver en mapa */

function urlMapaTarea(t) {
  if (!t) return null;
  if (t.lat != null && t.lon != null) {
    return 'https://www.google.com/maps/search/?api=1&query=' + t.lat + ',' + t.lon;
  }
  if (t.direccion) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t.direccion);
  }
  return null;
}

/* ------------------------------------------- TAREAS DEL DÍA (FINALIZADAS) */

function renderTareas() {
  const wrap = $('#tareasDiaWrap');
  const lst = $('#tareasDiaList');
  const cnt = $('#tareasDiaCount');
  if (!wrap || !lst) return;

  // La última tarea cerrada siempre queda en la cima (orden descendente)
  const tareas = tareasJornada().slice().sort((a, b) => {
    const ta = a.horaISO ? Date.parse(a.horaISO) : 0;
    const tb = b.horaISO ? Date.parse(b.horaISO) : 0;
    if (tb !== ta) return tb - ta;
    return String(b.correlativo || '').localeCompare(String(a.correlativo || ''));
  });
  if (!tareas.length) { wrap.style.display = 'none'; lst.innerHTML = ''; return; }

  wrap.style.display = 'block';
  if (cnt) cnt.textContent = tareas.length;
  renderChipsTipos(tareas);

  const visibles = _filtroTipo
    ? tareas.filter(t => (t.tipoTrabajo || 'Sin tipo') === _filtroTipo)
    : tareas;

  if (!visibles.length) {
    lst.innerHTML = '<div class="tareas-vacio">Sin tareas de «' + escapeHtml(_filtroTipo) + '» en el día</div>';
    return;
  }

  lst.innerHTML = visibles.map(t => {
    const items = itemsDeTarea(State.jornada, t.id);
    const tipo = t.tipoUbicacion || 'ninguna';
    const badge = tipo === 'gps'
      ? '<span class="tarea-badge gps">GPS</span>'
      : (tipo === 'manual' ? '<span class="tarea-badge manual">MANUAL</span>'
                           : '<span class="tarea-badge sin">SIN UBICACIÓN</span>');
    const dir = t.direccion
      ? escapeHtml(t.direccion)
      : (t.lat != null ? 'Coordenadas ' + Number(t.lat).toFixed(5) + ', ' + Number(t.lon).toFixed(5)
                       : 'Ubicación no registrada');
    const url = urlMapaTarea(t);
    const baremos = items.length
      ? items.map(it => '<div class="tarea-baremo-item"><span class="tb-cod">' + escapeHtml(it.codigo)
          + '</span><span class="tb-desc" title="' + escapeHtml(it.descripcion) + '">'
          + escapeHtml(it.descripcion) + '</span><span class="tb-sub">x' + it.cantidad + ' · '
          + fmt(it.subtotal) + '</span></div>').join('')
      : '<div class="tarea-baremo-item"><span class="tb-desc">Sin baremos asociados</span></div>';

    const abierta = _tareasAbiertas.has(t.id);
    return '<div class="tarea-card ubic-' + tipo + (abierta ? ' open' : '') + '" data-tarea="' + t.id + '">'
      + '<div class="tarea-card-top" data-toggle-tarea="' + t.id + '" role="button" tabindex="0" aria-expanded="' + (abierta ? 'true' : 'false') + '">'
      + '<div class="tarea-num">TAREA ' + escapeHtml(t.correlativo)
      + (t.tipoTrabajo ? '<span class="tarea-tipo">' + escapeHtml(t.tipoTrabajo) + '</span>' : '') + '</div>'
      + '<span class="tarea-caret">▼</span></div>'
      + '<div class="tarea-row meta"><span class="v">🕒 ' + escapeHtml(fechaCorta(t.fecha)) + ' ' + escapeHtml(t.hora || '') + '</span>'
      + '<span class="meta-sep">·</span><span class="v">📍 ' + escapeHtml(t.zona || '-') + '</span></div>'
      + '<div class="tarea-row dir"><span class="k">Dirección:</span>'
      + '<span class="dir-chip ' + tipo + '" title="' + (tipo === 'manual' ? 'Ubicación manual' : (tipo === 'gps' ? 'Ubicación GPS' : 'Sin ubicación')) + '">📍 ' + dir + '</span>'
      + (url ? '<a class="tarea-mapa" href="' + url + '" target="_blank" rel="noopener noreferrer">🗺️ Ver mapa</a>' : '')
      + '</div>'
      + '<div class="tarea-row total"><span class="k">Total de la tarea:</span><span class="tarea-total">' + fmt(t.total || 0) + '</span></div>'
      + '<div class="tarea-body">'
      + '<div class="tarea-baremos"><div class="tarea-baremos-lbl">Baremos incluidos (' + items.length + '):</div>' + baremos + '</div>'
      + '<div class="tarea-card-actions"><button class="tarea-del-btn" data-del-tarea="' + t.id + '">🗑️ ELIMINAR</button></div>'
      + '</div></div>';
  }).join('');

  lst.querySelectorAll('[data-del-tarea]').forEach(b => {
    b.onclick = async e => {
      e.stopPropagation();
      await eliminarTarea(b.dataset.delTarea);
    };
  });

  // Expandir / colapsar: los baremos se ven al expandir la tarea
  lst.querySelectorAll('[data-toggle-tarea]').forEach(h => {
    const toggle = e => {
      if (e.target && e.target.closest('a')) return;
      const id = h.dataset.toggleTarea;
      const card = h.closest('.tarea-card');
      if (!card) return;
      const abrir = !card.classList.contains('open');
      card.classList.toggle('open', abrir);
      h.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      if (abrir) _tareasAbiertas.add(id); else _tareasAbiertas.delete(id);
    };
    h.onclick = toggle;
    h.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } };
  });
}

/* Mantiene la barra "Buscar baremos" siempre visible bajo la cabecera al hacer scroll */
function ajustarStickyBusqueda() {
  const h = document.querySelector('.app-header');
  if (!h) return;
  const alto = Math.round(h.getBoundingClientRect().height);
  if (alto > 0) document.documentElement.style.setProperty('--hdr-h', alto + 'px');
}
window.addEventListener('resize', ajustarStickyBusqueda);
window.addEventListener('orientationchange', ajustarStickyBusqueda);
document.addEventListener('DOMContentLoaded', () => {
  ajustarStickyBusqueda();
  setTimeout(ajustarStickyBusqueda, 600);
  setTimeout(ajustarStickyBusqueda, 1800);
  const hd = document.querySelector('.app-header');
  if (hd && window.ResizeObserver) { try { new ResizeObserver(ajustarStickyBusqueda).observe(hd); } catch (e) {} }
});

// Usa el sistema de confirmación existente: nunca elimina con un clic accidental
async function eliminarTarea(tareaId) {
  const t = tareasJornada().find(x => x.id === tareaId);
  if (!t) return;
  const items = itemsDeTarea(State.jornada, tareaId);
  const ok = await confirmDialog('¿Eliminar la TAREA ' + t.correlativo + '?\n'
    + items.length + ' baremo(s) · ' + fmt(t.total || 0) + '\nEsta acción no se puede deshacer.');
  if (!ok) return;
  State.tareas = tareasJornada().filter(x => x.id !== tareaId);
  State.items = (State.items || []).filter(it => it.tareaId !== tareaId);
  await saveJornada();
  renderAll();
  toast('TAREA ' + t.correlativo + ' eliminada', 'success');
}

/* ------------------------------------ permiso de ubicación al primer inicio */

async function solicitarPermisoUbicacionInicial() {
  let yaPreguntado = false;
  try { yaPreguntado = localStorage.getItem(GEO_LS_ONBOARDING) === '1'; } catch (e) {}
  if (yaPreguntado) return;
  if (!('geolocation' in navigator)) return;

  try {
    if (navigator.permissions && navigator.permissions.query) {
      const st = await navigator.permissions.query({ name: 'geolocation' });
      if (st && st.state === 'granted') {
        try { localStorage.setItem(GEO_LS_ONBOARDING, '1'); } catch (e) {}
        return;                         // ya autorizado: no se vuelve a molestar
      }
      if (st && st.state === 'denied') {
        try { localStorage.setItem(GEO_LS_ONBOARDING, '1'); } catch (e) {}
        return;                         // ya denegado: no insistir
      }
    }
  } catch (e) {}

  try { localStorage.setItem(GEO_LS_ONBOARDING, '1'); } catch (e) {}
  navigator.geolocation.getCurrentPosition(
    pos => {
      _ultimaPosicion = {
        lat: pos.coords.latitude, lon: pos.coords.longitude,
        precision: typeof pos.coords.accuracy === 'number' ? Math.round(pos.coords.accuracy) : null,
        ts: Date.now()
      };
      toast('Ubicación habilitada para registrar tus tareas', 'success');
    },
    () => { /* si rechaza, no se insiste: al finalizar una tarea existe el respaldo manual */ },
    { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS }
  );
}

/* --------------------------------------------------------------- arranque */

function setupTareasGPS() {
  const b = $('#btnFinalizarTarea');
  if (b) b.addEventListener('click', finalizarTarea);

  const form = $('#formUbicacionManual');
  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();
      await guardarUbicacionManual($('#ubicManualInput').value);
    };
  }
  const cancelar = $('#ubicCancelar');
  if (cancelar) {
    cancelar.onclick = () => {
      cerrarModalUbicacion();
      limpiarBorradorProceso();
      toast('Tarea sin finalizar: tus baremos siguen guardados', 'info');
    };
  }
  const reintentar = $('#ubicReintentar');
  if (reintentar) {
    reintentar.onclick = async () => {
      cerrarModalUbicacion();
      _ultimaPosicion = null;              // fuerza una lectura nueva del GPS
      await finalizarTarea();
    };
  }

  // Aviso si el navegador se recargó en medio del proceso (nada se perdió)
  try {
    const raw = localStorage.getItem(GEO_LS_EN_PROCESO);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.cantidadBaremos > 0) {
        setTimeout(() => toast('Se recuperó una tarea sin finalizar: ' + d.cantidadBaremos + ' baremo(s) intactos', 'info'), 1200);
      }
      limpiarBorradorProceso();
    }
  } catch (e) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupTareasGPS);
} else {
  setupTareasGPS();
}

/* ============================================================================
   UBICACIÓN EN HISTORIAL Y REPORTES PDF (aditivo)
   No altera el formato existente: solo agrega un bloque cuando la jornada
   contiene tareas con ubicación. Las jornadas antiguas no se modifican.
   ========================================================================== */

function textoUbicacionTarea(t) {
  if (!t) return 'Ubicación no registrada';
  if (t.direccion) {
    return t.direccion + (t.tipoUbicacion === 'manual' ? ' (manual)' : '');
  }
  if (t.lat != null && t.lon != null) {
    return 'Lat ' + Number(t.lat).toFixed(5) + ' / Lon ' + Number(t.lon).toFixed(5);
  }
  return 'Ubicación no registrada';
}

// Detalle de jornada (Historial): agrega tarea, fecha, hora, zona, dirección,
// ubicación, baremos y total. Si no hay tareas registradas, informa el caso.
function renderUbicacionesJornada(j) {
  const modal = document.querySelector('#modalJornada .modal');
  if (!modal) return;
  let box = document.getElementById('mjUbicaciones');
  if (!box) {
    box = document.createElement('div');
    box.id = 'mjUbicaciones';
    box.className = 'mj-ubic';
    const tabla = modal.querySelector('.table-wrap');
    if (tabla) modal.insertBefore(box, tabla);
    else modal.appendChild(box);
  }

  const tareas = Array.isArray(j.tareas) ? j.tareas : [];
  if (!tareas.length) {
    box.innerHTML = '<div class="mj-ubic-title">📍 Ubicación de tareas</div>'
      + '<div class="mj-ubic-row" style="color:var(--text-soft)">Ubicación no registrada</div>';
    return;
  }

  box.innerHTML = '<div class="mj-ubic-title">📍 Tareas con ubicación (' + tareas.length + ')</div>'
    + tareas.map(t => {
      const items = (j.items || []).filter(it => it.tareaId === t.id);
      const url = urlMapaTarea(t);
      const tipo = t.tipoUbicacion === 'gps' ? 'GPS' : (t.tipoUbicacion === 'manual' ? 'Manual' : 'No registrada');
      return '<div class="mj-ubic-row">'
        + '<strong>TAREA ' + escapeHtml(t.correlativo) + '</strong> · ' + escapeHtml(fechaCorta(t.fecha)) + ' ' + escapeHtml(t.hora || '') + '<br>'
        + 'Zona: ' + escapeHtml(t.zona || '-') + ' · Tipo: ' + escapeHtml(t.tipoTrabajo || 'No registrado')
        + ' · Ubicación: ' + escapeHtml(tipo) + '<br>'
        + 'Dirección: ' + escapeHtml(textoUbicacionTarea(t)) + '<br>'
        + 'Baremos: ' + items.length + ' · Total: <strong>' + fmt(t.total || 0) + '</strong>'
        + (url ? ' · <a href="' + url + '" target="_blank" rel="noopener noreferrer">🗺️ Ver mapa</a>' : '')
        + '</div>';
    }).join('');
}

// Agrega al PDF una tabla compacta con la ubicación de las tareas de la jornada.
// Devuelve la nueva coordenada Y. Si la jornada no tiene tareas, no cambia nada.
function agregarTablaUbicacionesPDF(doc, j, y) {
  const tareas = Array.isArray(j.tareas) ? j.tareas : [];
  if (!tareas.length || !doc.autoTable) return y;

  if (y > 235) { doc.addPage(); y = 25; }

  const body = tareas.map(t => [
    'TAREA ' + (t.correlativo || '') + (t.tipoTrabajo ? '\n' + t.tipoTrabajo : ''),
    fechaCorta(t.fecha) + ' ' + (t.hora || ''),
    t.zona || '-',
    textoUbicacionTarea(t),
    (t.lat != null && t.lon != null) ? (Number(t.lat).toFixed(5) + ', ' + Number(t.lon).toFixed(5)) : '-',
    fmt(t.total || 0)
  ]);

  doc.autoTable({
    startY: y,
    head: [['Tarea', 'Fecha / Hora', 'Zona', 'Dirección', 'Coordenadas', 'Total']],
    body,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [21, 163, 91] },
    columnStyles: { 3: { cellWidth: 55 } },
    margin: { left: 14, right: 14 }
  });

  return doc.lastAutoTable.finalY + 8;
}

/* ===================== v5.9.28 =====================
   Refuerzo silencioso del bloqueo de seleccion. El CSS ya lo evita, pero
   algunos navegadores todavia permiten seleccionar con doble clic, con
   triple clic o arrastrando. Esto lo cancela sin mostrar ningun aviso.
   Los campos de formulario quedan excluidos para poder escribir en ellos.
   =================================================== */
(function bloquearSeleccionDeTexto() {
  const esEditable = el => {
    if (!el || !el.closest) return false;
    return !!el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
  };
  document.addEventListener('selectstart', e => {
    if (!esEditable(e.target)) e.preventDefault();
  }, { capture: true });
  document.addEventListener('dragstart', e => {
    if (!esEditable(e.target)) e.preventDefault();
  }, { capture: true });
  // Doble y triple clic seleccionan antes del selectstart en algunos motores:
  // se limpia lo que haya quedado marcado, siempre en silencio.
  const limpiar = e => {
    if (esEditable(e.target)) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed) sel.removeAllRanges();
  };
  document.addEventListener('mousedown', e => { if (e.detail > 1) limpiar(e); }, { capture: true });
  document.addEventListener('mouseup', limpiar, { capture: true });
})();

/* ============================================================
   RECORDATORIO DE CIERRE DE TAREA (v5.9.28)

   Si el usuario cargo baremos y paso el tiempo sin finalizar la
   tarea, la app avisa con una notificacion del sistema (aparece
   aunque la app este en segundo plano) para que cierre la tarea
   actual y pueda arrancar la siguiente. Se repite cada 10 minutos
   mientras siga sin cerrarse y se corta solo al finalizar la tarea
   o al cerrar la jornada.
   ============================================================ */
const RECORDATORIO_MINUTOS = 10;
const RECORDATORIO_MS = RECORDATORIO_MINUTOS * 60 * 1000;
const RECORDATORIO_CHEQUEO_MS = 30 * 1000;
const LS_PENDIENTE_DESDE = 'baremo_pendiente_desde';
const LS_ULTIMO_RECORDATORIO = 'baremo_ultimo_recordatorio';
const LS_PERMISO_PEDIDO = 'baremo_permiso_notif_pedido';
const TAG_RECORDATORIO = 'baremo-cierre-tarea';
let _recordatorioActivo = false;

function lsNum(clave) {
  try { return parseInt(localStorage.getItem(clave)) || 0; } catch (e) { return 0; }
}

function lsSet(clave, valor) {
  try { localStorage.setItem(clave, String(valor)); } catch (e) {}
}

function lsDel(clave) {
  try { localStorage.removeItem(clave); } catch (e) {}
}

/* Arranca el reloj en el primer baremo de la tarea. Si ya estaba corriendo
   no se reinicia: el tiempo se cuenta desde el primer baremo cargado. */
function marcarBaremoPendiente() {
  if (!lsNum(LS_PENDIENTE_DESDE)) lsSet(LS_PENDIENTE_DESDE, Date.now());
}

function limpiarRecordatorioDeCierre() {
  lsDel(LS_PENDIENTE_DESDE);
  lsDel(LS_ULTIMO_RECORDATORIO);
  // Se baja la notificacion que hubiera quedado en la barra del telefono.
  try {
    if (swRegistration && swRegistration.getNotifications) {
      swRegistration.getNotifications({ tag: TAG_RECORDATORIO })
        .then(ns => ns.forEach(n => n.close()))
        .catch(() => {});
    }
  } catch (e) {}
}

/* El permiso se pide en el momento en que el usuario carga un baremo (es un
   gesto suyo) y solo una vez. Si lo rechaza, el aviso igual se muestra dentro
   de la app y no se lo vuelve a molestar. */
function pedirPermisoNotificaciones(forzar) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    // v5.9.35 - el automatico sigue siendo una sola vez, pero el boton de
    // Ajustes puede volver a pedirlo si el usuario cerro el cartel sin elegir.
    if (!forzar && lsNum(LS_PERMISO_PEDIDO)) return;
    lsSet(LS_PERMISO_PEDIDO, 1);
    const p = Notification.requestPermission();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {}
}

async function avisarCierreDeTarea(minutos, cantidad, total) {
  const titulo = 'Tarea sin finalizar';
  const cuerpo = 'Tenés ' + cantidad + ' baremo(s) cargados hace ' + minutos +
    ' min por ' + fmt(total) + '. Finalizá la tarea para poder continuar con la siguiente.';

  let mostrada = false;

  // 1) Notificacion del sistema por service worker: es la que aparece aunque
  //    la app este cerrada o en segundo plano.
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const reg = swRegistration ||
        (navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null);
      if (reg && reg.showNotification) {
        await reg.showNotification(titulo, {
          body: cuerpo,
          tag: TAG_RECORDATORIO,
          renotify: true,
          requireInteraction: false,
          icon: './icons/icon-192.png?v=' + APP_VERSION,
          badge: './icons/icon-192.png?v=' + APP_VERSION,
          vibrate: [200, 100, 200],
          data: { tipo: 'cierre-tarea' }
        });
        mostrada = true;
      } else if (typeof Notification === 'function') {
        new Notification(titulo, { body: cuerpo, tag: TAG_RECORDATORIO });
        mostrada = true;
      }
    }
  } catch (e) {}

  // 2) Si la app esta abierta a la vista, ademas se avisa adentro.
  if (document.visibilityState === 'visible') {
    try { toast('Finalizá la tarea: ' + cantidad + ' baremo(s) hace ' + minutos + ' min', 'warn'); } catch (e) {}
  }

  lsSet(LS_ULTIMO_RECORDATORIO, Date.now());
  return mostrada;
}

function revisarRecordatorioDeCierre() {
  try {
    const pend = (typeof itemsPendientes === 'function') ? itemsPendientes() : [];

    // No hay nada abierto: se limpia cualquier marca vieja.
    if (!pend.length || !State.jornada || State.jornada.cerrada) {
      if (lsNum(LS_PENDIENTE_DESDE)) limpiarRecordatorioDeCierre();
      return;
    }

    // Hay baremos sin cerrar pero no habia marca (por ejemplo, jornada
    // restaurada al abrir la app): se empieza a contar ahora.
    let desde = lsNum(LS_PENDIENTE_DESDE);
    if (!desde) { desde = Date.now(); lsSet(LS_PENDIENTE_DESDE, desde); return; }

    const transcurrido = Date.now() - desde;
    if (transcurrido < RECORDATORIO_MS) return;

    const ultimo = lsNum(LS_ULTIMO_RECORDATORIO);
    if (ultimo && Date.now() - ultimo < RECORDATORIO_MS) return;

    const minutos = Math.floor(transcurrido / 60000);
    const total = pend.reduce((a, i) => a + (i.subtotal || 0), 0);
    avisarCierreDeTarea(minutos, pend.length, total);
  } catch (e) {}
}

function iniciarRecordatorioDeCierre() {
  if (_recordatorioActivo) return;
  _recordatorioActivo = true;

  setInterval(revisarRecordatorioDeCierre, RECORDATORIO_CHEQUEO_MS);

  // Al volver a la app se revisa en el momento (el intervalo puede quedar
  // frenado mientras el telefono esta en segundo plano).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') revisarRecordatorioDeCierre();
  });
  window.addEventListener('focus', revisarRecordatorioDeCierre);

  // Si el usuario toca la notificacion, se lo lleva a la vista correspondiente.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', ev => {
      if (ev.data && ev.data.tipo === 'PUSH_RECIBIDO') {
        if (typeof mostrarAlertaSupervisorEnVivo === 'function') {
          mostrarAlertaSupervisorEnVivo(ev.data.payload);
        }
        return;
      }
      if (ev.data && (ev.data.tipo === 'IR_A_REGISTRO' || ev.data.tipo === 'IR_A_VISTA')) {
        const vista = ev.data.vista || 'Registro';
        try { showView(vista); } catch (e) {
          try { showView('Registro'); } catch (e2) {}
        }
        if (ev.data.accion === 'abrir_ats') {
          setTimeout(() => {
            if (typeof abrirModalATS === 'function') abrirModalATS({ obligatorio: true });
          }, 200);
        } else if (ev.data.accion === 'cerrar_jornada') {
          setTimeout(() => {
            if (typeof atenderJornadaPendientePush === 'function') atenderJornadaPendientePush();
          }, 300);
        } else if (ev.data.accion === 'ver_aviso' || vista === 'AvisosEmpresa') {
          setTimeout(() => {
            if (typeof abrirModalAvisosEmpresa === 'function') abrirModalAvisosEmpresa();
          }, 300);
        }
      }
    });
  }

  setTimeout(revisarRecordatorioDeCierre, 5000);
  setTimeout(revisarAvisosProgramados, 6000);
}

/* ============================================================
   NOTIFICACIONES LOCALES (v5.9.28)

   Tres avisos nuevos:
   1) Total del dia entre 50.000 y 100.000 -> aliento para seguir.
   2) Reporte PDF generado.
   3) Pasaron 7 horas desde el primer cierre de tarea -> recordar
      cerrar la jornada, controlar las ganancias y reportar.

   Para que aparezcan aunque la app este cerrada o suspendida (lo mas
   parecido posible a las notificaciones de las redes sociales, siendo
   una PWA sin servidor de push) se combinan tres mecanismos:

   - Siempre se muestran por el service worker, asi caen en la barra
     de notificaciones del sistema con icono, vibracion y sonido.
   - Los avisos con hora futura se guardan en IndexedDB (no en
     localStorage, porque el service worker no puede leer localStorage).
   - El service worker se despierta solo con Periodic Background Sync y
     revisa los avisos vencidos con la app cerrada. Donde el navegador
     no lo soporte, se revisan al volver a la app.

   Se usa una base propia y separada para no tocar la base de datos de
   las jornadas.
   ============================================================ */
const AVISOS_DB_NAME = 'BaremoAvisos';
const AVISOS_DB_VERSION = 1;
const AVISOS_STORE = 'avisos';
const SYNC_TAG_AVISOS = 'baremo-avisos';

const TAG_BAJO_RENDIMIENTO = 'baremo-aliento';
const TAG_PDF = 'baremo-pdf';
const TAG_CIERRE_JORNADA = 'baremo-cierre-jornada';

const HORAS_CIERRE_JORNADA = 7;
const MS_CIERRE_JORNADA = HORAS_CIERRE_JORNADA * 60 * 60 * 1000;
const LS_PRIMER_CIERRE = 'baremo_primer_cierre_tarea';
const LS_AVISO_JORNADA_HECHO = 'baremo_aviso_jornada_hecho';
const ID_AVISO_JORNADA = 'cierre-jornada';

/* v5.9.28 - El aviso de aliento espera al menos 1 minuto dentro del rango
   antes de salir, para no aparecer justo al cerrar la tarea. */
const MS_ESPERA_ALIENTO = 60 * 1000;
const LS_ALIENTO_DESDE = 'baremo_aliento_desde';

/* v5.9.28 - Frases de aliento mientras la jornada esta abierta.
   Se elige una al azar y nunca salen a menos de una hora de distancia. */
const FRASES_JORNADA = [
  'Hoy es un buen día para realizar producción.',
  'Tratá de cumplir tu objetivo y olvidate de los problemas.',
  'Si continuás así estarás en la cima del reporte.',
  'Recordá reportar a tu supervisor cualquier problema.',
  'Si tenés dudas en una tarea llamá a tu supervisor.',
  'Asegurate de cobrar el Baremo correcto.',
  'No olvides consumir los materiales en FSM.'
];
const MS_ENTRE_FRASES = 60 * 60 * 1000;
const LS_ULTIMA_FRASE = 'baremo_ultima_frase_jornada';
const LS_INDICE_FRASE = 'baremo_ultimo_indice_frase';
const TAG_FRASE = 'baremo-animo';
const ID_AVISO_FRASE = 'frase-jornada';

/* ---------- v5.9.35: AVISOS DE INICIO DE MES ----------
   Del 01 al 03 de cada mes, en varias franjas de la manana, sale un aviso
   especial de arranque de mes. Se elige una frase al azar sin repetir la
   anterior y se muestra una sola vez por dia.
   Los tres avisos quedan AGENDADOS en IndexedDB apenas se sabe la fecha, asi
   el service worker los dispara aunque la app este cerrada (que es lo que
   fallaba: sin nada agendado, el despertador no tenia que mostrar). Cada uno
   ademas lleva fecha de expiracion: si el telefono despierta al service
   worker recien al otro dia, el aviso viejo ya no molesta. */
const DIAS_INICIO_MES = 3;
/* v5.9.35 - varias veces al dia, siempre en horas de la manana. Cada franja
   es un aviso propio, con su propia frase, para los dias 01, 02 y 03. */
const HORAS_AVISO_MES = [[8, 0], [10, 0], [11, 30]];
const HORA_LIMITE_MES = 13;   // pasado el mediodia el aviso del mes ya no sale
const TAG_INICIO_MES = 'baremo-inicio-mes';
const LS_INDICE_MES = 'baremo_indice_frase_mes';
const LS_NOTIF_OK = 'baremo_notif_ok';
/* v5.9.36 - aviso del reporte mensual, al dia siguiente del cierre del mes. */
const TAG_REPORTE_MES = 'baremo-reporte-mes';
const HORA_REPORTE_MES = 9;
const DIAS_VIGENCIA_REPORTE = 7;
const FRASES_INICIO_MES = [
  'Aprovechá el inicio del mes para producir.',
  'Iniciá tu mes productivo.',
  'Arranca el nuevo mes productivo.',
  'Este mes la vas a romper con tu producción.',
  'Iniciá el mes con buen pie.',
  '¡Vamos! Esto recién comienza.'
];

/* ---------- Base de avisos (compartida con el service worker) ---------- */
function abrirAvisosDB() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(AVISOS_DB_NAME, AVISOS_DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(AVISOS_STORE)) {
          d.createObjectStore(AVISOS_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

async function guardarAvisoProgramado(aviso) {
  try {
    const d = await abrirAvisosDB();
    await new Promise((res, rej) => {
      const r = d.transaction(AVISOS_STORE, 'readwrite').objectStore(AVISOS_STORE).put(aviso);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    d.close();
  } catch (e) {}
}

async function borrarAvisoProgramado(id) {
  try {
    const d = await abrirAvisosDB();
    await new Promise((res, rej) => {
      const r = d.transaction(AVISOS_STORE, 'readwrite').objectStore(AVISOS_STORE).delete(id);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    d.close();
  } catch (e) {}
}

async function leerAvisosProgramados() {
  try {
    const d = await abrirAvisosDB();
    const todos = await new Promise((res, rej) => {
      const r = d.transaction(AVISOS_STORE).objectStore(AVISOS_STORE).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
    d.close();
    return todos;
  } catch (e) { return []; }
}

/* ---------- Motor de notificaciones ----------
   Mismo camino ya probado para el recordatorio de tarea: primero el
   service worker (bandeja del sistema), si no se puede una notificacion
   comun, y si la app esta a la vista tambien un aviso adentro. */
/* v5.9.28 - Enmascarado del origen.
   El navegador es el que dibuja la linea con el sitio debajo del texto y no
   se puede borrar por codigo. Pero cuando la PWA corre INSTALADA, el sistema
   muestra el nombre de la app (BAREMO) en lugar de la direccion. Asi que la
   bandeja del sistema se usa solo en ese caso; en una pestana del navegador
   el aviso se da adentro de la app y la direccion nunca queda a la vista. */
function appInstalada() {
  try {
    if (navigator.standalone === true) return true;          // iPhone
    if (window.matchMedia) {
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
      if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
      if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
    }
  } catch (e) {}
  return false;
}

/* Una vez que se detecta instalada queda anotado, asi el aviso agendado
   tambien puede salir cuando la app arranco cerrada. */
function recordarSiEstaInstalada() {
  try { if (appInstalada()) lsSet('baremo_instalada', 1); } catch (e) {}
}

function puedeMostrarEnLaBandeja() {
  // v5.9.35 - si el usuario activo las notificaciones a mano desde Ajustes,
  // se usa la bandeja del sistema aunque la deteccion de instalada falle.
  try { return appInstalada() || !!lsNum('baremo_instalada') || !!lsNum(LS_NOTIF_OK); }
  catch (e) { return false; }
}

async function notificarLocal(opciones) {
  const titulo = opciones.titulo;
  const cuerpo = opciones.cuerpo;
  const tag = opciones.tag;
  let mostrada = false;

  try {
    if ('Notification' in window && Notification.permission === 'granted' && puedeMostrarEnLaBandeja()) {
      const reg = swRegistration ||
        (navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null);
      if (reg && reg.showNotification) {
        await reg.showNotification(titulo, {
          body: cuerpo,
          tag: tag,
          renotify: true,
          requireInteraction: !!opciones.requiereInteraccion,
          silent: false,
          icon: './icons/icon-192.png?v=' + APP_VERSION,
          badge: './icons/icon-192.png?v=' + APP_VERSION,
          vibrate: opciones.vibrar || [200, 100, 200],
          timestamp: Date.now(),
          data: opciones.datos || { tipo: tag }
        });
        mostrada = true;
      } else if (typeof Notification === 'function') {
        new Notification(titulo, { body: cuerpo, tag: tag });
        mostrada = true;
      }
    }
  } catch (e) {}

  if (document.visibilityState === 'visible') {
    try { toast(opciones.toast || cuerpo, opciones.tipoToast || 'info'); } catch (e) {}
  }

  return mostrada;
}

/* ---------- 1) Total del dia entre 50.000 y 100.000 ---------- */
function claveAvisoAliento() {
  const fecha = (State.jornada && State.jornada.fecha) ? State.jornada.fecha : 'sin-fecha';
  return 'baremo_aviso_50k_' + fecha;
}

/* v5.9.28 - Ya no notifica en el momento: solo anota desde cuando el total
   esta en el rango. El aviso sale despues, si al minuto sigue ahi. */
function avisarBajoRendimiento(total) {
  try {
    if (!(total >= 50000 && total < 100000)) { lsDel(LS_ALIENTO_DESDE); return; }
    if (lsNum(claveAvisoAliento())) return;      // ya salio en esta jornada
    if (!lsNum(LS_ALIENTO_DESDE)) lsSet(LS_ALIENTO_DESDE, Date.now());
  } catch (e) {}
}

/* Total del dia con el mismo criterio que la pantalla: solo tareas finalizadas. */
function totalFinalizadoActual() {
  try {
    const fin = typeof itemsFinalizados === 'function'
      ? itemsFinalizados()
      : (State.items || []).filter(i => i.tareaId);
    return fin.reduce((a, i) => a + (i.subtotal || 0), 0);
  } catch (e) { return 0; }
}

/* Se llama en cada revision (cada minuto). Si paso la espera y el total
   sigue entre 50.000 y 100.000, recien ahi avisa. Una vez por jornada. */
async function revisarAlientoPendiente() {
  try {
    const desde = lsNum(LS_ALIENTO_DESDE);
    if (!desde) return;

    const jornadaAbierta = !!(State.jornada && !State.jornada.cerrada);
    if (!jornadaAbierta) { lsDel(LS_ALIENTO_DESDE); return; }

    const clave = claveAvisoAliento();
    if (lsNum(clave)) { lsDel(LS_ALIENTO_DESDE); return; }

    const total = totalFinalizadoActual();
    if (!(total >= 50000 && total < 100000)) { lsDel(LS_ALIENTO_DESDE); return; }
    if (Date.now() - desde < MS_ESPERA_ALIENTO) return;

    lsSet(clave, Date.now());
    lsDel(LS_ALIENTO_DESDE);

    await notificarLocal({
      titulo: '¡Estás muy bajo para rendirte!',
      cuerpo: 'Vas ' + fmt(total) + ' en el día. Te falta poco para los $ 100.000, no aflojes ahora.',
      tag: TAG_BAJO_RENDIMIENTO,
      tipoToast: 'warn',
      toast: '¡Estás muy bajo para rendirte! Vas ' + fmt(total),
      datos: { tipo: 'aliento', vista: 'Registro' }
    });
  } catch (e) {}
}

/* ---------- 2) Reporte PDF generado ---------- */
function avisarPDFGenerado(detalle) {
  try {
    notificarLocal({
      titulo: 'Tu reporte PDF ha sido generado',
      cuerpo: detalle ? ('Ya está listo el reporte ' + detalle + '.') : 'El reporte quedó guardado en tu dispositivo.',
      tag: TAG_PDF,
      tipoToast: 'success',
      toast: 'Tu reporte PDF ha sido generado',
      datos: { tipo: 'pdf', vista: 'Historial' }
    });
  } catch (e) {}
}

/* ---------- 3) Siete horas desde el primer cierre de tarea ---------- */
function textoAvisoJornada() {
  return {
    titulo: 'Recordá cerrar tu jornada',
    cuerpo: 'Cerrá tu jornada, controlá tus ganancias y reportá a tu Supervisor.'
  };
}

/* Se llama cada vez que se finaliza una tarea, pero solo guarda la hora
   de LA PRIMERA de la jornada. */
function marcarPrimerCierreDeTarea() {
  try {
    if (lsNum(LS_PRIMER_CIERRE)) return;
    const desde = Date.now();
    lsSet(LS_PRIMER_CIERRE, desde);
    lsDel(LS_AVISO_JORNADA_HECHO);

    const t = textoAvisoJornada();
    // Queda agendado en IndexedDB: el service worker puede dispararlo
    // aunque la app este cerrada.
    guardarAvisoProgramado({
      id: ID_AVISO_JORNADA,
      vence: desde + MS_CIERRE_JORNADA,
      titulo: t.titulo,
      cuerpo: t.cuerpo,
      tag: TAG_CIERRE_JORNADA,
      requiereInteraccion: true,
      datos: { tipo: 'cierre-jornada', vista: 'Registro' },
      mostrado: false
    });
    registrarDespertadorDeAvisos();
  } catch (e) {}
}

function limpiarAvisoDeJornada() {
  try {
    lsDel(LS_PRIMER_CIERRE);
    lsDel(LS_AVISO_JORNADA_HECHO);
    lsDel(LS_ALIENTO_DESDE);
    borrarAvisoProgramado(ID_AVISO_JORNADA);
    limpiarFrasesDeJornada();
    if (swRegistration && swRegistration.getNotifications) {
      swRegistration.getNotifications({ tag: TAG_CIERRE_JORNADA })
        .then(ns => ns.forEach(n => n.close()))
        .catch(() => {});
    }
  } catch (e) {}
}

/* ---------- Revision de los avisos con hora ---------- */
async function revisarAvisosProgramados() {
  try {
    // Aviso de cierre de jornada (7 horas desde el primer cierre de tarea)
    const desde = lsNum(LS_PRIMER_CIERRE);
    const jornadaAbierta = !!(State.jornada && !State.jornada.cerrada);

    if (desde && !jornadaAbierta) { limpiarAvisoDeJornada(); }
    else if (desde && !lsNum(LS_AVISO_JORNADA_HECHO) && Date.now() - desde >= MS_CIERRE_JORNADA) {
      const t = textoAvisoJornada();
      lsSet(LS_AVISO_JORNADA_HECHO, Date.now());
      await borrarAvisoProgramado(ID_AVISO_JORNADA);
      await notificarLocal({
        titulo: t.titulo,
        cuerpo: t.cuerpo,
        tag: TAG_CIERRE_JORNADA,
        requiereInteraccion: true,
        tipoToast: 'warn',
        toast: t.cuerpo,
        datos: { tipo: 'cierre-jornada', vista: 'Registro' }
      });
    }

    // Si el service worker ya mostro el aviso mientras la app estaba
    // cerrada, se toma nota para no repetirlo.
    const agendados = await leerAvisosProgramados();
    const jornada = agendados.filter(a => a.id === ID_AVISO_JORNADA && a.mostrado);
    if (jornada.length && !lsNum(LS_AVISO_JORNADA_HECHO)) {
      lsSet(LS_AVISO_JORNADA_HECHO, Date.now());
      await borrarAvisoProgramado(ID_AVISO_JORNADA);
    }

    await revisarAlientoPendiente();
    await revisarFraseDeJornada();
    await revisarAvisoInicioMes();
    await revisarReporteMensual();
    await revisarRecordatorioDeBackup();
  } catch (e) {}
}

/* ---------- 4) Frases mientras la jornada esta abierta ----------
   Una al azar, sin repetir la anterior, y nunca a menos de una hora de
   distancia de la anterior. Queda agendada en IndexedDB para que tambien
   pueda salir con la app cerrada. */
function elegirFraseJornada() {
  try {
    const total = FRASES_JORNADA.length;
    if (!total) return '';
    const ultimo = lsNum(LS_INDICE_FRASE);
    let i = Math.floor(Math.random() * total);
    if (total > 1 && i === ultimo) i = (i + 1) % total;   // no repetir la anterior
    lsSet(LS_INDICE_FRASE, i);
    return FRASES_JORNADA[i];
  } catch (e) { return FRASES_JORNADA[0] || ''; }
}

async function agendarProximaFrase() {
  try {
    await guardarAvisoProgramado({
      id: ID_AVISO_FRASE,
      vence: Date.now() + MS_ENTRE_FRASES,
      titulo: 'BAREMO',
      cuerpo: elegirFraseJornada(),
      tag: TAG_FRASE,
      requiereInteraccion: false,
      datos: { tipo: 'animo', vista: 'Registro' },
      mostrado: false
    });
    registrarDespertadorDeAvisos();
  } catch (e) {}
}

async function limpiarFrasesDeJornada() {
  try {
    lsDel(LS_ULTIMA_FRASE);
    await borrarAvisoProgramado(ID_AVISO_FRASE);
  } catch (e) {}
}

async function revisarFraseDeJornada() {
  try {
    const jornadaAbierta = !!(State.jornada && !State.jornada.cerrada);
    if (!jornadaAbierta) { await limpiarFrasesDeJornada(); return; }

    // Primera vez en la jornada: se empieza a contar la hora.
    const ultima = lsNum(LS_ULTIMA_FRASE);
    if (!ultima) {
      lsSet(LS_ULTIMA_FRASE, Date.now());
      await agendarProximaFrase();
      return;
    }

    // Si el service worker ya la mostro con la app cerrada, se toma nota
    // y se agenda la siguiente para dentro de una hora.
    const agendados = await leerAvisosProgramados();
    const ag = agendados.find(a => a.id === ID_AVISO_FRASE);
    if (ag && ag.mostrado) {
      lsSet(LS_ULTIMA_FRASE, Date.now());
      await agendarProximaFrase();
      return;
    }

    if (Date.now() - ultima < MS_ENTRE_FRASES) return;

    const frase = (ag && ag.cuerpo) ? ag.cuerpo : elegirFraseJornada();
    lsSet(LS_ULTIMA_FRASE, Date.now());
    await notificarLocal({
      titulo: 'BAREMO',
      cuerpo: frase,
      tag: TAG_FRASE,
      tipoToast: 'info',
      toast: frase,
      datos: { tipo: 'animo', vista: 'Registro' }
    });
    await agendarProximaFrase();
  } catch (e) {}
}

/* ---------- v5.9.35: AVISOS DEL 01 AL 03 DE CADA MES ---------- */
function claveAvisoInicioMes(f, i) { return 'baremo_aviso_mes_' + f + '_' + i; }
function idAvisoInicioMes(f, i) { return 'inicio-mes-' + f + '-' + i; }

function fechaISOLocal(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function fraseInicioMes() {
  try {
    const total = FRASES_INICIO_MES.length;
    if (!total) return '';
    const ultimo = lsNum(LS_INDICE_MES);
    let i = Math.floor(Math.random() * total);
    if (total > 1 && i === ultimo) i = (i + 1) % total;   // no repetir la anterior
    lsSet(LS_INDICE_MES, i);
    return FRASES_INICIO_MES[i];
  } catch (e) { return FRASES_INICIO_MES[0] || ''; }
}

/* Los tres primeros dias del mes en curso. Si ya pasaron, los del mes que
   viene: la agenda nunca queda vacia. */
function diasDeInicioDeMes() {
  const hoy = new Date();
  let y = hoy.getFullYear();
  let m = hoy.getMonth();
  if (hoy.getDate() > DIAS_INICIO_MES) { m += 1; if (m > 11) { m = 0; y += 1; } }
  const dias = [];
  for (let d = 1; d <= DIAS_INICIO_MES; d++) {
    dias.push(new Date(y, m, d, 0, 0, 0, 0));
  }
  return dias;
}

/* Momento exacto de cada franja de la manana para un dia dado. */
function horaDeFranja(dia, i) {
  const h = HORAS_AVISO_MES[i] || [8, 0];
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h[0], h[1], 0, 0).getTime();
}

/* Hasta cuando tiene sentido mostrarla: si el telefono despierta al service
   worker a la tarde, el aviso de la manana ya no aparece. */
function limiteDeFranja(dia) {
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), HORA_LIMITE_MES, 0, 0, 0).getTime();
}

async function agendarAvisosInicioMes() {
  try {
    const ahora = Date.now();
    const agendados = await leerAvisosProgramados();

    // Se limpian los del mes pasado para que la base no crezca.
    for (const a of agendados) {
      if (a && typeof a.id === 'string' && a.id.indexOf('inicio-mes-') === 0 &&
          a.expira && a.expira <= ahora) {
        await borrarAvisoProgramado(a.id);
      }
    }

    for (const d of diasDeInicioDeMes()) {
      const f = fechaISOLocal(d);
      const limite = limiteDeFranja(d);
      if (limite <= ahora) continue;                            // esa manana ya paso
      for (let i = 0; i < HORAS_AVISO_MES.length; i++) {
        const id = idAvisoInicioMes(f, i);
        if (lsNum(claveAvisoInicioMes(f, i))) continue;         // esa franja ya salio
        if (agendados.some(a => a && a.id === id)) continue;    // ya estaba agendada
        await guardarAvisoProgramado({
          id: id,
          vence: horaDeFranja(d, i),
          expira: limite,
          titulo: 'BAREMO',
          cuerpo: fraseInicioMes(),
          tag: TAG_INICIO_MES,
          requiereInteraccion: false,
          datos: { tipo: 'inicio-mes', vista: 'Dashboard' },
          mostrado: false
        });
      }
    }
    registrarDespertadorDeAvisos();
  } catch (e) {}
}

/* Con la app abierta: si es 1, 2 o 3 y ya paso alguna franja de la manana, el
   aviso sale igual, sin esperar al despertador del service worker. Una sola
   vez por franja, y nunca dos juntas en la misma pasada. */
async function revisarAvisoInicioMes() {
  try {
    const ahora = new Date();
    if (ahora.getDate() <= DIAS_INICIO_MES) {
      const f = fechaISOLocal(ahora);
      const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0);
      const limite = limiteDeFranja(hoy);
      const agendados = await leerAvisosProgramados();
      let yaMostrada = false;

      // De la ultima franja hacia atras: si el telefono estuvo apagado y
      // quedaron dos juntas, sale solo la mas reciente.
      for (let i = HORAS_AVISO_MES.length - 1; i >= 0; i--) {
        const clave = claveAvisoInicioMes(f, i);
        if (lsNum(clave)) continue;
        if (ahora.getTime() < horaDeFranja(hoy, i)) continue;   // todavia no es la hora

        const id = idAvisoInicioMes(f, i);
        const ag = agendados.find(a => a && a.id === id);
        lsSet(clave, Date.now());
        await borrarAvisoProgramado(id);

        if (yaMostrada) continue;
        if (ag && ag.mostrado) { yaMostrada = true; continue; }  // la mostro el SW
        if (ahora.getTime() >= limite) continue;                 // la manana ya paso

        const frase = (ag && ag.cuerpo) ? ag.cuerpo : fraseInicioMes();
        yaMostrada = true;
        await notificarLocal({
          titulo: 'BAREMO',
          cuerpo: frase,
          tag: TAG_INICIO_MES,
          tipoToast: 'success',
          toast: frase,
          datos: { tipo: 'inicio-mes', vista: 'Dashboard' }
        });
      }
    }
    await agendarAvisosInicioMes();
  } catch (e) {}
}

/* ---------- v5.9.36: EL REPORTE DEL MES YA ESTA LISTO ----------
   Apenas cierra el mes (desde el dia 1 del mes siguiente) el usuario recibe
   un aviso con su nombre y su legajo recordandole que baje el reporte
   mensual desde el Historial: un solo PDF con todas sus jornadas. Queda
   agendado en la base local, asi el service worker puede mostrarlo aunque la
   app este cerrada, y vale por una semana. Una sola vez por mes. */
function claveReporteMes(mes) {
  const leg = (State.user && State.user.legajo) ? State.user.legajo : 'x';
  return 'baremo_reporte_listo_' + leg + '_' + mes;
}
function idReporteMes(mes) {
  const leg = (State.user && State.user.legajo) ? State.user.legajo : 'x';
  return 'reporte-mes-' + leg + '-' + mes;
}

function textoReporteMensual(mes) {
  const nombre = (State.user && State.user.nombre) ? State.user.nombre : '';
  const leg = (State.user && State.user.legajo) ? State.user.legajo : '';
  let quien = '';
  if (nombre && leg) quien = nombre + ' (Legajo ' + leg + ')';
  else if (nombre) quien = nombre;
  else if (leg) quien = 'Legajo ' + leg;
  return {
    titulo: 'BAREMO · Reporte de ' + nombreMes(mes),
    cuerpo: 'Hola' + (quien ? ' ' + quien : '') + ', tu reporte del mes está listo, ' +
      'podés bajarlo en el menú Historial. Junta todas tus jornadas de ' +
      nombreMes(mes) + ' en un solo PDF.'
  };
}

async function hayJornadasCerradasDelMes(mes) {
  try {
    const leg = State.user ? State.user.legajo : null;
    const todas = await dbGetAll('jornadas');
    return todas.some(j => j && j.legajo === leg && j.cerrada && (j.fecha || '').startsWith(mes));
  } catch (e) { return false; }
}

/* El aviso del mes que esta corriendo queda agendado para el dia 1 del mes
   siguiente: el service worker lo dispara aunque la app este cerrada. */
async function agendarReporteMensual() {
  try {
    if (!State.user || !State.user.legajo) return;
    const ahora = Date.now();
    const agendados = await leerAvisosProgramados();

    for (const a of agendados) {
      if (a && typeof a.id === 'string' && a.id.indexOf('reporte-mes-') === 0 &&
          a.expira && a.expira <= ahora) {
        await borrarAvisoProgramado(a.id);
      }
    }

    const mesQueCierra = mesActual();
    if (lsNum(claveReporteMes(mesQueCierra))) return;
    const id = idReporteMes(mesQueCierra);
    if (agendados.some(a => a && a.id === id)) return;

    const hoyD = new Date();
    const primero = new Date(hoyD.getFullYear(), hoyD.getMonth() + 1, 1, HORA_REPORTE_MES, 0, 0, 0);
    const t = textoReporteMensual(mesQueCierra);
    await guardarAvisoProgramado({
      id: id,
      vence: primero.getTime(),
      expira: primero.getTime() + DIAS_VIGENCIA_REPORTE * 24 * 60 * 60 * 1000,
      titulo: t.titulo,
      cuerpo: t.cuerpo,
      tag: TAG_REPORTE_MES,
      requiereInteraccion: true,
      datos: { tipo: 'reporte-mes', vista: 'Historial' },
      mostrado: false
    });
    registrarDespertadorDeAvisos();
  } catch (e) {}
}

/* Con la app abierta: si el mes anterior ya cerro y tiene jornadas, el aviso
   sale en el momento. Una sola vez por mes y por usuario. */
async function revisarReporteMensual() {
  try {
    if (!State.user || !State.user.legajo) return;
    const mesCerrado = mesAnterior();
    const clave = claveReporteMes(mesCerrado);

    if (!lsNum(clave)) {
      const id = idReporteMes(mesCerrado);
      const agendados = await leerAvisosProgramados();
      const ag = agendados.find(a => a && a.id === id);

      if (ag && ag.mostrado) {
        lsSet(clave, Date.now());              // ya lo mostro el service worker
        await borrarAvisoProgramado(id);
      } else if (await hayJornadasCerradasDelMes(mesCerrado)) {
        const t = (ag && ag.cuerpo) ? { titulo: ag.titulo, cuerpo: ag.cuerpo } : textoReporteMensual(mesCerrado);
        lsSet(clave, Date.now());
        await borrarAvisoProgramado(id);
        await notificarLocal({
          titulo: t.titulo,
          cuerpo: t.cuerpo,
          tag: TAG_REPORTE_MES,
          requiereInteraccion: true,
          tipoToast: 'success',
          toast: t.cuerpo,
          datos: { tipo: 'reporte-mes', vista: 'Historial' }
        });
      }
    }
    await agendarReporteMensual();
  } catch (e) {}
}

/* ---------- v5.9.35: ACTIVAR LAS NOTIFICACIONES A MANO ----------
   El permiso se pedia una sola vez y en silencio, al cargar un baremo. Si el
   usuario cerraba ese cartel sin elegir, la app quedaba muda para siempre.
   Ahora Ajustes tiene su propia tarjeta: pide el permiso, avisa como quedo y
   manda una notificacion de prueba para confirmar que llega a la barra. */
function pintarEstadoNotificaciones() {
  const el = $('#ajNotifDesc');
  if (!el) return;
  let txt = 'Tocá para activar los avisos del sistema';
  try {
    if (!('Notification' in window)) txt = 'No disponibles en este dispositivo';
    else if (Notification.permission === 'granted') {
      // El renglon con la direccion lo dibuja el navegador y solo desaparece
      // con la app instalada: ahi el sistema muestra el nombre BAREMO.
      if (appInstalada() || lsNum('baremo_instalada')) {
        txt = 'Activadas · salen como BAREMO, sin la dirección';
      } else if (puedeMostrarEnLaBandeja()) {
        txt = 'Activadas · instalá la app para que salgan sin la dirección';
      } else {
        txt = 'Activadas · instalá la app para verlas en la barra';
      }
    }
    else if (Notification.permission === 'denied') txt = 'Bloqueadas desde los ajustes del teléfono';
  } catch (e) {}
  el.textContent = txt;
}

async function activarNotificaciones() {
  try {
    if (!('Notification' in window)) {
      toast('Este dispositivo no admite notificaciones', 'warn');
      return;
    }
    let permiso = Notification.permission;
    if (permiso === 'default') {
      pedirPermisoNotificaciones(true);
      permiso = await Notification.requestPermission();
    }
    if (permiso !== 'granted') {
      toast('Activá las notificaciones de BAREMO en los ajustes del teléfono', 'warn');
      pintarEstadoNotificaciones();
      return;
    }
    lsSet(LS_NOTIF_OK, 1);
    recordarSiEstaInstalada();
    await registrarDespertadorDeAvisos();
    await agendarAvisosInicioMes();
    // v5.9.35 - se reenganchan tambien los avisos de siempre: cierre de
    // jornada, frases de animo, bajo rendimiento y reporte PDF.
    await revisarAvisosProgramados();
    const enBandeja = await notificarLocal({
      titulo: 'BAREMO',
      cuerpo: 'Listo: las notificaciones quedaron activadas.',
      tag: 'baremo-prueba',
      tipoToast: 'success',
      toast: 'Notificaciones activadas',
      datos: { tipo: 'prueba', vista: 'Dashboard' }
    });
    pintarEstadoNotificaciones();
    if (!enBandeja) {
      toast('Instalá BAREMO en la pantalla de inicio para verlas en la barra', 'info');
    }
  } catch (e) {}
}

/* ---------- Despertador del service worker ----------
   Periodic Background Sync permite que el navegador despierte al service
   worker cada tanto con la app cerrada. Donde no exista, se cae en la
   revision al volver a la app, sin romper nada. */
async function registrarDespertadorDeAvisos() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = swRegistration || await navigator.serviceWorker.getRegistration();
    if (!reg) return;

    if ('periodicSync' in reg) {
      try {
        let permitido = true;
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
            permitido = st.state === 'granted';
          } catch (e) { permitido = true; }
        }
        if (permitido) {
          const tags = await reg.periodicSync.getTags();
          if (!tags.includes(SYNC_TAG_AVISOS)) {
            await reg.periodicSync.register(SYNC_TAG_AVISOS, { minInterval: 15 * 60 * 1000 });
          }
        }
      } catch (e) {}
    }

    // Respaldo: un sync comun, que el navegador ejecuta en cuanto puede.
    if ('sync' in reg) {
      try { await reg.sync.register(SYNC_TAG_AVISOS); } catch (e) {}
    }
  } catch (e) {}
}

/* ---------- v5.9.40: LOS AVISOS DIARIOS SALEN POR DEFECTO ----------
   Antes la agenda se armaba una sola vez y, si el usuario nunca habia
   tocado el boton de Ajustes o si una version nueva reemplazaba el cache,
   los avisos podian quedar huerfanos y la app se quedaba muda.
   Ahora, cada vez que la app abre:
     - se pide el permiso SOLO si nunca se pregunto (instalacion nueva):
       al actualizar la app jamas se vuelve a preguntar (v5.9.41);
     - si esta concedido se marca, asi la bandeja del sistema se usa aunque
       la deteccion de "instalada" falle;
     - se vuelve a armar la agenda completa (inicio de mes, reporte mensual
       y respaldo de los lunes). Las tres funciones son idempotentes:
       respetan las marcas de lo ya mostrado, asi que nada se repite.
   ------------------------------------------------------------------- */
const LS_AVISOS_VERSION = 'baremo_avisos_version';

function versionDeAvisos() {
  try { return localStorage.getItem(LS_AVISOS_VERSION) || ''; } catch (e) { return ''; }
}

async function asegurarAvisosDiarios() {
  try {
    if (!('Notification' in window)) return;
    // v5.9.41 - actualizar la app NO vuelve a pedir el permiso: la respuesta
    // que el usuario dio en una version anterior se respeta tal cual, sea que
    // haya aceptado o rechazado. Solo se pregunta si nunca se pregunto, es
    // decir en una instalacion nueva.
    if (Notification.permission === 'default') {
      pedirPermisoNotificaciones();
    }

    lsSet(LS_AVISOS_VERSION, APP_VERSION);

    if (Notification.permission !== 'granted') return;

    lsSet(LS_NOTIF_OK, 1);
    recordarSiEstaInstalada();

    await registrarDespertadorDeAvisos();
    await agendarAvisosInicioMes();
    await agendarReporteMensual();
    await agendarBackupSemanal();
    await revisarAvisosProgramados();
  } catch (e) {}
}

function iniciarAvisosLocales() {
  try {
    recordarSiEstaInstalada();
    registrarDespertadorDeAvisos();
    // v5.9.35 - la agenda del inicio de mes se arma apenas abre la app, para
    // que el service worker tenga que mostrar aunque despues quede cerrada.
    revisarAvisoInicioMes();
    // v5.9.35 - y una revision inmediata de TODOS los avisos (cierre de
    // jornada, frases de animo, aliento y PDF), no solo los del mes.
    revisarAvisosProgramados();
    // v5.9.40 - y la agenda completa se repone en cada arranque, asi los
    // avisos diarios siguen saliendo por defecto tras cada actualizacion.
    asegurarAvisosDiarios();

    // Al volver a la app se revisa en el momento.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        revisarAvisosProgramados();
        revisarRecordatorioATSAlAbrir();
      }
    });
    window.addEventListener('focus', () => {
      revisarAvisosProgramados();
      revisarRecordatorioATSAlAbrir();
    });

    // Revision periodica mientras la app este abierta.
    setInterval(() => {
      revisarAvisosProgramados();
      revisarRecordatorioATSAlAbrir();
    }, 60 * 1000);
  } catch (e) {}
}

/* ============================================================
   SERVICIO DE NOTIFICACIONES LOCALES VÍA SERVICE WORKER - ATS
   ============================================================ */
const TAG_ATS_RECORDATORIO = 'baremo-ats-recordatorio';
let _ultimoAvisoAts = 0;

async function notificarAtsPendienteViaSW(opciones = {}) {
  const ahoraMs = Date.now();
  if (!opciones.forzar && ahoraMs - _ultimoAvisoAts < 25 * 1000) {
    return;
  }
  _ultimoAvisoAts = ahoraMs;

  const titulo = '⚠️ ATS Pendiente - Seguridad en el Trabajo';
  const cuerpo = 'Recordá completar el Análisis de Trabajo Seguro (ATS) obligatorio antes de iniciar las tareas del día.';

  // Pedir permiso al sistema si aún no fue concedido ni bloqueado
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch (e) {}

  let notificadoPorSW = false;

  // 1) Notificación nativa del sistema mediante el Service Worker
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      let reg = swRegistration;
      if (!reg && navigator.serviceWorker) {
        reg = await navigator.serviceWorker.getRegistration();
      }
      if (reg && reg.showNotification) {
        await reg.showNotification(titulo, {
          body: cuerpo,
          tag: TAG_ATS_RECORDATORIO,
          renotify: true,
          requireInteraction: true,
          silent: false,
          icon: './icons/icon-192.png?v=' + APP_VERSION,
          badge: './icons/icon-192.png?v=' + APP_VERSION,
          vibrate: [300, 150, 300, 150, 300],
          timestamp: ahoraMs,
          data: { tipo: 'ats-recordatorio', accion: 'abrir_ats', vista: 'Registro' }
        });
        notificadoPorSW = true;
      }
    }
  } catch (e) {
    console.warn('[SW Notif ATS]', e);
  }

  // 2) Canal directo por postMessage al Service Worker (activo/controller)
  try {
    const swTarget = (swRegistration && swRegistration.active) || (navigator.serviceWorker && navigator.serviceWorker.controller);
    if (swTarget && typeof swTarget.postMessage === 'function') {
      swTarget.postMessage({
        tipo: 'NOTIFICAR_ATS',
        titulo: titulo,
        cuerpo: cuerpo
      });
    }
  } catch (e) {}

  // 3) Respaldo si no hay Service Worker activo pero hay Notification tradicional
  if (!notificadoPorSW) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(titulo, {
          body: cuerpo,
          tag: TAG_ATS_RECORDATORIO,
          icon: './icons/icon-192.png?v=' + APP_VERSION
        });
      }
    } catch (e) {}
  }

  // 4) Aviso complementario en pantalla si la app está visible
  if (document.visibilityState === 'visible') {
    try {
      toast('⚠️ Recordá rellenar el ATS antes de iniciar tareas', 'warn');
    } catch (e) {}
  }
}

async function limpiarNotificacionATS() {
  try {
    let reg = swRegistration;
    if (!reg && navigator.serviceWorker) {
      reg = await navigator.serviceWorker.getRegistration();
    }
    if (reg && reg.getNotifications) {
      const notifs = await reg.getNotifications({ tag: TAG_ATS_RECORDATORIO });
      if (notifs && notifs.length) {
        notifs.forEach(n => n.close());
      }
    }
  } catch (e) {}

  try {
    const swTarget = (swRegistration && swRegistration.active) || (navigator.serviceWorker && navigator.serviceWorker.controller);
    if (swTarget && typeof swTarget.postMessage === 'function') {
      swTarget.postMessage({ tipo: 'LIMPIAR_NOTIFICACION_ATS' });
    }
  } catch (e) {}
}

async function revisarRecordatorioATSAlAbrir(forzar = false) {
  try {
    if (!State.user) return;

    // Caso A: Hay jornada activa abierta
    if (State.jornada && !State.jornada.cerrada) {
      if (State.jornada.ats && State.jornada.ats.completado) {
        await limpiarNotificacionATS();
        return;
      }
      // ATS pendiente en jornada abierta
      await notificarAtsPendienteViaSW({ forzar });
      return;
    }

    // Caso B: No hay jornada abierta, verificar si se completó el ATS hoy en alguna jornada previa
    const jornadasHoy = await dbGetByIndex('jornadas', 'fechaLegajo', [hoy(), State.user.legajo]);
    const completadoHoy = Array.isArray(jornadasHoy) && jornadasHoy.some(j => j.ats && j.ats.completado);

    if (completadoHoy) {
      await limpiarNotificacionATS();
    } else {
      // El usuario abrió la app y hoy todavía no tiene el ATS completado
      await notificarAtsPendienteViaSW({ forzar });
    }
  } catch (e) {
    console.warn('[revisarRecordatorioATSAlAbrir]', e);
  }
}

/* ============================================================
   FORMULARIO ATS (Análisis de Trabajo Seguro) - Oficial sin logo
   Código: PR SH 06 FOR 03 · Revisión: 2 · Vigencia: 02/09/2020
   ============================================================ */

const ATS_RIESGOS = [
  { n: 1,  t: 'Caída de personas a nivel' },
  { n: 2,  t: 'Caída de personas de altura' },
  { n: 3,  t: 'Caída de personas al agua' },
  { n: 4,  t: 'Caída de objetos en altura' },
  { n: 5,  t: 'Derrumbe de instalaciones' },
  { n: 6,  t: 'Pisada sobre objetos' },
  { n: 7,  t: 'Proyección de partículas' },
  { n: 8,  t: 'Golpes por objetos' },
  { n: 9,  t: 'Aprisionamiento' },
  { n: 10, t: 'Esfuerzo físico excesivo' },
  { n: 11, t: 'Heridas con objeto cortopunzante' },
  { n: 12, t: 'Contacto con fuego' },
  { n: 13, t: 'Contacto con electricidad' },
  { n: 14, t: 'Incendio' },
  { n: 15, t: 'Atropellamiento por animales' },
  { n: 16, t: 'Mordeduras por animales' },
  { n: 17, t: 'Atropellamiento por vehículos' },
  { n: 18, t: 'Agresión con armas' },
  { n: 19, t: 'Agresión por terceros' },
  { n: 20, t: 'Poste podrido' },
  { n: 21, t: 'Otras formas' }
];

function renderATSStatus() {
  const banner = $('#atsBanner');
  if (!banner) return;

  const abierta = !!(State.jornada && !State.jornada.cerrada);
  if (!abierta) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';
  const ats = State.jornada.ats;
  const completado = !!(ats && ats.completado);

  const tIco = $('#atsBannerIco');
  const tTit = $('#atsBannerTitle');
  const tDesc = $('#atsBannerDesc');
  const act = $('#atsBannerActions');

  if (!completado) {
    banner.className = 'ats-banner pending';
    if (tIco) tIco.textContent = '⚠️';
    if (tTit) tTit.textContent = 'ATS Obligatorio: Pendiente';
    if (tDesc) tDesc.textContent = 'Debés completar el Análisis de Trabajo Seguro antes de iniciar la primera tarea del día.';
    if (act) {
      act.innerHTML = '<button class="btn btn-warning-ats" id="btnAtsBannerAction" type="button">📋 Rellenar ATS</button>';
      const b = $('#btnAtsBannerAction');
      if (b) b.onclick = () => abrirModalATS({ obligatorio: true });
    }
  } else {
    banner.className = 'ats-banner completed';
    if (tIco) tIco.textContent = '🛡️';
    if (tTit) tTit.textContent = 'ATS Completado';
    if (tDesc) {
      const otTxt = ats.ot ? `OT: ${escapeHtml(ats.ot)}` : 'Sin OT';
      const fechaTxt = ats.fecha ? `${fechaCorta(ats.fecha)} ${ats.hora || ''}` : '';
      tDesc.textContent = `${otTxt} · ${fechaTxt} · ${escapeHtml(ats.trabajoAsignado || 'Trabajo registrado')}`;
    }
    if (act) {
      act.innerHTML = `
        <button class="btn btn-success-ats" id="btnAtsVer" type="button">👁️ Ver ATS</button>
        <button class="btn btn-success-ats" id="btnAtsQuickPdf" type="button" title="Exportar PDF">📄 PDF</button>
      `;
      const bv = $('#btnAtsVer');
      if (bv) bv.onclick = () => abrirModalATS();
      const bp = $('#btnAtsQuickPdf');
      if (bp) bp.onclick = () => exportarAtsPDF(ats);
    }
  }
}

let atsFirmaJefeData = null;
let atsFirmaSupervisorData = null;
let atsFirmaHigieneData = null;

let currentSignatureCallback = null;
let sigCanvas = null;
let sigCtx = null;
let sigDrawing = false;
let sigHasStrokes = false;

function initSignatureCanvas() {
  const canvas = $('#atsSignatureCanvas');
  if (!canvas) return;
  sigCanvas = canvas;
  sigCtx = canvas.getContext('2d');

  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    let cx, cy;
    if (e.touches && e.touches.length > 0) {
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    return {
      x: cx - rect.left,
      y: cy - rect.top
    };
  }

  function onDown(e) {
    e.preventDefault();
    sigDrawing = true;
    const p = getCoords(e);
    sigCtx.beginPath();
    sigCtx.moveTo(p.x, p.y);
  }

  function onMove(e) {
    if (!sigDrawing) return;
    e.preventDefault();
    const p = getCoords(e);
    sigCtx.lineTo(p.x, p.y);
    sigCtx.stroke();
    sigHasStrokes = true;
  }

  function onUp(e) {
    if (sigDrawing) {
      sigDrawing = false;
      sigCtx.closePath();
    }
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);
  window.addEventListener('touchcancel', onUp);

  const bClear = $('#btnAtsFirmaClear');
  if (bClear) bClear.onclick = () => limpiarCanvasFirma();

  const bCancel = $('#btnAtsFirmaCancel');
  if (bCancel) bCancel.onclick = cerrarModalFirmaDigital;
  const bClose = $('#btnAtsFirmaClose');
  if (bClose) bClose.onclick = cerrarModalFirmaDigital;

  const bAccept = $('#btnAtsFirmaAccept');
  if (bAccept) {
    bAccept.onclick = () => {
      if (!sigHasStrokes) {
        toast('Por favor, realizá tu firma en el recuadro antes de aplicar', 'warn');
        return;
      }
      const dataUrl = exportarFirmaRecortada(canvas);
      if (typeof currentSignatureCallback === 'function') {
        currentSignatureCallback(dataUrl);
      }
      cerrarModalFirmaDigital();
      toast('✍️ Firma registrada', 'success');
    };
  }
}

function abrirModalFirmaDigital({ titulo = '✍️ Firma Digital', onAceptar = null } = {}) {
  const modal = $('#modalFirmaAts');
  if (!modal) return;
  currentSignatureCallback = onAceptar;
  const tEl = $('#atsFirmaModalTitle');
  if (tEl) tEl.textContent = titulo;
  modal.classList.add('show');
  setTimeout(() => {
    ajustarTamanioCanvasFirma();
    limpiarCanvasFirma();
  }, 60);
}

function cerrarModalFirmaDigital() {
  const modal = $('#modalFirmaAts');
  if (modal) modal.classList.remove('show');
  currentSignatureCallback = null;
}

function ajustarTamanioCanvasFirma() {
  const canvas = $('#atsSignatureCanvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(window.devicePixelRatio || 1, 2);
  const w = rect.width || 560;
  const h = rect.height || 220;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  sigCtx = canvas.getContext('2d');
  sigCtx.scale(dpr, dpr);
  sigCtx.lineCap = 'round';
  sigCtx.lineJoin = 'round';
  sigCtx.lineWidth = 2.8;
  sigCtx.strokeStyle = '#0f172a';
}

function limpiarCanvasFirma() {
  const canvas = $('#atsSignatureCanvas');
  if (!canvas || !sigCtx) return;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 560;
  const h = rect.height || 220;
  sigCtx.clearRect(0, 0, w, h);
  sigHasStrokes = false;
}

function exportarFirmaRecortada(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > 15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return canvas.toDataURL('image/png');

    const pad = Math.round(12 * (window.devicePixelRatio || 1));
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w, maxX + pad);
    maxY = Math.min(h, maxY + pad);

    const cW = maxX - minX;
    const cH = maxY - minY;

    const tc = document.createElement('canvas');
    tc.width = cW;
    tc.height = cH;
    const tCtx = tc.getContext('2d');
    tCtx.drawImage(canvas, minX, minY, cW, cH, 0, 0, cW, cH);
    return tc.toDataURL('image/png');
  } catch (err) {
    return canvas.toDataURL('image/png');
  }
}

function actualizarVistaFirmasAutoridades() {
  const phJ = $('#atsPlaceholderJefe'), wrJ = $('#atsWrapSignJefe'), imJ = $('#atsImgSignJefe');
  if (atsFirmaJefeData) {
    if (phJ) phJ.style.display = 'none';
    if (wrJ) wrJ.style.display = 'flex';
    if (imJ) imJ.src = atsFirmaJefeData;
  } else {
    if (phJ) phJ.style.display = 'flex';
    if (wrJ) wrJ.style.display = 'none';
  }

  const phS = $('#atsPlaceholderSup'), wrS = $('#atsWrapSignSup'), imS = $('#atsImgSignSup');
  if (atsFirmaSupervisorData) {
    if (phS) phS.style.display = 'none';
    if (wrS) wrS.style.display = 'flex';
    if (imS) imS.src = atsFirmaSupervisorData;
  } else {
    if (phS) phS.style.display = 'flex';
    if (wrS) wrS.style.display = 'none';
  }

  const phH = $('#atsPlaceholderHig'), wrH = $('#atsWrapSignHig'), imH = $('#atsImgSignHig');
  if (atsFirmaHigieneData) {
    if (phH) phH.style.display = 'none';
    if (wrH) wrH.style.display = 'flex';
    if (imH) imH.src = atsFirmaHigieneData;
  } else {
    if (phH) phH.style.display = 'flex';
    if (wrH) wrH.style.display = 'none';
  }
}

function initATS() {
  // 1. Grid interactivo de los 21 riesgos
  const cont = $('#atsRiesgosGrid');
  if (cont) {
    cont.innerHTML = ATS_RIESGOS.map(r => `
      <div class="ats-doc-risk-item" data-n="${r.n}">
        <span class="ats-doc-risk-circle">${r.n}</span>
        <span class="ats-doc-risk-text">${escapeHtml(r.t)}</span>
      </div>
    `).join('');
    cont.querySelectorAll('.ats-doc-risk-item').forEach(item => {
      item.onclick = () => {
        item.classList.toggle('selected');
      };
    });
  }

  // 2. Botones rápidos
  const bEpp = $('#btnAtsEppEstandar');
  if (bEpp) {
    bEpp.onclick = () => {
      const basicos = ['Casco', 'Botín de Seguridad', 'Guantes de prot Mec.', 'Protector Ocular'];
      $$('input[name="atsEpp"]').forEach(cb => {
        if (basicos.includes(cb.value)) cb.checked = true;
      });
      toast('EPP básico seleccionado', 'info');
    };
  }

  const bReglas = $('#btnAts5Reglas');
  if (bReglas) {
    bReglas.onclick = () => {
      $$('input[name="atsReglas"]').forEach(cb => { cb.checked = true; });
      toast('5 Reglas de Oro marcadas', 'info');
    };
  }

  const bCharla = $('#btnAtsCharlaTodo');
  if (bCharla) {
    bCharla.onclick = () => {
      const habituales = [
        '1.- Riesgos eléctricos',
        '2.- Normas de seguridad',
        '3.- Condiciones del lugar de trabajo',
        '6.- Uso de Elementos de Protecion Personal.',
        '7.- Uso equipos y herramientas aisladas',
        '12.- Orden y limpieza'
      ];
      $$('input[name="atsCharla"]').forEach(cb => {
        if (habituales.includes(cb.value)) cb.checked = true;
      });
      toast('Temas habituales de charla marcados', 'info');
    };
  }

  const bAddCuad = $('#btnAtsAddCuadrilla');
  if (bAddCuad) {
    bAddCuad.onclick = () => {
      const container = $('#atsCuadrillaList');
      if (!container) return;
      const cant = container.querySelectorAll('.ats-cuadrilla-row-item').length;
      const div = document.createElement('div');
      div.className = 'ats-cuadrilla-row-item';
      div.dataset.idx = cant;
      div.dataset.firma = '';
      div.innerHTML = `
        <div class="ats-cell-q-num ats-cuadrilla-num">${cant + 1}</div>
        <div class="ats-cell-q-nom">
          <input class="ats-cell-input ats-cuad-nom" placeholder="Apellido y Nombre">
        </div>
        <div class="ats-cell-q-dni">
          <input class="ats-cell-input ats-cuad-dni" placeholder="N° Documento / Legajo">
        </div>
        <div class="ats-cell-q-sign ats-cuad-sign-cell"></div>
        <div class="ats-cell-q-act">
          <button type="button" class="ats-btn-del-cuadrilla" title="Quitar fila">🗑️</button>
        </div>
      `;
      actualizarFirmaRowCuadrilla(div);
      div.querySelector('.ats-btn-del-cuadrilla').onclick = () => {
        div.remove();
        reindexarCuadrilla();
      };
      container.appendChild(div);
      const inp = div.querySelector('.ats-cuad-nom');
      if (inp) inp.focus();
    };
  }

  // 3. Cerrar modal y botones header
  const bClose = $('#btnAtsClose');
  if (bClose) bClose.onclick = cerrarModalATS;
  const bCancel = $('#btnAtsCancel');
  if (bCancel) bCancel.onclick = cerrarModalATS;

  const bSaveTop = $('#btnAtsQuickSaveTop');
  if (bSaveTop) {
    bSaveTop.onclick = async () => {
      await guardarATS();
    };
  }

  const bPdfTop = $('#btnAtsQuickPdfTop');
  if (bPdfTop) {
    bPdfTop.onclick = async () => {
      const data = recolectarDatosATS();
      await exportarAtsPDF(data);
    };
  }

  // 4. Exportar PDF desde el footer
  const bExp = $('#btnAtsExportPDF');
  if (bExp) {
    bExp.onclick = async () => {
      const data = recolectarDatosATS();
      await exportarAtsPDF(data);
    };
  }

  // 5. Guardar ATS form submit
  const form = $('#formATS');
  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();
      await guardarATS();
    };
  }

  // 6. Firmas de Autoridades
  // Jefe
  const bSignJefe = $('#btnSignJefe');
  if (bSignJefe) {
    bSignJefe.onclick = () => {
      const nom = $('#atsFirmaJefe') ? $('#atsFirmaJefe').value.trim() : 'Jefe de cuadrilla';
      abrirModalFirmaDigital({
        titulo: `✍️ Firma de ${nom || 'Jefe de cuadrilla'}`,
        onAceptar: (dataUrl) => {
          atsFirmaJefeData = dataUrl;
          actualizarVistaFirmasAutoridades();
        }
      });
    };
  }
  const bResignJefe = $('#btnResignJefe');
  if (bResignJefe) {
    bResignJefe.onclick = () => {
      const nom = $('#atsFirmaJefe') ? $('#atsFirmaJefe').value.trim() : 'Jefe de cuadrilla';
      abrirModalFirmaDigital({
        titulo: `✍️ Firma de ${nom || 'Jefe de cuadrilla'}`,
        onAceptar: (dataUrl) => {
          atsFirmaJefeData = dataUrl;
          actualizarVistaFirmasAutoridades();
        }
      });
    };
  }
  const bDelSignJefe = $('#btnDelSignJefe');
  if (bDelSignJefe) {
    bDelSignJefe.onclick = () => {
      atsFirmaJefeData = null;
      actualizarVistaFirmasAutoridades();
    };
  }

  // Supervisor
  const bSignSup = $('#btnSignSup');
  if (bSignSup) {
    bSignSup.onclick = () => {
      const nom = $('#atsFirmaSupervisor') ? $('#atsFirmaSupervisor').value.trim() : 'Supervisor';
      abrirModalFirmaDigital({
        titulo: `✍️ Firma de ${nom || 'Supervisor'}`,
        onAceptar: (dataUrl) => {
          atsFirmaSupervisorData = dataUrl;
          actualizarVistaFirmasAutoridades();
        }
      });
    };
  }
  const bResignSup = $('#btnResignSup');
  if (bResignSup) {
    bResignSup.onclick = () => {
      const nom = $('#atsFirmaSupervisor') ? $('#atsFirmaSupervisor').value.trim() : 'Supervisor';
      abrirModalFirmaDigital({
        titulo: `✍️ Firma de ${nom || 'Supervisor'}`,
        onAceptar: (dataUrl) => {
          atsFirmaSupervisorData = dataUrl;
          actualizarVistaFirmasAutoridades();
        }
      });
    };
  }
  const bDelSignSup = $('#btnDelSignSup');
  if (bDelSignSup) {
    bDelSignSup.onclick = () => {
      atsFirmaSupervisorData = null;
      actualizarVistaFirmasAutoridades();
    };
  }

  // Higiene
  const bSignHig = $('#btnSignHig');
  if (bSignHig) {
    bSignHig.onclick = () => {
      const nom = $('#atsFirmaHigiene') ? $('#atsFirmaHigiene').value.trim() : 'Higiene & Seguridad';
      abrirModalFirmaDigital({
        titulo: `✍️ Firma de ${nom || 'Higiene & Seguridad'}`,
        onAceptar: (dataUrl) => {
          atsFirmaHigieneData = dataUrl;
          actualizarVistaFirmasAutoridades();
        }
      });
    };
  }
  const bResignHig = $('#btnResignHig');
  if (bResignHig) {
    bResignHig.onclick = () => {
      const nom = $('#atsFirmaHigiene') ? $('#atsFirmaHigiene').value.trim() : 'Higiene & Seguridad';
      abrirModalFirmaDigital({
        titulo: `✍️ Firma de ${nom || 'Higiene & Seguridad'}`,
        onAceptar: (dataUrl) => {
          atsFirmaHigieneData = dataUrl;
          actualizarVistaFirmasAutoridades();
        }
      });
    };
  }
  const bDelSignHig = $('#btnDelSignHig');
  if (bDelSignHig) {
    bDelSignHig.onclick = () => {
      atsFirmaHigieneData = null;
      actualizarVistaFirmasAutoridades();
    };
  }

  // 7. Inicializar canvas de firmas
  initSignatureCanvas();

  // Render inicial del banner
  renderATSStatus();
}

function reindexarCuadrilla() {
  const container = $('#atsCuadrillaList');
  if (!container) return;
  container.querySelectorAll('.ats-cuadrilla-row-item').forEach((row, idx) => {
    row.dataset.idx = idx;
    const num = row.querySelector('.ats-cuadrilla-num');
    if (num) num.textContent = idx + 1;
    const actCell = row.querySelector('.ats-cell-q-act');
    if (actCell) {
      actCell.innerHTML = idx > 0 ? `<button type="button" class="ats-btn-del-cuadrilla" title="Quitar fila">🗑️</button>` : '';
      const delBtn = actCell.querySelector('.ats-btn-del-cuadrilla');
      if (delBtn) {
        delBtn.onclick = () => {
          row.remove();
          reindexarCuadrilla();
        };
      }
    }
  });
}

function actualizarFirmaRowCuadrilla(row) {
  const signCell = row.querySelector('.ats-cuad-sign-cell');
  if (!signCell) return;
  const firma = row.dataset.firma || '';
  const nomInput = row.querySelector('.ats-cuad-nom');

  if (firma) {
    signCell.innerHTML = `
      <div class="ats-sign-thumb-container">
        <img src="${firma}" class="ats-sign-thumb-img" alt="Firma digital">
        <button type="button" class="ats-btn-resign" title="Cambiar firma">✍️</button>
        <button type="button" class="ats-btn-delsign" title="Borrar firma">✕</button>
      </div>
    `;
    signCell.querySelector('.ats-btn-resign').onclick = () => {
      const nombre = nomInput ? nomInput.value.trim() : 'Integrante';
      abrirModalFirmaDigital({
        titulo: `✍️ Firma de ${nombre || 'Integrante'}`,
        onAceptar: (dataUrl) => {
          row.dataset.firma = dataUrl;
          actualizarFirmaRowCuadrilla(row);
        }
      });
    };
    signCell.querySelector('.ats-btn-delsign').onclick = () => {
      row.dataset.firma = '';
      actualizarFirmaRowCuadrilla(row);
    };
  } else {
    signCell.innerHTML = `<button type="button" class="ats-btn-sign-item">✍️ Firmar</button>`;
    signCell.querySelector('.ats-btn-sign-item').onclick = () => {
      const nombre = nomInput ? nomInput.value.trim() : 'Integrante';
      abrirModalFirmaDigital({
        titulo: `✍️ Firma de ${nombre || 'Integrante'}`,
        onAceptar: (dataUrl) => {
          row.dataset.firma = dataUrl;
          actualizarFirmaRowCuadrilla(row);
        }
      });
    };
  }
}

function renderCuadrillaRows(lista) {
  const container = $('#atsCuadrillaList');
  if (!container) return;
  if (!lista || !lista.length) {
    lista = [{
      nombre: State.user ? State.user.nombre : '',
      dni: State.user ? (State.user.legajo || State.user.dni || '') : '',
      firma: ''
    }];
  }

  container.innerHTML = lista.map((m, idx) => `
    <div class="ats-cuadrilla-row-item" data-idx="${idx}" data-firma="${escapeHtml(m.firma || '')}">
      <div class="ats-cell-q-num ats-cuadrilla-num">${idx + 1}</div>
      <div class="ats-cell-q-nom">
        <input class="ats-cell-input ats-cuad-nom" placeholder="Apellido y Nombre" value="${escapeHtml(m.nombre || '')}">
      </div>
      <div class="ats-cell-q-dni">
        <input class="ats-cell-input ats-cuad-dni" placeholder="N° Documento / Legajo" value="${escapeHtml(m.dni || '')}">
      </div>
      <div class="ats-cell-q-sign ats-cuad-sign-cell"></div>
      <div class="ats-cell-q-act">
        ${idx > 0 ? `<button type="button" class="ats-btn-del-cuadrilla" title="Quitar fila">🗑️</button>` : ''}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.ats-cuadrilla-row-item').forEach(row => {
    actualizarFirmaRowCuadrilla(row);
  });

  container.querySelectorAll('.ats-btn-del-cuadrilla').forEach(btn => {
    btn.onclick = () => {
      const row = btn.closest('.ats-cuadrilla-row-item');
      if (row) row.remove();
      reindexarCuadrilla();
    };
  });
}

function abrirModalATS(opciones = {}) {
  const modal = $('#modalATS');
  if (!modal) return;

  const ats = (State.jornada && State.jornada.ats) ? State.jornada.ats : null;
  const hoyStr = (State.jornada && State.jornada.fecha) ? State.jornada.fecha : hoy();
  const horaActual = horaCorta();

  // Datos Generales
  const fOT = $('#atsOT');
  const fObra = $('#atsObra');
  const fPedido = $('#atsPedido');
  const fSector = $('#atsSector');
  const fFecha = $('#atsFecha');
  const fHora = $('#atsHora');
  const fDir = $('#atsDireccion');
  const fLoc = $('#atsLocalidad');
  const fTrab = $('#atsTrabajoAsignado');

  if (fOT) fOT.value = ats ? (ats.ot || '') : '';
  if (fObra) fObra.value = ats ? (ats.obra || '') : '';
  if (fPedido) fPedido.value = ats ? (ats.pedido || '') : '';
  if (fSector) fSector.value = ats ? (ats.sector || '') : 'Distribución';
  if (fFecha) fFecha.value = ats ? (ats.fecha || hoyStr) : hoyStr;
  if (fHora) fHora.value = ats ? (ats.hora || horaActual) : horaActual;
  if (fDir) fDir.value = ats ? (ats.direccion || '') : '';
  if (fLoc) fLoc.value = ats ? (ats.localidad || '') : (State.user ? State.user.zona || '' : '');
  if (fTrab) fTrab.value = ats ? (ats.trabajoAsignado || '') : '';

  // Riesgos Potenciales
  const selRiesgos = (ats && Array.isArray(ats.riesgos)) ? ats.riesgos.map(Number) : [];
  $$('.ats-doc-risk-item').forEach(item => {
    const n = parseInt(item.dataset.n);
    item.classList.toggle('selected', selRiesgos.includes(n));
  });

  // Tipo de Tareas
  const selTipos = (ats && Array.isArray(ats.tipos)) ? ats.tipos : [];
  $$('input[name="atsTipo"]').forEach(cb => {
    cb.checked = selTipos.includes(cb.value);
  });
  const tCivil = $('#atsTipoObraCivil'); if (tCivil) tCivil.value = ats ? (ats.tipoObraCivil || '') : '';
  const tPoda = $('#atsTipoPoda'); if (tPoda) tPoda.value = ats ? (ats.tipoPoda || '') : '';
  const tCanal = $('#atsTipoCanalizacion'); if (tCanal) tCanal.value = ats ? (ats.tipoCanalizacion || '') : '';

  // Situación del Entorno
  const selEnt = (ats && Array.isArray(ats.entorno)) ? ats.entorno : ['Normal'];
  $$('input[name="atsEntorno"]').forEach(cb => {
    cb.checked = selEnt.includes(cb.value);
  });
  const entAnorm = $('#atsEntornoAnormal'); if (entAnorm) entAnorm.value = ats ? (ats.entornoAnormal || '') : '';
  const fObs = $('#atsObservacion'); if (fObs) fObs.value = ats ? (ats.observacion || '') : '';

  // EPP
  const selEpp = (ats && Array.isArray(ats.epp)) ? ats.epp : ['Casco', 'Botín de Seguridad', 'Guantes de prot Mec.', 'Protector Ocular'];
  $$('input[name="atsEpp"]').forEach(cb => {
    cb.checked = selEpp.includes(cb.value);
  });
  const eppOtros = $('#atsEppOtros'); if (eppOtros) eppOtros.value = ats ? (ats.eppOtros || '') : '';

  // 5 Reglas de Oro
  const selReglas = (ats && Array.isArray(ats.reglas)) ? ats.reglas : [];
  $$('input[name="atsReglas"]').forEach(cb => {
    cb.checked = selReglas.includes(cb.value);
  });

  // Charla 5 Minutos
  const selCharla = (ats && Array.isArray(ats.charla)) ? ats.charla : [
    '1.- Riesgos eléctricos',
    '2.- Normas de seguridad',
    '3.- Condiciones del lugar de trabajo',
    '6.- Uso de Elementos de Protecion Personal.'
  ];
  $$('input[name="atsCharla"]').forEach(cb => {
    cb.checked = selCharla.includes(cb.value);
  });

  // Personal de Cuadrilla
  renderCuadrillaRows(ats ? ats.cuadrilla : null);

  // Firmas de Autoridades
  const fj = $('#atsFirmaJefe');
  if (fj) fj.value = ats ? (ats.firmaJefe || '') : (State.user ? `${State.user.nombre} (Leg. ${State.user.legajo || State.user.dni || ''})` : '');
  const fs = $('#atsFirmaSupervisor');
  if (fs) fs.value = ats ? (ats.firmaSupervisor || '') : '';
  const fh = $('#atsFirmaHigiene');
  if (fh) fh.value = ats ? (ats.firmaHigiene || '') : '';

  atsFirmaJefeData = (ats && ats.firmaJefeImg) ? ats.firmaJefeImg : null;
  atsFirmaSupervisorData = (ats && ats.firmaSupervisorImg) ? ats.firmaSupervisorImg : null;
  atsFirmaHigieneData = (ats && ats.firmaHigieneImg) ? ats.firmaHigieneImg : null;
  actualizarVistaFirmasAutoridades();

  // Botón Exportar PDF en footer y header
  const bExp = $('#btnAtsExportPDF');
  if (bExp) bExp.style.display = ats && ats.completado ? 'inline-block' : 'none';
  const bExpTop = $('#btnAtsQuickPdfTop');
  if (bExpTop) bExpTop.style.display = ats && ats.completado ? 'inline-block' : 'none';

  modal.classList.add('show');
  if (fOT && !fOT.value) fOT.focus();
}

function cerrarModalATS() {
  const modal = $('#modalATS');
  if (modal) modal.classList.remove('show');
}

function recolectarDatosATS() {
  const fOT = $('#atsOT');
  const fObra = $('#atsObra');
  const fPedido = $('#atsPedido');
  const fSector = $('#atsSector');
  const fFecha = $('#atsFecha');
  const fHora = $('#atsHora');
  const fDir = $('#atsDireccion');
  const fLoc = $('#atsLocalidad');
  const fTrab = $('#atsTrabajoAsignado');

  const riesgos = [];
  $$('.ats-doc-risk-item.selected').forEach(item => {
    const n = parseInt(item.dataset.n);
    if (!isNaN(n)) riesgos.push(n);
  });

  const tipos = [];
  $$('input[name="atsTipo"]:checked').forEach(cb => tipos.push(cb.value));

  const entorno = [];
  $$('input[name="atsEntorno"]:checked').forEach(cb => entorno.push(cb.value));

  const epp = [];
  $$('input[name="atsEpp"]:checked').forEach(cb => epp.push(cb.value));

  const reglas = [];
  $$('input[name="atsReglas"]:checked').forEach(cb => reglas.push(cb.value));

  const charla = [];
  $$('input[name="atsCharla"]:checked').forEach(cb => charla.push(cb.value));

  const cuadrilla = [];
  $$('#atsCuadrillaList .ats-cuadrilla-row-item').forEach(row => {
    const nom = row.querySelector('.ats-cuad-nom');
    const dni = row.querySelector('.ats-cuad-dni');
    const firma = row.dataset.firma || '';
    if (nom && nom.value.trim()) {
      cuadrilla.push({
        nombre: nom.value.trim(),
        dni: dni ? dni.value.trim() : '',
        firma
      });
    }
  });

  return {
    ot: fOT ? fOT.value.trim() : '',
    obra: fObra ? fObra.value.trim() : '',
    pedido: fPedido ? fPedido.value.trim() : '',
    sector: fSector ? fSector.value.trim() : '',
    fecha: fFecha ? fFecha.value : hoy(),
    hora: fHora ? fHora.value : horaCorta(),
    direccion: fDir ? fDir.value.trim() : '',
    localidad: fLoc ? fLoc.value.trim() : '',
    trabajoAsignado: fTrab ? fTrab.value.trim() : '',
    riesgos,
    tipos,
    tipoObraCivil: $('#atsTipoObraCivil') ? $('#atsTipoObraCivil').value.trim() : '',
    tipoPoda: $('#atsTipoPoda') ? $('#atsTipoPoda').value.trim() : '',
    tipoCanalizacion: $('#atsTipoCanalizacion') ? $('#atsTipoCanalizacion').value.trim() : '',
    entorno,
    entornoAnormal: $('#atsEntornoAnormal') ? $('#atsEntornoAnormal').value.trim() : '',
    observacion: $('#atsObservacion') ? $('#atsObservacion').value.trim() : '',
    epp,
    eppOtros: $('#atsEppOtros') ? $('#atsEppOtros').value.trim() : '',
    reglas,
    charla,
    cuadrilla,
    firmaJefe: $('#atsFirmaJefe') ? $('#atsFirmaJefe').value.trim() : '',
    firmaSupervisor: $('#atsFirmaSupervisor') ? $('#atsFirmaSupervisor').value.trim() : '',
    firmaHigiene: $('#atsFirmaHigiene') ? $('#atsFirmaHigiene').value.trim() : '',
    firmaJefeImg: atsFirmaJefeData || '',
    firmaSupervisorImg: atsFirmaSupervisorData || '',
    firmaHigieneImg: atsFirmaHigieneData || '',
    completado: true,
    actualizadoEn: ahora()
  };
}

async function guardarATS(exportarDespues = false) {
  if (!State.jornada) {
    toast('Debés iniciar la jornada para guardar el ATS', 'warn');
    return;
  }

  const ats = recolectarDatosATS();
  if (!ats.ot) {
    toast('El número de OT es obligatorio', 'warn');
    const fOT = $('#atsOT'); if (fOT) fOT.focus();
    return;
  }
  if (!ats.trabajoAsignado) {
    toast('El trabajo asignado es obligatorio', 'warn');
    const fT = $('#atsTrabajoAsignado'); if (fT) fT.focus();
    return;
  }

  State.jornada.ats = ats;
  await saveJornada();

  renderATSStatus();
  try { await limpiarNotificacionATS(); } catch (e) {}
  toast('✅ Formulario ATS guardado correctamente', 'success');

  const bExp = $('#btnAtsExportPDF');
  if (bExp) bExp.style.display = 'inline-block';
  const bExpTop = $('#btnAtsQuickPdfTop');
  if (bExpTop) bExpTop.style.display = 'inline-block';

  cerrarModalATS();

  if (exportarDespues) {
    await exportarAtsPDF(ats);
  }
}

async function exportarAtsPDF(ats, compartir = false) {
  if (!ats) {
    toast('No hay datos de ATS para exportar', 'warn');
    return;
  }
  if (!window.jspdf) {
    toast('Librería PDF no disponible en este momento', 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const left = 10;
  const w = 190;
  let y = 10;

  // 1. ENCABEZADO (h = 15mm) - FORMATO SIN LOGO COMO FUE SOLICITADO
  doc.setDrawColor(40);
  doc.setLineWidth(0.35);
  doc.rect(left, y, w, 15);

  // Columna 1 (izquierda, vacía sin logo): 42mm
  doc.line(left + 42, y, left + 42, y + 15);

  // Columna 2 (centro): 102mm
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(20);
  doc.text('FORMULARIO', left + 42 + 51, y + 5.5, { align: 'center' });
  doc.setFontSize(11);
  doc.text('Análisis de trabajo seguro (ATS)', left + 42 + 51, y + 11.5, { align: 'center' });

  // Columna 3 (derecha): 46mm
  doc.line(left + 144, y, left + 144, y + 15);
  const rh = 15 / 4; // 3.75mm por fila
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(30);
  doc.line(left + 144, y + rh, left + w, y + rh);
  doc.line(left + 144, y + rh * 2, left + w, y + rh * 2);
  doc.line(left + 144, y + rh * 3, left + w, y + rh * 3);
  doc.text('Código: PR SH 06 FOR 03', left + 146, y + 2.7);
  doc.text('Vigencia:02/09/2020', left + 146, y + rh + 2.7);
  doc.text('Revisión: 2', left + 146, y + rh * 2 + 2.7);
  doc.text('Página: 1 de 1', left + 146, y + rh * 3 + 2.7);

  y += 15;

  // 2. DATOS GENERALES (3 filas)
  // Fila 1: N° OT (35mm) | Obra (40mm) | Pedido (35mm) | Sector (42mm) | Fecha (38mm)
  doc.rect(left, y, w, 5.8);
  doc.line(left + 35, y, left + 35, y + 5.8);
  doc.line(left + 75, y, left + 75, y + 5.8);
  doc.line(left + 110, y, left + 110, y + 5.8);
  doc.line(left + 152, y, left + 152, y + 5.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text('N° OT:', left + 1.5, y + 4);
  doc.text('Obra:', left + 36.5, y + 4);
  doc.text('Pedido:', left + 76.5, y + 4);
  doc.text('Sector:', left + 111.5, y + 4);
  doc.text('Fecha:', left + 153.5, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.text(String(ats.ot || ''), left + 12, y + 4);
  doc.text(String(ats.obra || ''), left + 46, y + 4);
  doc.text(String(ats.pedido || ''), left + 88, y + 4);
  doc.text(String(ats.sector || ''), left + 122, y + 4);
  doc.text(String(ats.fecha || ''), left + 164, y + 4);

  y += 5.8;

  // Fila 2: Dirección (92mm) | Localidad (60mm) | Hora (38mm)
  doc.rect(left, y, w, 5.8);
  doc.line(left + 92, y, left + 92, y + 5.8);
  doc.line(left + 152, y, left + 152, y + 5.8);

  doc.setFont('helvetica', 'bold');
  doc.text('Dirección:', left + 1.5, y + 4);
  doc.text('Localidad:', left + 93.5, y + 4);
  doc.text('Hora:', left + 153.5, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.text(String(ats.direccion || ''), left + 16, y + 4);
  doc.text(String(ats.localidad || ''), left + 108, y + 4);
  doc.text(String(ats.hora || ''), left + 163, y + 4);

  y += 5.8;

  // Fila 3: Trabajo Asignado
  doc.rect(left, y, w, 5.8);
  doc.setFont('helvetica', 'bold');
  doc.text('Trabajo Asignado:', left + 1.5, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(String(ats.trabajoAsignado || ''), left + 27, y + 4);

  y += 5.8;

  // 3. RIESGOS POTENCIALES (realizar un circulo alrededor del número)
  doc.setFillColor(232, 232, 232);
  doc.rect(left, y, w, 4.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('Riesgos potenciales (realizar un circulo alrededor del número)', left + w / 2, y + 3.2, { align: 'center' });
  y += 4.5;

  const colW = w / 3;
  const rH = 3.6;
  const riesgosCols = [
    [
      { n: 1,  t: 'Caída de personas a nivel' },
      { n: 2,  t: 'Caída de personas de altura' },
      { n: 3,  t: 'Caída de personas al agua' },
      { n: 4,  t: 'Caída de objetos en altura' },
      { n: 5,  t: 'Derrumbe de instalaciones' },
      { n: 6,  t: 'Pisada sobre objetos' },
      { n: 7,  t: 'Proyección de partículas' }
    ],
    [
      { n: 8,  t: 'Golpes por objetos' },
      { n: 9,  t: 'Aprisionamiento' },
      { n: 10, t: 'Esfuerzo físico excesivo' },
      { n: 11, t: 'Heridas con objeto cortopunzante' },
      { n: 12, t: 'Contacto con fuego' },
      { n: 13, t: 'Contacto con electricidad' },
      { n: 14, t: 'Incendio' }
    ],
    [
      { n: 15, t: 'Atropellamiento por animales' },
      { n: 16, t: 'Mordeduras por animales' },
      { n: 17, t: 'Atropellamiento por vehículos' },
      { n: 18, t: 'Agresión con armas' },
      { n: 19, t: 'Agresión por terceros' },
      { n: 20, t: 'Poste podrido' },
      { n: 21, t: 'Otras formas' }
    ]
  ];

  doc.rect(left, y, w, rH * 7);
  doc.line(left + colW, y, left + colW, y + rH * 7);
  doc.line(left + colW * 2, y, left + colW * 2, y + rH * 7);

  const riesgosSel = Array.isArray(ats.riesgos) ? ats.riesgos.map(Number) : [];

  for (let c = 0; c < 3; c++) {
    const colList = riesgosCols[c];
    for (let r = 0; r < 7; r++) {
      const item = colList[r];
      const itemY = y + r * rH;
      if (r > 0) {
        doc.line(left + c * colW, itemY, left + (c + 1) * colW, itemY);
      }
      const boxX = left + c * colW + 1;
      const numX = boxX + 2.8;
      const numY = itemY + 2.6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.text(String(item.n), numX, numY, { align: 'center' });

      // Círculo alrededor del número si está seleccionado
      if (riesgosSel.includes(item.n)) {
        doc.setDrawColor(220, 38, 38);
        doc.setLineWidth(0.45);
        doc.circle(numX, numY - 0.7, 2.2);
        doc.setDrawColor(40);
        doc.setLineWidth(0.35);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.text(item.t, boxX + 6.5, numY);
    }
  }
  y += rH * 7;

  // 4. TIPO DE TAREAS
  doc.setFillColor(232, 232, 232);
  doc.rect(left, y, w, 4.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('Tipo de Tareas:', left + 2, y + 3);
  y += 4.2;

  const tiposSel = Array.isArray(ats.tipos) ? ats.tipos : [];

  function drawBoxCheck(x, yPos, isChecked, size = 3) {
    doc.rect(x, yPos, size, size);
    if (isChecked) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('X', x + size / 2, yPos + size - 0.6, { align: 'center' });
    }
  }

  // Fila 1: Aéreas de MT/BT | Montaje de Estructuras... | Obra Civil
  doc.rect(left, y, w, 5.2);
  doc.line(left + 55, y, left + 55, y + 5.2);
  doc.line(left + 130, y, left + 130, y + 5.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.text('Aéreas de MT/BT', left + 1.5, y + 3.4);
  drawBoxCheck(left + 49, y + 1.1, tiposSel.includes('Aéreas de MT/BT'));

  doc.text('Montaje de Estructuras, LAMT, LABT Y TRANSFORMADORES', left + 56.5, y + 3.4);
  drawBoxCheck(left + 124, y + 1.1, tiposSel.includes('Montaje de Estructuras, LAMT, LABT Y TRANSFORMADORES'));

  const hasCivil = tiposSel.includes('Obra Civil') || !!ats.tipoObraCivil;
  doc.text('Obra Civil: ' + (ats.tipoObraCivil || ''), left + 131.5, y + 3.4);
  drawBoxCheck(left + 184, y + 1.1, hasCivil);

  y += 5.2;

  // Fila 2: Montaje de Postes | Poda | Canalización/Zanjeo | Medidores
  doc.rect(left, y, w, 5.2);
  doc.line(left + 55, y, left + 55, y + 5.2);
  doc.line(left + 97, y, left + 97, y + 5.2);
  doc.line(left + 145, y, left + 145, y + 5.2);

  doc.text('Montaje de Postes y Columnas y Bases', left + 1.5, y + 3.4);
  drawBoxCheck(left + 49, y + 1.1, tiposSel.includes('Montaje de Postes y Columnas y Bases'));

  const hasPoda = tiposSel.includes('Poda') || !!ats.tipoPoda;
  doc.text('Poda: ' + (ats.tipoPoda || ''), left + 56.5, y + 3.4);
  drawBoxCheck(left + 91, y + 1.1, hasPoda);

  const hasCanal = tiposSel.includes('Canalización / Zanjeo') || !!ats.tipoCanalizacion;
  doc.text('Canalización / Zanjeo: ' + (ats.tipoCanalizacion || ''), left + 98.5, y + 3.4);
  drawBoxCheck(left + 139, y + 1.1, hasCanal);

  doc.text('Medidores', left + 146.5, y + 3.4);
  drawBoxCheck(left + 184, y + 1.1, tiposSel.includes('Medidores'));

  y += 5.2;

  // 5. SITUACIÓN DEL ENTORNO
  doc.setFillColor(232, 232, 232);
  doc.rect(left, y, w, 4.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Situación del Entorno (Planificar la Tarea) Marcar con una X', left + 2, y + 3);
  y += 4.2;

  const entornoSel = Array.isArray(ats.entorno) ? ats.entorno : [];
  const colEnt = w / 3;

  // Fila 1 entorno
  doc.rect(left, y, w, 4.8);
  doc.line(left + colEnt, y, left + colEnt, y + 4.8);
  doc.line(left + colEnt * 2, y, left + colEnt * 2, y + 4.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.text('Normal', left + 1.5, y + 3.4);
  drawBoxCheck(left + colEnt - 6, y + 0.9, entornoSel.includes('Normal'));

  doc.text('Poste Roto', left + colEnt + 1.5, y + 3.4);
  drawBoxCheck(left + colEnt * 2 - 6, y + 0.9, entornoSel.includes('Poste Roto'));

  doc.text('Distancias de Seguridad', left + colEnt * 2 + 1.5, y + 3.4);
  drawBoxCheck(left + w - 6, y + 0.9, entornoSel.includes('Distancias de Seguridad'));

  y += 4.8;

  // Fila 2 entorno
  doc.rect(left, y, w, 4.8);
  doc.line(left + colEnt, y, left + colEnt, y + 4.8);
  doc.line(left + colEnt * 2, y, left + colEnt * 2, y + 4.8);

  const hasAnorm = entornoSel.includes('Anormal') || !!ats.entornoAnormal;
  doc.text('Anormal (Indicar): ' + (ats.entornoAnormal || ''), left + 1.5, y + 3.4);
  drawBoxCheck(left + colEnt - 6, y + 0.9, hasAnorm);

  doc.text('Instalaciones defectuosas', left + colEnt + 1.5, y + 3.4);
  drawBoxCheck(left + colEnt * 2 - 6, y + 0.9, entornoSel.includes('Instalaciones defectuosas'));

  doc.text('Orden y Limpieza', left + colEnt * 2 + 1.5, y + 3.4);
  drawBoxCheck(left + w - 6, y + 0.9, entornoSel.includes('Orden y Limpieza'));

  y += 4.8;

  // Fila 3 entorno: Observación
  doc.rect(left, y, w, 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.text('Observación:', left + 1.5, y + 3.5);
  doc.setFont('helvetica', 'normal');
  doc.text(String(ats.observacion || ''), left + 20, y + 3.5);

  y += 5;

  // 6. EPP Y ESC A UTILIZAR
  doc.setFillColor(232, 232, 232);
  doc.rect(left, y, w, 4.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text('EPP y ESC a Utilizar (marcar con una X el que corresponda según la tarea a realizar)', left + 2, y + 3);
  y += 4.2;

  const eppSel = Array.isArray(ats.epp) ? ats.epp : [];
  const colEpp = w / 3;
  const eppRows = [
    [
      { t: 'Casco', val: 'Casco' },
      { t: 'Botín de Seguridad', val: 'Botín de Seguridad' },
      { t: 'Guantes de prot Mec.', val: 'Guantes de prot Mec.' },
      { t: 'Guantes Dieléctricos', val: 'Guantes Dieléctricos' },
      { t: 'Mascara Antideflagracion', val: 'Mascara Antideflagracion' },
      { t: 'Protector Ocular', val: 'Protector Ocular' }
    ],
    [
      { t: 'Arnés anticaida y Acc.', val: 'Arnés anticaida y Acc.' },
      { t: 'Alfombra y/o Manta', val: 'Alfombra y/o Manta' },
      { t: 'Botiquín 1° Auxilios', val: 'Botiquín 1° Auxilios' },
      { t: 'Matafuego', val: 'Matafuego' },
      { t: 'Herramientas Aisladas', val: 'Herramientas Aisladas' },
      { t: 'Manopla Extrac Fusible', val: 'Manopla Extrac Fusible' }
    ],
    [
      { t: 'Escaleras Dieléctricas', val: 'Escaleras Dieléctricas' },
      { t: 'Elementos de Señalizacion', val: 'Elementos de Señalizacion' },
      { t: 'Trepadores', val: 'Trepadores' },
      { t: 'Soga de servicio', val: 'Soga de servicio' },
      { t: 'Otros (Indicar): ' + (ats.eppOtros || ''), val: 'Otros' },
      { t: '', val: null }
    ]
  ];

  const hEppRow = 3.6;
  doc.rect(left, y, w, hEppRow * 6);
  doc.line(left + colEpp, y, left + colEpp, y + hEppRow * 6);
  doc.line(left + colEpp * 2, y, left + colEpp * 2, y + hEppRow * 6);

  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 6; r++) {
      const it = eppRows[c][r];
      const rY = y + r * hEppRow;
      if (r > 0) doc.line(left + c * colEpp, rY, left + (c + 1) * colEpp, rY);
      if (it.val) {
        const isChecked = eppSel.includes(it.val) || (it.val === 'Otros' && !!ats.eppOtros);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.8);
        doc.text(it.t, left + c * colEpp + 1.5, rY + 2.5);
        drawBoxCheck(left + (c + 1) * colEpp - 5.5, rY + 0.4, isChecked, 2.7);
      }
    }
  }
  y += hEppRow * 6;

  // 7. MEDIDAS DE SEGURIDAD (5 REGLAS DE ORO)
  doc.setFillColor(232, 232, 232);
  doc.rect(left, y, w, 4.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text('Medidas de Seguridad (5 Reglas de Oro) si corresponde a la tarea, Marcar con una X', left + 2, y + 3);
  y += 4.2;

  const reglasSel = Array.isArray(ats.reglas) ? ats.reglas : [];
  const reglasList = [
    { t: 'Corte de Alimentación', val: 'Corte de Alimentación' },
    { t: 'Bloqueo', val: 'Bloqueo' },
    { t: 'Verificación de Tensión', val: 'Verificación de Tensión' },
    { t: 'Puesta a Tierra y CC.', val: 'Puesta a Tierra y CC.' },
    { t: 'Delimitación de la zona de Trabajo', val: 'Delimitación de la zona de Trabajo' }
  ];

  const colRegla = w / 5;
  doc.rect(left, y, w, 5.2);
  for (let i = 0; i < 5; i++) {
    if (i > 0) doc.line(left + i * colRegla, y, left + i * colRegla, y + 5.2);
    const reg = reglasList[i];
    const isChecked = reglasSel.includes(reg.val);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.2);
    doc.text(reg.t, left + i * colRegla + 1, y + 3.4);
    drawBoxCheck(left + (i + 1) * colRegla - 5, y + 1.2, isChecked, 2.8);
  }
  y += 5.2;

  // 8. TEXTO LEGAL
  doc.rect(left, y, w, 7.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.7);
  doc.setTextColor(50);
  const legalText = 'El objetivo de la NOTIFICACION DE RIESGOS es dar cumplimiento al Art. 208 del Dec. 351/79 "capacitar en... En prevención de enfermedades profesionales y de accidentes del trabajo", siendo parte, la presente notificación, de un conjunto de acciones y registros tendientes a cumplimentar todo el capítulo 21 del citado Dec. que reglamenta la Ley 19587.';
  doc.text(doc.splitTextToSize(legalText, w - 4), left + 2, y + 2.7);
  doc.setTextColor(20);
  y += 7.5;

  // 9. CHARLA DE 5 MINUTOS
  doc.setFillColor(232, 232, 232);
  doc.rect(left, y, w, 4.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text('CHARLA DE 5 MINUTOS (marque con una X los temas que mencionaron)', left + 2, y + 3);
  y += 4.2;

  const charlaSel = Array.isArray(ats.charla) ? ats.charla : [];
  const colCharla = w / 2;
  const charlaCols = [
    [
      '1.- Riesgos eléctricos',
      '2.- Normas de seguridad',
      '3.- Condiciones del lugar de trabajo',
      '4.- Riesgo de trabajo en altura',
      '5.- Prevción y combate de incendios',
      '6.- Uso de Elementos de Protecion Personal.',
      '7.- Uso equipos y herramientas aisladas'
    ],
    [
      '8.- Manejo y almacenamiento de materiales',
      '09.- Señalización en vía pública',
      '10.- Superficies de trabajo',
      '11.- Normas de higiene y aseo',
      '12.- Orden y limpieza',
      '13.- Riesgos específicos',
      '14.- Respuestas ante emergencias'
    ]
  ];

  const hCharlaRow = 3.5;
  doc.rect(left, y, w, hCharlaRow * 7);
  doc.line(left + colCharla, y, left + colCharla, y + hCharlaRow * 7);

  for (let c = 0; c < 2; c++) {
    for (let r = 0; r < 7; r++) {
      const tema = charlaCols[c][r];
      const rY = y + r * hCharlaRow;
      if (r > 0) doc.line(left + c * colCharla, rY, left + (c + 1) * colCharla, rY);
      const isChecked = charlaSel.includes(tema);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.text(tema, left + c * colCharla + 1.5, rY + 2.5);
      drawBoxCheck(left + (c + 1) * colCharla - 5.5, rY + 0.4, isChecked, 2.7);
    }
  }
  y += hCharlaRow * 7;

  // 10. APELLIDO, NOMBRE Y NÚMERO DE DOCUMENTO (CUADRILLA Y FIRMAS)
  doc.setFillColor(232, 232, 232);
  doc.rect(left, y, w, 4.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text('Apellido, Nombre y Número de Documento (Datos obligatorios y firmas del equipo)', left + 2, y + 3);
  y += 4.2;

  const cuadrilla = Array.isArray(ats.cuadrilla) ? ats.cuadrilla : [];
  const filasCuadrilla = Math.max(4, cuadrilla.length);
  const hCuadRow = 7.5; // Altura para firma digital legible

  // Encabezado de la tabla cuadrilla
  doc.rect(left, y, w, 3.8);
  doc.line(left + 10, y, left + 10, y + 3.8);
  doc.line(left + 80, y, left + 80, y + 3.8);
  doc.line(left + 130, y, left + 130, y + 3.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.text('N°', left + 5, y + 2.6, { align: 'center' });
  doc.text('Apellido y Nombre', left + 12, y + 2.6);
  doc.text('N° de Documento / Legajo', left + 82, y + 2.6);
  doc.text('Firma del Integrante', left + 132, y + 2.6);
  y += 3.8;

  // Filas de la tabla
  doc.rect(left, y, w, hCuadRow * filasCuadrilla);
  doc.line(left + 10, y, left + 10, y + hCuadRow * filasCuadrilla);
  doc.line(left + 80, y, left + 80, y + hCuadRow * filasCuadrilla);
  doc.line(left + 130, y, left + 130, y + hCuadRow * filasCuadrilla);

  for (let i = 0; i < filasCuadrilla; i++) {
    const cY = y + i * hCuadRow;
    if (i > 0) doc.line(left, cY, left + w, cY);
    const m = cuadrilla[i] || {};
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text(String(i + 1), left + 5, cY + 4.8, { align: 'center' });
    if (m.nombre) doc.text(String(m.nombre), left + 12, cY + 4.8);
    if (m.dni) doc.text(String(m.dni), left + 82, cY + 4.8);

    if (m.firma) {
      try {
        doc.addImage(m.firma, 'PNG', left + 132, cY + 0.8, 48, 5.8);
      } catch (err) {
        doc.setFontSize(5);
        doc.text('(Firma digital registrada)', left + 133, cY + 4.8);
      }
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.2);
      doc.setTextColor(150);
      doc.text('_____________________________', left + 132, cY + 4.8);
      doc.setTextColor(20);
    }
  }
  y += hCuadRow * filasCuadrilla;

  // 11. FIRMAS Y ACLARACIONES (3 columnas con firmas digitales)
  doc.setFillColor(232, 232, 232);
  doc.rect(left, y, w, 4.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text('Firmas y Aclaraciones de Autoridades', left + 2, y + 3);
  y += 4.2;

  const colFirma = w / 3;
  const hFirma = 18;
  doc.rect(left, y, w, hFirma);
  doc.line(left + colFirma, y, left + colFirma, y + hFirma);
  doc.line(left + colFirma * 2, y, left + colFirma * 2, y + hFirma);

  // Columna 1: Jefe de cuadrilla
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('Jefe de cuadrilla', left + colFirma / 2, y + 3.2, { align: 'center' });
  if (ats.firmaJefeImg) {
    try {
      doc.addImage(ats.firmaJefeImg, 'PNG', left + (colFirma - 40) / 2, y + 4.5, 40, 7.5);
    } catch (e) {}
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  if (ats.firmaJefe) doc.text(String(ats.firmaJefe), left + colFirma / 2, y + (ats.firmaJefeImg ? 13.8 : 9.5), { align: 'center' });
  doc.setFontSize(5.2);
  doc.text('Firma y aclaración', left + colFirma / 2, y + 16.8, { align: 'center' });

  // Columna 2: Supervisor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('Supervisor', left + colFirma + colFirma / 2, y + 3.2, { align: 'center' });
  if (ats.firmaSupervisorImg) {
    try {
      doc.addImage(ats.firmaSupervisorImg, 'PNG', left + colFirma + (colFirma - 40) / 2, y + 4.5, 40, 7.5);
    } catch (e) {}
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  if (ats.firmaSupervisor) doc.text(String(ats.firmaSupervisor), left + colFirma + colFirma / 2, y + (ats.firmaSupervisorImg ? 13.8 : 9.5), { align: 'center' });
  doc.setFontSize(5.2);
  doc.text('Firma y aclaración', left + colFirma + colFirma / 2, y + 16.8, { align: 'center' });

  // Columna 3: Dto. Higiene & Seguridad
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('Dto. de Higiene & Seguridad', left + colFirma * 2 + colFirma / 2, y + 3.2, { align: 'center' });
  if (ats.firmaHigieneImg) {
    try {
      doc.addImage(ats.firmaHigieneImg, 'PNG', left + colFirma * 2 + (colFirma - 40) / 2, y + 4.5, 40, 7.5);
    } catch (e) {}
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  if (ats.firmaHigiene) doc.text(String(ats.firmaHigiene), left + colFirma * 2 + colFirma / 2, y + (ats.firmaHigieneImg ? 13.8 : 9.5), { align: 'center' });
  doc.setFontSize(5.2);
  doc.text('Firma y aclaración', left + colFirma * 2 + colFirma / 2, y + 16.8, { align: 'center' });

  const nombre = 'ATS_' + (ats.ot ? 'OT' + ats.ot + '_' : '') + (ats.fecha || hoy()) + '.pdf';
  if (compartir) {
    await compartirPDFWhatsApp(doc, nombre, 'Formulario ATS - OT ' + (ats.ot || 'S/N') + ' - Fecha: ' + (ats.fecha || hoy()));
    return;
  }
  doc.save(nombre);
  toast('📄 Formulario ATS exportado correctamente en PDF', 'success');
}

document.addEventListener('DOMContentLoaded', initATS);

/* ============================================================
   MÓDULO DE NOTIFICACIONES PUSH Y AVISOS DE LA EMPRESA (v5.9.50)
   - Push Notifications mediante Web Push API y Service Worker
   - Alertas de jornadas pendientes sin cerrar (previas o prolongadas)
   - Comunicados oficiales y avisos de seguridad de la empresa
   - Sincronización y emisión de notificaciones a las cuadrillas
   ============================================================ */

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function obtenerVapidPublicKey() {
  if (State.pushPublicKey) return State.pushPublicKey;
  try {
    const res = await fetch('/api/push/public-key');
    if (res.ok) {
      const data = await res.json();
      if (data && data.publicKey) {
        State.pushPublicKey = data.publicKey;
        return data.publicKey;
      }
    }
  } catch (e) {
    console.warn('[Push] Error al obtener clave pública VAPID:', e);
  }
  return null;
}

async function inicializarPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.info('[Push] Web Push API no disponible en este dispositivo/navegador.');
    pintarEstadoPush();
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    // Si ya tiene permiso y no tiene suscripción activa, intentar suscribir con la clave VAPID
    if (!sub && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const key = await obtenerVapidPublicKey();
      if (key) {
        try {
          const convertedKey = urlB64ToUint8Array(key);
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey
          });
        } catch (subErr) {
          console.warn('[Push] No se pudo crear suscripción automática:', subErr);
        }
      }
    }

    if (sub) {
      State.pushSubscribed = true;
      // Enviar / actualizar la suscripción en el servidor para asociarla al legajo actual
      try {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: sub,
            user: {
              legajo: State.user ? State.user.legajo : 'anonimo',
              nombre: State.user ? State.user.nombre : 'Operador'
            }
          })
        });
      } catch (errSync) {
        console.warn('[Push] Error al sincronizar suscripción en servidor:', errSync);
      }
    } else {
      State.pushSubscribed = false;
    }
  } catch (e) {
    console.warn('[Push] Error en inicializarPushNotifications:', e);
  }

  pintarEstadoPush();
}

async function alternarSuscripcionPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    toast('Las notificaciones Push no están soportadas en este navegador', 'warn');
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (sub) {
      // Dar de baja
      await sub.unsubscribe();
      try {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
      } catch (e) {}
      State.pushSubscribed = false;
      toast('🔕 Notificaciones Push desactivadas', 'info');
    } else {
      // Solicitar permiso
      let perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      if (perm !== 'granted') {
        perm = await Notification.requestPermission();
      }
      if (perm !== 'granted') {
        toast('Tenés que permitir las notificaciones en el navegador para recibir alertas push', 'warn');
        pintarEstadoPush();
        actualizarUIPushConfig();
        return;
      }

      const key = await obtenerVapidPublicKey();
      if (!key) {
        toast('No se pudo conectar con el servicio Push del servidor', 'error');
        return;
      }

      const convertedKey = urlB64ToUint8Array(key);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          user: {
            legajo: State.user ? State.user.legajo : 'anonimo',
            nombre: State.user ? State.user.nombre : 'Operador'
          }
        })
      });

      State.pushSubscribed = true;
      toast('🔔 ¡Notificaciones Push activadas con éxito!', 'success');

      // Envío de confirmación
      setTimeout(() => {
        enviarPushTest('bienvenida');
      }, 500);
    }
  } catch (err) {
    console.error('[Push] Error al alternar suscripción:', err);
    toast('Error al gestionar las notificaciones push: ' + (err.message || err), 'error');
  }

  pintarEstadoPush();
  actualizarUIPushConfig();
}

function pintarEstadoPush() {
  const el = $('#ajPushDesc');
  if (!el) return;
  if (!('PushManager' in window)) {
    el.textContent = 'No compatible con este navegador';
    return;
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    el.textContent = 'Bloqueadas desde los permisos del dispositivo';
    return;
  }
  if (State.pushSubscribed) {
    el.textContent = 'Activas · recibirás alertas de jornadas y avisos de empresa';
  } else {
    el.textContent = 'Desactivadas · tocá para activar alertas inmediatas';
  }
}

async function enviarPushTest(tipo) {
  toast('📡 Enviando notificación push de prueba...', 'info');

  let payload = {
    tipo: tipo || 'aviso_empresa',
    titulo: '📢 BAREMO · Notificación Push',
    cuerpo: 'Esta es una notificación push de prueba a través del Service Worker.',
    prioridad: 'alta'
  };

  if (tipo === 'jornada_pendiente') {
    payload = {
      tipo: 'jornada_pendiente',
      titulo: '⏰ BAREMO · Jornada Pendiente de Cierre',
      cuerpo: 'Tenés una jornada abierta del día ' + hoy() + '. Revisá tus baremos y cerrala para asegurar tu registro.',
      prioridad: 'alta',
      accion: 'cerrar_jornada',
      legajo: State.user ? State.user.legajo : undefined
    };
  } else if (tipo === 'aviso_empresa') {
    payload = {
      tipo: 'aviso_empresa',
      titulo: '📢 BAREMO · Aviso Oficial de Cuadrilla',
      cuerpo: 'Seguridad Operativa: Uso obligatorio de guantes dieléctricos y verificación de ATS en cuadrilla.',
      prioridad: 'alta',
      accion: 'ver_aviso'
    };
  } else if (tipo === 'bienvenida') {
    payload = {
      tipo: 'aviso_empresa',
      titulo: '🔔 BAREMO · Notificaciones Push Habilitadas',
      cuerpo: 'Recibirás avisos de jornadas sin cerrar y comunicados urgentes de la empresa.',
      prioridad: 'normal'
    };
  }

  // 1. Intentar enviar vía servidor Web Push a todos los suscriptores o al actual
  try {
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && (data.success || data.ok)) {
      const cant = data.enviados !== undefined ? data.enviados : (data.enviadas !== undefined ? data.enviadas : 1);
      toast('✓ Notificación push enviada (' + cant + ' dispositivo/s)', 'success');
    } else {
      // Si el backend no tiene suscriptores o falla VAPID externo en el sandbox, emitir vía Service Worker local
      emitirAlertaServiceWorkerLocal(payload);
    }
  } catch (e) {
    console.warn('[Push] Falla en /api/push/send, activando emisor local:', e);
    emitirAlertaServiceWorkerLocal(payload);
  }
}

async function emitirAlertaServiceWorkerLocal(payload) {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(payload.titulo, {
          body: payload.cuerpo,
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          tag: 'push-test-' + Date.now(),
          vibrate: [200, 100, 200],
          data: {
            tipo: payload.tipo,
            accion: payload.accion,
            url: window.location.origin
          },
          actions: [
            { action: payload.accion || 'ver', title: 'Abrir en BAREMO' }
          ]
        });
        toast('🔔 Alerta mostrada en la barra del dispositivo', 'success');
      }
    }
  } catch (err) {
    console.error('[Push Local]', err);
  }
}

/* ------------------------------------------------------------
   DETECCIÓN Y ALERTA DE JORNADAS PENDIENTES
   ------------------------------------------------------------ */
let _jornadaPendienteDetectada = null;

async function verificarJornadasPendientes() {
  if (!State.user) return;
  try {
    const all = await dbGetAll('jornadas');
    const mias = all.filter(j => j.legajo === State.user.legajo);
    const fechaActual = hoy();

    // 1. Jornadas de días anteriores que hayan quedado sin cerrar
    const anterioresAbiertas = mias.filter(j => !j.cerrada && j.fecha && j.fecha < fechaActual);

    // 2. Jornada de hoy abierta con tiempo excesivo (> 7 horas)
    let hoyAbiertaProlongada = null;
    if (State.jornada && !State.jornada.cerrada && State.jornada.horaInicio) {
      const partes = State.jornada.horaInicio.split(':');
      if (partes.length >= 2) {
        const d = new Date();
        const inicio = new Date();
        inicio.setHours(parseInt(partes[0], 10), parseInt(partes[1], 10), 0, 0);
        const diffHoras = (d.getTime() - inicio.getTime()) / (1000 * 60 * 60);
        if (diffHoras >= 7) {
          hoyAbiertaProlongada = State.jornada;
        }
      }
    }

    const pendiente = (anterioresAbiertas.length > 0) ? anterioresAbiertas[anterioresAbiertas.length - 1] : hoyAbiertaProlongada;
    _jornadaPendienteDetectada = pendiente;

    const banner = $('#jornadaPendienteBanner');
    if (!banner) return;

    if (pendiente) {
      const cantTareas = (pendiente.items || []).length;
      const esFechaAnterior = pendiente.fecha < fechaActual;
      
      const titleEl = $('#jpbTitle');
      const descEl = $('#jpbDesc');
      if (titleEl) {
        titleEl.textContent = esFechaAnterior 
          ? `⚠️ Jornada pendiente sin cerrar (${pendiente.fecha})`
          : `⚠️ Turno prolongado sin cerrar (${pendiente.horaInicio || ''})`;
      }
      if (descEl) {
        descEl.textContent = esFechaAnterior
          ? `Tenés una jornada del ${pendiente.fecha} que no fue cerrada (${cantTareas} baremos registrados). Cerrala para consolidar tus números.`
          : `Llevás más de 7 horas de trabajo en la jornada de hoy. Acordate de controlar tus tareas y cerrarla al terminar.`;
      }
      banner.style.display = 'flex';

      // Disparar push automático en background si no se envió en las últimas 4 horas
      const keyCache = 'baremo_push_pend_' + (pendiente.id || pendiente.fecha);
      const ultimoEnvio = parseInt(localStorage.getItem(keyCache) || '0', 10);
      const ahora = Date.now();
      if (ahora - ultimoEnvio > 4 * 60 * 60 * 1000) {
        localStorage.setItem(keyCache, String(ahora));
        try {
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'jornada_pendiente',
              titulo: '⏰ BAREMO · Jornada Pendiente de Cierre',
              cuerpo: `Tenés una jornada pendiente del ${pendiente.fecha}. Ingresá a BAREMO para revisarla y cerrarla.`,
              prioridad: 'alta',
              accion: 'cerrar_jornada',
              legajo: State.user.legajo
            })
          }).catch(() => {});
        } catch (e) {}
      }
    } else {
      banner.style.display = 'none';
    }
  } catch (err) {
    console.warn('[Jornadas Pendientes]', err);
  }
}

function atenderJornadaPendientePush() {
  showView('Registro');
  if (_jornadaPendienteDetectada) {
    // Cargar la jornada pendiente en State si es de un día anterior
    if (State.jornada?.id !== _jornadaPendienteDetectada.id) {
      State.jornada = _jornadaPendienteDetectada;
      State.items = _jornadaPendienteDetectada.items || [];
      State.tareas = _jornadaPendienteDetectada.tareas || [];
      actualizarBotoneraJornada();
      renderAll();
    }
    setTimeout(() => {
      confirmDialog(`Tenés seleccionada la jornada del ${_jornadaPendienteDetectada.fecha}.\n\n¿Querés cerrarla ahora?`).then(ok => {
        if (ok) cerrarJornada();
      });
    }, 250);
  } else if (State.jornada && !State.jornada.cerrada) {
    cerrarJornada();
  } else {
    toast('No hay jornadas pendientes en este momento', 'info');
  }
}

/* ------------------------------------------------------------
   AVISOS IMPORTANTES DE LA EMPRESA (COMUNICADOS)
   ------------------------------------------------------------ */
async function cargarAvisosEmpresa() {
  try {
    const res = await fetch('/api/push/avisos');
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.avisos) ? data.avisos : []);
      if (list && list.length > 0) {
        State.avisosEmpresa = list;
        localStorage.setItem('baremo_avisos_cache', JSON.stringify(list));
      }
    }
  } catch (e) {
    // Fallback a caché local
    try {
      const cache = localStorage.getItem('baremo_avisos_cache');
      if (cache) State.avisosEmpresa = JSON.parse(cache);
    } catch (cErr) {}
  }

  actualizarIndicadorAvisos();
}

/* ------------------------------------------------------------
   CARRUSEL AUTOMÁTICO DE AVISOS IMPORTANTES EN INICIO
   ------------------------------------------------------------ */
let _carruselAvisosTimer = null;
let _carruselAvisosIdx = 0;
let _carruselAvisosList = [];
let _carruselPausado = false;

function detenerTimerCarruselAvisos() {
  if (_carruselAvisosTimer) {
    clearInterval(_carruselAvisosTimer);
    _carruselAvisosTimer = null;
  }
}

function iniciarTimerCarruselAvisos() {
  detenerTimerCarruselAvisos();
  if (!_carruselAvisosList || _carruselAvisosList.length <= 1) return;
  _carruselAvisosTimer = setInterval(() => {
    if (!_carruselPausado) {
      avanzarCarruselAvisos(1, false);
    }
  }, 4500);
}

function obtenerIconoAviso(categoria) {
  const cat = (categoria || '').toLowerCase();
  if (cat.includes('segur') || cat.includes('epp') || cat.includes('arnes')) return '🛡️';
  if (cat.includes('proced') || cat.includes('norm') || cat.includes('ats')) return '📋';
  if (cat.includes('opera') || cat.includes('linea') || cat.includes('media')) return '⚡';
  if (cat.includes('clima') || cat.includes('tormenta') || cat.includes('lluvia')) return '⛈️';
  return '📢';
}

function mostrarSlideAviso(indice, animar = true) {
  if (!_carruselAvisosList || _carruselAvisosList.length === 0) return;
  if (indice < 0) indice = _carruselAvisosList.length - 1;
  if (indice >= _carruselAvisosList.length) indice = 0;
  _carruselAvisosIdx = indice;

  const aviso = _carruselAvisosList[indice];
  if (!aviso) return;

  const elIco = $('#eabIco');
  const elCat = $('#eabCatBadge');
  const elPrio = $('#eabPrioBadge');
  const elTitle = $('#eabTitle');
  const elDesc = $('#eabDesc');
  const elCounter = $('#eabCounter');
  const elControls = $('#eabControls');
  const elDots = $('#eabDots');

  // Actualizar controles y contador
  if (_carruselAvisosList.length > 1) {
    if (elControls) elControls.style.display = 'inline-flex';
    if (elCounter) elCounter.textContent = `${_carruselAvisosIdx + 1}/${_carruselAvisosList.length}`;
    if (elDots) {
      elDots.style.display = 'flex';
      elDots.innerHTML = _carruselAvisosList.map((_, i) =>
        `<span class="eab-dot ${i === _carruselAvisosIdx ? 'active' : ''}" data-idx="${i}" title="Aviso ${i + 1}"></span>`
      ).join('');
      elDots.querySelectorAll('.eab-dot').forEach(dot => {
        dot.onclick = (e) => {
          e.stopPropagation();
          const targetIdx = parseInt(dot.dataset.idx, 10);
          if (!isNaN(targetIdx) && targetIdx !== _carruselAvisosIdx) {
            mostrarSlideAviso(targetIdx, true);
            iniciarTimerCarruselAvisos();
          }
        };
      });
    }
  } else {
    if (elControls) elControls.style.display = 'none';
    if (elDots) elDots.style.display = 'none';
  }

  // Meta badges
  if (elIco) elIco.textContent = obtenerIconoAviso(aviso.categoria);
  if (elCat) elCat.textContent = aviso.categoria || 'General';
  if (elPrio) {
    if (aviso.prioridad === 'alta') {
      elPrio.textContent = 'URGENTE';
      elPrio.style.display = 'inline-block';
    } else {
      elPrio.style.display = 'none';
    }
  }

  // Animación suave de transición en textos
  if (animar && elTitle && elDesc) {
    elTitle.classList.add('eab-fade-out');
    elDesc.classList.add('eab-fade-out');
    setTimeout(() => {
      elTitle.textContent = aviso.titulo || 'Comunicado oficial';
      elDesc.textContent = aviso.cuerpo || '';
      elTitle.classList.remove('eab-fade-out');
      elDesc.classList.remove('eab-fade-out');
      elTitle.classList.add('eab-fade-in');
      elDesc.classList.add('eab-fade-in');
      setTimeout(() => {
        elTitle.classList.remove('eab-fade-in');
        elDesc.classList.remove('eab-fade-in');
      }, 250);
    }, 180);
  } else {
    if (elTitle) elTitle.textContent = aviso.titulo || 'Comunicado oficial';
    if (elDesc) elDesc.textContent = aviso.cuerpo || '';
  }
}

function avanzarCarruselAvisos(pasos = 1, porUsuario = true) {
  if (!_carruselAvisosList || _carruselAvisosList.length <= 1) return;
  const nuevoIdx = (_carruselAvisosIdx + pasos + _carruselAvisosList.length) % _carruselAvisosList.length;
  mostrarSlideAviso(nuevoIdx, true);
  if (porUsuario) {
    iniciarTimerCarruselAvisos();
  }
}

function actualizarIndicadorAvisos() {
  const avisos = State.avisosEmpresa || [];
  let leidos = [];
  try {
    leidos = JSON.parse(localStorage.getItem('baremo_avisos_leidos') || '[]');
  } catch (e) {}

  const noLeidos = avisos.filter(a => !leidos.includes(a.id));
  const badge = $('#badgeAvisosUnread');
  if (badge) {
    if (noLeidos.length > 0) {
      badge.textContent = noLeidos.length > 9 ? '9+' : String(noLeidos.length);
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  // Banner en inicio con carrusel si hay múltiples avisos
  const banner = $('#empresaAvisoBanner');
  if (!banner) return;

  const itemsParaBanner = noLeidos.length > 0 ? noLeidos : avisos;

  if (itemsParaBanner && itemsParaBanner.length > 0) {
    _carruselAvisosList = itemsParaBanner;
    if (_carruselAvisosIdx >= _carruselAvisosList.length) {
      _carruselAvisosIdx = 0;
    }
    banner.style.display = 'flex';
    mostrarSlideAviso(_carruselAvisosIdx, false);
    iniciarTimerCarruselAvisos();
  } else {
    banner.style.display = 'none';
    detenerTimerCarruselAvisos();
  }
}

function renderAvisosEmpresaList() {
  const container = $('#avisosEmpresaList');
  if (!container) return;

  const avisos = State.avisosEmpresa || [];
  const cat = State.avisosCategoriaFiltro || 'todas';
  let leidos = [];
  try {
    leidos = JSON.parse(localStorage.getItem('baremo_avisos_leidos') || '[]');
  } catch (e) {}

  const filtrados = cat === 'todas' ? avisos : avisos.filter(a => a.categoria === cat);

  if (filtrados.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:32px 16px; color:var(--text-soft);">
        <div style="font-size:36px; margin-bottom:8px;">📭</div>
        <div style="font-size:14px; font-weight:700;">No hay comunicados en esta categoría</div>
        <div style="font-size:12px; margin-top:4px;">Los avisos emitidos por supervisión o seguridad aparecerán aquí.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtrados.map(a => {
    const esNoLeido = !leidos.includes(a.id);
    const esAlta = a.prioridad === 'alta';
    const prioLabel = esAlta ? '🔴 ALTA PRIORIDAD' : '🟡 INFORMATIVO';
    const prioClass = esAlta ? 'prio-alta' : 'prio-media';
    const fecha = a.fecha ? new Date(a.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    return `
      <div class="aviso-card ${esNoLeido ? 'aviso-unread' : ''}" data-id="${a.id}">
        <div class="aviso-card-head">
          <span class="aviso-badge-prio ${prioClass}">${prioLabel}</span>
          <span class="aviso-date">${fecha}</span>
        </div>
        <div class="aviso-title">${a.titulo}</div>
        <div class="aviso-body">${a.cuerpo}</div>
        <div class="aviso-footer">
          <div class="aviso-autor">🏢 ${a.autor || 'Supervisión de Operaciones'}</div>
          <div style="font-size:11px; opacity:0.8;">🏷️ ${a.categoria || 'General'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function abrirModalAvisosEmpresa(categoria, avisoIdDestacado) {
  if (categoria) State.avisosCategoriaFiltro = categoria;
  renderAvisosEmpresaList();
  const m = $('#modalAvisosEmpresa');
  if (m) m.classList.add('show');
  if (avisoIdDestacado) {
    setTimeout(() => {
      const card = $(`#avisosEmpresaList [data-id="${avisoIdDestacado}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('aviso-card-highlight');
        setTimeout(() => card.classList.remove('aviso-card-highlight'), 2200);
      }
    }, 200);
  }
}

function cerrarModalAvisosEmpresa() {
  const m = $('#modalAvisosEmpresa');
  if (m) m.classList.remove('show');
}

function marcarTodosAvisosLeidos() {
  const avisos = State.avisosEmpresa || [];
  const ids = avisos.map(a => a.id);
  localStorage.setItem('baremo_avisos_leidos', JSON.stringify(ids));
  actualizarIndicadorAvisos();
  renderAvisosEmpresaList();
  toast('✓ Todos los comunicados marcados como leídos', 'success');
}

function abrirModalPublicarAviso() {
  // Directiva estricta: Solo el Supervisor con Clave Maestra tiene acceso a emitir avisos a las cuadrillas.
  if (!State.adminLoggedIn) {
    cerrarModalAvisosEmpresa();
    showView('Admin');
    toast('🔐 Solo el Supervisor con Clave Maestra puede emitir comunicados a las cuadrillas', 'warn');
    setTimeout(() => {
      const p = $('#adminPassword');
      if (p) {
        p.focus();
        p.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 350);
    return;
  }

  // Si ya es supervisor autenticado, redirigir al panel de administración enfocado en el emisor de comunicados
  cerrarModalAvisosEmpresa();
  showView('Admin');
  setTimeout(() => {
    const el = $('#adminPushCard') || $('#adminAvisosCard');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const t = $('#adminPushTitulo');
    if (t) t.focus();
  }, 250);
}

function cerrarModalPublicarAviso() {
  const m = $('#modalPublicarAviso');
  if (m) m.classList.remove('show');
}

function abrirModalPushConfig() {
  actualizarUIPushConfig();
  const m = $('#modalPushConfig');
  if (m) m.classList.add('show');
}

function cerrarModalPushConfig() {
  const m = $('#modalPushConfig');
  if (m) m.classList.remove('show');
}

async function actualizarUIPushConfig() {
  const txtStatus = $('#pscStatusTxt');
  const txtSub = $('#pscSubTxt');
  const icon = $('#pscIcon');
  const btn = $('#btnTogglePushSub');
  const bannerOptIn = $('#pushActivarBanner');

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (txtStatus) txtStatus.textContent = 'Push no disponible';
    if (txtSub) txtSub.textContent = 'Este navegador no soporta el estándar PushManager de Service Workers.';
    if (icon) icon.textContent = '❌';
    if (btn) { btn.disabled = true; btn.textContent = 'No soportado'; }
    if (bannerOptIn) bannerOptIn.style.display = 'none';
    return;
  }

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();

  if (sub) {
    State.pushSubscribed = true;
    if (txtStatus) txtStatus.textContent = 'Push Activo y Vinculado';
    if (txtSub) txtSub.textContent = 'Este dispositivo recibe alertas inmediatas de jornadas pendientes y comunicados de empresa.';
    if (icon) icon.textContent = '🟢';
    if (btn) {
      btn.disabled = false;
      btn.className = 'btn btn-ghost';
      btn.textContent = '🔕 Desactivar Notificaciones Push';
    }
    if (bannerOptIn) bannerOptIn.style.display = 'none';
  } else {
    State.pushSubscribed = false;
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
    if (perm === 'denied') {
      if (txtStatus) txtStatus.textContent = 'Permiso Bloqueado';
      if (txtSub) txtSub.textContent = 'Las notificaciones fueron bloqueadas en la configuración del navegador.';
      if (icon) icon.textContent = '🚫';
      if (btn) { btn.disabled = true; btn.textContent = 'Desbloquear en Ajustes'; }
      if (bannerOptIn) bannerOptIn.style.display = 'none';
    } else {
      if (txtStatus) txtStatus.textContent = 'Push Inactivo';
      if (txtSub) txtSub.textContent = 'Activá las notificaciones para recibir avisos de jornadas sin cerrar y comunicados urgentes.';
      if (icon) icon.textContent = '📡';
      if (btn) {
        btn.disabled = false;
        btn.className = 'btn btn-primary';
        btn.textContent = '🔔 Activar Notificaciones Push';
      }
      if (bannerOptIn && !sessionStorage.getItem('push_banner_dismissed')) {
        bannerOptIn.style.display = 'flex';
      }
    }
  }
}

/* ============================================================
   SISTEMA DE ALERTA EN VIVO DE SUPERVISIÓN & SINCRONIZACIÓN
   ============================================================ */

function reproducirChimeAlerta() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.14);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.9);
  } catch (e) {}
}

function mostrarAlertaSupervisorEnVivo(alerta) {
  if (!alerta) return;

  // 1. Vibración de alerta en dispositivos móviles
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([400, 150, 400]);
    }
  } catch (e) {}

  // 2. Chime acústico
  reproducirChimeAlerta();

  // 3. Poblar modal de alerta de supervisión
  const m = $('#modalAlertaSupervisor');
  const tit = $('#alertaSupervisorTitulo');
  const cue = $('#alertaSupervisorCuerpo');
  const emi = $('#alertaSupervisorEmisor');
  const fec = $('#alertaSupervisorFecha');
  const bdg = $('#alertaSupervisorBadge');

  if (tit) tit.textContent = alerta.titulo || 'Comunicado de Supervisión';
  if (cue) cue.textContent = alerta.cuerpo || alerta.mensaje || '';
  if (emi) emi.textContent = 'Emitido por: ' + (alerta.autor || 'Supervisión Central');
  if (fec) fec.textContent = fechaLegible(alerta.fecha || hoy());
  if (bdg) {
    bdg.textContent = (alerta.prioridad === 'alta') ? '🚨 ALERTA URGENTE DE SUPERVISIÓN' : '📢 COMUNICADO DE SUPERVISIÓN';
  }

  if (m) {
    m.style.display = 'flex';
    m.classList.add('show');
  }

  // 4. Actualizar comunicados y carrusel de avisos
  if (typeof cargarAvisosEmpresa === 'function') {
    cargarAvisosEmpresa();
  }
}

let _liveAlertsTimer = null;
let _ultimoLiveAlertTimestamp = parseInt(localStorage.getItem('baremo_last_alert_ts') || '0', 10);
let _alertasVistasIds = new Set(JSON.parse(localStorage.getItem('baremo_alertas_vistas') || '[]'));

function iniciarLiveAlertsPoller() {
  if (_liveAlertsTimer) clearInterval(_liveAlertsTimer);
  chequearLiveAlerts();
  _liveAlertsTimer = setInterval(() => {
    if (!document.hidden && navigator.onLine) {
      chequearLiveAlerts();
    }
  }, 10000);
}

async function chequearLiveAlerts() {
  try {
    const url = `/api/push/live-events?since=${_ultimoLiveAlertTimestamp}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.events) || data.events.length === 0) return;

    for (const ev of data.events) {
      _ultimoLiveAlertTimestamp = Math.max(_ultimoLiveAlertTimestamp, ev.timestamp || 0);
      localStorage.setItem('baremo_last_alert_ts', String(_ultimoLiveAlertTimestamp));

      if (ev.id && !_alertasVistasIds.has(ev.id)) {
        _alertasVistasIds.add(ev.id);
        localStorage.setItem('baremo_alertas_vistas', JSON.stringify(Array.from(_alertasVistasIds).slice(-100)));
        mostrarAlertaSupervisorEnVivo(ev);
      }
    }
  } catch (e) {
    // Modo sin conexión momentáneo
  }
}

let _sincronizandoRemoto = false;
async function sincronizarJornadasAlServidor() {
  if (_sincronizandoRemoto || !navigator.onLine) return;
  if (!State.user || !State.user.legajo) return;

  _sincronizandoRemoto = true;
  try {
    const todas = await dbGetAll('jornadas');
    const miLegajo = String(State.user.legajo);
    const misJornadas = todas.filter(j => String(j.legajo) === miLegajo && j.cerrada);

    const res = await fetch('/api/sync/jornadas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: {
          legajo: State.user.legajo,
          nombre: State.user.nombre,
          zona: State.user.zona || '',
          email: State.user.email || ''
        },
        jornadas: misJornadas
      })
    });

    if (res.ok) {
      const d = await res.json();
      console.log('[Sync] Jornadas sincronizadas en el servidor central:', d);
      if (typeof actualizarEstadoSyncNube === 'function') {
        actualizarEstadoSyncNube();
      }
    }
  } catch (err) {
    console.warn('[Sync] Sincronización en segundo plano diferida:', err.message);
  } finally {
    _sincronizandoRemoto = false;
  }
}

function inicializarEventosPushYAvisos() {
  // Botón header avisos de empresa
  const btnAvisos = $('#btnAvisosEmpresa');
  if (btnAvisos) btnAvisos.onclick = () => abrirModalAvisosEmpresa();

  const btnAvisosClose = $('#btnAvisosEmpresaClose');
  if (btnAvisosClose) btnAvisosClose.onclick = cerrarModalAvisosEmpresa;

  // Botón configurar push desde avisos
  const btnAbrirPush = $('#btnAbrirPushConfig');
  if (btnAbrirPush) btnAbrirPush.onclick = () => {
    cerrarModalAvisosEmpresa();
    abrirModalPushConfig();
  };

  // Botones de modal push config
  const btnPushClose = $('#btnPushConfigClose');
  if (btnPushClose) btnPushClose.onclick = cerrarModalPushConfig;
  const btnPushAceptar = $('#btnPushConfigAceptar');
  if (btnPushAceptar) btnPushAceptar.onclick = cerrarModalPushConfig;

  const btnTogglePush = $('#btnTogglePushSub');
  if (btnTogglePush) btnTogglePush.onclick = alternarSuscripcionPush;

  const btnRefrescarPush = $('#btnRefrescarPushStatus');
  if (btnRefrescarPush) btnRefrescarPush.onclick = actualizarUIPushConfig;

  // Banner superior para activar Notificaciones Push
  const btnActivarBanner = $('#btnActivarPushBanner');
  if (btnActivarBanner) {
    btnActivarBanner.onclick = async () => {
      await alternarSuscripcionPush();
      const b = $('#pushActivarBanner');
      if (b) b.style.display = 'none';
    };
  }
  const btnCerrarBanner = $('#btnCerrarPushBanner');
  if (btnCerrarBanner) {
    btnCerrarBanner.onclick = () => {
      const b = $('#pushActivarBanner');
      if (b) b.style.display = 'none';
      sessionStorage.setItem('push_banner_dismissed', '1');
    };
  }

  // Modal Alerta Supervisor
  const btnAlertaSupervisorAceptar = $('#btnAlertaSupervisorAceptar');
  if (btnAlertaSupervisorAceptar) {
    btnAlertaSupervisorAceptar.onclick = () => {
      const m = $('#modalAlertaSupervisor');
      if (m) {
        m.classList.remove('show');
        m.style.display = 'none';
      }
    };
  }

  // Pruebas de push
  const btnTestJ = $('#btnTestPushJornada');
  if (btnTestJ) btnTestJ.onclick = () => enviarPushTest('jornada_pendiente');

  const btnTestA = $('#btnTestPushAviso');
  if (btnTestA) btnTestA.onclick = () => enviarPushTest('aviso_empresa');

  // Filtros de categoría de avisos
  const filterGroup = $('#avisosFilterGroup');
  if (filterGroup) {
    filterGroup.querySelectorAll('.avisos-pill').forEach(pill => {
      pill.onclick = () => {
        filterGroup.querySelectorAll('.avisos-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        State.avisosCategoriaFiltro = pill.dataset.cat || 'todas';
        renderAvisosEmpresaList();
      };
    });
  }

  // Marcar todos leídos
  const btnMarcarLeidos = $('#btnAvisosMarcarLeidos');
  if (btnMarcarLeidos) btnMarcarLeidos.onclick = marcarTodosAvisosLeidos;

  // Publicar aviso: restringido exclusivamente a Supervisor con Clave Maestra
  const btnAbrirPub = $('#btnAbrirPublicarAviso');
  if (btnAbrirPub) btnAbrirPub.onclick = abrirModalPublicarAviso;

  const btnClosePub = $('#btnPublicarAvisoClose');
  if (btnClosePub) btnClosePub.onclick = cerrarModalPublicarAviso;

  const btnCancelPub = $('#btnPublicarAvisoCancelar');
  if (btnCancelPub) btnCancelPub.onclick = cerrarModalPublicarAviso;

  // Formulario publicar aviso
  const formPub = $('#formPublicarAviso');
  if (formPub) {
    formPub.onsubmit = async (e) => {
      e.preventDefault();

      if (!State.adminLoggedIn) {
        toast('🔐 Solo el Supervisor con Clave Maestra puede emitir comunicados a las cuadrillas', 'error');
        cerrarModalPublicarAviso();
        showView('Admin');
        return;
      }

      const titulo = ($('#pubAvisoTitulo')?.value || '').trim();
      const cuerpo = ($('#pubAvisoCuerpo')?.value || '').trim();
      const categoria = $('#pubAvisoCategoria')?.value || 'General';
      const prioridad = $('#pubAvisoPrioridad')?.value || 'media';
      const autor = ($('#pubAvisoAutor')?.value || '').trim() || 'Supervisión';
      const enviarPush = $('#pubAvisoEnviarPush')?.checked ?? true;

      if (!titulo || !cuerpo) {
        toast('Completá título y descripción del comunicado', 'warn');
        return;
      }

      const submitBtn = $('#btnPublicarAvisoSubmit');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Emitiendo...'; }

      try {
        const res = await fetchAdminAPI('/api/push/avisos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo,
            cuerpo,
            categoria,
            prioridad,
            autor,
            enviarPush
          })
        });

        const data = await res.json();
        if (res.ok && (data.success || data.ok)) {
          toast('📢 Comunicado emitido con éxito a las cuadrillas', 'success');
          cerrarModalPublicarAviso();
          formPub.reset();
          await cargarAvisosEmpresa();
          renderAvisosEmpresaList();
        } else {
          toast('Error al publicar: ' + (data.error || 'Intente nuevamente'), 'error');
        }
      } catch (err) {
        toast('Fallo de red al publicar aviso: ' + err.message, 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🚀 Publicar y Emitir Push'; }
      }
    };
  }

  // Acciones en banners de viewInicio
  const btnJpbCerrar = $('#btnJpbCerrar');
  if (btnJpbCerrar) btnJpbCerrar.onclick = atenderJornadaPendientePush;

  const btnJpbDesc = $('#btnJpbDescartar');
  if (btnJpbDesc) btnJpbDesc.onclick = () => {
    const b = $('#jornadaPendienteBanner');
    if (b) b.style.display = 'none';
  };

  const btnEabVer = $('#btnEabVer');
  if (btnEabVer) {
    btnEabVer.onclick = () => {
      const avisoActual = _carruselAvisosList[_carruselAvisosIdx];
      abrirModalAvisosEmpresa(null, avisoActual ? avisoActual.id : null);
    };
  }

  // Controles de navegación manual del carrusel de avisos
  const btnEabPrev = $('#btnEabPrev');
  if (btnEabPrev) {
    btnEabPrev.onclick = (e) => {
      e.stopPropagation();
      avanzarCarruselAvisos(-1, true);
    };
  }

  const btnEabNext = $('#btnEabNext');
  if (btnEabNext) {
    btnEabNext.onclick = (e) => {
      e.stopPropagation();
      avanzarCarruselAvisos(1, true);
    };
  }

  // Tocar el título del banner abre directamente el comunicado
  const elTitleBanner = $('#eabTitle');
  if (elTitleBanner) {
    elTitleBanner.style.cursor = 'pointer';
    elTitleBanner.onclick = () => {
      const avisoActual = _carruselAvisosList[_carruselAvisosIdx];
      abrirModalAvisosEmpresa(null, avisoActual ? avisoActual.id : null);
    };
  }

  // Pausar rotación automática al interactuar o pasar el mouse sobre el banner
  const bannerAvisos = $('#empresaAvisoBanner');
  if (bannerAvisos) {
    bannerAvisos.addEventListener('mouseenter', () => { _carruselPausado = true; });
    bannerAvisos.addEventListener('mouseleave', () => { _carruselPausado = false; });
    bannerAvisos.addEventListener('touchstart', () => { _carruselPausado = true; }, { passive: true });
    bannerAvisos.addEventListener('touchend', () => {
      setTimeout(() => { _carruselPausado = false; }, 3500);
    }, { passive: true });
  }

  // Pausar el carrusel cuando la pestaña no está visible para ahorrar batería
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      detenerTimerCarruselAvisos();
    } else {
      const vInicio = $('#viewInicio');
      if (vInicio && vInicio.classList.contains('active')) {
        iniciarTimerCarruselAvisos();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  try { inicializarEventosPushYAvisos(); } catch (e) { console.error(e); }
});

