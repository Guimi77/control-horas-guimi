# Control Horas Guimi

Aplicación web sencilla para controlar horas extra y horas a descontar.

## Funciones

- Calendario perpetuo, sin depender de un año concreto.
- Histórico inicial importado de la hoja Control Horas Guimi de 2026.
- Saldo total, anual, mensual y semanal.
- Alta, edición y borrado de movimientos.
- Varias imputaciones en un mismo día.
- Persistencia local en el navegador.
- Exportación e importación de copias de seguridad JSON.
- Diseño adaptable a móvil y escritorio.

## Publicación

La aplicación es estática y está preparada para GitHub Pages. El punto de entrada es `index.html`.

## Datos

Los datos personales añadidos posteriormente no se suben al repositorio: se almacenan en `localStorage` del navegador. Para evitar pérdidas, conviene exportar copias de seguridad periódicamente.
