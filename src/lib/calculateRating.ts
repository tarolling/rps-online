import config from "@/config/settings.json";

/**
 * 
 * @param {number} playerRating The player's rating
 * @param {number} oppRating The opponent's rating
 * @param {boolean} won Whether the player won
 * @returns The player's new rating
 */
export default function calculateRating(playerRating: number, oppRating: number, won: boolean): number {
  const winnerRating = won ? playerRating : oppRating;
  const loserRating = won ? oppRating : playerRating;

  let larger, smaller, expectedWin, expectedLoss;
  if (winnerRating >= loserRating) {
    larger = Math.pow(10, (winnerRating) / config.distributionFactor);
    smaller = Math.pow(10, (loserRating) / config.distributionFactor);

    expectedWin = larger / (larger + smaller);
    expectedLoss = smaller / (larger + smaller);
  } else {
    larger = Math.pow(10, (loserRating) / config.distributionFactor);
    smaller = Math.pow(10, (winnerRating) / config.distributionFactor);

    expectedWin = smaller / (larger + smaller);
    expectedLoss = larger / (larger + smaller);
  }

  const winInc = Math.round(config.K * (1 - expectedWin));
  const loseInc = Math.round(config.K * (0 - expectedLoss));

  return won ? playerRating + winInc : playerRating + loseInc;
}