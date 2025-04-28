const { user } = require('../../db/db');

const validateEmailService = async(email) => {
    try{
        // Procedemos a validar el email
        const searchEmail = await user.findOne({
            where: {
                email
            }
        }).catch(err => {
            console.log(err);
            return null;
        });
        // Validamos respuesta
        if(!searchEmail) 404;
        // Caso contrario, enviamos código 200
        return searchEmail
    }catch(err){
        console.log(err);
        return 500
    }
}
// Exportación
module.exports = {
    validateEmailService, // Para validar Email 
}