import RewardClaim from "../models/rewardsClaim.js";

const setPresentsReward = (character) => {
    try {
        switch (character) {
          case 0:
            // Swordman (class 1)
            return {
              i: [1009, 1109, 1209, 1309, 1409, 1509],
              m: 'un Set DarkKnight de Swordman'
            };
          case 1:
            // Archer (class 2)
            return {
              i: [2009, 2109, 2209, 2309, 2409, 2509],
              m: 'un Set DarkKnight de Archer'
            };
          case 2:
            // Black (class 4)
            return {
              i: [3009, 3109, 3209, 3309, 3409, 3509],
              m: 'un Set DarkKnight de Black'
            };
          case 3:
            // Mage (class 8)
            return {
              i: [4009, 4109, 4209, 4309, 4409, 4509],
              m: 'un Set DarkKnight de Mage'
            };
          case 4:
            // Ninja (class 16)
            return {
              i: [5009, 5109, 5209, 5309, 5409, 5509],
              m: 'un Set DarkKnight de Ninja'
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