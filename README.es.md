# ai-locale CLI de Traducción

Una herramienta de línea de comandos para validar y traducir archivos de localización usando la API de OpenAI. Soporta múltiples formatos de archivo con coincidencia inteligente de rutas usando el marcador de posición `#locale`.

## 🌍 Documentación Multilingüe

- 🇺🇸 [English](README.md) (Original)
- 🇫🇷 [Français](README.fr.md)
- 🇪🇸 [Español](README.es.md) (Actual)
- 🇨🇳 [中文](README.zh.md)

## 🎯 Formatos de Archivo Soportados

El CLI soporta una amplia gama de formatos de archivo de localización:

### 📱 **Archivos iOS .strings**

```strings
/* Localizable.strings */
"SAVE_BUTTON" = "Guardar";
"CANCEL_BUTTON" = "Cancelar";
"ERROR_MESSAGE" = "Ocurrió un error: {error}";
```

### 📄 **Cadenas XML de Android**

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="save_button">Guardar</string>
    <string name="cancel_button">Cancelar</string>
    <string name="error_message">Ocurrió un error: %1$s</string>
</resources>
```

### 📦 **Archivos JSON**

```json
{
  "save_button": "Guardar",
  "cancel_button": "Cancelar",
  "error_message": "Ocurrió un error: {error}"
}
```

### 🔧 **Objetos de Exportación TypeScript/JavaScript**

```typescript
export default {
  save_button: "Guardar",
  cancel_button: "Cancelar",
  error_message: "Ocurrió un error: {error}",
} as const;
```

## 🗂️ Coincidencia de Rutas con `#locale`

El CLI usa el marcador de posición `#locale` para descubrimiento inteligente de archivos y detección de idioma:

### **Cómo Funciona `#locale`**

El marcador de posición `#locale` se reemplaza automáticamente con códigos de idioma detectados de la estructura de archivos:

```bash
# Patrón: locales/#locale/messages.json
# Coincide con: locales/en/messages.json, locales/fr/messages.json, locales/es/messages.json
# Idiomas detectados: en, fr, es

ai-locale translate 'locales/#locale/messages.json'
```

### **Patrones `#locale` Comunes**

```bash
# Estructura iOS/Android
'locales/#locale/Localizable.strings'
'locales/#locale/strings.xml'

# Estructura JSON
'locales/#locale/messages.json'
'i18n/#locale/translations.json'

# Estructura TypeScript
'src/locales/#locale/index.ts'
'locales/#locale/translation.ts'

# Formatos mixtos
'locales/#locale/strings.xml'
'locales/#locale/messages.json'
```

### **Detección de Idioma**

El CLI detecta automáticamente idiomas desde:

- **Nombres de directorio**: `locales/en/`, `locales/fr/`
- **Nombres de archivo**: `en.json`, `fr.json`, `en.ts`
- **Rutas de archivo**: `locales/en/messages.json`

## Características

- ✅ **Soporte Multi-formato**: Maneja archivos iOS `.strings`, Android XML, JSON y TypeScript/JavaScript
- ✅ **Coincidencia Inteligente de Rutas**: Usa el marcador de posición `#locale` para descubrimiento inteligente de archivos
- ✅ **Detección de Claves Faltantes**: Identifica automáticamente traducciones faltantes en archivos de idioma
- ✅ **Traducción Alimentada por IA**: Usa GPT-4o-mini de OpenAI para traducciones de alta calidad
- ✅ **Optimizado para Costo**: Procesa traducciones en lotes paralelos con estimación de costos
- ✅ **Consciente del Contexto**: Usa TODAS las traducciones existentes como contexto para máxima precisión
- ✅ **CLI Interactivo**: Interfaz de terminal hermosa con indicadores de progreso
- ✅ **Soporte de Respaldo**: Crea automáticamente archivos de respaldo antes de la traducción
- ✅ **Modo Dry Run**: Previsualiza traducciones sin hacer cambios
- ✅ **Control de Lotes**: Tamaño de lote y retraso configurables para gestión de límites de tasa

## Instalación

### Instalación Global

```bash
npm install -g ai-locale-cli
```

### Instalación Local

```bash
git clone <repository-url>
cd iara-worldwide
npm install
```

## Inicio Rápido

### 1. Configurar Clave API

Crear un archivo `.env` en la raíz del proyecto:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

O usar la opción `--api-key`:

```bash
ai-locale translate "locales/#locale/messages.json" --api-key sk-your-key
```

### 2. Traducir Archivos

```bash
# Usando patrón #locale (recomendado)
ai-locale translate "locales/#locale/messages.json" --source en

# Especificar idiomas objetivo explícitamente
ai-locale translate "locales/#locale/strings.xml" --source en --target fr,es,de

# Usar patrones glob tradicionales
ai-locale translate "translations/**/*.strings" --source en --target fr,es

# Dry run para ver qué se traduciría
ai-locale translate "locales/#locale/messages.json" --dry-run
```

### 3. Validar Archivos

```bash
# Verificar traducciones faltantes usando patrón #locale
ai-locale validate "locales/#locale/messages.json" --source en

# Patrón glob tradicional
ai-locale validate "translations/**/*.strings" --source en
```

### 4. Ver Estadísticas

```bash
# Mostrar estadísticas de completitud de traducción
ai-locale stats "locales/#locale/messages.json"

# Patrón glob tradicional
ai-locale stats "translations/**/*.strings"
```

## Comandos CLI

### `translate` - Traducir Claves Faltantes

Traduce claves faltantes en archivos de localización.

```bash
ai-locale translate <pattern> [options]
```

**Argumentos:**

- `pattern` - Patrón de archivo (ej. `locales/#locale/messages.json`, `translations/**/*.strings`)

**Opciones:**

- `-k, --api-key <key>` - Clave API de OpenAI (o establecer variable de entorno OPENAI_API_KEY)
- `-s, --source <lang>` - Código de idioma fuente (por defecto: "en")
- `-t, --target <langs>` - Idiomas objetivo separados por comas (detectados automáticamente si no se proporcionan)
- `-o, --output <dir>` - Directorio de salida (por defecto: sobrescribir archivos originales)
- `-c, --context <text>` - Breve descripción de tu aplicación para el traductor (vacío por defecto)
- `--dry-run` - Mostrar qué se traduciría sin hacer cambios
- `--verbose` - Mostrar salida detallada
- `--no-backup` - No crear archivos de respaldo
- `--yes` - Omitir prompt de confirmación
- `--batch-size <size>` - Número de traducciones a procesar en paralelo (por defecto: 5)
- `--batch-delay <ms>` - Retraso entre lotes en milisegundos (por defecto: 1000)

**Ejemplos:**

```bash
# Traducción básica con patrón #locale
ai-locale translate "locales/#locale/messages.json"

# Especificar idiomas fuente y objetivo
ai-locale translate "locales/#locale/strings.xml" --source en --target fr,es,de,it

# Dry run para previsualizar
ai-locale translate "locales/#locale/messages.json" --dry-run --verbose

# Guardar en directorio diferente
ai-locale translate "locales/#locale/messages.json" --output ./translated/

# Usar clave API específica
ai-locale translate "locales/#locale/messages.json" --api-key sk-your-key

# Controlar procesamiento por lotes
ai-locale translate "locales/#locale/messages.json" --batch-size 3 --batch-delay 2000
```

### `validate` - Validar Archivos de Traducción

Verifica archivos de traducción para claves faltantes y problemas de consistencia.

```bash
ai-locale validate <pattern> [options]
```

**Argumentos:**

- `pattern` - Patrón de archivo a validar

**Opciones:**

- `-s, --source <lang>` - Código de idioma fuente (por defecto: "en")

**Ejemplos:**

```bash
# Validar todos los archivos de traducción usando patrón #locale
ai-locale validate "locales/#locale/messages.json"

# Validar con idioma fuente específico
ai-locale validate "locales/#locale/strings.xml" --source en

# Patrón glob tradicional
ai-locale validate "translations/**/*.strings" --source en
```

### `stats` - Mostrar Estadísticas de Traducción

Muestra estadísticas completas sobre archivos de traducción.

```bash
ai-locale stats <pattern>
```

**Argumentos:**

- `pattern` - Patrón de archivo a analizar

**Ejemplos:**

```bash
# Mostrar estadísticas para todos los archivos usando patrón #locale
ai-locale stats "locales/#locale/messages.json"

# Mostrar estadísticas para patrón específico
ai-locale stats "locales/#locale/strings.xml"

# Patrón glob tradicional
ai-locale stats "translations/**/*.strings"
```

### `purge` - Eliminar Claves Obsoletas

Elimina claves que no existen en el archivo de idioma fuente.

```bash
ai-locale purge <pattern> [options]
```

**Argumentos:**

- `pattern` - Patrón de archivo a purgar

**Opciones:**

- `-s, --source <lang>` - Código de idioma fuente (por defecto: "en")
- `--dry-run` - Mostrar qué se purgaría sin hacer cambios
- `--verbose` - Mostrar salida detallada
- `--no-backup` - No crear archivos de respaldo

**Ejemplos:**

```bash
# Eliminar claves no presentes en inglés usando patrón #locale
ai-locale purge "locales/#locale/messages.json" --source en

# Dry run para previsualizar qué se purgaría
ai-locale purge "locales/#locale/strings.xml" --dry-run --verbose

# Purgar con francés como fuente
ai-locale purge "locales/#locale/messages.json" --source fr

# Patrón glob tradicional
ai-locale purge "translations/**/*.strings" --source en
```

## Ejemplos de Patrones Glob

El CLI soporta patrones glob poderosos para descubrimiento de archivos:

```bash
# Todos los archivos de traducción en directorio locales
"locales/#locale/messages.json"

# Todos los archivos .strings recursivamente
"translations/**/*.strings"

# Archivos de idioma específicos
"src/locales/en.ts"
"src/locales/fr.ts"

# Patrones múltiples
"locales/#locale/messages.json" "src/i18n/#locale/translations.json"

# Archivos con convención de nombres específica
"**/i18n/#locale/*.ts"
"**/locales/#locale/*.strings"

# Formatos mixtos con #locale
"locales/#locale/strings.xml"
"locales/#locale/messages.json"
```

## Idiomas Soportados

La herramienta soporta 20+ idiomas incluyendo:

- Inglés (en)
- Francés (fr)
- Español (es)
- Alemán (de)
- Italiano (it)
- Portugués (pt)
- Holandés (nl)
- Sueco (sv)
- Danés (da)
- Noruego (no)
- Finés (fi)
- Polaco (pl)
- Ruso (ru)
- Japonés (ja)
- Coreano (ko)
- Chino (zh)
- Árabe (ar)
- Hindi (hi)
- Turco (tr)
- Tailandés (th)

## Contexto de Traducción y Precisión

El CLI proporciona contexto máximo a OpenAI para las traducciones más precisas:

### **Detección Inteligente de Contexto**

- **Todas las Traducciones Existentes**: Si una clave existe en inglés y francés, ambas se incluyen en el prompt
- **Prioridad del Idioma Fuente**: Usa el idioma fuente especificado como referencia principal
- **Contexto Completo**: Proporciona todas las traducciones disponibles para cada clave para asegurar consistencia

### **Ejemplo de Contexto de Traducción**

```
Clave: "common.save"
Traducciones existentes:
- en: "Save"
- fr: "Enregistrer"
- es: "Guardar"

Faltante en: de, it

La IA recibe: "Traducir 'Save' al alemán e italiano, considerando las traducciones existentes en francés y español para contexto"
```

## Optimización de Costos

El CLI está optimizado para costo y velocidad:

- **Procesamiento Paralelo**: Traduce múltiples claves simultáneamente usando `Promise.all`
- **Lotes Configurables**: Controla tamaño de lote y retraso con opciones `--batch-size` y `--batch-delay`
- **Estimación de Costos**: Muestra costos estimados antes del procesamiento
- **Modelo Eficiente**: Usa GPT-4o-mini para ratio costo/calidad óptimo
- **Optimización de Contexto**: Usa TODAS las traducciones existentes como contexto para máxima precisión
- **Gestión de Límites de Tasa**: Retrasos integrados y procesamiento por lotes para respetar límites de API

### Ejemplos de Control de Lotes

```bash
# Enfoque conservador (lotes más pequeños, retrasos más largos)
ai-locale translate "locales/#locale/messages.json" --batch-size 2 --batch-delay 2000

# Enfoque agresivo (lotes más grandes, retrasos más cortos)
ai-locale translate "locales/#locale/messages.json" --batch-size 10 --batch-delay 500

# Configuración por defecto (equilibrada)
ai-locale translate "locales/#locale/messages.json" --batch-size 5 --batch-delay 1000
```

### Ejemplo de Estimación de Costos

Para 100 claves faltantes en 3 idiomas:

- Costo estimado: ~$0.15 USD
- Tiempo de procesamiento: ~2-3 minutos
- Tokens usados: ~25,000 entrada + 5,000 salida

## Desarrollo

### Desarrollo Local

```bash
# Instalar dependencias
npm install

# Ejecutar CLI localmente
node src/cli.js translate "examples/*.ts"

# Desarrollo con recarga automática
npm run dev translate "examples/*.ts"

# Ejecutar pruebas
npm test
```

### Construcción de Ejecutable

```bash
# Construir ejecutable independiente
npm run build

# El ejecutable estará en el directorio dist/
./dist/ai-locale-cli translate "locales/#locale/messages.json"
```

### Variables de Entorno

| Variable         | Descripción         | Por Defecto |
| ---------------- | ------------------- | ----------- |
| `OPENAI_API_KEY` | Clave API de OpenAI | Requerido   |
| `NODE_ENV`       | Entorno             | development |

### Estructura del Proyecto

```
src/
├── cli.js                    # Punto de entrada CLI principal
├── services/
│   ├── openaiService.js      # Integración OpenAI
│   └── translationService.js # Lógica de traducción
└── utils/
    ├── fileParser.js         # Utilidades de análisis de archivos
    └── validation.js         # Validación de solicitudes
```

## Ejemplos de Uso

### Ejemplo 1: Traducción Básica

```bash
# Estructura del proyecto:
# locales/
#   ├── en/
#   │   └── messages.json
#   ├── fr/
#   │   └── messages.json (falta algunas claves)
#   └── es/
#       └── messages.json (falta algunas claves)

ai-locale translate "locales/#locale/messages.json" --source en
```

### Ejemplo 2: Archivos iOS Strings

```bash
# Estructura del proyecto:
# translations/
#   ├── en/
#   │   └── Localizable.strings
#   ├── fr/
#   │   └── Localizable.strings
#   └── es/
#       └── Localizable.strings

ai-locale translate "translations/#locale/Localizable.strings" --source en
```

### Ejemplo 3: Archivos Android XML

```bash
# Estructura del proyecto:
# locales/
#   ├── en/
#   │   └── strings.xml
#   ├── fr/
#   │   └── strings.xml
#   └── es/
#       └── strings.xml

ai-locale translate "locales/#locale/strings.xml" --source en
```

### Ejemplo 4: Archivos GNU gettext .po

```bash
# Estructura del proyecto:
# locale/
#   ├── en/
#   │   └── LC_MESSAGES/
#   │       └── messages.po
#   ├── fr/
#   │   └── LC_MESSAGES/
#   │       └── messages.po
#   └── es/
#       └── LC_MESSAGES/
#           └── messages.po

ai-locale translate "locale/#locale/LC_MESSAGES/messages.po" --source en
```

### Ejemplo 5: Validación y Estadísticas

```bash
# Verificar qué falta
ai-locale validate "locales/#locale/messages.json" --source en

# Mostrar estadísticas
ai-locale stats "locales/#locale/messages.json"

# Previsualizar traducción (dry run)
ai-locale translate "locales/#locale/messages.json" --dry-run --verbose
```

### Ejemplo 6: Purgar Claves Obsoletas

```bash
# Eliminar claves no presentes en inglés
ai-locale purge "locales/#locale/messages.json" --source en

# Previsualizar qué se purgaría
ai-locale purge "translations/#locale/Localizable.strings" --dry-run --verbose

# Purgar con francés como fuente
ai-locale purge "locales/#locale/messages.json" --source fr
```

## Manejo de Errores

El CLI proporciona manejo de errores completo:

- **Archivo No Encontrado**: Mensajes de error claros para patrones inválidos
- **Errores de API**: Manejo elegante de fallos de API de OpenAI
- **Errores de Análisis**: Información de error detallada para problemas de archivos
- **Errores de Validación**: Mensajes claros para solicitudes inválidas

## Solución de Problemas

### Problemas Comunes

1. **Clave API de OpenAI Inválida**

   ```
   Error: Se requiere clave API de OpenAI
   ```

   Solución: Establecer variable de entorno `OPENAI_API_KEY` o usar opción `--api-key`

2. **No Se Encontraron Archivos**

   ```
   Error: No se encontraron archivos de traducción que coincidan con el patrón
   ```

   Solución: Verificar patrón glob y estructura de archivos

3. **Errores de Análisis de Archivo**

   ```
   Error: Falló el análisis del archivo en.ts
   ```

   Solución: Verificar formato de archivo y sintaxis

4. **Errores de Permisos**

   ```
   Error: EACCES: permiso denegado
   ```

   Solución: Verificar permisos de archivo o ejecutar con privilegios apropiados

### Modo Debug

Habilitar salida verbosa para depuración:

```bash
ai-locale translate "locales/#locale/messages.json" --verbose
```

## Contribución

1. Fork el repositorio
2. Crear rama de funcionalidad
3. Hacer cambios
4. Agregar pruebas
5. Enviar pull request

## Licencia

Licencia MIT - ver archivo LICENSE para detalles.

## Soporte

Para problemas y preguntas:

1. Verificar sección de solución de problemas
2. Revisar logs
3. Crear issue con información detallada
4. Incluir ejemplos de archivos y mensajes de error
