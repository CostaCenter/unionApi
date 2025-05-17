const { materia, kit, itemKit, armado, armadoKits, proveedor, price, linea, categoria } = require('../../db/db');


// Add Items To Armado. 
const addItemToArmado = async (armadoId, kitId, cantidad,) => {
    try{
        // Buscamos que exista el MtId y el Kit.
        const searchKit = await kit.findByPk(kitId).catch(err => null);
        if(!searchKit) return 404

        const searchArmado = await armado.findOne({
            where: {
                id: armadoId
            }
        }).catch(err => {
            console.log(err);
            return 502; 
        });
        if(!searchArmado) return 404
        
        const existeItem = await armadoKits.findOne({
            where: {
                kitId: kitId,
                armadoId: armadoId
            }
        }).catch(err => null);

        if(existeItem) return 200;
       
        // Caso contrario... 
        const addItemToKitSend = await armadoKits.create({
            cantidad,
            kitId,
            armadoId,
        }).catch(err => {
            console.log(err); 
            return 502;
        })
        return addItemToKitSend; 

    }catch(err){
        console.log(err);
        return 500;
    } 
}

// Eliminar item de un kit
const deleteDeleteItemOArmado = async (kitId, armadoId) => {
    try{    
        // Validamos que los parámetros entren realmente.
        // Caso contrario, avanzamos...
        const searchKit = await kit.findByPk(kitId);
        const searchArmado = await armado.findByPk(armadoId);
        // const searchKitItem = await itemKit.findOne({
        //     where: {
        //         materiaId: itemId,
        //         kitId: kitId
        //     }
        // }).catch(err => null);

        // Si no hay resultados, envia respuesta
        const deletee = await searchArmado.removeMateria(searchKit);
        if(!deletee) return 502
        return 200

    }catch(err){
        console.log(err);
        return 500
    }
}
// Exportación
module.exports = {
    addItemToArmado, // Agregar kit a un nuevo componente
    deleteDeleteItemOArmado, // Eliminar kit del componente
}