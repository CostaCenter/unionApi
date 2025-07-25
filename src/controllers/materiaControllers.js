const express = require('express');
const { materia, proveedor, price, linea, categoria, db } = require('../db/db');
const { Op } = require('sequelize');
const { searchPrice, addPriceMt, updatePriceState,  } = require('./services/priceServices');

// Controladores para Materia de prima

const buscarPorQuery = async (req, res) => {
    try {
      const { q } = req.query; // ejemplo: /buscar?q=mesa
  
      const resultados = await materia.findAll({
        where: {
            [Op.or]: [
                { item: { [Op.iLike]: `%${q}%` } },
                { description: { [Op.iLike]: `%${q}%` } },
            
            ]
        }
      });
  
      res.json(resultados);
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error en la búsqueda' });
    }
}
// Consultar elemento individual
const getItem = async (req, res) => {
    try{
        // Recibimos Id por params
        const { itemId } = req.params;
        // Validamos que el parámetro entre correctamente
        if(!itemId) return res.status(501).json({msg: 'Parámetro invalido'});

        // Caso contrario, avanzamos 
        const searchItem = await materia.findOne({
            where: {
                id:itemId
            },
            include: [{
                model: price,
                where: {
                    state: 'active'
                },
                include: [{
                    model: proveedor,
                    attributes:['id', 'type', 'nit', 'nombre']
                }],
                required:false
            }, {
                model: categoria
            }, {
                model: linea
            }],
            order: [
                // Ordenamos por la fecha de creación del proveedor anidado
                [price, proveedor, 'createdAt', 'DESC']
            ]
        }).catch(err => {
            console.log(err);
            return null;
        });

        // Validamos que el resultado contenga un registro.
        if(!searchItem) return res.status(404).json({msg: 'No hemos encontrado este item'});

        // caso contrario, avanzamos (200). Succesful!
        res.status(200).json(searchItem);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}
// Consultar toda la matería prima
const getAllMateria = async(req, res) => {
    try{
        // Procedemos a buscar todos los elementos de matería prima
        const searchAllMateria = await materia.findAll({
            include: [{
                model: price,
                where: {
                    state: 'active'
                },
                required:false
            }],
            order:[['description', 'ASC']]
        })
        .catch(err => {
            console.log(err);
            return null; 
        });
        // Validamos que existan regsitros.
        if(!searchAllMateria || !searchAllMateria.length) return res.status(404).json({msg: 'No hay registros para mostrar'});
        // Caso contrario, enviamos respuesta
        res.status(200).json(searchAllMateria);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}
// Agregar al sistema
const addMateria = async(req, res) => {
    try{
        // Recibimos datos por body
        const { item, description, unidad, medida, peso, volumen, procedencia, criticidad, lineaId, categoriumId, calibre } = req.body;

        // Validamos que los datos entren correctamente
        if(!item || !description || !medida || !lineaId || !categoriumId) return res.status(501).json({msg: 'Los parámetros no son validos.'});
        // Caso contrario, avanzamos 

        // Buscamos 
        const searchMateria = await materia.findOne({
            where: { 
                item
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta
        if(searchMateria) return res.status(200).json({msg: 'Ya existe un item con este nombre.'});
        // Caso contrario, creamos el item 

        const createItem = await materia.create({
            item,
            description,
            medida, 
            unidad,
            peso, 
            volumen,
            procedencia,
            criticidad,
            lineaId,
            categoriumId,
            calibre
        }).catch(err => {
            console.log(err);
            return null
        }); 
        
        // Validamos la respuesta
        if(!createItem) return res.status(502).json({msg: 'No hemos logrado crer este item, intentalo más tarde'});

        // Caso contrario, enviamos el registro, 201. Succesful!
        res.status(201).json(createItem);
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}


// Actualizar item
const updateMateria = async(req, res) => {
    try{
        // Recibimos datos por body
        const { itemId, item, description, medida, unidad, peso, volumen, procedencia, criticidad, lineaId, categoriaId, calibre } = req.body;

        // Validamos que los datos entren correctamente
        if(!itemId) return res.status(501).json({msg: 'Parámetro invalido.'});
        // Caso contrario, avanzamos
 
        // Buscamos 
        const searchMateria = await materia.findByPk(itemId).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos la respuesta
        if(!searchMateria) return res.status(404).json({msg: 'No hemos encontrado este registro.'});
        // Caso contrario, creamos el item

        const updateItem = await materia.update({
            item,
            description,
            medida,
            unidad,
            peso,
            volumen,
            procedencia,
            criticidad,
            lineaId,
            categoriumId: categoriaId,
            calibre
        }, {
            where: {
                id: itemId
            }
        }).catch(err => {
            console.log(err);
            return null
        });
        
        // Validamos la respuesta
        if(!updateItem) return res.status(502).json({msg: 'No hemos logrado actualizar este item, intentalo más tarde'});

        // Caso contrario, enviamos el registro, 201. Succesful!
        res.status(201).json({msg: 'Item actualizado con éxito'});
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Clonar mt
const clonarMateriaPrima = async (req, res) => { 
     const transaction = await db.transaction();

    try{ 
        // Recibimos parametro por params
        const { MPID , userId} = req.body;
        if(!MPID) return res.status(501).json({msg: 'Invado el parámetro'})
        // Definimos la transacción

        const MpOriginal = await materia.findByPk(MPID, {
            include: [{
                model: price,
            }]
        }, {
            transaction
        }).catch(err => {
            console.log(err);
            return null; 
        });

        // Validamos la existencia
        if(!MpOriginal) {
            await transaction.rollback();
            return res.status(404).json({msg: 'No hemos encontrado este kit'});
        }
        // Caso contrario, avanzamos...

        const nuevoMateria = await materia.create({
            item: MpOriginal.item,
            description: MpOriginal.description,
            peso: MpOriginal.peso,
            volumen: MpOriginal.volumen,
            procedencia: MpOriginal.procendencia,
            criticidad: MpOriginal.criticidad,
            medida: MpOriginal.medida,
            unidad: MpOriginal.unidad,
            lineaId: MpOriginal.lineaId, 
            categoriumId: MpOriginal.categoriumId,

        }, { transaction }); 

        if(!nuevoMateria) { 
            await transaction.rollback();
            return res.status(502).json({msg: 'No hemos logrado crear esto.'});
        }

        // Listamos la materia
        const precio = MpOriginal.prices.map((pric) => ({
            valor: String(pric.valor),
            iva: pric.iva,
            descuentos: pric.descuentos,
            materiumId: nuevoMateria.id,
            proveedorId: pric.proveedorId,
            state: String(pric.state),
        }));
        // Caso contrario
        // Caso contrario, avanzamos
        if(precio.length > 0){
            await price.bulkCreate(precio,  { transaction })
            .then((res) =>  {
                return true
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

        console.error('Error en la funcion clonar producto.', err);

        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

// Eliminar Kit
const deleteMP = async(req, res) => {
    try{
        const { materiaId, userId } = req.body;

        if(!materiaId) return res.status(501).json({msg: 'El parámetro no es valido.'});
        // Caso contrario, avanzamos

        const materiaAEliminar = await materia.findByPk(materiaId).catch(err => null);
        // Validamos
        if(!materiaAEliminar) return res.status(404).json({msg: 'No hemos encontrado este kit.'});
        
        const sendRemove = await materiaAEliminar.destroy()

        if(!sendRemove) return res.state(502).json({msg: 'No hemos logrado eliminar esto'});
        // Caso contrario, avanzamos
        res.status(200).json({msg: 'Eliminado con éxito'});

    }catch(err){    
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal'});
    }
}

// Agregar un precio según proveedor a MT
const addPriceMateriaPrima = async(req, res) => {
    try{
        // Recibimos datos por body
        const { mtId, pvId, price, iva, descuentos } = req.body;
        // Validamos que entren los parámetros.
        
        // Consultamos precio.
        const consultarPrice = await searchPrice(mtId, pvId).catch(err => null);
        
        // Validamos respuesta
        if(consultarPrice == 404){
            const addPriceMtVar = await addPriceMt(mtId, pvId, price, iva, descuentos)
            .catch(err => {
                console.log(err);
                return null;
            })
            // Si Arroja 404
            if(addPriceMtVar == 501) return res.status(501).json({msg: 'Parámetros no validos'});

            if(addPriceMtVar == 404) return res.status(501).json({msg: 'No hemos encontrado esto.'});

            // Si arroja 501
            if(addPriceMtVar == 502) return res.status(501).json({msg: 'No hemos logrado crear esto.'});
            
            return res.status(201).json(addPriceMtVar);
        }else{
            // Enviamos petición para actualizar precio.
            const updateStatePrice = await updatePriceState(mtId, pvId, 'changed')
            .then(async (result) => {
                // Una vez actualizado el estado del precio. Actualizamos ahora si nuevo precio.
                if(result == 200){
                    const addPriceMtVar = await addPriceMt(mtId, pvId, price, iva, descuentos)
                    .catch(err => {
                        console.log(err);
                        return null;
                    })

                    return addPriceMtVar;
                }else{
                    return result
                }
            })
            .catch(err => null);
            // Validamos resultado. 
            // Si Arroja 404
            if(updateStatePrice == 501) return res.status(501).json({msg: 'Parámetros no validos'});

            if(updateStatePrice == 404) return res.status(501).json({msg: 'No hemos encontrado esto.'});

            // Si arroja 501
            if(updateStatePrice == 502) return res.status(501).json({msg: 'No hemos logrado actualizar esto.'});

            return res.status(201).json(updateStatePrice); 
        }

    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

const updatePricesMP = async (req, res) => {
    // Buscamos productos
    const searchAllPrices = await price.findAll();

    if(!searchAllPrices) return res.status(404).json({msg: 'No hemos encontrado esto.'});

    searchAllPrices.map(async (pr, i) => {
        const valorActual = pr.valor; // Este valor pasará a descuento.
        const valorIva = Number(Number(valorActual) * 0.19).toFixed(0);
        const final = Number(Number(valorActual) + Number(valorIva)).toFixed(0)
        const updatePrices = await price.update({
            iva: valorIva,
            valor: final
        }, {
            where: {
                id: pr.id
            }
        });
        return updatePrices
    })

    // Actualizado con éxito
    res.status(200).json({msg: 'Materia prima actualizada'})
}

const updateToInactivePCMP = async (req, res) => {
    try{
        // Recibimos datos por body
        const { priceId} = req.body;
        // Validamos la entrada
        if(!priceId ) return res.status(400).json({msg: 'Recibimos datos por body'});
        // Avanzamos
        const updateThat = await price.update({
            state: 'changed'
        }, {
            where: {
                id: priceId
            }
        });
        if(!updateThat) return res.status(502).json({msg:'No logrados actualizar esto.'});
        // Caso contrario:
        res.status(201).json({msg: 'Actualizado con éxito'})
    }catch(err){
        console.log(err);
        res.status(500).json({msg: 'Ha ocurrido un error en la principal.'});
    }
}

module.exports = { 
    buscarPorQuery, // Buscador
    getItem, // Obtener item individual
    getAllMateria, // Obtener todos los registros de la tabla. Sin filtros**
    addMateria, // Agregar matería al sistema. 
    clonarMateriaPrima, // Clonar item  
    deleteMP, // Eliminar MP
    updateMateria, // Actualizar item
    addPriceMateriaPrima, // Agregar precio
    updatePricesMP, // Actualizar MP
    updateToInactivePCMP, // Change state to "Changed"
}