import { K, minInc, maxInc, distributionFactor } from '../config/settings.json';

/**
 * 
 * @param {number} playerRating The player's rating
 * @param {number} oppRating The opponent's rating
 * @param {boolean} won Whether the player won
 * @returns The player's new rating
 */
export default function calculateRating(playerRating, oppRating, won) {
    const winnerRating = won ? playerRating : oppRating;
    const loserRating = won ? oppRating : playerRating;

    let larger, smaller, expectedWin, expectedLoss;
    if (winnerRating >= loserRating) {
        larger = Math.pow(10, (winnerRating) / distributionFactor);
        smaller = Math.pow(10, (loserRating) / distributionFactor);

        expectedWin = larger / (larger + smaller);
        expectedLoss = smaller / (larger + smaller);
    } else {
        larger = Math.pow(10, (loserRating) / distributionFactor);
        smaller = Math.pow(10, (winnerRating) / distributionFactor);

        expectedWin = smaller / (larger + smaller);
        expectedLoss = larger / (larger + smaller);
    }

    let winInc = Math.round(K * (1 - expectedWin));
    let loseInc = Math.round(K * (0 - expectedLoss));

    winInc = Math.max(minInc, Math.min(maxInc, winInc));
    loseInc = Math.max(-maxInc, Math.min(-minInc, loseInc));

    return won ? playerRating + winInc : playerRating + loseInc;
}
