const dayjs = require('dayjs');
const { materia, kit, log, itemKit, proveedor, price, linea, categoria } = require('../../db/db');

// SearchKit
const addLog = async(entidad, entidadId, accion, detalle, userId, segunda_id) => {
    try{
        const dia = dayjs();
        const addingLog = await log.create({
            entidad,
            entidad_id: entidadId,
            segunda_id,
            accion,
            detalle,
            fecha: dia, 
            userId
        }).catch(err => null); 
        // Si no hay registro, avanzamos
        if(!addingLog) return 404;
        // Si existe un registro, enviamos 200
        return 200

    }catch(err){
        console.log(err);
        return 500
    }
}

// Exportación
module.exports = {
    addLog, // Buscar Kit
}