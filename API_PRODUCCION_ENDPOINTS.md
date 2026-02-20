# 📋 API DE PRODUCCIÓN - ENDPOINTS ITEMAREPRODUCTION

## 🎯 **FUNCIONALIDADES IMPLEMENTADAS**

Sistema completo para gestionar items en áreas de producción (Corte y Tubería).

---

## 📡 **ENDPOINTS DISPONIBLES**

### **1. Crear Item en Área de Producción**

**POST** `/api/production/post/item-area`

Asigna un kit o producto a un área de producción específica.

#### **Body (JSON):**
```json
{
  "requisicionId": 15,
  "necesidadProyectoId": 50,
  "areaProductionId": 2,
  "kitId": 25,
  "cantidad": 10.00,
  "medida": "0.5X0.06"
}
```

#### **Campos:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `requisicionId` | `number` | ✅ Sí | ID del proyecto/requisición |
| `necesidadProyectoId` | `number` | ⚪ Opcional | ID de la necesidad (si aplica) |
| `areaProductionId` | `number` | ✅ Sí | **2** = Corte, **3** = Tubería |
| `kitId` | `number` | ⚪ Uno u otro | ID del kit (si es kit) |
| `productoId` | `number` | ⚪ Uno u otro | ID del producto (si es producto) |
| `cantidad` | `number` | ✅ Sí | Cantidad total a procesar |
| `medida` | `string` | ⚪ Opcional | Medida del item (ej: "0.5X0.06") |

#### **Response (Éxito):**
```json
{
  "ok": true,
  "msg": "Item agregado al área Corte",
  "itemAreaProduction": {
    "id": 1,
    "requisicionId": 15,
    "necesidadProyectoId": 50,
    "areaProductionId": 2,
    "kitId": 25,
    "productoId": null,
    "cantidad": 10.00,
    "cantidadProcesada": 0.00,
    "medida": "0.5X0.06",
    "estado": "pendiente",
    "notas": null,
    "fechaInicio": null,
    "fechaFin": null,
    "createdAt": "2026-02-19T...",
    "updatedAt": "2026-02-19T..."
  }
}
```

#### **Validaciones:**
- ✅ `requisicionId` debe existir en la base de datos
- ✅ `areaProductionId` debe existir (2 o 3)
- ✅ Debe proporcionar `kitId` o `productoId` (al menos uno)
- ✅ `cantidad` debe ser mayor a 0
- ✅ `cantidadProcesada` arranca automáticamente en **0**
- ✅ `estado` arranca automáticamente en **"pendiente"**

---

### **2. Actualizar Cantidades Procesadas**

**PUT** `/api/production/put/item-area/:id`

Actualiza la cantidad procesada y el estado de un item en producción.

#### **Params:**
- `id`: ID del `itemAreaProduction`

#### **Body (JSON):**
```json
{
  "cantidadProcesada": 5.00,
  "estado": "en_proceso",
  "notas": "Procesando lote 1"
}
```

#### **Campos:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `cantidadProcesada` | `number` | ⚪ Opcional | Cantidad ya procesada |
| `estado` | `string` | ⚪ Opcional | `pendiente` \| `en_proceso` \| `completado` \| `pausado` |
| `notas` | `string` | ⚪ Opcional | Observaciones del proceso |

#### **Response (Éxito):**
```json
{
  "ok": true,
  "msg": "Item actualizado correctamente",
  "itemAreaProduction": {
    "id": 1,
    "requisicionId": 15,
    "areaProductionId": 2,
    "kitId": 25,
    "cantidad": 10.00,
    "cantidadProcesada": 5.00,
    "medida": "0.5X0.06",
    "estado": "en_proceso",
    "notas": "Procesando lote 1",
    "fechaInicio": "2026-02-19T10:30:00Z",
    "fechaFin": null,
    "areaProduction": {
      "id": 2,
      "name": "Corte"
    },
    "requisicion": {
      "id": 15,
      "folio": "REQ-2026-015"
    }
  }
}
```

#### **Lógica Automática de Estados:**

| Condición | Estado Automático | Fecha |
|-----------|-------------------|-------|
| `cantidadProcesada = 0` | `pendiente` | - |
| `0 < cantidadProcesada < cantidad` | `en_proceso` | `fechaInicio` se marca |
| `cantidadProcesada >= cantidad` | `completado` | `fechaFin` se marca |

#### **Validaciones:**
- ✅ `cantidadProcesada` no puede ser mayor que `cantidad` total
- ✅ Fechas se actualizan automáticamente según el estado
- ✅ Si el estado se marca manualmente, respeta el override

---

### **3. Obtener Items por Requisición**

**GET** `/api/production/get/requisicion/:requisicionId`

Obtiene todos los items de producción de una requisición/proyecto específico.

#### **Params:**
- `requisicionId`: ID de la requisición/proyecto

#### **Response (Éxito):**
```json
{
  "ok": true,
  "requisicionId": 15,
  "totalItems": 4,
  "porArea": {
    "Corte": [
      {
        "id": 1,
        "cantidad": 10.00,
        "cantidadProcesada": 5.00,
        "estado": "en_proceso",
        "areaProduction": {
          "id": 2,
          "name": "Corte",
          "description": "Área de corte de láminas"
        },
        "kit": {
          "id": 25,
          "description": "Pedestal P100"
        },
        "necesidadProyecto": {
          "id": 50,
          "cantidadComprometida": 10.00,
          "cantidadEntregada": 0.00,
          "estado": "reservado"
        }
      },
      {
        "id": 2,
        "cantidad": 20.00,
        "cantidadProcesada": 20.00,
        "estado": "completado",
        "areaProduction": {
          "id": 2,
          "name": "Corte"
        },
        "producto": {
          "id": 15,
          "item": "Lámina cortada"
        }
      }
    ],
    "Tubería": [
      {
        "id": 3,
        "cantidad": 15.00,
        "cantidadProcesada": 0.00,
        "estado": "pendiente",
        "areaProduction": {
          "id": 3,
          "name": "Tubería"
        },
        "kit": {
          "id": 30,
          "description": "Silla S200"
        }
      }
    ]
  },
  "items": [
    "... (array completo de items sin agrupar)"
  ]
}
```

---

## 📊 **EJEMPLOS DE USO**

### **Ejemplo 1: Asignar Kit a Área de Corte**

```javascript
// Frontend
const asignarACorte = async (requisicionId, kitId, cantidad, medida) => {
  try {
    const response = await axios.post('/api/production/post/item-area', {
      requisicionId,
      areaProductionId: 2, // Corte
      kitId,
      cantidad,
      medida
    });

    if (response.data.ok) {
      console.log('✅ Item asignado a Corte');
      console.log('ID:', response.data.itemAreaProduction.id);
    }
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
};

// Uso
asignarACorte(15, 25, 10.00, '0.5X0.06');
```

### **Ejemplo 2: Actualizar Progreso (Operador de Producción)**

```javascript
// Cuando el operador procesa items
const actualizarProgreso = async (itemId, cantidadProcesada, notas) => {
  try {
    const response = await axios.put(`/api/production/put/item-area/${itemId}`, {
      cantidadProcesada,
      notas
    });

    if (response.data.ok) {
      const item = response.data.itemAreaProduction;
      console.log(`✅ Actualizado: ${item.cantidadProcesada}/${item.cantidad}`);
      console.log(`Estado: ${item.estado}`);
    }
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
};

// Uso: El operador procesó 5 de 10
actualizarProgreso(1, 5.00, 'Procesado lote 1');
```

### **Ejemplo 3: Ver Estado del Proyecto**

```javascript
// Dashboard de producción
const verEstadoProyecto = async (requisicionId) => {
  try {
    const response = await axios.get(`/api/production/get/requisicion/${requisicionId}`);

    if (response.data.ok) {
      const { porArea, totalItems } = response.data;
      
      console.log(`Total items: ${totalItems}`);
      
      // Mostrar por área
      Object.entries(porArea).forEach(([area, items]) => {
        console.log(`\n${area}:`);
        items.forEach(item => {
          const progreso = ((item.cantidadProcesada / item.cantidad) * 100).toFixed(2);
          console.log(`  - ${item.kit?.description || item.producto?.item}: ${progreso}% (${item.estado})`);
        });
      });
    }
  } catch (error) {
    console.error('Error:', error.response?.data);
  }
};

// Uso
verEstadoProyecto(15);
```

---

## 🎨 **COMPONENTE DE FRONTEND (Ejemplo)**

```javascript
const ProduccionPanel = ({ requisicionId }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [requisicionId]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/production/get/requisicion/${requisicionId}`);
      setItems(res.data.items);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const actualizarCantidad = async (itemId, cantidad) => {
    try {
      await axios.put(`/api/production/put/item-area/${itemId}`, {
        cantidadProcesada: cantidad
      });
      fetchItems(); // Recargar
      alert('✅ Actualizado');
    } catch (error) {
      alert('❌ Error: ' + error.response?.data?.msg);
    }
  };

  return (
    <div className="produccion-panel">
      <h2>Producción - Requisición {requisicionId}</h2>
      
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div className="items-list">
          {items.map(item => (
            <div key={item.id} className={`item-card estado-${item.estado}`}>
              <div className="item-header">
                <h3>{item.kit?.description || item.producto?.item}</h3>
                <span className={`badge ${item.estado}`}>{item.estado}</span>
              </div>
              
              <div className="item-info">
                <p>Área: <strong>{item.areaProduction.name}</strong></p>
                <p>Total: {item.cantidad}</p>
                <p>Procesado: {item.cantidadProcesada}</p>
                <p>Progreso: {((item.cantidadProcesada / item.cantidad) * 100).toFixed(2)}%</p>
              </div>

              <div className="item-actions">
                <input
                  type="number"
                  step="0.01"
                  max={item.cantidad}
                  defaultValue={item.cantidadProcesada}
                  onBlur={(e) => actualizarCantidad(item.id, e.target.value)}
                />
                <button onClick={() => actualizarCantidad(item.id, item.cantidad)}>
                  Marcar Completo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## 🔍 **FLUJO COMPLETO**

```
1. Material llega a producción
   → POST /api/stock/transferir-item (ya implementado)

2. Crear asignación a área de corte
   → POST /api/production/post/item-area
   Body: { requisicionId: 15, areaProductionId: 2, kitId: 25, cantidad: 10 }
   Response: { id: 1, cantidadProcesada: 0, estado: "pendiente" }

3. Operador empieza a procesar
   → PUT /api/production/put/item-area/1
   Body: { cantidadProcesada: 3 }
   Response: { estado: "en_proceso", fechaInicio: "..." }

4. Operador termina
   → PUT /api/production/put/item-area/1
   Body: { cantidadProcesada: 10 }
   Response: { estado: "completado", fechaFin: "..." }

5. Pasar a siguiente área (Tubería)
   → POST /api/production/post/item-area
   Body: { requisicionId: 15, areaProductionId: 3, kitId: 25, cantidad: 10 }

6. Consultar estado general
   → GET /api/production/get/requisicion/15
   Response: Ver todos los items y su progreso por área
```

---

## ⚠️ **ERRORES COMUNES**

### **Error 400: requisicionId es requerido**
```json
{
  "ok": false,
  "msg": "requisicionId es requerido"
}
```
**Solución:** Asegúrate de enviar `requisicionId` en el body.

### **Error 400: Debe proporcionar kitId o productoId**
```json
{
  "ok": false,
  "msg": "Debe proporcionar kitId o productoId"
}
```
**Solución:** Envía al menos uno de los dos IDs.

### **Error 400: cantidad debe ser mayor a 0**
```json
{
  "ok": false,
  "msg": "cantidad debe ser mayor a 0"
}
```
**Solución:** Verifica que `cantidad` sea un número positivo.

### **Error 404: Requisición X no encontrada**
```json
{
  "ok": false,
  "msg": "Requisición 999 no encontrada"
}
```
**Solución:** Verifica que el `requisicionId` exista en la base de datos.

### **Error 400: La cantidad procesada no puede ser mayor que la cantidad total**
```json
{
  "ok": false,
  "msg": "La cantidad procesada (15) no puede ser mayor que la cantidad total (10)"
}
```
**Solución:** No puedes procesar más de lo asignado.

---

## ✅ **RESUMEN DE ÁREAS**

| ID | Nombre | Descripción |
|----|--------|-------------|
| **2** | Corte | Área de corte de láminas y perfiles |
| **3** | Tubería | Área de corte y preparación de tubería |

---

## 🚀 **TESTING CON cURL**

### **Crear item en Corte:**
```bash
curl -X POST http://localhost:3000/api/production/post/item-area \
  -H "Content-Type: application/json" \
  -d '{
    "requisicionId": 15,
    "areaProductionId": 2,
    "kitId": 25,
    "cantidad": 10.00,
    "medida": "0.5X0.06"
  }'
```

### **Actualizar progreso:**
```bash
curl -X PUT http://localhost:3000/api/production/put/item-area/1 \
  -H "Content-Type: application/json" \
  -d '{
    "cantidadProcesada": 5.00,
    "notas": "Lote 1 procesado"
  }'
```

### **Ver estado de proyecto:**
```bash
curl -X GET http://localhost:3000/api/production/get/requisicion/15
```

---

**¡Sistema de producción listo para usar!** 🏭✨
