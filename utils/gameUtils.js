const setPresentsReward = (character) => {
    try {
        switch (character) {
            case 0:
              //Swordman
              return {i:[14011, 14012, 14013, 14014, 14015, 14016],m:'un Set de Swordman'};
            case 1:
              //Archer
              return {i:[14017, 14018, 14019, 14020, 14021, 14022],m:'un Set de Archer'};;
            case 2:
              //Black
              return {i:[14023, 14024, 14025, 14026, 14027, 14028],m:'un Set de Black'};;
            case 3:
              //Mage
              return {i:[14029, 14030, 14031, 14032, 14033, 14034],m:'un Set de Mage'};;
            case 4:
              //Ninja
              return {i:[14035, 14036, 14037, 14038, 14039, 14040],m:'un Set de Ninja'};;
            default:
              return null;
          }
  
    } catch (error) {
      console.error(`Error al entregar premios:`, error);
      throw error;
    }
  };

  export { setPresentsReward };