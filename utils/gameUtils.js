const setPresentsReward = (character) => {
    try {
        switch (character) {
            case 0:
              //Swordman
              return [14011, 14012, 14013, 14014, 14015, 14016];
            case 1:
              //Archer
              return [14017, 14018, 14019, 14020, 14021, 14022];
            case 2:
              //Black
              return [14023, 14024, 14025, 14026, 14027, 14028];
            case 3:
              //Mage
              return [14029, 14030, 14031, 14032, 14033, 14034];
            case 4:
              //Ninja
              return [14035, 14036, 14037, 14038, 14039, 14040];
            default:
              break;
          }
  
    } catch (error) {
      console.error(`Error al entregar premios:`, error);
      throw error;
    }
  };

  export { setPresentsReward };