import Evento from "../models/eventosModel.js";
import { Sequelize, Op } from 'sequelize';
import sequelize from "../config/database.js";
import { getDateMinusTimeZone } from "../utils/utils.js";

// Desactivar logs de Sequelize temporalmente
//const sequelize = new Sequelize({ logging: false });

const actualizarEventos = async () => {
    try {

        sequelize.options.logging = false;
        // Obtener todos los eventos que cumplen con las condiciones
        const eventos = await Evento.findAll({
            where: {
                estado: 1,
                inicio: { [Op.lt]: new Date()},
            }
        });
        sequelize.options.logging = console.log;
        const date = new Date();
        // Actualizar el campo 'show' según las condiciones
        for (const evento of eventos) {
            const inicio = getDateMinusTimeZone(evento.inicio);
            const fin = evento.fin ? getDateMinusTimeZone(evento.fin) : null;

            console.log(inicio);
console.log(date);
console.log(fin);

            if (fin !== null && fin < date) {
                evento.show = 0;
            } else if ((fin === null && inicio < date) || (fin !== null && fin > date && inicio < date)){
                evento.show = 1;
            }
            await evento.save();
        }

        //console.log(`Eventos actualizados: ${eventos.length}`);
    } catch (error) {
        console.error('Error al actualizar eventos:', error);
    }
};

// Función para ejecutar la función de actualización de eventos cada segundo
const ejecutarActualizacionPeriodica = () => {
    setInterval(async () => {
        await actualizarEventos();
    }, 1000);
};

ejecutarActualizacionPeriodica();
