const setPresentsReward = (character) => {
    try {
        switch (character) {
            case 0:
              //Swordman
              return {i:[1008, 1108, 1208, 1308, 1408, 1508],m:'un Set Knight de Swordman'};
            case 1:
              //Archer
              return {i:[2008, 2108, 2208, 2308, 2408, 2508],m:'un Set Knight de Archer'};;
            case 2:
              //Black
              return {i:[3008, 3108, 3208, 3308, 3408, 3508],m:'un Set Knight de Black'};;
            case 3:
              //Mage
              return {i:[4008, 4108, 4208, 4308, 4408, 4508],m:'un Set Knight de Mage'};;
            case 4:
              //Ninja
              return {i:[5008, 5108, 5208, 5308, 5408, 5508],m:'un Set Knight de Ninja'};;
            default:
              return null;
          }
  
    } catch (error) {
      console.error(`Error al entregar premios:`, error);
      throw error;
    }
  };

  export { setPresentsReward };