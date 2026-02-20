# 🧪 Pruebas del Sistema de Remisiones

## 📋 Preparación

### Base de datos
Asegúrate de que tienes:
- ✅ Tabla `remision` creada
- ✅ Tabla `itemRemision` creada
- ✅ Relaciones configuradas
- ✅ Datos de prueba en `necesidadProyecto`, `requisicion`, `producto`, `kit`

### Datos de ejemplo
```sql
-- Requisición de prueba
INSERT INTO requisicion (folio, ...) VALUES ('REQ-TEST-001', ...);

-- Necesidad de proyecto (ejemplo: 10 pedestales comprometidos)
INSERT INTO necesidadProyecto (
  requisicionId, 
  productoId, 
  cantidadComprometida, 
  cantidadEntregada,
  estado
) VALUES (
  1,  -- ID de requisición
  10, -- ID de producto
  10, -- Comprometido: 10 unidades
  0,  -- Entregado: 0
  'reservado'
);
```

---

## 🧪 Casos de Prueba

### ✅ CASO 1: Ingresar primera entrega parcial

**Objetivo:** Ingresar 3 pedestales de 10 comprometidos

**Request:**
```bash
POST http://localhost:3000/api/remision/post/ingresar-listo
Content-Type: application/json

{
  "necesidadProyectoId": 1,
  "cantidad": 3,
  "notas": "Primera entrega de pedestales - Corte completado"
}
```

**Respuesta esperada (201):**
```json
{
  "ok": true,
  "necesidadProyecto": {
    "id": 1,
    "cantidadComprometida": 10,
    "cantidadEntregadaAnterior": 0,
    "cantidadEntregadaNueva": 3,
    "cantidadIngresada": 3,
    "estado": "parcial"
  },
  "remision": {
    "id": 1,
    "numeroRemision": "REM-REQ-TEST-001-1708345678901",
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

**Validaciones:**
- ✅ `necesidadProyecto.cantidadEntregada` = 3
- ✅ `necesidadProyecto.estado` = "parcial"
- ✅ Se creó remisión con estado "Activa"
- ✅ Se creó itemRemision con cantidad 3
- ✅ Stock en bodega 8 = 3
- ✅ Se creó stockMove tipo "INGRESO_LISTO"

---

### ✅ CASO 2: Ingresar segunda entrega (acumular en misma remisión)

**Objetivo:** Ingresar 5 pedestales más (total 8 de 10)

**Request:**
```bash
POST http://localhost:3000/api/remision/post/ingresar-listo
Content-Type: application/json

{
  "necesidadProyectoId": 1,
  "cantidad": 5,
  "notas": "Segunda entrega - Tubería completada"
}
```

**Respuesta esperada (201):**
```json
{
  "ok": true,
  "necesidadProyecto": {
    "id": 1,
    "cantidadComprometida": 10,
    "cantidadEntregadaAnterior": 3,
    "cantidadEntregadaNueva": 8,
    "cantidadIngresada": 5,
    "estado": "parcial"
  },
  "remision": {
    "id": 1,
    "numeroRemision": "REM-REQ-TEST-001-1708345678901",
    "estado": "Activa"
  },
  "itemRemision": {
    "id": 1,
    "cantidad": 8
  },
  "stock": {
    "bodega": 8,
    "cantidad": 8
  }
}
```

**Validaciones:**
- ✅ `necesidadProyecto.cantidadEntregada` = 8 (acumulado)
- ✅ `necesidadProyecto.estado` = "parcial" (8 < 10)
- ✅ Se usó la MISMA remisión (id: 1, estado "Activa")
- ✅ Se actualizó itemRemision: cantidad 3 → 8
- ✅ Stock en bodega 8 = 8 (acumulado)
- ✅ Se creó nuevo stockMove

---

### ✅ CASO 3: Consultar remisiones de la requisición

**Request:**
```bash
GET http://localhost:3000/api/remision/get/requisicion/1
```

**Respuesta esperada (200):**
```json
{
  "ok": true,
  "requisicionId": 1,
  "totalRemisiones": 1,
  "remisiones": [
    {
      "id": 1,
      "numeroRemision": "REM-REQ-TEST-001-1708345678901",
      "estado": "Activa",
      "fechaRemision": null,
      "requisicion": {
        "id": 1,
        "folio": "REQ-TEST-001"
      },
      "itemRemisions": [
        {
          "id": 1,
          "cantidad": 8,
          "estado": "Pendiente",
          "producto": {
            "id": 10,
            "item": "Pedestal Ejecutivo"
          },
          "necesidadProyecto": {
            "id": 1,
            "cantidadComprometida": 10,
            "cantidadEntregada": 8,
            "estado": "parcial"
          }
        }
      ]
    }
  ]
}
```

---

### ✅ CASO 4: Remisionar documento

**Objetivo:** Cambiar estado a "Remisionada" y hacer salida de inventario

**Request:**
```bash
PUT http://localhost:3000/api/remision/put/remisionar/1
```

**Respuesta esperada (200):**
```json
{
  "ok": true,
  "remision": {
    "id": 1,
    "numeroRemision": "REM-REQ-TEST-001-1708345678901",
    "estado": "Remisionada",
    "fechaRemision": "2026-02-19T15:30:45.123Z",
    "requisicionId": 1,
    "folio": "REQ-TEST-001"
  },
  "itemsRemisionados": [
    {
      "itemRemisionId": 1,
      "productoId": 10,
      "kitId": null,
      "cantidad": 8,
      "nombre": "Pedestal Ejecutivo"
    }
  ],
  "totalItems": 1
}
```

**Validaciones:**
- ✅ `remision.estado` = "Remisionada"
- ✅ `remision.fechaRemision` = NOW()
- ✅ Stock en bodega 8 descontado: 8 → 0
- ✅ Se creó stockMove tipo "SALIDA_REMISION"
- ✅ `itemRemision.estado` = "Remisionado"

---

### ✅ CASO 5: Ingresar entrega final (después de remisionar)

**Objetivo:** Completar los últimos 2 pedestales (total 10)

**Request:**
```bash
POST http://localhost:3000/api/remision/post/ingresar-listo
Content-Type: application/json

{
  "necesidadProyectoId": 1,
  "cantidad": 2,
  "notas": "Entrega final - Completado"
}
```

**Respuesta esperada (201):**
```json
{
  "ok": true,
  "necesidadProyecto": {
    "id": 1,
    "cantidadComprometida": 10,
    "cantidadEntregadaAnterior": 8,
    "cantidadEntregadaNueva": 10,
    "cantidadIngresada": 2,
    "estado": "completo"
  },
  "remision": {
    "id": 2,
    "numeroRemision": "REM-REQ-TEST-001-1708346789012",
    "estado": "Activa"
  },
  "itemRemision": {
    "id": 2,
    "cantidad": 2
  },
  "stock": {
    "bodega": 8,
    "cantidad": 2
  }
}
```

**Validaciones:**
- ✅ `necesidadProyecto.cantidadEntregada` = 10
- ✅ `necesidadProyecto.estado` = "completo" (10 === 10)
- ✅ Se creó NUEVA remisión (id: 2) porque la anterior ya estaba Remisionada
- ✅ Se creó nuevo itemRemision (id: 2)
- ✅ Stock en bodega 8 = 2

---

### ❌ CASO 6: ERROR - Intentar entregar más de lo comprometido

**Objetivo:** Intentar ingresar 5 unidades cuando solo faltan 2

**Request:**
```bash
POST http://localhost:3000/api/remision/post/ingresar-listo
Content-Type: application/json

{
  "necesidadProyectoId": 1,
  "cantidad": 5
}
```

**Respuesta esperada (400):**
```json
{
  "ok": false,
  "msg": "No se puede entregar más de lo comprometido. Comprometido: 10, Ya entregado: 8, Intentas agregar: 5, Nuevo total: 13"
}
```

**Validaciones:**
- ✅ Transacción hace ROLLBACK
- ✅ No se modifica `necesidadProyecto`
- ✅ No se crea remisión ni item
- ✅ No se modifica stock

---

### ❌ CASO 7: ERROR - Intentar remisionar sin stock suficiente

**Objetivo:** Simular falta de stock en bodega 8

**Setup:**
```sql
-- Supongamos que itemRemision tiene cantidad: 10
-- Pero stock en bodega 8 solo tiene: 5
```

**Request:**
```bash
PUT http://localhost:3000/api/remision/put/remisionar/1
```

**Respuesta esperada (400):**
```json
{
  "ok": false,
  "msg": "Stock insuficiente en bodega 8 para Pedestal Ejecutivo. Disponible: 5, Necesario: 10"
}
```

**Validaciones:**
- ✅ Transacción hace ROLLBACK completo
- ✅ `remision.estado` sigue siendo "Activa"
- ✅ Stock NO se modifica
- ✅ No se crean stockMoves

---

### ❌ CASO 8: ERROR - Intentar remisionar una remisión ya remisionada

**Request:**
```bash
PUT http://localhost:3000/api/remision/put/remisionar/1
# (ya fue remisionada en CASO 4)
```

**Respuesta esperada (400):**
```json
{
  "ok": false,
  "msg": "La remisión REM-REQ-TEST-001-1708345678901 no está Activa (estado actual: Remisionada)"
}
```

**Validaciones:**
- ✅ No se puede remisionar dos veces
- ✅ Estado permanece "Remisionada"

---

### ❌ CASO 9: ERROR - necesidadProyectoId no existe

**Request:**
```bash
POST http://localhost:3000/api/remision/post/ingresar-listo
Content-Type: application/json

{
  "necesidadProyectoId": 99999,
  "cantidad": 5
}
```

**Respuesta esperada (400):**
```json
{
  "ok": false,
  "msg": "necesidadProyecto con ID 99999 no encontrado"
}
```

---

### ❌ CASO 10: ERROR - Cantidad inválida

**Request:**
```bash
POST http://localhost:3000/api/remision/post/ingresar-listo
Content-Type: application/json

{
  "necesidadProyectoId": 1,
  "cantidad": 0
}
```

**Respuesta esperada (400):**
```json
{
  "ok": false,
  "msg": "cantidad debe ser mayor a 0"
}
```

---

## 🔄 Flujo Completo de Prueba

### 1. Limpiar datos previos
```sql
DELETE FROM itemRemision;
DELETE FROM remision;
DELETE FROM stockMove WHERE tipoMovimiento IN ('INGRESO_LISTO', 'SALIDA_REMISION');
DELETE FROM stock WHERE ubicacionId = 8;
UPDATE necesidadProyecto SET cantidadEntregada = 0, estado = 'reservado' WHERE id = 1;
```

### 2. Ejecutar pruebas en orden
```bash
# CASO 1: Primera entrega (3 de 10)
POST /api/remision/post/ingresar-listo
{ "necesidadProyectoId": 1, "cantidad": 3 }

# CASO 2: Segunda entrega (5 más, total 8)
POST /api/remision/post/ingresar-listo
{ "necesidadProyectoId": 1, "cantidad": 5 }

# CASO 3: Consultar remisiones
GET /api/remision/get/requisicion/1

# CASO 4: Remisionar
PUT /api/remision/put/remisionar/1

# CASO 5: Entrega final (2 más, total 10)
POST /api/remision/post/ingresar-listo
{ "necesidadProyectoId": 1, "cantidad": 2 }

# CASO 6: Intentar exceder (ERROR)
POST /api/remision/post/ingresar-listo
{ "necesidadProyectoId": 1, "cantidad": 5 }

# CASO 8: Intentar remisionar dos veces (ERROR)
PUT /api/remision/put/remisionar/1
```

### 3. Verificar en base de datos
```sql
-- Ver remisiones
SELECT * FROM remision WHERE requisicionId = 1;
-- Debe haber 2 remisiones: una "Remisionada" y otra "Activa"

-- Ver items de remisión
SELECT * FROM itemRemision WHERE remisionId IN (1, 2);

-- Ver necesidad actualizada
SELECT cantidadComprometida, cantidadEntregada, estado 
FROM necesidadProyecto WHERE id = 1;
-- cantidadEntregada = 10, estado = 'completo'

-- Ver stock en bodega 8
SELECT * FROM stock WHERE ubicacionId = 8;
-- cantidad = 2 (los últimos 2 que ingresaron)

-- Ver movimientos
SELECT * FROM stockMove 
WHERE tipoMovimiento IN ('INGRESO_LISTO', 'SALIDA_REMISION')
ORDER BY createdAt DESC;
```

---

## 🎯 Checklist de Validaciones

### ✅ Transaccionalidad
- [ ] Si falla algo → ROLLBACK completo
- [ ] No hay datos parciales en BD

### ✅ Validaciones de negocio
- [ ] No se puede entregar más de lo comprometido
- [ ] No pueden existir 2 remisiones Activas por requisición
- [ ] No se puede remisionar sin stock suficiente
- [ ] Estado de necesidadProyecto actualiza correctamente

### ✅ Integridad de datos
- [ ] Stock se actualiza correctamente
- [ ] StockMove registra todos los movimientos
- [ ] itemRemision acumula cantidades correctamente
- [ ] Remisión cambia de estado correctamente

### ✅ Logs
- [ ] Console logs informativos en cada paso
- [ ] Errores descriptivos

---

## 📊 Resultado Esperado Final

Después de ejecutar todos los casos exitosos:

```
necesidadProyecto (id: 1):
  cantidadComprometida: 10
  cantidadEntregada: 10
  estado: "completo"

remision:
  - id: 1, estado: "Remisionada", items: 8 unidades
  - id: 2, estado: "Activa", items: 2 unidades

stock (bodega 8):
  cantidad: 2 (los últimos 2 ingresados)

stockMove:
  - INGRESO_LISTO: +3
  - INGRESO_LISTO: +5
  - SALIDA_REMISION: -8
  - INGRESO_LISTO: +2
```

---

**Autor:** Sistema de Pruebas de Remisiones  
**Fecha:** 2026-02-19
