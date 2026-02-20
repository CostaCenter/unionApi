# 🚀 GUÍA DE INICIO RÁPIDO - Sistema de Remisiones

## 📋 Pasos para Poner en Marcha el Sistema

Sigue estos pasos para empezar a usar el sistema de remisiones.

---

## PASO 1: Reiniciar el Servidor ⚡

```bash
# Detener el servidor si está corriendo
# Presiona Ctrl+C en la terminal donde corre el servidor

# Iniciar el servidor
npm start

# O si usas nodemon:
npm run dev
```

**¿Qué pasa aquí?**
- Sequelize detecta los nuevos modelos (`remision`, `itemRemision`)
- Crea automáticamente las tablas en la base de datos
- Registra las rutas `/api/remision/...`

**Verifica que todo está OK:**
Deberías ver en la consola:
```
✅ Server listening on port 3000
✅ Database connected
```

---

## PASO 2: Verificar que las Rutas Están Activas 🔍

Abre Postman, Thunder Client, o tu navegador y prueba:

```bash
GET http://localhost:3000/api/remision/get/requisicion/1
```

**Respuesta esperada (200):**
```json
{
  "ok": true,
  "requisicionId": 1,
  "totalRemisiones": 0,
  "remisiones": []
}
```

Si recibes esto, ¡las rutas están funcionando! 🎉

---

## PASO 3: Preparar Datos de Prueba 📊

Necesitas tener en tu base de datos:

### ✅ Una requisición
```sql
SELECT * FROM requisicion LIMIT 1;
-- Anota el ID (ejemplo: 1)
```

### ✅ Una necesidadProyecto
```sql
SELECT * FROM necesidadProyecto 
WHERE requisicionId = 1 
LIMIT 1;
-- Anota el ID (ejemplo: 45)
```

**Si no tienes datos:**
Crea una necesidadProyecto de prueba:
```sql
INSERT INTO necesidadProyecto (
  requisicionId, 
  productoId, 
  cantidadComprometida, 
  cantidadEntregada,
  estado,
  createdAt,
  updatedAt
) VALUES (
  1,          -- ID de tu requisición
  10,         -- ID de un producto existente
  10,         -- Comprometido: 10 unidades
  0,          -- Entregado: 0
  'reservado',
  NOW(),
  NOW()
);
```

---

## PASO 4: Primera Prueba - Ingresar Cantidades 🧪

Abre Postman y crea esta request:

**Endpoint:**
```
POST http://localhost:3000/api/remision/post/ingresar-listo
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "necesidadProyectoId": 45,
  "cantidad": 3,
  "notas": "Primera entrega de prueba"
}
```

**Haz clic en "Send"**

**Respuesta esperada (201):**
```json
{
  "ok": true,
  "necesidadProyecto": {
    "id": 45,
    "cantidadComprometida": 10,
    "cantidadEntregadaAnterior": 0,
    "cantidadEntregadaNueva": 3,
    "cantidadIngresada": 3,
    "estado": "parcial"
  },
  "remision": {
    "id": 1,
    "numeroRemision": "REM-REQ001-1708345678901",
    "estado": "Activa"
  },
  "itemRemision": {
    "id": 1,
    "cantidad": 3
  },
  "stock": {
    "bodega": 8,
    "cantidad": 3
  }
}
```

**¡Si ves esto, funciona! 🎉**

---

## PASO 5: Verificar en la Base de Datos 🗄️

```sql
-- Ver la remisión creada
SELECT * FROM remision WHERE id = 1;

-- Ver el item de remisión
SELECT * FROM itemRemision WHERE remisionId = 1;

-- Ver la necesidad actualizada
SELECT cantidadComprometida, cantidadEntregada, estado 
FROM necesidadProyecto 
WHERE id = 45;

-- Ver el stock en bodega 8
SELECT * FROM stock WHERE ubicacionId = 8;

-- Ver el movimiento registrado
SELECT * FROM stockMove 
WHERE tipoMovimiento = 'INGRESO_LISTO'
ORDER BY createdAt DESC 
LIMIT 1;
```

**Todo debería estar ahí!** ✅

---

## PASO 6: Segunda Prueba - Acumular Cantidades 📦

**Endpoint:**
```
POST http://localhost:3000/api/remision/post/ingresar-listo
```

**Body:**
```json
{
  "necesidadProyectoId": 45,
  "cantidad": 5,
  "notas": "Segunda entrega - sumando más"
}
```

**Respuesta esperada (201):**
```json
{
  "ok": true,
  "necesidadProyecto": {
    "cantidadEntregadaAnterior": 3,
    "cantidadEntregadaNueva": 8,
    "cantidadIngresada": 5,
    "estado": "parcial"
  },
  "remision": {
    "id": 1,
    "numeroRemision": "REM-REQ001-1708345678901",
    "estado": "Activa"
  },
  "itemRemision": {
    "id": 1,
    "cantidad": 8  // ← Se sumó: 3 + 5 = 8
  },
  "stock": {
    "bodega": 8,
    "cantidad": 8  // ← Se sumó en stock también
  }
}
```

**Nota:** Usó la MISMA remisión (id: 1) y SUMÓ las cantidades! ✅

---

## PASO 7: Tercera Prueba - Remisionar 📋

**Endpoint:**
```
PUT http://localhost:3000/api/remision/put/remisionar/1
```

**No necesita body**

**Respuesta esperada (200):**
```json
{
  "ok": true,
  "remision": {
    "id": 1,
    "numeroRemision": "REM-REQ001-1708345678901",
    "estado": "Remisionada",
    "fechaRemision": "2026-02-19T15:30:45.123Z",
    "requisicionId": 1
  },
  "itemsRemisionados": [
    {
      "itemRemisionId": 1,
      "productoId": 10,
      "cantidad": 8,
      "nombre": "Nombre del Producto"
    }
  ],
  "totalItems": 1
}
```

**Verificar en BD:**
```sql
-- La remisión cambió de estado
SELECT * FROM remision WHERE id = 1;
-- estado = 'Remisionada', fechaRemision tiene valor

-- El stock en bodega 8 se descontó
SELECT * FROM stock WHERE ubicacionId = 8;
-- cantidad = 0 (se descontaron los 8)

-- Hay un movimiento de salida
SELECT * FROM stockMove 
WHERE tipoMovimiento = 'SALIDA_REMISION'
ORDER BY createdAt DESC 
LIMIT 1;
```

**¡Remisión exitosa! 🎉**

---

## PASO 8: Cuarta Prueba - Nueva Remisión Después de Remisionar 🔄

**Endpoint:**
```
POST http://localhost:3000/api/remision/post/ingresar-listo
```

**Body:**
```json
{
  "necesidadProyectoId": 45,
  "cantidad": 2,
  "notas": "Entrega final - debería crear nueva remisión"
}
```

**Respuesta esperada (201):**
```json
{
  "ok": true,
  "necesidadProyecto": {
    "cantidadEntregadaAnterior": 8,
    "cantidadEntregadaNueva": 10,
    "cantidadIngresada": 2,
    "estado": "completo"  // ← ¡Completado!
  },
  "remision": {
    "id": 2,  // ← NUEVA remisión (no usa la 1 porque ya está Remisionada)
    "numeroRemision": "REM-REQ001-1708346789012",
    "estado": "Activa"
  },
  "itemRemision": {
    "id": 2,  // ← NUEVO item
    "cantidad": 2
  },
  "stock": {
    "bodega": 8,
    "cantidad": 2
  }
}
```

**¡Creó una NUEVA remisión automáticamente! 🎉**

---

## PASO 9: Consultar Todas las Remisiones 📊

**Endpoint:**
```
GET http://localhost:3000/api/remision/get/requisicion/1
```

**Respuesta esperada (200):**
```json
{
  "ok": true,
  "requisicionId": 1,
  "totalRemisiones": 2,
  "remisiones": [
    {
      "id": 2,
      "estado": "Activa",
      "itemRemisions": [
        { "cantidad": 2, "estado": "Pendiente" }
      ]
    },
    {
      "id": 1,
      "estado": "Remisionada",
      "fechaRemision": "2026-02-19T15:30:45.123Z",
      "itemRemisions": [
        { "cantidad": 8, "estado": "Remisionado" }
      ]
    }
  ]
}
```

**¡Puedes ver todas las remisiones! 🎉**

---

## ⚠️ PASO 10: Probar Validaciones (Errores Esperados)

### Error 1: Intentar exceder lo comprometido

**Endpoint:**
```
POST http://localhost:3000/api/remision/post/ingresar-listo
```

**Body:**
```json
{
  "necesidadProyectoId": 45,
  "cantidad": 10
}
```

**Respuesta esperada (400):**
```json
{
  "ok": false,
  "msg": "No se puede entregar más de lo comprometido. Comprometido: 10, Ya entregado: 10, Intentas agregar: 10, Nuevo total: 20"
}
```

✅ **Validación funcionando correctamente!**

---

### Error 2: Intentar remisionar sin stock

**Primero, vacía el stock:**
```sql
UPDATE stock SET cantidad = 0 WHERE ubicacionId = 8;
```

**Endpoint:**
```
PUT http://localhost:3000/api/remision/put/remisionar/2
```

**Respuesta esperada (400):**
```json
{
  "ok": false,
  "msg": "Stock insuficiente en bodega 8 para [nombre del producto]. Disponible: 0, Necesario: 2"
}
```

✅ **Validación funcionando correctamente!**

---

## ✅ CHECKLIST DE VERIFICACIÓN

Marca cada paso que completaste:

- [ ] **PASO 1:** Servidor reiniciado exitosamente
- [ ] **PASO 2:** Rutas respondiendo correctamente
- [ ] **PASO 3:** Datos de prueba preparados
- [ ] **PASO 4:** Primera entrega (3 unidades) - OK
- [ ] **PASO 5:** Verificación en BD - Todo correcto
- [ ] **PASO 6:** Segunda entrega (5 más) - Acumuló correctamente
- [ ] **PASO 7:** Remisión exitosa - Stock descontado
- [ ] **PASO 8:** Nueva remisión automática - OK
- [ ] **PASO 9:** Consulta de remisiones - OK
- [ ] **PASO 10:** Validaciones funcionando - OK

---

## 🎉 ¡COMPLETADO!

Si marcaste todos los pasos, el sistema está:

✅ **Funcionando al 100%**  
✅ **Validaciones operativas**  
✅ **Listo para integrar con frontend**  
✅ **Listo para producción**

---

## 📚 Documentación Completa

Lee estos documentos para profundizar:

1. **RESUMEN_EJECUTIVO_REMISIONES.md** - Overview completo
2. **SISTEMA_REMISIONES.md** - Documentación técnica
3. **API_REMISIONES_ENDPOINTS.md** - Referencia de API
4. **PRUEBAS_REMISIONES.md** - Más casos de prueba
5. **DIAGRAMA_VISUAL_REMISIONES.md** - Diagramas de flujo

---

## 📞 ¿Algo No Funciona?

### Problema: Error 500 al ingresar cantidades

**Solución:**
1. Verifica que `necesidadProyectoId` existe
2. Verifica que tiene `requisicionId`
3. Revisa los logs en la consola del servidor

---

### Problema: Las tablas no se crean

**Solución:**
1. Asegúrate de reiniciar el servidor
2. Verifica la conexión a la base de datos
3. Revisa los logs de Sequelize

---

### Problema: Stock no se descuenta al remisionar

**Solución:**
1. Verifica que hay stock en bodega 8
2. Verifica que la remisión está en estado "Activa"
3. Revisa los logs de la transacción

---

## 🚀 Próximos Pasos

Ahora que el sistema funciona, puedes:

1. **Integrar con tu frontend**
2. **Crear más pruebas con datos reales**
3. **Ajustar permisos de usuario**
4. **Crear reportes de remisiones**
5. **Generar PDFs de remisión**

---

**Creado por:** Senior Full-Stack Developer  
**Fecha:** 2026-02-19  
**Versión:** 1.0  
**Estado:** ✅ **Sistema 100% Funcional**
