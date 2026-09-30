---
name: tailwind
description: Reglas y flujo de trabajo para maquetación, componentes y diseño UI usando Tailwind CSS, Shadcn UI y Class Variance Authority (cva). Usar al crear, modificar o aplicar estilos a componentes visuales.
---

# Tailwind CSS and Styling Guidelines

Utiliza el sistema de estilos ya establecido en el proyecto. Prioriza el uso de clases utilitarias de Tailwind y componentes compartidos antes que estilos personalizados o puntuales (*one-off*).

## Reglas Generales

- Mantén la consistencia visual con el sistema de diseño existente antes de introducir nuevos patrones.
- Prioriza las utilidades de Tailwind para el diseño a nivel de componente.
- Reutiliza primitivas e interfaces UI compartidas en lugar de duplicar listas extensas de clases.
- Mantén el comportamiento responsivo con enfoque *mobile-first*.
- Prioriza HTML semántico y estados accesibles antes de aplicarles diseño.
- Evita valores arbitrarios (ej. `bg-[#123456]`) cuando un *token* del sistema o una utilidad existente exprese la misma intención (ej. `bg-primary`).
- No introduzcas un segundo sistema de estilos sin un requerimiento técnico explícito.

## Componentes y Variantes

- Extrae patrones visuales complejos o repetidos hacia componentes reutilizables o variantes con `cva` (Class Variance Authority).
- Mantén las variantes visuales tipadas de forma explícita mediante TypeScript.
- Preserva las convenciones existentes de modo oscuro (`dark:`), temas, animaciones y accesibilidad al modificar componentes compartidos.

## Flujo de Trabajo (Workflow)

1. **Revisión previa:** Consulta los componentes existentes en `src/components/ui/` (Shadcn UI / Radix) antes de crear nuevos elementos.
2. **Tokens y variables:** Inspecciona `src/styles/global.css` y la configuración de Tailwind para identificar variables CSS y tokens del sistema.
3. **Aplicación:** Aplica las convenciones de diseño e interfaz del proyecto.

## Reglas de Estilizado

- **Mobile-first:** Diseña por defecto para pantallas pequeñas y aplica modificadores responsivos hacia arriba (`sm:`, `md:`, `lg:`).
- **Tokens del sistema:** Usa variables semánticas (`bg-zinc-900`, `text-muted-foreground`, `bg-primary`).
- **Estados accesibles:** Asegura estados explícitos para `:hover`, `:focus-visible`, `:active` y `dark:`.
- **Animaciones y transiciones:** Asegura duraciones explícitas de transición (`transition-colors duration-200`) en elementos interactivos o animados.
- **Atributos A11y:** Incluye anillos de enfoque (`focus-ring`), etiquetas de accesibilidad (`aria-label`) y roles semánticos donde corresponda.