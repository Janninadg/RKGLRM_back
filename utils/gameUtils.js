import RewardClaim from "../models/rewardsClaim.js";

const setPresentsReward = (character) => {
    try {
        switch (character) {
          case 0:
            // Swordman
            return {
              i: [1043, 1143, 1243, 1343, 1443, 1543],
              m: 'un Set Damned de Swordman'
            };
          case 1:
            // Archer
            return {
              i: [2043, 2143, 2243, 2343, 2443, 2543],
              m: 'un Set Damned de Archer'
            };
          case 2:
            // Black
            return {
              i: [3043, 3143, 3243, 3343, 3443, 3543],
              m: 'un Set Damned de Black'
            };
          case 3:
            // Mage
            return {
              i: [4043, 4143, 4243, 4343, 4443, 4543],
              m: 'un Set Damned de Mage'
            };
          case 4:
            // Ninja
            return {
              i: [5043, 5143, 5243, 5343, 5443, 5543],
              m: 'un Set Damned de Ninja'
            };
          default:
            return null;
        }
  
    } catch (error) {
      console.error(`Error al entregar premios:`, error);
      throw error;
    }
};

const hasUserClaimed = async (userId) => {
  // Obtenemos la fecha actual en formato "YYYY-MM-DD"
  const todayStr = new Date().toISOString().split('T')[0];

  // Buscamos un registro en reward_claims para ese usuario y la fecha actual
  const claim = await RewardClaim.findOne({
    where: {
      user_id: userId,
      claim_date: todayStr
    }
  });

  // Retornamos true si existe un registro, false en caso contrario
  return claim !== null;
};

  export { setPresentsReward,hasUserClaimed };