const { user } = require('../db/db');
const authConfig = require('../../config/auth');

const jwt = require('jsonwebtoken');
  
const isAuthenticated = async (req,res,next)=>{
        const token = req.headers.authorization.split(' ')[1];
        if(!token){
            console.log('logueate, por favor');
            return next('Please login to access the data');
        }
        try {
            const verify = jwt.verify(token,authConfig.secret);
            req.user = verify; 
            
            next();
        } catch (error) {
            console.log('intenta pero falla');
            return next(error);  
        }
}



module.exports = isAuthenticated; 