const express = require('express');
const { materia, proveedor, extension, price, kit, itemKit, linea, categoria, percentage, Op, db, literal} = require('../db/db');
const { searchPrice, addPriceMt, updatePriceState,  } = require('./services/priceServices');
const { searchKit, createKitServices, addItemToKit, deleteDeleteItemOnKit, changeState } = require('./services/kitServices');
const { addLog } = require('./services/logServices');


// Buscamos kits para cotizar por Query
const searchKitsForCoti = async (req, res) => {
    try{
        // Recibo dato por query
        const { query } = req.query; // Obtiene el parámetro de búsqueda desde la URL

        if (!query) {
            return res.status(400).json({ message: "Debes proporcionar un término de búsqueda." });
        }

        const kits = await kit.findAll({
            where: {
                [Op.and]: [
                    { state: 'completa' },
                    {
                        [Op.or]: [
                            { name: { [Op.iLike]: `%${query}%` } }, // Búsqueda flexible (ignora mayúsculas/minúsculas)
                            { id: query }
                        ],
                    }
                ]
                
            },  
            include:[{
                model: materia,
                attributes: { exclude: ['createdAt', 'updatedAt'] },
                include:[{
                    model: price,
                    where: {
                        state: 'active'
                    }, 
                    attributes: { exclude: ['createdAt', 'updatedAt'] },

                }]
            },{
                model: categoria
            },
            {
                model: linea,
                include:[{
                    model: percentage,
                    where: {
                        state: 'active'
                    },
                    required:false

                }]
            },{
                model: extension
            }],
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            
        }).catch((err => {
            console.log(err);
            return null; 
        }));

        if(!kits) return res.status(404).json({msg: 'No encontrado'})

        res.status(200).json(kits);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}
// Buscamos kits por Query
const searchKitsQuery = async(req, res) => {
    try {
        const { query } = req.query; // Obtiene el parámetro de búsqueda desde la URL

        if (!query) {
            return res.status(400).json({ message: "Debes proporcionar un término de búsqueda." });
        }

        const kits = await kit.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.iLike]: `%${query}%` } }, // Búsqueda flexible (ignora mayúsculas/minúsculas)
                ],
                state: 'completa'
            },
            attributes: { exclude: ['createdAt', 'updatedAt'] },
            limit: 10, // Máximo 10 resultados para eficiencia
        }).catch((err => {
            console.log(err);
            return null;
        }));

        if(!kits) return res.status(404).json({msg: 'No encontrado'})

        res.status(200).json(kits);
    } catch (error) {
        console.error("Error al buscar productos:", error);
        res.status(500).json({ message: "Error interno del servidor" });
    }
}
// Obtener todos los kikts Terminados
const getAllKitCompleted = async(req, res) => {
    try{
        // Buscamos todos los elementos dentro de la base de datos
        const searchAll = await kit.findAll({
            where: {
                state: 'completa'
            },
            include:[{
                model: materia,
                attributes: { exclude: ['createdAt', 'updatedAt'] },
                include:[{
                    model: price,
                    where: {
                        state: 'active'
                    }, 
                    attributes: { exclude: ['createdAt', 'updatedAt'] },

                }]
            },{
                model: categoria
            },
            {
                model: linea,
                include:[{
                    model: percentage,
                    where: {
                        state: 'active'
                    },
                    required:false

                }]
            },{
                model: extension
            }] 
        }).catch(err => {
            console.log(err)
            return null
        });

        if(!searchAll) return res.status(404).json({msg: 'No hemos encontrado esto'});

        // caso contrario, enviamos resultados
        res.status(200).json(searchAll)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}

// Obtener kits sin precio
const getKits = async(req, res) => {
    try{
        // Buscamos todos los elementos dentro de la base de datos
        const searchAll = await kit.findAll({
            include:[{  
                model: categoria,
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'code'] }
            },
            {
                model: linea,
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'code'] }
            },{
                model: extension,
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type'] }
            }], 
            order:[['createdAt', 'DESC']]
        }).catch(err => {
            console.log(err)
            return null
        });

        if(!searchAll) return res.status(404).json({msg: 'No hemos encontrado esto'});

        // caso contrario, enviamos resultados
        res.status(200).json(searchAll)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}
// Obtener todos los kikts
const getAllKit = async(req, res) => {
    try{
        // Buscamos todos los elementos dentro de la base de datos 
        
        
        const searchAll = await kit.findAll({
            include:[{
                model: materia,
                include:[{
                    model: price,
                    where: {
                        state: 'active'
                    }
                }]
            },{ 
                model: categoria,
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'code', 'state'] }
            },{
                model: linea,
                include:[{
                    model: percentage,
                    where: {
                        state: 'active'
                    },
                    required:false

                }],
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'code', 'state'] }
                
            },{ 
                model: extension,
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'state'] }

            }] ,
            order:[['name', 'ASC']]
        }).catch(err => {
            console.log(err)
            return null
        });

        if(!searchAll) return res.status(404).json({msg: 'No hemos encontrado esto'});

        // caso contrario, enviamos resultados
        res.status(200).json(searchAll)
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'})
    }
}
// Obtenemos un Kit con precios
const getKit = async(req, res) => {
    try{
        // Recibimos body
        const { kitId } = req.params;
        if(!kitId) return res.status(404).json({msg: 'Parámetro no es valido.'});
        
        // Caso contrario, avanzamos
        const searchKit = await kit.findOne({
            where: {
                id: kitId
            },
            include:[{
                model:materia,
                attributes:['id', 'item', 'description', 'medida', 'unidad'],
                include:[{
                    model: price,
                    where: {
                        state: 'active'
                    },
                    attributes: ['id', 'valor', 'iva', 'descuentos', 'state']
                }]
            },{ 
                model: categoria,
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'code', 'state'] }
            },
            {
                model: linea,
                include:[{
                    model: percentage,
                    where: {
                        state: 'active'
                    },
                    required:false

                }], 
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'code', 'state'] }
            },{ 
                model: extension,
                attributes: { exclude: ['createdAt', 'updatedAt', 'description', 'type', 'state'] }

            }]
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!searchKit) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        // Caso contrario, avanzamos
        res.status(201).json(searchKit);
    
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Creamos un kit

const addKit = async (req, res) => {
    try{
        // Recibimos datos por body
        const { code, nombre, description, extension, linea, categoria, userId } = req.body;
        // Validamos que los datos entren correctamente
        if(!nombre || !extension) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos...
 
        // Validamos que no exista un kit con todos las condiciones
        const searchK = await searchKit(nombre, extension).catch(err => null);

        if(searchK == 404){
            const addKit = await createKitServices(code, nombre, description, extension, linea, categoria)
            .catch(err => {
                console.log(err);
                return null;
            })
            if(addKit == 502) return res.status(500).json({msg: 'No hemos logrado crear este kit'})
            // Entidad, entidadId, accion, detalle, fecha, userId
            const a = await addLog('kits', addKit.id, 'create', 'Creo nuevo kit', userId)
            return res.status(201).json(addKit); 


        }else if(searchK == 200){
            return res.status(200).json({msg: 'Ya existe este kit.'});
        }else{
            return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        }
    }catch(err){
        console.log(err);
        return res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Update Basic information about Kit
const updateKitt = async (req, res) => {
    try{
        // Recibimos datos por body
        const { kitId, nombre, description, extensionId, lineaId, categoriumId, userId } = req.body;

        // Validamos
        if(!kitId) return res.status(501).json({msg: 'Parametro invalido.'});
        // Caso contrario, avanzamos
        const updateKit = await kit.update({
            name: nombre,
            description,
            extensionId: extensionId,
            lineaId: lineaId,
            categoriumId: categoriumId
        }, {
            where: {
                id: kitId
            }
        })
        .then(async (res) => {
            // Entidad, entidadId, accion, detalle, fecha, userId
            const a = await addLog('kits', kitId, 'update', 'Actualizó datos generales de este kit', userId)
            return res
        })
        .catch(err => {
            console.log(err);
            return 502;
        });
        if(!updateKit) return res.status(502).json({msg: 'No hemos logrado actualizar esto.'});
        // Caso contrario
        res.status(200).json({msg: 'Actualizado con éxito'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Agregamos item al Kit
const addItem = async (req, res) => {
    try{
        // Recibimos datos por body
        const { mtId, kitId, cantidad, medida, calibre, userId} = req.body;

        //Validamos que entren correctamente.
        if(!mtId || !kitId || !cantidad || !medida) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        
        // Caso contrario, avanzamos...

        const addChoosed = await addItemToKit(mtId, kitId, cantidad, medida, calibre)
        .then(async res => {
            const updateKit = await changeState(kitId, 'desarrollo')
            return res
        })
        .then(async (res) => {
            // Entidad, entidadId, accion, detalle, fecha, userId
            const a = await addLog('kits', kitId, 'add', 'Añadió materia prima al kit', userId, mtId)
            return res
        })
        .catch(err => {
            console.log(err); 
            return null
        });
        if(addChoosed == 500) return res.status(500).json({msg: 'Falló la función.'});
        if(addChoosed == 502) return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        if(addChoosed == 404) return res.status(404).json({msg: 'No hemos encontrado esto.'});
        if(addChoosed == 200) return res.status(404).json({msg: 'Este item ya hace parte del kit'});
        
        res.status(201).json(addChoosed)

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

const updateItemOnKit = async (req, res) => {
    try{
        // Recibimos por body
        const { kitId, materiaId, medida, userId } = req.body;
        // Validamos que los datos entren correctamente
        if(!kitId || !materiaId || !medida) return res.status(400).json({msg: 'No hemos recibido los datos correctamente.'});
        // Caso contrario, avanzamos

        const updateItemKit = itemKit.update({
            medida
        }, {
            where: {
                kitId,
                materiaId
            }
        }).then(async (res) => {
            // Entidad, entidadId, accion, detalle, fecha, userId
            const a = await addLog('kits', kitId, 'update', 'Modificó cantidades del kit', userId, materiaId)
            return res
        });

        if(!updateItemKit) return res.status(502).json({msg: 'No hemos encontrado esto.'});
        // Avanzamos
        res.status(201).json({msg: 'Actualizado con exito'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}
// Clonar KIT
const clonarKit = async (req, res) => { 
    try{
        // Recibimos parametro por params
        const { kitId , userId} = req.params;
        if(!kitId) return res.status(501).json({msg: 'Invado el parámetro'})
        // Definimos la transacción
        const transaction = await db.transaction();

        const kitOriginal = await kit.findByPk(kitId, {
            include: [{ model: materia }],
            transaction
        }).catch(err => {
            console.log(err);
            return null; 
        });

        // Validamos la existencia
        if(!kitOriginal) {
            await transaction.rollback();
            return res.status(404).json({msg: 'No hemos encontrado este kit'});
        }
        // Caso contrario, avanzamos...

        const nuevoKit = await kit.create({
            name: kitOriginal.name,
            description: kitOriginal.description,
            lineaId: kitOriginal.lineaId, 
            categoriumId: kitOriginal.categoriumId,
            extensionId: kitOriginal.extensionId,
            state: kitOriginal.state

        }, { transaction }); 

        if(!nuevoKit) { 
            await transaction.rollback();
            return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        }

        // Listamos la materia
        const nuevaMateria = kitOriginal.materia.map((mp) => ({
            cantidad: String(mp.itemKit.cantidad),
            medida: String(mp.itemKit.medida),
            materiaId: mp.itemKit.materiaId, 
            calibre: mp.calibre ? mp.itemKit.calibre : null,
            kitId: nuevoKit.id
        }));
        // Caso contrario
        // Caso contrario, avanzamos
        if(nuevaMateria.length > 0){
            await itemKit.bulkCreate(nuevaMateria,  { transaction })
            .then((res) =>  {
                return true
            })
            .then(async (res) => {
                // Entidad, entidadId, accion, detalle, fecha, userId
                const a = await addLog('kits', nuevoKit.id, 'create', 'Clonó este kit.', userId)
                return res
            })
            
            await transaction.commit();
            return res.status(201).json({msg: 'Kit clonado con éxito!'});
        }else{

            await transaction.commit();

            return res.status(201).json({msg: 'Kit clonado con éxito (El Kit original no tenia items).'})
        }
    }catch(err){
        if (transaction) {
            try {
                 await transaction.rollback();
                 console.error('Rollback de transacción exitoso.');
            } catch (rollbackErr) {
                 console.error('Error haciendo rollback de la transacción:', rollbackErr);
                 // Opcional: reportar este error de rollback si es crítico
            }
        }

        console.error('Error en la funcion clonar Kit.', err);

        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}


// Eliminar elemento del Kit
const deleteItemOnKit = async(req, res) => {
    try{
        // Recibo dos varaibles por body
        const { kitId, itemId, userId} = req.body;
        // Validamos
        if(!kitId || !itemId) return res.status(501).json({msg: 'Los parámetros no son validos'});
        
        // Caso contrario, avanzamos...
        const sendToDelete = await deleteDeleteItemOnKit(kitId, itemId)
        .then(async res => {
            const updateKit = await changeState(kitId, 'desarrollo')
            return res
        })
        .then(async (res) => {
            // Entidad, entidadId, accion, detalle, fecha, userId
            const a = await addLog('kits', kitId, 'delete', 'Elimino matería prima del kit', userId, itemId)
            return res
        })
        .catch(err => null);

        if(sendToDelete == 502) return res.status(502).json({msg: 'No hemos logrado eliminar esto.'});
        // Caso contrario.
        res.status(200).json({msg: 'Eliminado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

const changeStateToKit = async(req, res) => {
    try{
        // Recibo parámetros por body
        const { kitId, state, userId } = req.body;
        if(!kitId || !state) return res.status(501).json({msg: 'Los parámetros no son validos'});
        // Caso contrario

        const sendPeti = await changeState(kitId, state).catch(err => null)
        if(!sendPeti) return res.status(502).json({msg: 'No hemos logrado actualizar esto'});
        // caso contrario, actualizado con exito.
        const a = await addLog('kits', addKit, 'update', `Cambio el estado del kit a ${state}`, userId)
        res.status(200).json({msg: 'Actualizado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'})
    }
}
// Eliminar Kit
const deleteKit = async(req, res) => {
    try{
        const { kitId, userId } = req.params;

        if(!kitId) return res.status(501).json({msg: 'El parámetro no es valido.'});
        // Caso contrario, avanzamos

        const kitAEliminar = await kit.findByPk(kitId).catch(err => null);
        // Validamos
        if(!kitAEliminar) return res.status(404).json({msg: 'No hemos encontrado este kit.'});
        
        const sendRemove = await kitAEliminar.destroy()
        .then(async (res) => {
            // Entidad, entidadId, accion, detalle, fecha, userId
            const a = await addLog('kits', kitId, 'delete', 'Eliminó kit', userId)
            return res
        }).catch(err => {
            console.log(err);
            return null;
        });

        if(!sendRemove) return res.state(502).json({msg: 'No hemos logrado eliminar esto'});
        // Caso contrario, avanzamos
        res.status(200).json({msg: 'Eliminado con éxito'});

    }catch(err){    
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}
module.exports = { 
    searchKitsQuery, // SearchKits With Query
    addKit, // Agregamos KIT.
    addItem, // Agregar Item
    updateKitt, // Actualizar kit
    clonarKit, // Clonar Kit
    deleteKit, // Eliminar Kit
    getKit, // Obtenemos el KIT
    deleteItemOnKit, // Eliminar item del kit
    getAllKit, // Obtenemos todos los kits 
    getKits, // Obtenemos los kits sin precios
    changeStateToKit, // Actualizar estado del kit
    getAllKitCompleted, // Obtener solo kits completos
    updateItemOnKit, // Update ItemKits
    searchKitsForCoti, // Buscamos kits para cotizar
}