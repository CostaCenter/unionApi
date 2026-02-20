# 📦 Sistema de Remisiones - Documentación Completa

## 🎯 Descripción General

Este sistema gestiona el ingreso de cantidades listas para despacho y la creación de remisiones para proyectos. Todo el proceso es **100% transaccional** para garantizar la integridad de los datos.

---

## 📐 Arquitectura

### Modelos

#### **remision**
- `id`: INTEGER (PK)
- `numeroRemision`: STRING (unique) - Ej: "REM-FOLIO-1234567890"
- `estado`: ENUM ('Activa', 'Remisionada', 'Cancelada')
- `fechaRemision`: DATE (nullable)
- `observaciones`: TEXT (nullable)
- `usuarioId`: INTEGER (FK a user)
- `requisicionId`: INTEGER (FK a requisicion)

#### **itemRemision**
- `id`: INTEGER (PK)
- `cantidad`: DECIMAL(10,4)
- `medida`: STRING (nullable) - Para productos con mt2, etc.
- `estado`: ENUM ('Pendiente', 'Remisionado', 'Cancelado')
- `notas`: TEXT (nullable)
- `remisionId`: INTEGER (FK a remision)
- `necesidadProyectoId`: INTEGER (FK a necesidadProyecto)
- `productoId`: INTEGER (FK a producto, nullable)
- `kitId`: INTEGER (FK a kit, nullable)

### Relaciones

```
remision (1) → (N) itemRemision
remision (N) → (1) requisicion
remision (N) → (1) user (creador)
itemRemision (N) → (1) necesidadProyecto
itemRemision (N) → (1) producto (opcional)
itemRemision (N) → (1) kit (opcional)
```

---

## 🔄 Flujo de Trabajo

### 1️⃣ Ingresar Cantidades Listas

**Endpoint:** `POST /api/remision/post/ingresar-listo`

**Body:**
```json
{
  "necesidadProyectoId": 45,
  "cantidad": 5.5,
  "medida": "1.2X2.4",
  "notas": "Primera entrega de pedestales"
}
```

**Proceso (Transaccional):**

1. **Valida `necesidadProyectoId` y `cantidad`**
   - `cantidad` > 0
   - `necesidadProyecto` existe

2. **Valida que NO se exceda lo comprometido**
   ```
   nuevoTotalEntregado = cantidadEntregadaActual + cantidadAIngresar
   
   if (nuevoTotalEntregado > cantidadComprometida) → ERROR
   ```

3. **Actualiza `necesidadProyecto`**
   ```
   cantidadEntregada = nuevoTotalEntregado
   
   estado = 
     - 'reservado' si cantidadEntregada === 0
     - 'completo' si cantidadEntregada >= cantidadComprometida
     - 'parcial' si está entre 0 y cantidadComprometida
   ```

4. **Busca o crea remisión Activa**
   - **Regla:** NO pueden existir dos remisiones Activas para la misma `requisicionId`
   - Si existe remisión Activa → usa esa
   - Si NO existe → crea nueva con número `REM-{folio}-{timestamp}`

5. **Busca o actualiza `itemRemision`**
   - Si existe item para esa `necesidadProyectoId` en la remisión Activa → **SUMA** la cantidad
   - Si NO existe → crea nuevo

6. **Ingresa stock en Bodega 8 (Listo)**
   - Busca stock por: `ubicacionId`, `productoId`/`kitId`, `medida` (si aplica)
   - Si existe → **SUMA** la cantidad
   - Si NO existe → crea nuevo

7. **Registra movimiento en `stockMove`**
   - Tipo: `INGRESO_LISTO`
   - Referencia: `LISTO_REM_{numeroRemision}_NEC_{necesidadProyectoId}`

**Respuesta (201):**
```json
{
  "ok": true,
  "necesidadProyecto": {
    "id": 45,
    "cantidadComprometida": 10,
    "cantidadEntregadaAnterior": 3,
    "cantidadEntregadaNueva": 8.5,
    "cantidadIngresada": 5.5,
    "estado": "parcial"
  },
  "remision": {
    "id": 12,
    "numeroRemision": "REM-REQ001-1645678900000",
    "estado": "Activa"
  },
  "itemRemision": {
    "id": 34,
    "cantidad": 8.5
  },
  "stock": {
    "bodega": 8,
    "cantidad": 50.5
  }
}
```

---

### 2️⃣ Remisionar Documento

**Endpoint:** `PUT /api/remision/put/remisionar/:remisionId`

**Params:**
- `remisionId`: ID de la remisión a remisionar

**Proceso (Transaccional):**

1. **Valida remisión**
   - Existe
   - Estado === 'Activa'
   - Tiene items

2. **Valida stock suficiente para TODOS los items**
   - Para cada `itemRemision`:
     - Busca stock en Bodega 8
     - Valida que `stockDisponible.cantidad >= itemRemision.cantidad`
   - Si algún item NO tiene stock → **ERROR y ROLLBACK completo**

3. **Hace salida de inventario**
   - Para cada item:
     - Descuenta cantidad de `stock` en Bodega 8
     - Si `stock.cantidad <= 0` → `state = 'Agotado'`
     - Registra `stockMove` con tipo `SALIDA_REMISION`
     - Actualiza `itemRemision.estado = 'Remisionado'`

4. **Actualiza remisión**
   ```
   estado = 'Remisionada'
   fechaRemision = NOW()
   ```

**Respuesta (200):**
```json
{
  "ok": true,
  "remision": {
    "id": 12,
    "numeroRemision": "REM-REQ001-1645678900000",
    "estado": "Remisionada",
    "fechaRemision": "2026-02-19T10:30:00.000Z",
    "requisicionId": 5,
    "folio": "REQ001"
  },
  "itemsRemisionados": [
    {
      "itemRemisionId": 34,
      "productoId": 10,
      "kitId": null,
      "cantidad": 8.5,
      "nombre": "Pedestal Ejecutivo"
    },
    {
      "itemRemisionId": 35,
      "productoId": null,
      "kitId": 3,
      "cantidad": 5,
      "nombre": "Kit Estantería Básica"
    }
  ],
  "totalItems": 2
}
```

---

## 🔒 Validaciones

### ❌ Errores Controlados

1. **Al ingresar cantidades listas:**
   ```
   - necesidadProyectoId requerido
   - cantidad debe ser > 0
   - necesidadProyecto no encontrado
   - No se puede entregar más de lo comprometido
   ```

2. **Al remisionar:**
   ```
   - remisionId requerido
   - Remisión no encontrada
   - Remisión no está Activa
   - Remisión no tiene items
   - No hay stock en bodega 8 para [item]
   - Stock insuficiente en bodega 8 para [item]
   ```

### ✅ Reglas de Negocio

1. **NO pueden existir dos remisiones Activas** para la misma `requisicionId`
2. **NO se puede entregar más de lo comprometido**
3. **NO se puede remisionar sin stock suficiente** en bodega 8
4. **Si algo falla → ROLLBACK completo** (100% transaccional)
5. **Si la remisión ya está Remisionada**, NO se puede volver a usar (crear nueva)

---

## 📡 Endpoints Adicionales

### Obtener remisiones de una requisición

**Endpoint:** `GET /api/remision/get/requisicion/:requisicionId`

**Respuesta (200):**
```json
{
  "ok": true,
  "requisicionId": 5,
  "totalRemisiones": 3,
  "remisiones": [
    {
      "id": 12,
      "numeroRemision": "REM-REQ001-1645678900000",
      "estado": "Remisionada",
      "fechaRemision": "2026-02-19T10:30:00.000Z",
      "requisicion": {
        "id": 5,
        "folio": "REQ001"
      },
      "itemRemisions": [...]
    }
  ]
}
```

---

### Obtener detalle de una remisión

**Endpoint:** `GET /api/remision/get/:remisionId`

**Respuesta (200):**
```json
{
  "ok": true,
  "remision": {
    "id": 12,
    "numeroRemision": "REM-REQ001-1645678900000",
    "estado": "Remisionada",
    "fechaRemision": "2026-02-19T10:30:00.000Z",
    "requisicion": { "id": 5, "folio": "REQ001" },
    "itemRemisions": [
      {
        "id": 34,
        "cantidad": 8.5,
        "medida": "1.2X2.4",
        "estado": "Remisionado",
        "producto": { "id": 10, "item": "Pedestal Ejecutivo" },
        "kit": null,
        "necesidadProyecto": {
          "id": 45,
          "cantidadComprometida": 10,
          "cantidadEntregada": 8.5,
          "estado": "parcial"
        }
      }
    ]
  }
}
```

---

## 🧪 Ejemplos de Uso

### Escenario 1: Primera entrega parcial

```bash
# 1. Ingresar cantidades listas
POST /api/remision/post/ingresar-listo
{
  "necesidadProyectoId": 45,
  "cantidad": 3,
  "notas": "Primera entrega de 3 pedestales"
}

# Resultado:
# - necesidadProyecto.cantidadEntregada: 0 → 3
# - necesidadProyecto.estado: "reservado" → "parcial"
# - Crea remisión REM-REQ001-xxx con estado "Activa"
# - Crea itemRemision con cantidad 3
# - Stock en bodega 8: +3
```

---

### Escenario 2: Segunda entrega (misma remisión)

```bash
# 2. Ingresar más cantidades
POST /api/remision/post/ingresar-listo
{
  "necesidadProyectoId": 45,
  "cantidad": 5,
  "notas": "Segunda entrega de 5 pedestales"
}

# Resultado:
# - necesidadProyecto.cantidadEntregada: 3 → 8
# - necesidadProyecto.estado: "parcial" (porque comprometida = 10)
# - USA la misma remisión Activa REM-REQ001-xxx
# - SUMA al itemRemision existente: cantidad 3 → 8
# - Stock en bodega 8: +5
```

---

### Escenario 3: Remisionar

```bash
# 3. Remisionar el documento
PUT /api/remision/put/remisionar/12

# Resultado:
# - Valida que hay stock suficiente en bodega 8 (8 pedestales)
# - Descuenta 8 de stock en bodega 8
# - remision.estado: "Activa" → "Remisionada"
# - remision.fechaRemision: NOW()
# - itemRemision.estado: "Pendiente" → "Remisionado"
# - Crea stockMove con tipo "SALIDA_REMISION"
```

---

### Escenario 4: Nueva entrega después de remisionar

```bash
# 4. Ingresar el resto (después de remisionar)
POST /api/remision/post/ingresar-listo
{
  "necesidadProyectoId": 45,
  "cantidad": 2,
  "notas": "Entrega final de 2 pedestales"
}

# Resultado:
# - necesidadProyecto.cantidadEntregada: 8 → 10
# - necesidadProyecto.estado: "parcial" → "completo"
# - CREA NUEVA remisión REM-REQ001-yyy (la anterior ya está Remisionada)
# - Crea nuevo itemRemision con cantidad 2
# - Stock en bodega 8: +2
```

---

## 🚨 Manejo de Errores

### Error: Intentar entregar más de lo comprometido

```bash
POST /api/remision/post/ingresar-listo
{
  "necesidadProyectoId": 45,
  "cantidad": 5
}

# Si cantidadComprometida = 10 y cantidadEntregada = 8
# Respuesta (400):
{
  "ok": false,
  "msg": "No se puede entregar más de lo comprometido. Comprometido: 10, Ya entregado: 8, Intentas agregar: 5, Nuevo total: 13"
}
```

---

### Error: Stock insuficiente al remisionar

```bash
PUT /api/remision/put/remisionar/12

# Si un item requiere 10 unidades pero solo hay 7 en bodega 8
# Respuesta (400):
{
  "ok": false,
  "msg": "Stock insuficiente en bodega 8 para Pedestal Ejecutivo. Disponible: 7, Necesario: 10"
}

# ⚠️ NADA se remisiona (ROLLBACK completo)
```

---

### Error: Remisión ya remisionada

```bash
PUT /api/remision/put/remisionar/12

# Si la remisión ya está Remisionada
# Respuesta (400):
{
  "ok": false,
  "msg": "La remisión REM-REQ001-1645678900000 no está Activa (estado actual: Remisionada)"
}
```

---

## 🎨 Diagrama de Estados

### **necesidadProyecto.estado**

```
reservado → parcial → completo
   ↓          ↓          ↓
  0%      0% < x < 100%  100%
```

### **remision.estado**

```
Activa → Remisionada
  ↓          ↓
Editable  Cerrada
```

### **itemRemision.estado**

```
Pendiente → Remisionado
    ↓            ↓
En remisión  Despachado
 Activa
```

---

## ✨ Características Clave

✅ **100% Transaccional**: Si algo falla → ROLLBACK completo  
✅ **No duplicar remisiones Activas**: Una sola remisión Activa por requisición  
✅ **No exceder comprometido**: Validación estricta de cantidades  
✅ **Validación de stock**: No se puede remisionar sin inventario suficiente  
✅ **Registro completo**: Todo movimiento queda en `stockMove`  
✅ **Acumulación inteligente**: Si ya existe item en remisión Activa → SUMA cantidades  
✅ **Logs detallados**: Console logs para debugging  

---

## 📊 Flujo Visual

```
┌─────────────────────────┐
│  Producción termina     │
│  una cantidad de items  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────┐
│ POST /api/remision/post/ingresar-listo             │
│ - Validar no exceder comprometido                   │
│ - Actualizar necesidadProyecto.cantidadEntregada    │
│ - Buscar o crear remisión Activa                    │
│ - Crear o actualizar itemRemision                   │
│ - Ingresar stock en bodega 8                        │
│ - Registrar stockMove (INGRESO_LISTO)               │
└───────────┬─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ Remisión estado:        │
│ "Activa"                │
│ Items acumulándose      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────┐
│ PUT /api/remision/put/remisionar/:id                │
│ - Validar stock suficiente en bodega 8              │
│ - Hacer salida de inventario                        │
│ - Cambiar estado a "Remisionada"                    │
│ - Registrar stockMove (SALIDA_REMISION)             │
└───────────┬─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ Remisión estado:        │
│ "Remisionada"           │
│ Items despachados       │
└─────────────────────────┘
```

---

## 🔧 Próximos pasos (si se requiere)

- [ ] Frontend para ingresar cantidades listas
- [ ] Frontend para ver remisiones y remisionar
- [ ] Endpoint para cancelar remisión
- [ ] Endpoint para editar item antes de remisionar
- [ ] PDF de remisión
- [ ] Notificaciones al remisionar

---

**Autor:** Sistema de Gestión de Remisiones  
**Versión:** 1.0  
**Fecha:** 2026-02-19
