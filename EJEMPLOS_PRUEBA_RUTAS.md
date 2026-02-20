# 📋 Guía de Pruebas - Rutas Versionadas de Almacén

## 🚀 Endpoint de Prueba

Primero, verifica que las rutas estén funcionando:

```
GET http://localhost:PUERTO/api/inventario-version/get/prueba
```

Este endpoint te mostrará toda la información que necesitas para hacer las pruebas.

---

## 📝 Ejemplos de Uso

### 1. Verificar si un item requiere piezas completas

**Endpoint:**
```
GET /api/inventario-version/get/verificar/piezas-completas?materiaId=123
```

**Ejemplo con cURL:**
```bash
curl -X GET "http://localhost:3000/api/inventario-version/get/verificar/piezas-completas?materiaId=123"
```

**Ejemplo con Postman:**
- Método: GET
- URL: `http://localhost:3000/api/inventario-version/get/verificar/piezas-completas`
- Query Params:
  - `materiaId`: 123 (o `productoId`: 456)

**Respuesta esperada:**
```json
{
  "success": true,
  "materiaId": 123,
  "productoId": null,
  "unidad": "mt2",
  "tipo": "MP",
  "requierePiezasCompletas": true
}
```

---

### 2. Transferir Material (Materia Prima: Bodega 1 → 4)

**Endpoint:**
```
POST /api/inventario-version/post/bodega/movimientos-version
```

**Ejemplo con cURL:**
```bash
curl -X POST "http://localhost:3000/api/inventario-version/post/bodega/movimientos-version" \
  -H "Content-Type: application/json" \
  -d '{
    "materiaId": 123,
    "cantidad": 3.2,
    "tipoProducto": "Materia Prima",
    "tipo": "TRANSFERENCIA",
    "ubicacionOrigenId": 1,
    "ubicacionDestinoId": 4,
    "refDoc": "REF-TEST-001",
    "comprasCotizacionId": 456,
    "cotizacionId": 789
  }'
```

**Ejemplo con Postman:**
- Método: POST
- URL: `http://localhost:3000/api/inventario-version/post/bodega/movimientos-version`
- Headers:
  - `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "materiaId": 123,
  "cantidad": 3.2,
  "tipoProducto": "Materia Prima",
  "tipo": "TRANSFERENCIA",
  "ubicacionOrigenId": 1,
  "ubicacionDestinoId": 4,
  "refDoc": "REF-TEST-001",
  "comprasCotizacionId": 456,
  "cotizacionId": 789
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "msg": "Transferencia de piezas completas realizada exitosamente.",
  "data": {
    "success": true,
    "tipoProducto": "MP",
    "idProductoOMateria": 123,
    "unidad": "mt2",
    "requierePiezasCompletas": true,
    "ubicacionOrigenId": 1,
    "ubicacionDestinoId": 4,
    "cantidadSolicitada": 3.2,
    "cantidadTransferida": 4.0,
    "comprasCotizacionId": 456,
    "cotizacionId": 789,
    "detalles": [...]
  }
}
```

---

### 3. Transferir Producto Terminado (Bodega 2 → 5)

**Ejemplo con Postman:**
```json
{
  "productoId": 456,
  "cantidad": 5,
  "tipoProducto": "Producto",
  "tipo": "TRANSFERENCIA",
  "ubicacionOrigenId": 2,
  "ubicacionDestinoId": 5,
  "refDoc": "REF-PT-001",
  "comprasCotizacionId": 789,
  "cotizacionId": 101
}
```

---

## ⚠️ Validaciones Importantes

### Campos Obligatorios:
- `materiaId` o `productoId` (al menos uno)
- `cantidad`
- `tipoProducto`: "Materia Prima" o "MP" para bodega 1, "Producto" o "PR" para bodega 2
- `tipo`: Siempre "TRANSFERENCIA"
- `ubicacionOrigenId`: 1 (MP) o 2 (PT)
- `ubicacionDestinoId`: 4 (MP) o 5 (PT)
- `refDoc`: Referencia del documento
- `comprasCotizacionId`: **OBLIGATORIO** - ID de orden de compra

### Campos Opcionales:
- `cotizacionId`: ID de cotización/proyecto
- `usuarioId`: ID de usuario (se toma de req.user si está autenticado)

---

## 🔍 Qué Verificar Después de la Transferencia

1. **En Bodega Origen (1 o 2):**
   - Los items físicos deben tener `cantidadDisponible` reducida o en 0
   - Estado debe cambiar a "Cortada" o "Agotada"

2. **En Bodega Destino (4 o 5):**
   - Deben crearse nuevos items físicos
   - `cantidadDisponible` debe ser la cantidad transferida
   - `comprasCotizacionId` debe estar asociado

3. **Movimientos:**
   - Debe haber un movimiento SALIDA en origen
   - Debe haber un movimiento ENTRADA en destino
   - Ambos deben tener el mismo `comprasCotizacionId`

---

## 🐛 Errores Comunes

### Error: "comprasCotizacionId es obligatorio"
**Solución:** Agrega `comprasCotizacionId` en el body de la petición.

### Error: "Transferencia versionada solo permite: Bodega 1→4 o 2→5"
**Solución:** Verifica que `ubicacionOrigenId` y `ubicacionDestinoId` sean correctos:
- MP: 1 → 4
- PT: 2 → 5

### Error: "No hay ítems disponibles en la ubicación de origen"
**Solución:** Asegúrate de que haya stock disponible en la bodega origen antes de transferir.

### Error: "Stock insuficiente"
**Solución:** Verifica que la cantidad solicitada no exceda el stock disponible.

---

## 💡 Tips para Probar

1. **Empieza con el endpoint de prueba:**
   ```
   GET /api/inventario-version/get/prueba
   ```
   Te dará toda la información que necesitas.

2. **Verifica la unidad primero:**
   ```
   GET /api/inventario-version/get/verificar/piezas-completas?materiaId=123
   ```
   Así sabrás si transferirá piezas completas o cantidad exacta.

3. **Usa cantidades pequeñas al principio:**
   - Prueba con 1 o 2 unidades
   - Verifica que todo funcione
   - Luego prueba con cantidades mayores

4. **Revisa los logs del servidor:**
   - Los errores se muestran en la consola
   - Te ayudará a entender qué está pasando

---

## 📞 Próximos Pasos

1. Prueba el endpoint de prueba para ver la estructura
2. Verifica una materia prima para ver su unidad
3. Haz una transferencia pequeña
4. Verifica en la base de datos que todo se creó correctamente
5. Prueba con diferentes unidades (mt2, mt, kg, unidad)
