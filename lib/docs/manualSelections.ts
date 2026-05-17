// lib/docs/manualSections.ts
//
// INSTRUCCIONES PARA LAS IMÁGENES:
// 1. Extrae las imágenes del PDF (puedes usar Adobe Acrobat, pdfimages, o capturas de pantalla).
// 2. Guárdalas en: assets/manual/  con los nombres indicados abajo.
// 3. Si una imagen no existe todavía, simplemente comenta su bloque { type: 'image', ... }
//
// Estructura de cada bloque:
//   { type: 'markdown', content: string }          → texto con formato
//   { type: 'image', key: string, caption?: string } → imagen de la carpeta assets/manual/

export type ManualBlock =
  | { type: 'markdown'; content: string }
  | { type: 'image'; key: string; caption?: string };

// Mapa centralizado de imágenes (require debe ser estático en React Native)
// Añade o comenta entradas según vayas teniendo los archivos.
export const MANUAL_IMAGES: Record<string, any> = {
  // Sección 1 – Primeros Pasos
  inicio_home:     require('../../assets/manual/inicio_home.png'),
  login:           require('../../assets/manual/login.png'),
  registro:        require('../../assets/manual/registro.png'),
  recuperar_pass:  require('../../assets/manual/recuperar_pass.png'),
  lobby:           require('../../assets/manual/lobby.png'),
  crear_club:      require('../../assets/manual/crear_club.png'),
  unirse_club:     require('../../assets/manual/unirse_club.png'),
  mi_perfil:       require('../../assets/manual/mi_perfil.png'),
  cambiar_pass:    require('../../assets/manual/cambiar_pass.png'),

  // Sección 2 – Presidente
  dashboard:            require('../../assets/manual/dashboard.png'),
  nuevo_evento:         require('../../assets/manual/nuevo_evento.png'),
  editar_evento:        require('../../assets/manual/editar_evento.png'),
  editar_stats:         require('../../assets/manual/editar_stats.png'),
  horarios_pres:        require('../../assets/manual/horarios_pres.png'),
  tablon_pres:          require('../../assets/manual/tablon_pres.png'),
  nuevo_anuncio:        require('../../assets/manual/nuevo_anuncio.png'),
  mi_club_pres:         require('../../assets/manual/mi_club_pres.png'),
  campos_pres:          require('../../assets/manual/campos_pres.png'),
  asistencia_pres:      require('../../assets/manual/asistencia_pres.png'),
  convocatorias_pres:   require('../../assets/manual/convocatorias_pres.png'),
  stats_pres:           require('../../assets/manual/stats_pres.png'),
  multas_pres:          require('../../assets/manual/multas_pres.png'),
  peticiones:           require('../../assets/manual/peticiones.png'),
  revisar_solicitud:    require('../../assets/manual/revisar_solicitud.png'),
  cuotas:               require('../../assets/manual/cuotas.png'),
  equipos_admin:        require('../../assets/manual/equipos_admin.png'),

  // Sección 3 – Entrenador
  entrenador_calendario:     require('../../assets/manual/entrenador_calendario.png'),
  entrenador_horarios:       require('../../assets/manual/entrenador_horarios.png'),
  entrenador_mi_club:        require('../../assets/manual/entrenador_mi_club.png'),
  entrenador_campos:         require('../../assets/manual/entrenador_campos.png'),
  entrenador_asistencia:     require('../../assets/manual/entrenador_asistencia.png'),
  entrenador_convocatorias:  require('../../assets/manual/entrenador_convocatorias.png'),
  entrenador_stats:          require('../../assets/manual/entrenador_stats.png'),
  entrenador_multas:         require('../../assets/manual/entrenador_multas.png'),
};

export const manualSections: ManualBlock[] = [

  // ─────────────────────────────────────────────
  // 1. PRIMEROS PASOS
  // ─────────────────────────────────────────────
  {
    type: 'markdown',
    content: `# Manual de Usuario SQUADRA

## 1. Primeros Pasos (Acciones Comunes)

Bienvenido al manual de usuario de **SQUADRA**. En esta sección se detallan las acciones iniciales que todo usuario debe realizar para acceder a la plataforma, gestionar su perfil y acceder a sus clubes correspondientes, independientemente del rol que vaya a ejercer posteriormente.

### 1.1 Pantalla de Inicio

La pantalla de inicio es el punto de entrada a la aplicación. En ella encontrarás un resumen visual de las herramientas principales de gestión (como **Equipos**, **Alineaciones**, **Cuotas**, **Entrenos**, **Partidos**, **Campos** y **Anuncios**) y las vías de acceso a la plataforma.

Para comenzar, selecciona una de las siguientes acciones:
1. Haz clic en el botón **Iniciar Sesión** si ya tienes una cuenta registrada.
2. Haz clic en el botón **Crear una cuenta nueva** si es tu primera vez en la plataforma.
3. Haz clic en el enlace **Únete ahora** situado en la parte inferior si tu club ya utiliza Squadra y deseas registrarte.`,
  },
  { type: 'image', key: 'inicio_home', caption: 'Pantalla de inicio de SQUADRA' },

  // 1.2 Inicio de sesión
  {
    type: 'markdown',
    content: `### 1.2 Inicio de Sesión

Si seleccionaste iniciar sesión, serás redirigido a la pantalla de acceso. Tienes dos métodos disponibles para entrar:

**Acceso tradicional:**
1. Introduce tu correo electrónico en el campo **Email**.
2. Introduce tu clave en el campo **Contraseña**. Puedes hacer clic en el icono del "ojo" para hacer visible tu contraseña y verificar que está bien escrita.
3. Haz clic en el botón verde **Acceder**.

**Acceso rápido:**
1. Haz clic en el botón **Continuar con Google** para iniciar sesión utilizando tus credenciales vinculadas a Google.

*Nota: Si tienes problemas para recordar tu clave, puedes hacer clic en el enlace **¿Olvidaste tu contraseña?**. Si por error llegaste a esta pantalla y no tienes cuenta, haz clic en **Regístrate**.*`,
  },
  { type: 'image', key: 'login', caption: 'Pantalla de inicio de sesión' },

  // 1.3 Registro
  {
    type: 'markdown',
    content: `### 1.3 Registro de cuenta nueva

Si decides crear una cuenta nueva, deberás completar el formulario de registro con tus datos personales:

1. Haz clic en el círculo superior que indica **Añadir foto** para subir una imagen de perfil.
2. Rellena los campos de texto correspondientes a tu **Nombre** y tus **Apellidos**.
3. En el apartado **Tipo de documento**, selecciona la opción que te corresponda: **DNI**, **NIE** o **Passport**.
4. Introduce tu identificador en el campo **Número de DNI** (o el documento seleccionado).
5. Escribe tu correo electrónico en el campo **Email**.
6. En el campo **Teléfono**, asegúrate de que el prefijo del país es el correcto (ej. **es +34**) e introduce tu número.
7. Crea una clave en el campo **Contraseña (min. 6)** y repítela exactamente igual en el campo **Confirmar contraseña**.
8. Una vez rellenados los datos, haz clic en el botón verde **Crear cuenta**. Alternativamente, puedes usar el botón **Continuar con Google** para registrarte con esa plataforma.

*Nota: Si ya tenías una cuenta y entraste aquí por error, haz clic en el enlace inferior **Inicia sesión**.*`,
  },
  { type: 'image', key: 'registro', caption: 'Formulario de registro de nueva cuenta' },

  // 1.4 Recuperación
  {
    type: 'markdown',
    content: `### 1.4 Recuperación de contraseña

Si olvidaste tu contraseña y solicitaste recuperarla desde la pantalla de inicio de sesión, sigue estos pasos para restablecerla:

1. Introduce el correo electrónico asociado a tu cuenta en el campo **Email**.
2. Haz clic en el botón verde **Enviar enlace**. Recibirás instrucciones en tu bandeja de entrada para configurar una nueva clave.
3. Si deseas cancelar la acción, haz clic en el enlace **Volver al inicio de sesión**.`,
  },
  { type: 'image', key: 'recuperar_pass', caption: 'Pantalla de recuperación de contraseña' },

  // 1.5 Lobby
  {
    type: 'markdown',
    content: `### 1.5 Gestión de Clubes (Lobby)

Una vez que has iniciado sesión con éxito, accederás a la pantalla **Tus clubes** (el Lobby). Desde aquí podrás configurar las preferencias visuales de tu cuenta y gestionar tu pertenencia a diferentes equipos.

**Ajustes de Interfaz y Perfil (Barra superior):**
* **Tema visual:** Selecciona el icono del "sol" para el modo claro, la "luna" para el modo oscuro, o el "engranaje" para adaptarlo a la configuración de tu sistema.
* **Idioma:** Alterna el idioma de la interfaz haciendo clic en los botones **ES** (Español) o **EN** (Inglés).
* **Perfil y Cierre de sesión:** En la esquina superior derecha verás tu nombre y correo. Haz clic en el botón **Salir** para cerrar tu sesión de forma segura.

**Acciones en "Tus clubes":**

En esta pantalla visualizarás un listado con los clubes a los que ya perteneces, donde también se te indicará el rol que tienes en ellos (ej. Presidente). Tienes tres vías de acción principales:

**A. Entrar a un club existente:**
1. Haz clic sobre la tarjeta del club al que deseas acceder para entrar en su panel de gestión.`,
  },
  { type: 'image', key: 'lobby', caption: 'Pantalla Lobby: tus clubes' },

  {
    type: 'markdown',
    content: `**B. Crear un club nuevo:**
1. Haz clic en la opción **Crear mi club**.
2. Escribe el nombre en el campo **NOMBRE DEL CLUB**.
3. (Opcional) Pega el enlace web del escudo en el campo **URL DEL LOGO (OPCIONAL)**.
4. Haz clic en el botón **Crear club**. Al ser el creador, se te asignará el rol de Presidente automáticamente.`,
  },
  { type: 'image', key: 'crear_club', caption: 'Formulario para crear un nuevo club' },

  {
    type: 'markdown',
    content: `**C. Unirse a un club:**
1. Haz clic en la opción **Unirme a un club**.
2. Introduce el código proporcionado por el club en el campo **CÓDIGO DE INVITACIÓN**.
3. En el apartado **¿CON QUÉ ROL QUIERES UNIRTE?**, selecciona tu perfil pulsando sobre **Jugador**, **Entrenador**, **Familiar** u **Otro**.
4. Introduce tu fecha de nacimiento en el campo desplegable **FECHA DE NACIMIENTO** (formato dd/mm/aaaa).
5. (Opcional) Si necesitas enviar información extra, escríbela en el cuadro de texto **MENSAJE PARA EL PRESIDENTE (OPCIONAL)**.
6. Haz clic en el botón **Enviar solicitud** para completar el proceso.`,
  },
  { type: 'image', key: 'unirse_club', caption: 'Formulario para unirse a un club existente' },

  // 1.6 Perfil
  {
    type: 'markdown',
    content: `### 1.6 Perfil de Usuario y Ajustes Generales

En la esquina superior derecha de la pantalla, siempre tendrás visible tu nombre y tu imagen de perfil. Al hacer clic sobre tu nombre, se desplegará un menú rápido con las opciones de configuración de tu cuenta.

**A. Menú rápido de configuración:**
* **TEMA:** Alterna el aspecto visual haciendo clic en **Claro**, **Auto** u **Oscuro**.
* **IDIOMA:** Cambia el idioma pulsando en **ES** (Español) o **EN** (Inglés).
* **Cerrar sesión:** Haz clic en este texto rojo para salir de la aplicación de forma segura.
* Para ver toda tu información, haz clic en la opción superior **Mi perfil**.

**B. Pantalla de "Mi perfil":**
1. **Foto de perfil:** Actualiza tu imagen haciendo clic en el icono verde del lápiz situado junto a tu foto actual.
2. **DATOS:** Aquí puedes consultar tu **Teléfono** y tu **Documento** (DNI, NIE, etc.) vinculados a la cuenta.
3. **IDIOMA y TEMA:** Botones para configurar tus preferencias de idioma y de visualización.`,
  },
  { type: 'image', key: 'mi_perfil', caption: 'Pantalla de perfil de usuario' },

  {
    type: 'markdown',
    content: `**C. Cambiar contraseña:**
1. Haz clic en la opción **Cambiar contraseña**.
2. Se desplegará un panel en la parte inferior de la pantalla.
3. Introduce tu clave vigente en el campo **Contraseña actual**.
4. Escribe tu nueva clave en el campo **Nueva contraseña (min. 6)**.
5. Repite la nueva clave en el campo **Confirmar contraseña**.
6. Haz clic en el botón verde **Guardar** para aplicar los cambios (o en **Cancelar** si decides no hacerlo).

**D. Cambiar de club:**
Haz clic en la última opción **Cambiar de club** para volver directamente al Lobby sin necesidad de cerrar tu sesión.`,
  },
  { type: 'image', key: 'cambiar_pass', caption: 'Panel para cambiar la contraseña' },

  // ─────────────────────────────────────────────
  // 2. ROL PRESIDENTE
  // ─────────────────────────────────────────────
  {
    type: 'markdown',
    content: `---

## 2. Guía de Uso: Rol Presidente

En esta sección detallaremos las funcionalidades y pantallas a las que tienes acceso exclusivo o principal como Presidente del club.

### 2.1 Panel de Inicio (Dashboard)

Al acceder a un club desde el Lobby, la primera pantalla que visualizarás será la pestaña de **Inicio**. Este es tu panel de control principal, diseñado para darte un resumen rápido de la actualidad del club.

* **Cabecera interactiva:** Saludo que se adapta automáticamente a la hora del día, seguido de tu nombre, el nombre del club y las etiquetas que identifican la temporada actual y tu rol de **Presidencia**.
* **Último Anuncio:** Muestra el mensaje más reciente o fijado por la directiva. Haz clic en **Ver Tablón** para acceder al historial completo.
* **Próximos Eventos:** Lista los tres eventos más cercanos. Haz clic en **Ver todos** para ver el listado completo.`,
  },
  { type: 'image', key: 'dashboard', caption: 'Panel de inicio del Presidente (Dashboard)' },

  // 2.2 Calendario
  {
    type: 'markdown',
    content: `### 2.2 Calendario y Gestión de Eventos

Haciendo clic en la pestaña **Calendario** accederás a la vista mensual de planificación del club.

**Navegación e Interpretación:**
* Utiliza las flechas **<** y **>** para avanzar o retroceder en el tiempo.
* Puedes filtrar la vista por equipos utilizando los botones superiores (ej. **Todos**, **SENIOR A**, **U10 Z**).
* Una línea **naranja** corresponde a un **Partido**, y una línea **azul** corresponde a un **Entreno**.

**A. Crear un Nuevo Evento:**
1. Haz clic en el botón verde **+** (esquina inferior derecha).
2. Selecciona si es un **Entreno** o un **Partido**.
3. Elige el equipo implicado en **Seleccionar Equipo**.
4. Establece la **Fecha** y la **Hora**.
5. Indica el lugar en **Ubicación / Campo**.
6. (Si es partido) Rellena el **Rival**, la **Competición** (Liga, Amistoso, Copa, Torneo, Otro) y si juegas como **Local** o **Visitante**.
7. Haz clic en el botón verde **Confirmar**.`,
  },
  { type: 'image', key: 'nuevo_evento', caption: 'Formulario para crear un nuevo evento' },

  {
    type: 'markdown',
    content: `**B. Editar o Borrar un Evento (Futuro):**
1. Haz clic sobre el día en el calendario que contenga el evento.
2. Se abrirá una ventana emergente mostrando los detalles. La opción de estadísticas indica "⏳ Disponible el día del partido".
3. Para modificar la información, haz clic en el botón verde **Editar**. Realiza los cambios y pulsa **Actualizar**.
4. Para eliminar el evento definitivamente, haz clic en el botón rojo **Borrar**.`,
  },
  { type: 'image', key: 'editar_evento', caption: 'Popup de evento y formulario de edición' },

  {
    type: 'markdown',
    content: `**C. Ver y Editar Estadísticas (Eventos Pasados):**

Una vez que un partido ha concluido, se habilitan nuevas opciones para registrar lo ocurrido.

1. Haz clic en el día del partido ya finalizado.
2. Haz clic en el botón azul **Ver/Editar Estadísticas**.
3. Accederás a la pantalla **Editar Estadísticas** con la lista de jugadores convocados.
4. Para cada jugador, puedes sumar o restar valores con los botones **-** y **+** en las categorías: **Goles**, **Asist.**, **Amarillas**, **Rojas** y **Minutos**.
5. Puedes marcar si un jugador inició el partido activando el interruptor **Titular**.
6. Haz clic en el botón verde inferior **Guardar estadísticas**.

**D. Importar y Exportar Datos:**
Dispones de los botones **Import** y **CSV** en la esquina superior derecha del calendario para cargar planificaciones masivas o descargar el calendario actual.`,
  },
  { type: 'image', key: 'editar_stats', caption: 'Pantalla de edición de estadísticas del partido' },

  // 2.3 Horarios
  {
    type: 'markdown',
    content: `### 2.3 Horarios

La pestaña **Horarios** te ofrece una vista en formato lista de todos los eventos del club.

* **Filtros por Tipo de Evento:** Haz clic en las pestañas **Todos**, **Partidos** o **Entrenos**.
* **Filtros por Equipo:** Selecciona **Todos los equipos** o un equipo en concreto.
* Cada tarjeta te mostrará el tipo de evento, fecha, hora, ubicación, etiquetas informativas (ej. **FRIENDLY**, **LEAGUE**, **LOCAL**, **VISITANTE**) y, en partidos disputados, el resultado final (ej. **2 - 1**).

*Nota: Si seleccionas filtros para los que no hay nada agendado, la pantalla mostrará "No hay eventos programados."*`,
  },
  { type: 'image', key: 'horarios_pres', caption: 'Vista de horarios en formato lista' },

  // 2.4 Tablón
  {
    type: 'markdown',
    content: `### 2.4 Tablón (Comunicaciones)

La pestaña **Tablón** es el centro de comunicaciones del club. Como Presidente, tienes permisos para publicar mensajes oficiales y dirigirlos a toda la entidad o a equipos específicos.

**A. Visualización y Filtrado de Anuncios:**
* **Todos** → historial completo de comunicados.
* **Club** → mensajes dirigidos a toda la entidad deportiva.
* **Equipo** → mensajes que atañen a los equipos a los que estás vinculado.
* Las tarjetas de anuncio muestran etiquetas útiles como **FIJADO**, **CLUB** o el nombre del equipo (ej. **SENIOR A**).`,
  },
  { type: 'image', key: 'tablon_pres', caption: 'Tablón de comunicaciones del club' },

  {
    type: 'markdown',
    content: `**B. Crear un Nuevo Anuncio:**
1. Haz clic en el botón verde **+** (esquina superior derecha).
2. Selecciona el **Destino**: **Todo el club** o un equipo concreto (ej. **SENIOR A** o **U10 Z**).
3. Escribe el encabezado en el campo **Título**.
4. Desarrolla tu mensaje en el cuadro de texto **Contenido**.
5. (Opcional) Marca la casilla **Fijar anuncio** si quieres que el mensaje se mantenga siempre arriba.
6. Haz clic en el botón verde **Publicar Anuncio**.

**C. Eliminar un Anuncio:**
1. Localiza el anuncio y haz clic en el icono de la **papelera** a la derecha de la tarjeta.
2. Aparecerá una ventana de confirmación "¿Eliminar este anuncio permanentemente?".
3. Haz clic en **Aceptar** para confirmar, o en **Cancelar** si cambiaste de opinión.`,
  },
  { type: 'image', key: 'nuevo_anuncio', caption: 'Formulario para publicar un nuevo anuncio' },

  // 2.5 Mi club
  {
    type: 'markdown',
    content: `### 2.5 Mi club (Gestión de Plantillas y Staff)

En la sección **Mi club** puedes consultar y gestionar la información detallada de los miembros que componen cada uno de tus equipos.

**A. Selección de Equipo e Invitaciones:**
* Selecciona la categoría que deseas visualizar en la parte superior (ej. **SENIOR A**, **U10 Z**).
* Para invitar a nuevos miembros, localiza el **CÓDIGO DE INVITACIÓN** y haz clic en **Copiar** para compartirlo.

**B. Organización y Filtrado:**
La pantalla se divide en dos grandes bloques: **Staff técnico** y **Plantilla** (jugadores).
* En **Staff técnico**, puedes ordenar por **Rol** o alfabéticamente (**A-Z**).
* En **Plantilla**, puedes ordenar por **Posición**, **A-Z**, o por **Edad**.
* Los jugadores incluyen etiqueta de color: Naranja → **Portero**, Azul → **Defensa**, Morado → **Centrocampista**, Verde → **Delantero**.

**C. Ver Información Detallada de un Usuario:**
1. Haz clic sobre cualquier tarjeta de usuario.
2. Se abrirá una ventana emergente con la fotografía del perfil, nombre completo, rol, **Email**, **Teléfono** y **DNI**.
3. Para cerrar esta vista, haz clic en la **X** en la esquina superior derecha.`,
  },
  { type: 'image', key: 'mi_club_pres', caption: 'Sección Mi club con plantilla y staff' },

  // 2.6 Campos
  {
    type: 'markdown',
    content: `### 2.6 Campos (Gestión de Instalaciones)

La sección **Campos** es la base de datos de ubicaciones de tu club. Las instalaciones que des de alta aquí estarán disponibles para seleccionarlas rápidamente al crear eventos.

**A. Añadir un Campo Nuevo:**
* **Importación Masiva:** Haz clic en **Importar** si dispones de un archivo con varias localizaciones.
* **Añadir Manualmente:**
  1. Haz clic en el botón verde **+ Añadir campo**.
  2. Rellena el **Nombre** de la instalación y la **Dirección** exacta.
  3. (Opcional) Pega el **Enlace Google Maps** para la geolocalización.
  4. (Opcional) Introduce una **Foto del campo (URL)**.
  5. Haz clic en el botón verde **Guardar campo**.

**B. Gestión de Campos Existentes:**
* **Desactivar** (amarillo): El campo se oculta de las listas de selección al crear eventos, pero no se borra de tu base de datos.
* **Eliminar** (rojo): Borra la instalación permanentemente. El sistema pedirá confirmación previa.
* **Cómo llegar** (verde): Abre automáticamente Google Maps con la ruta hacia la instalación.`,
  },
  { type: 'image', key: 'campos_pres', caption: 'Gestión de instalaciones deportivas' },

  // 2.7 Gestión Coach
  {
    type: 'markdown',
    content: `### 2.7 Gestión entrenador (Gestión Coach)

Como Presidente tienes acceso global a las herramientas de gestión deportiva de todos los equipos. Al entrar, selecciona la plantilla que deseas revisar en el apartado **EQUIPO** (ej. **SENIOR A**, **U10 Z**).

La pantalla se divide en cuatro pestañas: **ASISTENCIA**, **CONVOCATORIAS**, **STATS** y **MULTAS**.

**A. Asistencia:**
1. Selecciona la tarjeta del entrenamiento específico (verás la fecha y la hora, ej. 11/05 - 22:00).
2. Utiliza el interruptor a la derecha del nombre de cada jugador: **verde** = asistió, **gris** = no asistió.
3. Haz clic en el icono de la **estrella** para registrar un rendimiento destacado.`,
  },
  { type: 'image', key: 'asistencia_pres', caption: 'Control de asistencia a entrenamientos' },

  {
    type: 'markdown',
    content: `**B. Convocatorias:**

Aquí solo aparecen los partidos futuros que aún no se han disputado.

1. Selecciona el partido futuro en el listado superior de tarjetas.
2. Define el estado de cada jugador:
   * **CONV.** (Verde): El jugador está convocado. *(Solo los jugadores convocados aparecerán en "Editar Estadísticas" una vez finalizado el partido).*
   * **DESC.** (Rojo): Descartado por decisión técnica.
   * **BAJA** (Amarillo): Baja por lesión u otros motivos.`,
  },
  { type: 'image', key: 'convocatorias_pres', caption: 'Gestión de convocatorias para partidos' },

  {
    type: 'markdown',
    content: `**C. Stats:**

Pantalla puramente informativa. El sistema calcula automáticamente los datos de los partidos finalizados y genera un ranking del equipo.

Utiliza los botones superiores para cambiar la categoría: **Goles**, **Asist.**, **Amarillas**, **Rojas** o **Minutos**. La lista se ordena de mayor a menor puntuación.`,
  },
  { type: 'image', key: 'stats_pres', caption: 'Estadísticas del equipo (ranking)' },

  {
    type: 'markdown',
    content: `**D. Multas:**

Herramienta para llevar un control interno de las sanciones económicas o disciplinarias.

1. Haz clic en el botón verde **+ Nueva multa**.
2. Selecciona el jugador en **Selecciona Jugador**.
3. Escribe la razón en el campo **Motivo** (ej. Llegar tarde, sin espinilleras...).
4. Introduce la cantidad en el campo **Importe (€)**.
5. Haz clic en el botón verde **Crear multa** (o **Cancelar** para descartar).`,
  },
  { type: 'image', key: 'multas_pres', caption: 'Gestión de multas disciplinarias' },

  // 2.8 Gestión Presidente
  {
    type: 'markdown',
    content: `### 2.8 Gestión presidente (Administración)

La pestaña **Gestión presidente** es tu panel de administración central. La pantalla está dividida en tres subsecciones: **Peticiones**, **Cuotas** y **Equipos**.

**A. Peticiones (Admisión de miembros):**

En este apartado recibirás las solicitudes de los usuarios que han utilizado un código de invitación.

1. Verás una tarjeta con el nombre y correo del solicitante. Haz clic en **Aprobar** o **Rechazar**.
2. Si decides **Aprobar**, se abrirá la ventana **Revisar Solicitud**:
   * **Rol a asignar:** **Jugador/a**, **Entrenador / Staff** o **Familiar**.
   * **Equipo:** Asígnalo a la plantilla correspondiente.
   * **Posición** (si es jugador): **Portero/a**, **Defensa**, **Centrocampista** o **Delantero/a**.
   * Activa el interruptor de **Consentimiento de Imagen** si el usuario ha entregado la autorización.
3. Haz clic en el botón verde **Confirmar**.`,
  },
  { type: 'image', key: 'peticiones', caption: 'Lista de solicitudes de nuevos miembros' },
  { type: 'image', key: 'revisar_solicitud', caption: 'Formulario para revisar y aprobar una solicitud' },

  {
    type: 'markdown',
    content: `**B. Cuotas (Control de pagos):**

1. Haz clic en el botón verde **+ Crear Nueva Cuota**.
2. Selecciona el grupo en **Asignar a:** (**Todo el club** o un equipo específico).
3. Escribe el motivo en **Concepto de la cuota:** (ej. Matrícula Anual).
4. Introduce la cantidad en el campo **Importe (€)**.
5. Establece la fecha límite en **Vencimiento**.
6. Haz clic en el botón verde **Generar Cuota**.

Para gestionar una cuota existente, verás tres contadores: **PAGADOS** (verde), **PENDIENTES** (naranja) y **EXPIRADOS** (rojo). Actualiza el estado de pago de cada miembro con los botones **Pagado** / **Pendiente**.`,
  },
  { type: 'image', key: 'cuotas', caption: 'Gestión de cuotas y control de pagos' },

  {
    type: 'markdown',
    content: `**C. Equipos (Estructura deportiva):**

Para crear un equipo nuevo:
1. Haz clic en la pestaña superior **Equipos** y luego en **+ Nuevo Equipo**.
2. Selecciona la **Categoría** por edad (desde Sub-6 hasta Senior).
3. Selecciona el **Género**: **Masc.**, **Fem.** o **Mixto**.
4. Introduce un identificador en el campo **Sufijo** (Ej: A, B, Norte...) para diferenciarlo.
5. Haz clic en el botón verde **Crear Equipo**.

Para eliminar un equipo, localízalo en la lista y haz clic en el botón rojo **Borrar**.`,
  },
  { type: 'image', key: 'equipos_admin', caption: 'Administración de equipos del club' },

  // ─────────────────────────────────────────────
  // 3. ROL ENTRENADOR
  // ─────────────────────────────────────────────
  {
    type: 'markdown',
    content: `---

## 3. Guía de Uso: Rol Entrenador

Como Entrenador en SQUADRA, tu objetivo principal es la gestión deportiva del día a día de tu plantilla. Tu vista de la aplicación está optimizada y filtrada por defecto para mostrar la información de tu equipo.

### 3.1 Calendario

1. Haz clic en la pestaña **Calendario** y luego en el botón verde **+**.
2. Selecciona si es **Entreno** o **Partido**.
3. En **Seleccionar Equipo**, solo tendrás habilitada la opción de tu equipo.
4. Rellena los datos de **Fecha**, **Hora** y **Ubicación / Campo**.
5. Si es un partido, completa el **Rival**, la **Competición** y si juegas de **Local** o **Visitante**.
6. Haz clic en **Confirmar**.

*(Al igual que la directiva, podrás hacer clic en eventos pasados de tu equipo para acceder al botón azul de **Ver/Editar Estadísticas**).*`,
  },
  { type: 'image', key: 'entrenador_calendario', caption: 'Vista de calendario del Entrenador' },

  // 3.2 Horarios
  {
    type: 'markdown',
    content: `### 3.2 Horarios

La pestaña **Horarios** es tu agenda en formato lista.

* Al entrar, la vista estará filtrada por defecto para mostrar únicamente los eventos de tu equipo.
* Esta es una pantalla de **solo visualización** (no puedes editar desde aquí). Sirve para comprobar rápidamente tus próximos compromisos y revisar los resultados de los partidos pasados.`,
  },
  { type: 'image', key: 'entrenador_horarios', caption: 'Agenda de horarios del equipo' },

  // 3.3 Tablón
  {
    type: 'markdown',
    content: `### 3.3 Tablón (Comunicaciones)

Puedes utilizar el tablón para enviar comunicados oficiales, pero tu alcance está **restringido a tus jugadores y staff**.

1. Haz clic en la pestaña **Tablón** y luego en el botón verde **+**.
2. En la ventana emergente, el campo **Destino** estará limitado; solo podrás seleccionar a tu equipo (no podrás enviar mensajes a "Todo el club").
3. Rellena el **Título** y el **Contenido** del mensaje.
4. Haz clic en **Publicar Anuncio**.

### 3.4 Mi club (Plantilla y Staff)

* Al acceder a **Mi club**, la pantalla cargará automáticamente la información de tu equipo.
* Podrás copiar el **CÓDIGO DE INVITACIÓN** para enviárselo a nuevos jugadores.
* Podrás consultar la lista del **Staff técnico** y la **Plantilla**, y hacer clic sobre cualquier usuario para ver sus datos de contacto (**Email**, **Teléfono**, **DNI**).`,
  },
  { type: 'image', key: 'entrenador_mi_club', caption: 'Mi club: plantilla y staff del entrenador' },

  // 3.5 Campos
  {
    type: 'markdown',
    content: `### 3.5 Campos

Tienes acceso al listado de instalaciones del club para asociarlas a tus entrenamientos y partidos.

* Puedes añadir nuevas instalaciones haciendo clic en **+ Añadir campo** o usar el botón **Importar**.
* Puedes usar el botón amarillo **Desactivar** si un campo ya no está disponible temporalmente (por obras, cierre, etc.).

> **⚠️ Aviso importante:** A diferencia de la directiva, por motivos de seguridad en la base de datos, **no tienes permisos para Eliminar** una instalación de forma definitiva.`,
  },
  { type: 'image', key: 'entrenador_campos', caption: 'Gestión de campos (vista Entrenador)' },

  // 3.6 Gestión entrenador
  {
    type: 'markdown',
    content: `### 3.6 Gestión entrenador (Gestión Coach)

Esta es tu herramienta principal de trabajo, centrada exclusivamente en tu equipo asignado.

**A. ASISTENCIA:**
1. Selecciona un entrenamiento en la barra superior.
2. Utiliza los interruptores laterales para marcar qué jugadores han asistido (verde) o faltado (gris).
3. Haz clic en el icono de la **estrella** para destacar a jugadores con rendimiento sobresaliente.`,
  },
  { type: 'image', key: 'entrenador_asistencia', caption: 'Control de asistencia (Entrenador)' },

  {
    type: 'markdown',
    content: `**B. CONVOCATORIAS:**
1. Selecciona un partido futuro en la barra superior.
2. Define el estado de cada jugador: **CONV.** (Verde) / **DESC.** (Rojo) / **BAJA** (Amarillo).`,
  },
  { type: 'image', key: 'entrenador_convocatorias', caption: 'Gestión de convocatorias (Entrenador)' },

  {
    type: 'markdown',
    content: `**C. STATS:**
Pantalla de solo visualización para analizar el rendimiento de tu plantilla. Haz clic en **Goles**, **Asist.**, **Amarillas**, **Rojas** o **Minutos** para ordenar automáticamente a tus jugadores según sus estadísticas acumuladas.`,
  },
  { type: 'image', key: 'entrenador_stats', caption: 'Estadísticas de la plantilla (Entrenador)' },

  {
    type: 'markdown',
    content: `**D. MULTAS:**
1. Ve a la pestaña **MULTAS** y haz clic en **+ Nueva multa**.
2. Selecciona al jugador, escribe el **Motivo** y el **Importe (€)**.
3. Haz clic en **Crear multa** para registrarla.`,
  },
  { type: 'image', key: 'entrenador_multas', caption: 'Registro de multas disciplinarias (Entrenador)' },

  // ─────────────────────────────────────────────
  // 4. ROL JUGADOR
  // ─────────────────────────────────────────────
  {
    type: 'markdown',
    content: `---

## 4. Guía de Uso: Rol Jugador

¡Bienvenido a SQUADRA! Como jugador, esta aplicación es tu herramienta principal para estar al día de todo lo que ocurre en tu equipo.

Tu perfil está diseñado para ser **puramente informativo y de consulta**. Tu única misión aquí es entrar, informarte de tus horarios, leer los comunicados y saber cómo llegar a los partidos.

### 4.1 Inicio (Tu panel resumen)

* **Saludo y Datos:** Arriba a la izquierda verás tu nombre, el club al que perteneces y tu equipo asignado.
* **Último Anuncio:** Mensaje más reciente publicado por tu entrenador o el presidente. Haz clic en **Ver tablón** para leer mensajes anteriores.
* **Próximos Eventos:** Lista rápida con tus próximos tres compromisos (entrenamientos o partidos). Haz clic en **Ver todos** para ver la agenda completa.

### 4.2 Calendario

1. Utiliza las flechas **<** y **>** para navegar por los meses.
2. **Línea naranja** = Partido ese día. **Línea azul** = Entreno ese día.
3. Haz clic sobre cualquier día con una línea de color para ver los detalles del evento (rival, hora, tipo).
4. Para salir de esta vista, haz clic en el botón inferior **Cerrar**.

### 4.3 Horarios

* Filtra la lista con los botones **Todos**, **Partidos** y **Entrenos**.
* Cada tarjeta indica la fecha, la hora, el campo y si juegas de **LOCAL** o **VISITANTE**.
* Los partidos pasados muestran el resultado final (ej. **2 - 1**).

### 4.4 Tablón

El **Tablón** es tu bandeja de entrada de comunicados oficiales. Como jugador, **no puedes escribir mensajes aquí**, solo leer los que te envía el cuerpo técnico o la directiva.

* Las tarjetas tienen etiquetas (ej. **CLUB** o **SENIOR A**) que indican si el mensaje es general o exclusivo para tu plantilla.
* Usa los botones **Todos**, **Club**, **Equipo** para filtrar los mensajes.

### 4.5 Mi club

* La pantalla está dividida en dos bloques: **Staff técnico** y **Plantilla**.
* Puedes ordenar la lista de compañeros por **Posición** (con etiquetas de color), **A-Z** o **Edad**.

### 4.6 Campos

¿No sabes dónde está el polideportivo rival? La pestaña **Campos** es tu solución.

1. Verás una lista con todas las instalaciones deportivas registradas por tu club.
2. Cada tarjeta tiene el nombre del campo y su dirección.
3. Haz clic en el botón verde brillante **Cómo llegar** para que se abra automáticamente Google Maps con la ruta exacta lista para que el GPS te guíe hasta la puerta del campo.`,
  },

  // ─────────────────────────────────────────────
  // 5. ROL FAMILIAR
  // ─────────────────────────────────────────────
  {
    type: 'markdown',
    content: `---

## 5. Guía de Uso: Rol Familiar

¡Bienvenido a SQUADRA! Como padre, madre o allegado, esta aplicación es tu vía de comunicación directa con el club y la herramienta perfecta para hacer el seguimiento deportivo de tu jugador vinculado.

Tu cuenta es de **"solo lectura"**, lo que significa que puedes navegar libremente por la aplicación sin miedo a borrar datos, modificar eventos o desconfigurar nada.

### 5.1 Inicio (Panel de resumen)

* **Último Anuncio:** Aviso más reciente del club o del entrenador (ej. recordatorios de cuotas, cambios de última hora). Haz clic en **Ver tablón** para leer mensajes anteriores.
* **Próximos Eventos:** Las tres próximas citas de tu jugador vinculado con su día y hora exacta. Haz clic en **Ver todos** para acceder a la agenda completa.

### 5.2 Calendario

1. Navega por los meses con las flechas **<** y **>**.
2. **Línea naranja** = Partido. **Línea azul** = Entreno.
3. Al hacer clic sobre un día marcado, se abrirá un panel con el tipo de partido, la hora de convocatoria y el rival. Haz clic en **Cerrar** para ocultar el panel.

### 5.3 Horarios

* Filtra la vista pulsando en **Partidos** o **Entrenos**.
* Las tarjetas muestran si el equipo juega en casa (**LOCAL**) o fuera (**VISITANTE**).
* Para los partidos ya disputados, podrás consultar el resultado final en la parte derecha de la tarjeta (ej. **2 - 1**).

### 5.4 Tablón

El **Tablón** es el canal oficial de comunicación del equipo.

* Las etiquetas te indicarán si es un comunicado general para toda la escuela (**CLUB**) o un aviso exclusivo para el equipo de tu jugador (ej. **SENIOR A**).
* Usa los botones **Todos**, **Club**, **Equipo** para filtrar los mensajes.

### 5.5 Mi club

* En el bloque de **Staff técnico**, podrás ver quién es el entrenador principal, los asistentes o el preparador físico.
* En el bloque de **Plantilla**, podrás ver a todos los compañeros de equipo, ordenados por su posición en el campo (con etiquetas de colores para Portero, Defensa, Centrocampista o Delantero).

### 5.6 Campos (Rutas y mapas)

Esta es probablemente una de las funciones más útiles para los desplazamientos del fin de semana.

1. Aquí encontrarás un listado con todas las instalaciones deportivas donde el equipo jugará sus partidos.
2. Cada tarjeta indica el nombre del polideportivo y su dirección física.
3. Al hacer clic en el botón verde **Cómo llegar**, se abrirá la aplicación de Google Maps en tu teléfono trazando automáticamente la ruta desde tu ubicación actual hasta la puerta de la instalación deportiva.`,
  },
];