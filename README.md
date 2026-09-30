# Farmacias Municipales de San Carlos

Demo web del sistema de inventario, ventas y entregas SUS para las seis farmacias municipales de San Carlos, Santa Cruz, Bolivia.

## Funciones incluidas

- Panel consolidado de las seis sucursales.
- Inventario por medicamento, lote, sucursal y fecha de vencimiento.
- Semáforo de vencimientos: rojo hasta 3 meses, amarillo hasta 6 meses y verde para lotes vigentes.
- Ventas normales y entregas gratuitas mediante SUS.
- Margen de ganancia personalizable y visible únicamente en la vista de administrador.
- Ingreso de medicamentos limitado a administrador y técnico.
- Usuarios y roles administrables desde la vista de administrador.
- Centro de control con auditoría detallada de ventas, SUS e ingresos de lotes, además de exportación compatible con Excel.
- Persistencia compartida automática mediante un almacén JSON en la nube, con respaldo local si el dispositivo pierde conexión.

## Ejecutar localmente

No necesita compilación ni dependencias. Puede abrirse con cualquier servidor web estático:

```bash
npx serve .
```

## Publicar en Vercel

1. Subir esta carpeta a un repositorio de GitHub.
2. Importar el repositorio desde Vercel.
3. Elegir `Other` como framework. No se requiere comando de compilación.
4. Publicar. El archivo `vercel.json` ya incluye la ruta de respaldo de la aplicación.

## Alcance de esta demo

La demo sincroniza un único estado JSON compartido para que distintos dispositivos puedan registrar y consultar cambios sin configurar una base de datos. También conserva una copia en `localStorage` como respaldo. Este mecanismo es apropiado para demostraciones con datos ficticios; la etapa de producción debe usar autenticación y una base de datos transaccional. Véase [docs/modelo-datos.md](docs/modelo-datos.md).
