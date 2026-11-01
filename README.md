# 📅 Plataforma Web de Agendamiento de Citas (Estilo Fresha)

Sistema completo y profesional de agendamiento de citas en línea inspirado en la interfaz moderna y minimalista de **Fresha**. Incluye generación de enlaces y códigos QR dinámicos, gestión de servicios con precios y duraciones, notificaciones automáticas por correo electrónico (confirmación, aplazamiento, cancelación y recordatorio 30 minutos antes), registro de auditoría con la hora exacta de agendamiento y panel de administración con control total del sitio.

---

## ✨ Características Principales

### 1. 🔗 Enlace Compartible y Código QR Dinámico
* **Generador de Enlace**: Botón con un clic para copiar el link directo de agendamiento.
* **Código QR en Alta Definición**: Se genera automáticamente en el panel y en la vista pública. Puede descargarse como imagen PNG para imprimir en folletos, tarjetas de presentación o recepción del local.
* **Compartir por WhatsApp**: Botón directo que abre WhatsApp con el mensaje y enlace preconfigurados.

### 2. ✂️ Gestión de Servicios con Precios y Duración
* El administrador puede agregar, editar y eliminar servicios fácilmente.
* Cada servicio incluye:
  - Nombre del servicio.
  - Categoría (Barbería, Peluquería, Estética, Spa, Uñas, etc.).
  - Precio / Valor a pagar (con formato de moneda configurable: COP $, USD, etc.).
  - Duración en minutos (utilizada para calcular la disponibilidad de turnos en tiempo real).
  - Descripción y detalles de lo que incluye.
  - Imagen y etiqueta personalizada (*"Más Popular"*, *"Top Ventas"*, *"Recomendado"*).

### 3. 🗓️ Experiencia de Agendamiento para el Cliente
* **Catálogo interactivo con filtros**: Búsqueda por palabra clave y selector de categorías.
* **Cálculo inteligente de turnos**: El sistema calcula los horarios disponibles según el horario de atención configurado (ej. 08:00 a 19:00), evitando duplicados y solapamientos.
* **Formulario rápido**: Nombre completo, correo electrónico, teléfono/WhatsApp y notas opcionales.
* **Confirmación instantánea**: Muestra el código único de cita (`CIT-XXXXX`), animación de celebración y opción de **Añadir a Google Calendar**.

### 4. 📧 Sistema de Correos Electrónicos y Notificaciones
* **Correo de confirmación al cliente**:
  - Contiene los detalles completos del servicio, fecha, hora, valor y dirección del negocio.
  - Incluye botones directos para **Aplazar / Reagendar** o **Cancelar** la cita en cualquier momento con un clic.
* **Alerta al Administrador (con registro de auditoría)**:
  - Notifica de inmediato al administrador con los datos del cliente, servicio agendado y la **hora y fecha exacta en la que se realizó el agendamiento** para llevar el control.
* **⏰ Recordatorio Automático 30 Minutos Antes**:
  - El servidor cuenta con un motor en segundo plano que detecta las citas próximas y envía automáticamente un correo recordatorio 30 minutos antes de la hora acordada.
* **Buzón de Auditoría de Correos en Vivo**:
  - Permite visualizar en el panel de administración todos los correos generados, su destinatario, estado de entrega y vista previa HTML idéntica a la que recibe el cliente.
* **Configuración SMTP Flexible**: Funciona de inmediato en modo simulación (para pruebas locales) y permite configurar credenciales SMTP reales (Gmail, Outlook, Hostinger, etc.).

### 5. ⚙️ Panel de Administración con Control Total (CMS)
* **Gestión de Citas**: Tabla con filtros por estado (*Confirmada, Reagendada, Completada, Cancelada*), fecha y buscador. Permite enviar el recordatorio manualmente si se desea.
* **Edición Visual del Sitio**:
  - Nombre del establecimiento y eslogan.
  - Títulos principales del banner (Hero Title y Subtítulo).
  - Logo y Banner de fondo.
  - Dirección física, ciudad, teléfono, WhatsApp y correo de contacto.
  - Horarios de atención: hora de apertura, hora de cierre e intervalo entre turnos (15, 30, 45, 60 min).
  - Moneda y símbolo.
  - Cambio de contraseña de administrador.

---

## 🚀 Cómo Ejecutar la Aplicación

### Requisitos
* [Node.js](https://nodejs.org/) v18+ o v24+ instalado.

### Paso 1: Instalar Dependencias (ya instaladas)
```bash
npm install
npm --prefix client install
```

### Paso 2: Iniciar la Aplicación
Ejecuta en tu terminal:
```bash
npm start
```

La plataforma estará lista en:
👉 **http://localhost:5000**

---

## 🔐 Acceso al Panel de Administración

* Puedes acceder haciendo clic en el botón **"Admin"** en la barra superior o ingresando a:
  **http://localhost:5000/#admin**
* **Contraseña por defecto**: `admin123`
*(Puedes cambiar esta contraseña en cualquier momento en la pestaña "Editar Página" > "Seguridad")*.

---

## ☁️ Despliegue en la Nube 24/7 (Gratuito en Render.com o Railway)

Para que tu sistema de agendamiento esté disponible las 24 horas del día para cualquier celular (con datos 4G/5G o Wi-Fi) sin tener tu computador encendido:

### Paso 1: Subir a GitHub
1. Abre tu cuenta de [GitHub](https://github.com) y crea un nuevo repositorio llamado `zipaquira-citas` (puede ser público o privado).
2. En la carpeta del proyecto, haz doble clic en **`SUBIR_A_GITHUB.bat`**.
3. Pega el enlace de tu repositorio de GitHub y presiona Enter. ¡Todos los archivos se subirán automáticamente!

### Paso 2: Conectar con Render.com (100% Gratis)
1. Ve a [Render.com](https://dashboard.render.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en el botón azul **"New +"** y selecciona **"Web Service"**.
3. Elige tu repositorio `zipaquira-citas`.
4. Render detectará automáticamente el archivo `render.yaml` pre-configurado:
   - **Runtime**: Node (versión 22)
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. Haz clic en **"Deploy Web Service"**.
6. ¡En un par de minutos tendrás tu enlace público seguro con SSL! (por ejemplo `https://zipaquira-citas.onrender.com/citas`).

Al abrir ese enlace en la nube, el sistema detecta automáticamente el dominio público y actualiza el código QR y los botones de compartir para todos tus clientes.

---

## 📂 Estructura del Proyecto

```text
├── client/                     # Frontend moderno (React, Vite, Tailwind CSS, Lucide Icons, QR)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx              # Barra de navegación con logo, búsqueda de citas y botón admin
│   │   │   ├── Hero.jsx                # Portada estilo Fresha con buscador de tratamientos y fechas
│   │   │   ├── ServiceCard.jsx         # Tarjetas de servicios con precios, ratings y duración
│   │   │   ├── BookingModal.jsx        # Asistente de 3 pasos para agendar citas
│   │   │   ├── ManageAppointmentModal.jsx # Gestión para aplazar / reprogramar o cancelar cita
│   │   │   ├── ShareQRModal.jsx        # Generador y descargador de link y código QR
│   │   │   ├── AdminPanel.jsx          # Panel de administración completo
│   │   │   └── EmailLogsModal.jsx      # Visor del historial y previsualización de correos
│   │   ├── App.jsx                     # Componente principal y enrutador
│   │   └── index.css                   # Estilos Tailwind CSS
│   └── dist/                           # Compilación estática para producción
├── data/
│   └── agendamiento.sqlite             # Base de datos SQLite persistente (citas, servicios, ajustes)
├── server/
│   ├── db.js                           # Conexión nativa a SQLite y esquemas de datos
│   ├── emailService.js                 # Plantillas HTML y motor de envío de correos
│   ├── schedulerService.js             # Motor en segundo plano para recordatorios 30 min antes
│   ├── routes/
│   │   ├── appointments.js             # Endpoints de citas, auditoría, aplazamiento y cancelación
│   │   ├── services.js                 # Endpoints CRUD de servicios y categorías
│   │   ├── settings.js                 # Endpoints de personalización CMS y autenticación
│   │   └── emails.js                   # Endpoints de logs de correos y pruebas
│   └── server.js                       # Servidor Express principal
└── package.json
```
