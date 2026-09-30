---
name: nextjs
description: Reglas, límites de App Router, rendimiento y flujo de trabajo para el desarrollo con Next.js. Usar al crear o modificar páginas, rutas, Server Actions o componentes.
---

# Next.js Guidelines

Estas reglas aplican cuando el proyecto utiliza Next.js App Router. Sigue la versión instalada en el proyecto en lugar de asumir APIs de versiones diferentes.

## App Router

- Mantén el renderizado en el servidor (Server Components) por defecto.

- Agrega `"use client"` únicamente cuando sea estrictamente necesario por APIs del navegador, estado interactivo, efectos o manejadores de eventos.

- Mantén los Route Handlers enfocados en aspectos HTTP y mueve la lógica de dominio reutilizable a módulos dedicados.

- Sigue las convenciones establecidas en el proyecto para páginas, layouts, estados de carga, manejo de errores, metadatos y organización de rutas.

- Evita duplicar la obtención de datos en el servidor a través de múltiples componentes cuando un límite compartido pueda proveerlos limpiamente.

## Límite de Seguridad y Entorno (Boundaries)

- No expongas secretos, módulos exclusivos del servidor o privilegios administrativos a Client Components.

- Valida todas las entradas no confiables en los límites del servidor (Route Handlers, Server Actions e integraciones externas).

- Mantén el acceso a variables de entorno centralizado según la estrategia de configuración del proyecto.

## Rendimiento

- Prioriza el trabajo en el servidor cuando evite enviar JavaScript innecesario al cliente.

- Optimiza imágenes y fuentes usando los componentes nativos soportados por el framework.

- No agregues configuración de almacenamiento en caché, memorización o renderizado dinámico sin comprender previamente el comportamiento que modifica.

## Flujo de Trabajo para Nuevas Funcionalidades

1. Lee la documentación relevante en `doc/` antes de escribir código.

2. Identifica el límite correcto dentro de App Router antes de la implementación.

3. Prioriza Server Components y el acceso a datos desde el servidor.

4. Introduce `"use client"` únicamente para comportamientos que requieran interacción en el navegador.

5. Valida datos externos usando el esquema de validación existente (ej. Zod).

6. Reutiliza componentes, Server Actions, modelos y utilidades existentes antes de crear nuevas abstracciones.

7. Agrega pruebas al nivel más pequeño y útil posible.

8. Ejecuta la validación mínima relevante y amplíala si los cambios afectan otras áreas del sistema.