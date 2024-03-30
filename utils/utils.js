const getFormatDate = (isoDate) => {
    // Convertir la fecha de la base de datos a un objeto Date
    const date = new Date(isoDate);

    // Obtener los componentes de la fecha
    const day = String(date.getDate()).padStart(2, '0'); // Añadir ceros al día si es necesario
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Añadir ceros al mes si es necesario
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    // Formatear la fecha como DD/MM/YYYY HH:MM:SS
    const fechaFormateada = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

    return fechaFormateada;

}

export {getFormatDate};