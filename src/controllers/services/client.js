const { materia, kit, itemKit, proveedor, price, linea, categoria } = require('../../db/db');

// Nuevo cliente
const newClientService = async () => {
    try{ 

    }catch(err){
        console.log(err);
        return 500
    }
}


// Exportación
module.exports = {
    newClientService
}