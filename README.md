# 📘 SIGED — Desarrollo del Curso (Extensión para Chrome)

Extensión de Chrome que **completa automáticamente** la sección "Desarrollo del Curso" en SIGED, a partir de un archivo CSV.

En vez de cargar uno por uno cada clase en SIGED, cargás todo el semestre de una sola vez.

---

## 🎯 ¿Para qué sirve?

Si tenés que cargar el desarrollo del curso de varias clases en SIGED (fecha, horas dictadas, horas no dictadas, y el texto de lo que se hizo), esta extensión lo hace **automáticamente** a partir de un archivo CSV que preparás en Excel.

---

## 📦 Instalación (solo una vez)

### Paso 1: Descargar
Descargá y descomprimí la carpeta `siged-desarrollo`.

### Paso 2: Abrir extensiones de Chrome
Escribí en la barra de direcciones:
```
chrome://extensions/
```

### Paso 3: Activar modo desarrollador
En la esquina **superior derecha**, activá el interruptor que dice **"Modo de desarrollador"**.

### Paso 4: Cargar la extensión
Hacé clic en **"Cargar extensión sin empaquetar"** y seleccioná la carpeta `siged-desarrollo`.

### Paso 5: Fijar el ícono
Hacé clic en el ícono de rompecabezas (🧩) en la barra de Chrome y fijá la extensión **"SIGED - Desarrollo del Curso"** con el pin 📌.

¡Listo! Vas a ver un ícono **DC** azul en la barra del navegador.

---

## 📝 Preparar el archivo CSV

Podés crear el archivo en **Excel** y guardarlo como CSV.

### Formato del archivo

El archivo tiene **4 columnas** separadas por punto y coma:

| Fecha | Horas dictadas | Horas no dictadas | Desarrollo |
|---|---|---|---|
| 05/03/2026 | 2 | 0 | Introducción a la cinemática. Conceptos de posición y desplazamiento. |
| 07/03/2026 | 2 | 0 | MRU: ecuación horaria, resolución de problemas. |
| 12/03/2026 | 0 | 2 | No se dictó clase por jornada institucional. |

### Cómo guardarlo desde Excel
1. Abrí Excel y completá las 4 columnas
2. **Archivo** → **Guardar como**
3. En "Tipo", elegí **CSV UTF-8 (delimitado por comas)** o **CSV (delimitado por punto y coma)**
4. Guardalo con un nombre descriptivo (ej: `desarrollo_7ebi3_fisicoquimica.csv`)

### Notas sobre el formato
- La fecha debe ser **DD/MM/AAAA** (ej: 05/03/2026)
- Las horas son números enteros (0, 1, 2, etc.)
- El texto de desarrollo puede ser tan largo como necesites
- Se incluye un archivo de ejemplo: `ejemplo_desarrollo.csv`

---

## 🚀 Cómo usar la extensión

### Paso 1: Ir a SIGED
Ingresá a SIGED y navegá hasta la sección **"Desarrollo del curso"** de la libreta que querés completar:

1. Entrá a `candersen.siged.com.uy`
2. Andá a **Libreta @** → **Mis Libretas**
3. Seleccioná la libreta (ej: 7-EBI 3 - CS FÍSICO-QUÍMICA)
4. Hacé clic en **"Desarrollo del curso"**

### Paso 2: Abrir la extensión
Hacé clic en el ícono **DC** en la barra del navegador.

La extensión te va a mostrar uno de estos mensajes:

| Mensaje | Significado |
|---|---|
| ✅ **Listo para cargar** | Estás en la página correcta. ¡Podés continuar! |
| ⚠️ **Estás en SIGED, pero falta un paso** | Necesitás navegar hasta "Desarrollo del curso" |
| ❌ **No estás en SIGED** | Abrí SIGED primero en el navegador |

### Paso 3: Cargar el CSV
Una vez que dice "Listo para cargar":
1. Hacé clic en **"Seleccionar archivo CSV"**
2. Elegí tu archivo
3. Vas a ver una vista previa de los datos

### Paso 4: Ejecutar
1. Opcionalmente, ajustá la pausa entre registros (3000ms por defecto)
2. Hacé clic en **"🚀 Cargar todo el Desarrollo en SIGED"**
3. **No toques nada** — la extensión trabaja sola

Vas a ver una barra de progreso y un log de lo que va haciendo. Cuando termina, te muestra cuántos registros se cargaron exitosamente.

### Importante
- **No cierres la pestaña de SIGED** mientras se ejecuta
- Si necesitás parar, usá el botón **"Detener carga"**
- Si SIGED anda lento, subí la pausa a 5000ms
- Para cada libreta diferente, tenés que navegar a su "Desarrollo del curso" y ejecutar de nuevo

---

## ❓ Solución de problemas

### La extensión dice "No estás en SIGED"
Abrí SIGED en el navegador (`candersen.siged.com.uy`) e iniciá sesión.

### La extensión dice "Estás en SIGED, pero falta un paso"
Navegá hasta **Libreta @** → **Mis Libretas** → elegí una libreta → **Desarrollo del curso**.

### "Error de comunicación"
Recargá la página de SIGED (F5), esperá que cargue completamente, y volvé a abrir la extensión.

### "No se encontró el botón Nuevo"
Asegurate de estar en la sección "Desarrollo del curso" y no en otra sección de la libreta.

### Las fechas no se cargan bien
Verificá que el formato sea DD/MM/AAAA (ej: 05/03/2026). No uses formatos como "5 de marzo".

### El texto de desarrollo no aparece
Si el editor CKEditor no cargó completamente, recargá la página (F5) e intentá de nuevo.

---

## 📁 Contenido de la carpeta

```
siged-desarrollo/
├── manifest.json            → Configuración de Chrome
├── popup.html               → Pantalla de la extensión
├── popup.js                 → Lógica de la interfaz
├── content.js               → Automatización en SIGED
├── icon16.png               → Ícono pequeño
├── icon48.png               → Ícono mediano
├── icon128.png              → Ícono grande
├── ejemplo_desarrollo.csv   → CSV de ejemplo
└── README.md                → Esta guía
```

---

## 🔒 Privacidad y seguridad

- ✅ Todo funciona **localmente** en tu navegador
- ✅ No se envía información a ningún servidor externo
- ✅ Los datos del CSV se procesan solo en memoria
- ✅ La extensión solo funciona en sitios de SIGED

---

*Desarrollado por Física Simple — Colegio Hans Christian Andersen*
