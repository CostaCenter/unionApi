const { materia, kit, itemKit, proveedor, price, inventario, ubicacion, movimientoInventario } = require('../../db/db');

// Nuevo cliente
const addMovimientoToInventario = async (object) => {
    try{ 
        // Recibimos parámetros. 
        const { cantidad, tipoMovimiento, referenciaDeDocumento, documentoId, notas, materia, origen, destino} = object;
        
        // Desarrollamos la lógica del movimiento inventario.
        // Tipos de movimientos: 
        // ENTRADAS ------------------
        // Entradas manuales
        // Entradas por OC
        // Devolución de producción
        // Ajuste positivo - AP
        // SALIDAS DE STOCK --------------
        // De Bodega a Producción
        // De terminado a cliente.
        // Perdida o Desecho.
        // Ajuste negativo - AP
        // TRANSFERENCIA ENTRE UBICACIONES --------------
        // Movimiento entre bodegas - Bodega principal a Bodega de en proceso - 
    }catch(err){
        console.log(err);
        return 500
    }
}


// Exportación
module.exports = {
    newClientService
}