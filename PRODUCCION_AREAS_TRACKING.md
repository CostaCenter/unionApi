# 🏭 SISTEMA DE TRACKING DE PRODUCCIÓN POR ÁREAS

## 🎯 **OBJETIVO**

Rastrear el **flujo de cada kit/producto** de cada proyecto a través de las **áreas de producción** (Corte, Tubería, Ensamble, etc.), permitiendo saber en qué etapa del proceso se encuentra cada item.

---

## 📊 **ARQUITECTURA DE MODELOS**

### **1. `areaProduction` - Catálogo de Áreas**

Tabla que define las **áreas de producción** disponibles.

```javascript
{
  id: 1,
  name: "Corte",
  description: "Área de corte de láminas y perfiles",
  createdAt: "2026-02-19",
  updatedAt: "2026-02-19"
}
```

**Campos:**
- `id` (PK): ID único del área
- `name`: Nombre del área (Corte, Tubería, Ensamble, Pintura, etc.)
- `description`: Descripción del proceso

---

### **2. `itemAreaProduction` - Tracking por Área**

Tabla que registra el **progreso de cada item** en cada área de producción.

```javascript
{
  id: 1,
  necesidadProyectoId: 50,    // ← Relacionado con necesidadProyecto
  areaProductionId: 1,         // ← Área (Corte)
  kitId: 25,                   // ← Kit específico
  productoId: null,            // ← O Producto
  cantidad: 10.00,             // Cantidad total a procesar
  cantidadProcesada: 5.00,     // Cantidad ya procesada
  medida: "0.5X0.06",          // Medida del item
  estado: "en_proceso",        // pendiente | en_proceso | completado | pausado
  notas: "Prioridad alta",
  fechaInicio: "2026-02-19",
  fechaFin: null,
  createdAt: "2026-02-19",
  updatedAt: "2026-02-19"
}
```

**Campos clave:**
- `necesidadProyectoId` (FK): Relaciona con la necesidad del proyecto
- `areaProductionId` (FK): Área donde se procesa
- `kitId` / `productoId` (FK): Item que se procesa
- `cantidad`: Total a procesar
- `cantidadProcesada`: Ya procesado
- `estado`: Estado del proceso en esta área
- `fechaInicio` / `fechaFin`: Timestamps del proceso

---

## 🔗 **RELACIONES ESTABLECIDAS**

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE RELACIONES                       │
└─────────────────────────────────────────────────────────────┘

           ┌─────────────────┐
           │   Requisicion   │ (Proyecto)
           └────────┬────────┘
                    │
                    │ hasMany
                    ↓
           ┌─────────────────────────┐
           │   necesidadProyecto     │ ← Qué kits/productos necesita el proyecto
           └────────┬────────────────┘
                    │ belongsTo
                    ├─────→ Kit
                    └─────→ Producto
                    │
                    │ hasMany
                    ↓
           ┌─────────────────────────┐
           │ itemAreaProduction      │ ← Tracking por área
           └────────┬────────────────┘
                    │ belongsTo
                    ├─────→ areaProduction (Corte, Tubería)
                    ├─────→ Kit (opcional, acceso directo)
                    └─────→ Producto (opcional, acceso directo)
```

### **Relaciones en Código:**

```javascript
// ItemAreaProduction <-> NecesidadProyecto
necesidadProyecto.hasMany(itemAreaProduction, {
  foreignKey: 'necesidadProyectoId',
  onDelete: 'CASCADE'
});
itemAreaProduction.belongsTo(necesidadProyecto);

// ItemAreaProduction <-> AreaProduction
areaProduction.hasMany(itemAreaProduction, {
  foreignKey: 'areaProductionId',
  onDelete: 'CASCADE'
});
itemAreaProduction.belongsTo(areaProduction);

// ItemAreaProduction <-> Kit (acceso directo)
kit.hasMany(itemAreaProduction, {
  foreignKey: 'kitId',
  onDelete: 'CASCADE'
});
itemAreaProduction.belongsTo(kit);

// ItemAreaProduction <-> Producto (acceso directo)
producto.hasMany(itemAreaProduction, {
  foreignKey: 'productoId',
  onDelete: 'CASCADE'
});
itemAreaProduction.belongsTo(producto);
```

---

## 📋 **FLUJO DE TRABAJO PROPUESTO**

### **1. Setup Inicial - Crear Áreas**

```sql
-- Insertar áreas de producción
INSERT INTO "areaProductions" (name, description, "createdAt", "updatedAt")
VALUES 
  ('Corte', 'Área de corte de láminas y perfiles metálicos', NOW(), NOW()),
  ('Tubería', 'Área de corte y preparación de tubería', NOW(), NOW()),
  ('Soldadura', 'Área de soldadura y unión de piezas', NOW(), NOW()),
  ('Ensamble', 'Área de ensamble final', NOW(), NOW()),
  ('Pintura', 'Área de pintura y acabados', NOW(), NOW());
```

### **2. Cuando un Item se Envía a Producción**

Cuando llamas `POST /api/stock/transferir-item` (que ya implementamos), puedes **crear automáticamente** los registros de tracking:

```javascript
// Ejemplo: Después de transferir a producción
const crearTrackingProduccion = async (necesidadProyectoId, kitId, productoId, cantidad, medida) => {
  // Obtener las áreas que debe pasar este item
  const areas = await areaProduction.findAll({ 
    where: { name: ['Corte', 'Tubería'] } // Según tipo de item
  });

  // Crear un registro de tracking por cada área
  for (const area of areas) {
    await itemAreaProduction.create({
      necesidadProyectoId,
      areaProductionId: area.id,
      kitId: kitId || null,
      productoId: productoId || null,
      cantidad,
      cantidadProcesada: 0,
      medida,
      estado: 'pendiente',
      fechaInicio: null,
      fechaFin: null
    });
  }
};
```

### **3. Actualizar Progreso en un Área**

```javascript
// Endpoint: PUT /api/produccion/area/progreso/:id
const actualizarProgresoArea = async (req, res) => {
  const { id } = req.params;
  const { cantidadProcesada, estado, notas } = req.body;

  const tracking = await itemAreaProduction.findByPk(id);
  
  if (!tracking) {
    return res.status(404).json({ ok: false, msg: 'Registro no encontrado' });
  }

  // Actualizar progreso
  tracking.cantidadProcesada = cantidadProcesada;
  tracking.estado = estado;
  tracking.notas = notas;

  // Si se está iniciando, marcar fecha
  if (estado === 'en_proceso' && !tracking.fechaInicio) {
    tracking.fechaInicio = new Date();
  }

  // Si se completó, marcar fecha fin
  if (estado === 'completado' && !tracking.fechaFin) {
    tracking.fechaFin = new Date();
  }

  await tracking.save();

  return res.json({ ok: true, tracking });
};
```

### **4. Consultar Estado de un Proyecto**

```javascript
// Endpoint: GET /api/produccion/proyecto/:requisicionId
const getEstadoProduccionProyecto = async (req, res) => {
  const { requisicionId } = req.params;

  const necesidades = await necesidadProyecto.findAll({
    where: { requisicionId },
    include: [
      {
        model: itemAreaProduction,
        include: [
          { model: areaProduction, attributes: ['id', 'name'] },
          { model: kit, attributes: ['id', 'description'] },
          { model: producto, attributes: ['id', 'item'] }
        ]
      },
      { model: kit },
      { model: producto }
    ]
  });

  // Agrupar por kit/producto y área
  const resumen = necesidades.map(nec => ({
    necesidadId: nec.id,
    item: nec.kit?.description || nec.producto?.item,
    cantidadTotal: nec.cantidadComprometida,
    areas: nec.itemAreaProductions.map(tracking => ({
      area: tracking.areaProduction.name,
      cantidad: tracking.cantidad,
      procesado: tracking.cantidadProcesada,
      estado: tracking.estado,
      progreso: ((tracking.cantidadProcesada / tracking.cantidad) * 100).toFixed(2) + '%'
    }))
  }));

  return res.json({ ok: true, proyecto: requisicionId, items: resumen });
};
```

---

## 📊 **EJEMPLO DE RESPUESTA - Estado de Proyecto**

```json
{
  "ok": true,
  "proyecto": 15,
  "items": [
    {
      "necesidadId": 50,
      "item": "Pedestal P100",
      "cantidadTotal": 10.00,
      "areas": [
        {
          "area": "Corte",
          "cantidad": 10.00,
          "procesado": 10.00,
          "estado": "completado",
          "progreso": "100.00%"
        },
        {
          "area": "Tubería",
          "cantidad": 10.00,
          "procesado": 5.00,
          "estado": "en_proceso",
          "progreso": "50.00%"
        }
      ]
    },
    {
      "necesidadId": 51,
      "item": "Silla S200",
      "cantidadTotal": 20.00,
      "areas": [
        {
          "area": "Corte",
          "cantidad": 20.00,
          "procesado": 0.00,
          "estado": "pendiente",
          "progreso": "0.00%"
        }
      ]
    }
  ]
}
```

---

## 🎨 **IMPLEMENTACIÓN EN FRONTEND**

### **Dashboard de Producción:**

```javascript
const ProduccionDashboard = ({ requisicionId }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const fetchEstado = async () => {
      const res = await axios.get(`/api/produccion/proyecto/${requisicionId}`);
      setItems(res.data.items);
    };
    fetchEstado();
  }, [requisicionId]);

  return (
    <div className="produccion-dashboard">
      <h2>Estado de Producción - Proyecto {requisicionId}</h2>
      
      {items.map(item => (
        <div key={item.necesidadId} className="item-card">
          <h3>{item.item}</h3>
          <p>Cantidad: {item.cantidadTotal}</p>
          
          <div className="areas-progress">
            {item.areas.map((area, idx) => (
              <div key={idx} className="area-progress">
                <span className="area-name">{area.area}</span>
                <div className="progress-bar">
                  <div 
                    className={`progress-fill ${area.estado}`}
                    style={{ width: area.progreso }}
                  >
                    {area.progreso}
                  </div>
                </div>
                <span className={`estado-badge ${area.estado}`}>
                  {area.estado}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
```

### **Badges de Estado:**

```css
.estado-badge.pendiente {
  background: #ffc107;
  color: #000;
}

.estado-badge.en_proceso {
  background: #2196f3;
  color: #fff;
}

.estado-badge.completado {
  background: #4caf50;
  color: #fff;
}

.estado-badge.pausado {
  background: #ff5722;
  color: #fff;
}
```

---

## 📝 **QUERIES ÚTILES**

### **1. Ver todos los items pendientes en Corte**

```sql
SELECT 
  iap.id,
  ap.name AS area,
  COALESCE(k.description, p.item) AS item,
  iap.cantidad,
  iap."cantidadProcesada",
  iap.estado,
  r."folio" AS proyecto
FROM "itemAreaProductions" iap
INNER JOIN "areaProductions" ap ON iap."areaProductionId" = ap.id
INNER JOIN "necesidadProyectos" np ON iap."necesidadProyectoId" = np.id
INNER JOIN "requisicions" r ON np."requisicionId" = r.id
LEFT JOIN "kits" k ON iap."kitId" = k.id
LEFT JOIN "productos" p ON iap."productoId" = p.id
WHERE ap.name = 'Corte'
  AND iap.estado IN ('pendiente', 'en_proceso')
ORDER BY r."folio", iap."createdAt";
```

### **2. Calcular tiempo promedio por área**

```sql
SELECT 
  ap.name AS area,
  COUNT(*) AS items_completados,
  AVG(EXTRACT(EPOCH FROM (iap."fechaFin" - iap."fechaInicio")) / 3600) AS horas_promedio
FROM "itemAreaProductions" iap
INNER JOIN "areaProductions" ap ON iap."areaProductionId" = ap.id
WHERE iap.estado = 'completado'
  AND iap."fechaInicio" IS NOT NULL
  AND iap."fechaFin" IS NOT NULL
GROUP BY ap.name
ORDER BY horas_promedio DESC;
```

### **3. Ver progreso global de un proyecto**

```sql
SELECT 
  r."folio" AS proyecto,
  ap.name AS area,
  COUNT(*) AS total_items,
  SUM(CASE WHEN iap.estado = 'completado' THEN 1 ELSE 0 END) AS completados,
  ROUND(
    (SUM(CASE WHEN iap.estado = 'completado' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 
    2
  ) AS porcentaje_completado
FROM "itemAreaProductions" iap
INNER JOIN "areaProductions" ap ON iap."areaProductionId" = ap.id
INNER JOIN "necesidadProyectos" np ON iap."necesidadProyectoId" = np.id
INNER JOIN "requisicions" r ON np."requisicionId" = r.id
WHERE r.id = 15
GROUP BY r."folio", ap.name
ORDER BY ap.name;
```

---

## 🚀 **ENDPOINTS SUGERIDOS**

### **Áreas de Producción:**
```
GET    /api/produccion/areas                    - Listar áreas
POST   /api/produccion/areas                    - Crear área
PUT    /api/produccion/areas/:id                - Actualizar área
DELETE /api/produccion/areas/:id                - Eliminar área
```

### **Tracking:**
```
GET    /api/produccion/proyecto/:requisicionId  - Estado del proyecto
GET    /api/produccion/area/:areaId             - Items en un área específica
POST   /api/produccion/tracking                 - Crear tracking (auto al enviar a producción)
PUT    /api/produccion/tracking/:id             - Actualizar progreso
GET    /api/produccion/tracking/:id             - Detalle de tracking
```

### **Reportes:**
```
GET    /api/produccion/reportes/pendientes      - Items pendientes por área
GET    /api/produccion/reportes/tiempos         - Tiempos promedio por área
GET    /api/produccion/reportes/proyecto/:id    - Reporte completo de proyecto
```

---

## ✅ **CHECKLIST DE IMPLEMENTACIÓN**

- [x] Modelos `areaProduction` y `itemAreaProduction` creados
- [x] Relaciones establecidas en `db.js`
- [x] Campos optimizados en `itemAreaProduction`
- [ ] Seeders para áreas iniciales (Corte, Tubería)
- [ ] Endpoints de CRUD para áreas
- [ ] Endpoints de tracking y progreso
- [ ] Integración con transferencia a producción
- [ ] Dashboard de producción en frontend
- [ ] Reportes y analytics
- [ ] Notificaciones de cambio de estado

---

## 💡 **PRÓXIMOS PASOS**

1. **Crear seeders** para las áreas iniciales (Corte, Tubería)
2. **Implementar controladores** para los endpoints sugeridos
3. **Integrar con la transferencia a producción** (auto-crear tracking)
4. **Desarrollar el dashboard** en el frontend
5. **Agregar notificaciones** cuando un item cambia de estado

---

**¿Quieres que implemente alguno de estos pasos?** 🚀

- Controladores y rutas para áreas
- Seeders para datos iniciales
- Endpoints de tracking
- Dashboard de frontend
- Reportes y analytics

¡Todo listo para rastrear tu producción de forma profesional! 🏭✨
