const { materia, kit, itemKit, proveedor, price, linea, categoria } = require('../../db/db');

// SearchKit
const searchKit = async(nombre, extension) => {
    try{
        const searchKit = await kit.findOne({
            where: {
                name: nombre,
                extensionId: extension
            }
        }).catch(err => null);
        // Si no hay registro, avanzamos
        if(!searchKit) return 404;
        // Si existe un registro, enviamos 200
        return 200

    }catch(err){
        console.log(err);
        return 500
    }
}
// Buscar un precio para u n MP de un PV
const createKitServices = async(code, nombre, description, extension, linea, categoria) => {
    try{
        if(!nombre || !extension) return 501
        // Caso contrario, avanzamos...

        const addNewKit = await kit.create({
            code, 
            name: nombre,
            description,
            extensionId: extension,
            lineaId: linea,
            categorium: categoria
        }).catch(err => {
            console.log(err);
            return 502;
        });

        return addNewKit;

    }catch(err){
        console.log(err);
        return 500
    }
} 
 
// Add Items To Kit. 
const addItemToKit = async (mtId, kitId, cantidad, medida, calibre) => {
    try{
        // Buscamos que exista el MtId y el Kit.
        const searchKit = await kit.findByPk(kitId).catch(err => null);
        if(!searchKit) return 404

        const searcMateria = await materia.findOne({
            where: {
                id: mtId
            },
            include:[{
                model: price,
                where: {
                    state: 'active'
                },
                required:true
            }]
        }).catch(err => {
            console.log(err);
            return 502; 
        });
        if(!searcMateria) return 404
        
        const existeItem = await itemKit.findOne({
            where: {
                kitId: kitId,
                materiaId: mtId
            }
        }).catch(err => null);

        if(existeItem) return 200;
       
        // Caso contrario... 
        const addItemToKitSend = await itemKit.create({
            cantidad,
            medida,
            kitId,
            materiaId: mtId,
            calibre
        }).catch(err => {
            console.log(err);
            return 502;
        })
        console.log(addItemToKitSend)
        return addItemToKitSend;
    }catch(err){
        console.log(err);
        return 500;
    } 
}

// Eliminar item de un kit
const deleteDeleteItemOnKit = async (kitId, itemId) => {
    try{    
        // Validamos que los parámetros entren realmente.
        // Caso contrario, avanzamos...
        const searchKit = await kit.findByPk(kitId);
        const searchMateria = await materia.findByPk(itemId);
        // const searchKitItem = await itemKit.findOne({
        //     where: {
        //         materiaId: itemId,
        //         kitId: kitId
        //     }
        // }).catch(err => null);

        // Si no hay resultados, envia respuesta
        const deletee = await searchKit.removeMateria(searchMateria);
        if(!deletee) return 502
        return 200

    }catch(err){
        console.log(err);
        return 500
    }
}
// Cambiar estado del kit
const changeState = async(kitId, state) => {
    try{
        const updateState = await kit.update({
            state
        }, {
            where: {
                id: kitId
            }
        }).catch(err => {
            console.log(err);
            return null
        })
        if(!updateState) return 502
        return 200
    }catch(err){
        console.log(err);
        return 500
    }
}
// Exportación
module.exports = {
    searchKit, // Buscar Kit
    createKitServices, // Crear un Kit
    addItemToKit, // Agregamos item a  kit.
    deleteDeleteItemOnKit, // Eliminar item de un Kit
    changeState, // Actualizar estado del kit 
}