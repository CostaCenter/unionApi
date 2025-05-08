const { cotizacion, kitCotizacion, requisicion } = require('../../db/db');

// Crear requsición
const createRequisicion = async(nombre, fecha, para, cotizacionId) => {
    // Validamos la entrada de los parámetros.
    if(!cotizacionId || !nombre) return 501;
    // Caso contrario, enviamos
    const newReq = await requisicion.create({
        nombre, fecha,
        estado: 'pendiente',
        fechaNecesaria: para,
        cotizacionId
    }).catch(err => {
        console.log(err);
        return null;
    });

    // Validamos la respuesta
    if(!newReq) return 502
    // Caso contrario. Enviamos respuesta completa
    return newReq;
}

// Exportación
module.exports = {
    createRequisicion,
}