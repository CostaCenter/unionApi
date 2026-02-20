# 🗄️ Modelo de Datos - Sistema de Remisiones

## 📊 Diagrama de Relaciones

```
┌──────────────────┐
│   requisicion    │
│ ─────────────── │
│ id (PK)          │
│ folio            │
│ ...              │
└────────┬─────────┘
         │
         │ 1:N
         │
┌────────▼─────────┐         ┌──────────────────┐
│ necesidadProyecto│◄────────│   remision       │
│ ───────────────  │  N:1    │ ──────────────── │
│ id (PK)          │         │ id (PK)          │
│ requisicionId FK │         │ numeroRemision   │
│ productoId FK    │         │ estado ENUM      │
│ kitId FK         │         │ fechaRemision    │
│ cantidadCompr... │         │ observaciones    │
│ cantidadEntreg...│         │ usuarioId FK     │
│ estado ENUM      │         │ requisicionId FK │
│ medida           │         └────────┬─────────┘
└──────────────────┘                  │
         │                            │ 1:N
         │                            │
         │ N:1              ┌─────────▼─────────┐
         └──────────────────┤  itemRemision     │
                            │ ───────────────── │
┌──────────────────┐        │ id (PK)           │
│    producto      │◄───────┤ cantidad          │
│ ──────────────── │  N:1   │ medida            │
│ id (PK)          │        │ estado ENUM       │
│ item             │        │ notas             │
│ unidad           │        │ remisionId FK     │
│ ...              │        │ necesidadProye... │
└──────────────────┘        │ productoId FK     │
                            │ kitId FK          │
┌──────────────────┐        └───────────────────┘
│       kit        │
│ ──────────────── │
│ id (PK)          │◄───────────────┘
│ description      │
│ ...              │
└──────────────────┘

┌──────────────────┐
│      stock       │
│ ──────────────── │
│ id (PK)          │
│ cantidad         │
│ ubicacionId FK   │◄─── Bodega 8 (Listo)
│ productoId FK    │
│ kitId FK         │
│ medida           │
│ state            │
└────────┬─────────┘
         │
         │ 1:N
         │
┌────────▼─────────┐
│    stockMove     │
│ ───────────────  │
│ id (PK)          │
│ cantidad         │
│ tipoMovimiento   │◄─── INGRESO_LISTO / SALIDA_REMISION
│ referenciaDeDoc..│
│ notas            │
│ bodegaOrigenId   │
│ bodegaDestinoId  │
│ stockId FK       │
│ productoId FK    │
│ kitId FK         │
└──────────────────┘
```

---

## 📋 Tablas Detalladas

### **remision**

| Campo             | Tipo                                      | Descripción                                    |
|-------------------|-------------------------------------------|------------------------------------------------|
| `id`              | INTEGER (PK)                              | ID único de la remisión                        |
| `numeroRemision`  | STRING (UNIQUE)                           | Número generado: `REM-{folio}-{timestamp}`    |
| `estado`          | ENUM('Activa', 'Remisionada', 'Cancelada')| Estado actual de la remisión                   |
| `fechaRemision`   | DATE (nullable)                           | Fecha cuando se remisionó                      |
| `observaciones`   | TEXT (nullable)                           | Observaciones generales                        |
| `usuarioId`       | INTEGER (FK → user)                       | Usuario que creó la remisión                   |
| `requisicionId`   | INTEGER (FK → requisicion)                | Requisición a la que pertenece                 |
| `createdAt`       | TIMESTAMP                                 | Fecha de creación                              |
| `updatedAt`       | TIMESTAMP                                 | Fecha de última actualización                  |

**Índices:**
- `numeroRemision` (UNIQUE)
- `requisicionId, estado` (para búsquedas de remisión Activa)

**Restricciones:**
- Solo puede haber UNA remisión con estado "Activa" por `requisicionId`

---

### **itemRemision**

| Campo                 | Tipo                                      | Descripción                                    |
|-----------------------|-------------------------------------------|------------------------------------------------|
| `id`                  | INTEGER (PK)                              | ID único del item                              |
| `cantidad`            | DECIMAL(10,4)                             | Cantidad remisionada                           |
| `medida`              | STRING (nullable)                         | Medida del item (ej: "1.2X2.4" para mt2)       |
| `estado`              | ENUM('Pendiente', 'Remisionado', 'Cancelado')| Estado del item                             |
| `notas`               | TEXT (nullable)                           | Notas del item (historial de ingresos)         |
| `remisionId`          | INTEGER (FK → remision)                   | Remisión a la que pertenece                    |
| `necesidadProyectoId` | INTEGER (FK → necesidadProyecto)          | Necesidad que satisface                        |
| `productoId`          | INTEGER (FK → producto, nullable)         | Producto remisionado (si aplica)               |
| `kitId`               | INTEGER (FK → kit, nullable)              | Kit remisionado (si aplica)                    |
| `createdAt`           | TIMESTAMP                                 | Fecha de creación                              |
| `updatedAt`           | TIMESTAMP                                 | Fecha de última actualización                  |

**Índices:**
- `remisionId, necesidadProyectoId` (para búsquedas de items)
- `productoId` (para búsquedas por producto)
- `kitId` (para búsquedas por kit)

**Restricciones:**
- Debe tener `productoId` O `kitId` (no ambos, no ninguno)

---

## 🔄 Flujo de Estados

### 1. **Estado de `remision`**

```
┌─────────┐
│  Nueva  │
└────┬────┘
     │
     ▼
┌──────────┐     PUT /remisionar      ┌──────────────┐
│  Activa  │─────────────────────────►│ Remisionada  │
└──────────┘                           └──────────────┘
     │
     │ DELETE (si se requiere)
     ▼
┌──────────┐
│Cancelada │
└──────────┘
```

**Reglas:**
- **Activa**: Se pueden agregar items (acumular cantidades)
- **Remisionada**: Cerrada, no se puede modificar
- **Cancelada**: Opcional, para anular remisiones

---

### 2. **Estado de `itemRemision`**

```
┌───────────┐
│ Pendiente │
└─────┬─────┘
      │
      │ PUT /remisionar (cuando se remisiona la remisión)
      ▼
┌─────────────┐
│ Remisionado │
└─────────────┘
      │
      │ DELETE (si se requiere)
      ▼
┌───────────┐
│ Cancelado │
└───────────┘
```

---

### 3. **Estado de `necesidadProyecto`**

```
┌───────────┐
│ reservado │  (cantidadEntregada = 0)
└─────┬─────┘
      │
      │ POST /ingresar-listo (0 < entregado < comprometido)
      ▼
┌──────────┐
│ parcial  │  (0 < cantidadEntregada < cantidadComprometida)
└─────┬────┘
      │
      │ POST /ingresar-listo (entregado >= comprometido)
      ▼
┌──────────┐
│ completo │  (cantidadEntregada >= cantidadComprometida)
└──────────┘
```

---

## 🔗 Relaciones

### **remision → requisicion** (N:1)
- Una remisión pertenece a una requisición
- Una requisición puede tener múltiples remisiones (a lo largo del tiempo)

### **remision → user** (N:1)
- Una remisión es creada por un usuario
- Un usuario puede crear múltiples remisiones

### **remision → itemRemision** (1:N)
- Una remisión contiene múltiples items
- Un item pertenece a una sola remisión

### **itemRemision → necesidadProyecto** (N:1)
- Un item de remisión satisface una necesidad de proyecto
- Una necesidad puede tener múltiples items (en diferentes remisiones)

### **itemRemision → producto/kit** (N:1)
- Un item de remisión es un producto O un kit
- Un producto/kit puede estar en múltiples items de remisión

---

## 📝 Triggers y Lógica Automática

### Trigger: Actualizar `necesidadProyecto.estado`

**Momento:** Al ejecutar `POST /ingresar-listo`

**Lógica:**
```javascript
if (cantidadEntregada === 0) {
  estado = 'reservado'
} else if (cantidadEntregada >= cantidadComprometida) {
  estado = 'completo'
} else {
  estado = 'parcial'
}
```

---

### Trigger: Crear/Usar remisión Activa

**Momento:** Al ejecutar `POST /ingresar-listo`

**Lógica:**
```javascript
const remisionActiva = await remision.findOne({
  where: { requisicionId, estado: 'Activa' }
})

if (!remisionActiva) {
  // Crear nueva remisión
  numeroRemision = `REM-${folio}-${Date.now()}`
  remisionActiva = await remision.create({ ... })
} else {
  // Usar la existente
}
```

---

### Trigger: Acumular cantidades en `itemRemision`

**Momento:** Al ejecutar `POST /ingresar-listo`

**Lógica:**
```javascript
const itemExistente = await itemRemision.findOne({
  where: { remisionId, necesidadProyectoId }
})

if (itemExistente) {
  // SUMAR la nueva cantidad
  itemExistente.cantidad += cantidadNueva
  await itemExistente.save()
} else {
  // CREAR nuevo item
  await itemRemision.create({ ... })
}
```

---

### Trigger: Validar stock al remisionar

**Momento:** Al ejecutar `PUT /remisionar/:id`

**Lógica:**
```javascript
for (const item of remision.itemRemisions) {
  const stockDisponible = await stock.findOne({ ... })
  
  if (!stockDisponible || stockDisponible.cantidad < item.cantidad) {
    throw new Error('Stock insuficiente')
    // ROLLBACK completo
  }
}

// Si TODO está OK, proceder con descuentos
```

---

## 🔒 Validaciones de Integridad

### 1. **No exceder comprometido**

```sql
CHECK (
  necesidadProyecto.cantidadEntregada <= necesidadProyecto.cantidadComprometida
)
```

### 2. **Una sola remisión Activa por requisición**

```sql
UNIQUE INDEX idx_remision_activa 
ON remision (requisicionId) 
WHERE estado = 'Activa'
```

### 3. **Item debe tener producto O kit**

```sql
CHECK (
  (productoId IS NOT NULL AND kitId IS NULL) OR
  (productoId IS NULL AND kitId IS NOT NULL)
)
```

### 4. **Cantidad debe ser > 0**

```sql
CHECK (itemRemision.cantidad > 0)
CHECK (stock.cantidad >= 0)
```

---

## 📊 Consultas Útiles

### Obtener remisiones pendientes de una requisición

```sql
SELECT r.*, COUNT(ir.id) as totalItems
FROM remision r
LEFT JOIN itemRemision ir ON ir.remisionId = r.id
WHERE r.requisicionId = :requisicionId
  AND r.estado = 'Activa'
GROUP BY r.id;
```

---

### Obtener necesidades con entregas pendientes

```sql
SELECT np.*, 
  (np.cantidadComprometida - np.cantidadEntregada) as faltante
FROM necesidadProyecto np
WHERE np.estado IN ('reservado', 'parcial')
  AND np.requisicionId = :requisicionId
ORDER BY np.createdAt;
```

---

### Obtener stock disponible en bodega Listo

```sql
SELECT s.*, 
  COALESCE(p.item, k.description) as nombre
FROM stock s
LEFT JOIN producto p ON p.id = s.productoId
LEFT JOIN kit k ON k.id = s.kitId
WHERE s.ubicacionId = 8  -- Bodega Listo
  AND s.cantidad > 0
ORDER BY s.updatedAt DESC;
```

---

### Historial de movimientos de una remisión

```sql
SELECT sm.*,
  r.numeroRemision
FROM stockMove sm
INNER JOIN remision r ON sm.referenciaDeDocumento LIKE CONCAT('%', r.numeroRemision, '%')
WHERE r.id = :remisionId
ORDER BY sm.createdAt;
```

---

## 🎯 Índices Recomendados

```sql
-- remision
CREATE INDEX idx_remision_requisicion_estado ON remision(requisicionId, estado);
CREATE UNIQUE INDEX idx_remision_numero ON remision(numeroRemision);

-- itemRemision
CREATE INDEX idx_itemRemision_remision ON itemRemision(remisionId);
CREATE INDEX idx_itemRemision_necesidad ON itemRemision(necesidadProyectoId);
CREATE INDEX idx_itemRemision_producto ON itemRemision(productoId);
CREATE INDEX idx_itemRemision_kit ON itemRemision(kitId);

-- stock
CREATE INDEX idx_stock_ubicacion ON stock(ubicacionId);
CREATE INDEX idx_stock_producto_ubicacion ON stock(productoId, ubicacionId);
CREATE INDEX idx_stock_kit_ubicacion ON stock(kitId, ubicacionId);

-- stockMove
CREATE INDEX idx_stockMove_tipo ON stockMove(tipoMovimiento);
CREATE INDEX idx_stockMove_referencia ON stockMove(referenciaDeDocumento);
```

---

**Autor:** Modelo de Datos - Remisiones  
**Versión:** 1.0  
**Última actualización:** 2026-02-19
