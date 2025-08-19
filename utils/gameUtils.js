import RewardClaim from "../models/rewardsClaim.js";

const setPresentsReward = (character) => {
    try {
        switch (character) {
          case 0:
            // Swordman
            return {
              i: [1013, 1113, 1213, 1313, 1437, 1537],
              m: 'un Set Bone de Swordman'
            };
          case 1:
            // Archer
            return {
              i: [2013, 2113, 2213, 2343, 2437, 2537],
              m: 'un Set Bone de Archer'
            };
          case 2:
            // Black
            return {
              i: [3013, 3113, 3213, 3313, 3437, 3537],
              m: 'un Set Bone de Black'
            };
          case 3:
            // Mage
            return {
              i: [4013, 4113, 4213, 4313, 4437, 4537],
              m: 'un Set Bone de Mage'
            };
          case 4:
            // Ninja
            return {
              i: [5013, 5113, 5213, 5313, 5437, 5537],
              m: 'un Set Bone de Ninja'
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