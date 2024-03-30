const setPresentsReward = (character) => {
    try {
        switch (character) {
            case 0:
              //Swordman
              return [1001,1101,1201,1301,1401,1501];
            case 1:
              //Archer
              return [2001,2101,2201,2301,2401,2501];
            case 2:
              //Black
              return [3001,3101,3201,3301,3401,3501];
            case 3:
              //Mage
              return [4001,4101,4201,4301,4401,4501];
            case 4:
              //Ninja
              return [5001,5101,5201,5301,5401,5501];
            default:
              break;
          }
  
    } catch (error) {
      console.error(`Error al entregar premios:`, error);
      throw error;
    }
  };

  export { setPresentsReward };