# 📦 TRANSFERENCIA DE BODEGA CON ACTUALIZACIÓN DE COMPROMISOS

## 🎯 Función Principal: `transferirItemConCompromisos`

### Descripción
Función profesional que maneja la **transferencia automática de un item de orden de compra** desde su bodega de origen hasta su bodega en proceso, distribuyendo cantidades según asignaciones por proyecto (`itemToProject`) y actualizando los compromisos correspondientes (`cotizacion_compromiso`).

---

## 📋 Flujo Completo

```
1. VALIDAR comprasCotizacionItem existe
2. OBTENER itemToProject (asignaciones por requisición/proyecto)
3. PARA CADA asignación:
   a. Descontar stock de bodega origen (tabla stock)
   b. Sumar stock en bodega destino (tabla stock)
   c. Registrar movimiento (tabla stockMove)
   d. Actualizar compromiso (tabla cotizacion_compromiso)
4. MARCAR item como "entregado"
5. RETORNAR resumen de operación
```

---

## 🏢 Reglas de Bodega

| Tipo | Bodega Origen | Bodega Destino |
|------|---------------|----------------|
| **Materia Prima (MP)** | 1 | 4 (En Proceso) |
| **Producto Terminado (PT)** | 2 | 5 (En Proceso) |

---

## 🔍 Búsqueda de Compromisos

### Para Materia Prima:
```sql
WHERE materiumId = X AND cotizacionId = Y
```

### Para Producto Terminado (NO mt2):
```sql
WHERE productoId = X AND cotizacionId = Y
```

### Para Producto Terminado (CON mt2):
```sql
WHERE productoId = X AND cotizacionId = Y AND medida = "9.00"
```

---

## 📊 Actualización de Estado en Compromiso

| Condición | Estado |
|-----------|--------|
| `cantidadEntregada = 0` | `reservado` |
| `0 < cantidadEntregada < cantidadComprometida` | `parcial` |
| `cantidadEntregada >= cantidadComprometida` | `completo` |

---

## 🚀 Endpoint API

### **POST** `/api/stock/transferir-item`

**Body:**
```json
{
  "comprasCotizacionItemId": 123
}
```

**Response (Éxito):**
```json
{
  "ok": true,
  "itemId": 123,
  "comprasCotizacionId": 45,
  "tipo": "Materia Prima",
  "cantidadTotal": 100.50,
  "bodegaOrigen": 1,
  "bodegaDestino": 4,
  "asignacionesProcesadas": 3,
  "movimientos": [
    {
      "requisicionId": 10,
      "cotizacionId": 5,
      "cantidad": 50.25,
      "stockMoveId": 201
    },
    {
      "requisicionId": 11,
      "cotizacionId": 6,
      "cantidad": 30.00,
      "stockMoveId": 202
    },
    {
      "requisicionId": 12,
      "cotizacionId": 7,
      "cantidad": 20.25,
      "stockMoveId": 203
    }
  ],
  "compromisosActualizados": [
    {
      "compromisoId": 301,
      "cotizacionId": 5,
      "cantidadAgregada": 50.25,
      "cantidadTotal": 50.25,
      "estado": "completo"
    },
    {
      "compromisoId": 302,
      "cotizacionId": 6,
      "cantidadAgregada": 30.00,
      "cantidadTotal": 30.00,
      "estado": "parcial"
    },
    {
      "compromisoId": 303,
      "cotizacionId": 7,
      "cantidadAgregada": 20.25,
      "cantidadTotal": 20.25,
      "estado": "completo"
    }
  ],
  "mensaje": "Se transfirieron 100.50 kg desde bodega 1 a bodega 4 distribuidos en 3 proyecto(s)"
}
```

**Response (Error - Stock Insuficiente):**
```json
{
  "ok": false,
  "msg": "No se pudo descontar de bodega 1: Stock insuficiente. Disponible: 80.00, requerido: 100.50. Verifica que haya stock suficiente.",
  "error": "Error: No se pudo descontar de bodega 1: ..."
}
```

**Response (Error - Sin Asignaciones):**
```json
{
  "ok": false,
  "msg": "El item 123 no tiene asignaciones a proyectos (itemToProject vacío)",
  "error": "Error: El item 123 no tiene asignaciones a proyectos (itemToProject vacío)"
}
```

---

## 🔗 Modelos Involucrados

### 1. **comprasCotizacionItem**
- Tabla: `comprasCotizacionItems`
- Campos relevantes: `id`, `cantidad`, `medida`, `comprasCotizacionId`, `materiaId`, `materiumId`, `productoId`

### 2. **itemToProject**
- Tabla: `itemToProjects`
- Campos relevantes: `id`, `cantidad`, `comprasCotizacionItemId`, `requisicionId`
- Relación: Un `comprasCotizacionItem` tiene varios `itemToProject` (distribución por proyecto)

### 3. **stock**
- Tabla: `stocks`
- Campos relevantes: `id`, `cantidad`, `unidad`, `medida`, `ubicacionId`, `productoId`, `materiumId`, `kitId`
- Función: Mantiene el stock agregado por item y bodega

### 4. **stockMove**
- Tabla: `stockMoves`
- Campos relevantes: `id`, `cantidad`, `tipoMovimiento`, `referenciaDeDocumento`, `bodegaOrigenId`, `bodegaDestinoId`, `comprasCotizacionId`
- Función: Historial detallado de movimientos

### 5. **cotizacion_compromiso**
- Tabla: `cotizacion_compromisos`
- Campos relevantes: `id`, `cantidadComprometida`, `cantidadEntregada`, `estado`, `medida`, `cotizacionId`, `productoId`, `materiumId`
- Función: Control de compromisos por proyecto

---

## 📝 Ejemplo de Uso en Frontend

### Desde el botón "Enviar a producción" en `pedidoItem.jsx`:

```javascript
const enviarAProduccion = async (itemId) => {
  try {
    setLoading(true);
    
    const response = await axios.post('/api/stock/transferir-item', {
      comprasCotizacionItemId: itemId
    });

    if (response.data.ok) {
      alert(`✅ Transferencia exitosa!\n\n` +
            `- Cantidad: ${response.data.cantidadTotal} ${response.data.tipo === 'Materia Prima' ? 'kg/mt/mt2' : 'unidades'}\n` +
            `- Proyectos: ${response.data.asignacionesProcesadas}\n` +
            `- Compromisos actualizados: ${response.data.compromisosActualizados.length}`);
      
      // Recargar datos o actualizar UI
      refetch();
    }
  } catch (error) {
    console.error('Error al transferir:', error);
    const mensaje = error.response?.data?.msg || error.message;
    alert(`❌ Error: ${mensaje}`);
  } finally {
    setLoading(false);
  }
};
```

---

## ⚠️ Validaciones y Errores

### ✅ Validaciones Implementadas:
1. El `comprasCotizacionItem` debe existir
2. Debe tener materia prima o producto asociado
3. Debe tener al menos un `itemToProject` (asignación)
4. Debe haber stock suficiente en la bodega origen
5. La requisición debe tener `cotizacionId` válido

### ❌ Errores Manejados:
- `comprasCotizacionItemId` no proporcionado → 400
- Item no encontrado → 400
- Sin asignaciones a proyectos → 400
- Stock insuficiente en origen → 400
- Compromiso no encontrado → ⚠️ Warning (no bloquea la operación)

---

## 🔐 Transaccionalidad

✅ **Toda la operación es atómica**: Si falla cualquier paso, se revierte TODA la transacción.

```javascript
return await sequelize.transaction(async (t) => {
  // 1. Validar item
  // 2. Obtener asignaciones
  // 3. Para cada asignación:
  //    - Descontar origen (con t)
  //    - Sumar destino (con t)
  //    - Registrar movimiento (con t)
  //    - Actualizar compromiso (con t)
  // 4. Marcar item entregado (con t)
  // Si falla CUALQUIER cosa → ROLLBACK automático
});
```

---

## 🧪 Testing Manual

### Caso 1: Materia Prima Simple

**Setup:**
```sql
-- Crear orden de compra
INSERT INTO "comprasCotizacions" (id, ...) VALUES (100, ...);

-- Crear item
INSERT INTO "comprasCotizacionItems" (id, comprasCotizacionId, materiumId, cantidad) 
VALUES (200, 100, 50, 100.00);

-- Crear stock en bodega 1
INSERT INTO "stocks" (materiumId, ubicacionId, cantidad, unidad) 
VALUES (50, 1, 150.00, 'kg');

-- Crear asignación a proyecto
INSERT INTO "itemToProjects" (comprasCotizacionItemId, requisicionId, cantidad) 
VALUES (200, 10, 100.00);

-- Crear compromiso
INSERT INTO "cotizacion_compromisos" (materiumId, cotizacionId, cantidadComprometida) 
VALUES (50, 5, 100.00);
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/stock/transferir-item \
  -H "Content-Type: application/json" \
  -d '{"comprasCotizacionItemId": 200}'
```

**Resultado Esperado:**
- Stock en bodega 1: `150.00 - 100.00 = 50.00 kg`
- Stock en bodega 4: `0 + 100.00 = 100.00 kg`
- Compromiso: `cantidadEntregada = 100.00`, `estado = 'completo'`
- Item: `entregado = true`

---

### Caso 2: Producto Terminado con mt2

**Setup:**
```sql
-- Item de PT con medida específica
INSERT INTO "comprasCotizacionItems" (id, comprasCotizacionId, productoId, cantidad, medida) 
VALUES (201, 101, 25, 10.00, '9.00');

-- Stock en bodega 2
INSERT INTO "stocks" (productoId, ubicacionId, cantidad, unidad, medida) 
VALUES (25, 2, 20.00, 'mt2', '9.00');

-- Asignación
INSERT INTO "itemToProjects" (comprasCotizacionItemId, requisicionId, cantidad) 
VALUES (201, 15, 10.00);

-- Compromiso con medida
INSERT INTO "cotizacion_compromisos" (productoId, cotizacionId, cantidadComprometida, medida) 
VALUES (25, 8, 10.00, '9.00');
```

**Request:**
```bash
curl -X POST http://localhost:3000/api/stock/transferir-item \
  -H "Content-Type: application/json" \
  -d '{"comprasCotizacionItemId": 201}'
```

**Resultado Esperado:**
- Stock en bodega 2 (medida 9.00): `20.00 - 10.00 = 10.00 mt2`
- Stock en bodega 5 (medida 9.00): `0 + 10.00 = 10.00 mt2`
- Compromiso (medida 9.00): `cantidadEntregada = 10.00`, `estado = 'completo'`

---

## 🎓 Notas Técnicas

### Diferencias con otros sistemas:
- ❌ **NO usa** `inventarioItemFisico` (piezas físicas individuales)
- ✅ **USA** `stock` (agregado) + `stockMove` (historial)
- ✅ Soporte nativo para **mt2 con medidas específicas**
- ✅ **Transaccional** y **atómico**

### Arquitectura:
```
Controller (stock.js)
    ↓
Service (stockServices.js)
    ↓
Models (stock, stockMove, cotizacion_compromiso)
```

### Reutilización:
Las funciones auxiliares `createOrUpdateStockIngreso` y `createOrUpdateStockSalida` aceptan transacciones externas, lo que permite:
- Usarlas de forma independiente (crean su propia transacción)
- Usarlas dentro de una transacción mayor (como `transferirItemConCompromisos`)

---

## 📞 Soporte

Para dudas o problemas:
1. Revisar logs del servidor con prefijo `[TRANSFERENCIA]`
2. Verificar que todas las relaciones en `db.js` estén correctas
3. Validar que `itemToProject` tenga registros
4. Confirmar que `requisicion.cotizacionId` existe

---

**Creado por:** Cursor AI Assistant  
**Fecha:** 2026-02-15  
**Versión:** 1.0.0
