/**
 * [Link to original algorithm in Python](https://web.archive.org/web/20201022115133/http://rpscontest.com/entry/175002)
 * @returns closure
 */
export default function setupAI() {
    const randomChoice = (choices) => choices[Math.floor(Math.random() * choices.length)];

    const beat = { P: "S", S: "R", R: "P" };
    const cede = { P: "R", S: "P", R: "S" };
    const score = { RR: 0, PP: 0, SS: 0, PR: 1, RS: 1, SP: 1, RP: -1, SR: -1, PS: -1 };

    let bothHist = "";
    let myHist = "";
    let oppHist = "";

    let bothPatterns = {};
    let oppPatterns = {};
    let myPatterns = {};

    let both2Patterns = {};
    let opp2Patterns = {};
    let my2Patterns = {};

    let output = randomChoice(["R", "P", "S"]);
    let candidates = Array(36).fill(output);
    let performance = Array(36).fill([0, 0]);

    return function (input) {
        if (input === "") {
            return output;
        }

        for (let length = Math.min(5, myHist.length); length > 0; length--) {
            const oppPattern = oppHist.slice(-length);
            const myPattern = myHist.slice(-length);
            const bothPattern = bothHist.slice(-2 * length);

            if (oppPatterns[oppPattern]) {
                for (let l2 = Math.min(5, oppPatterns[oppPattern].length); l2 > 0; l2--) {
                    const subPattern = oppPatterns[oppPattern].slice(-2 * l2);
                    opp2Patterns[subPattern] = (opp2Patterns[subPattern] || "") + output + input;
                }
            }
            oppPatterns[oppPattern] = (oppPatterns[oppPattern] || "") + output + input;

            if (myPatterns[myPattern]) {
                for (let l2 = Math.min(5, myPatterns[myPattern].length); l2 > 0; l2--) {
                    const subPattern = myPatterns[myPattern].slice(-2 * l2);
                    my2Patterns[subPattern] = (my2Patterns[subPattern] || "") + output + input;
                }
            }
            myPatterns[myPattern] = (myPatterns[myPattern] || "") + output + input;

            if (bothPatterns[bothPattern]) {
                for (let l2 = Math.min(5, bothPatterns[bothPattern].length); l2 > 0; l2--) {
                    const subPattern = bothPatterns[bothPattern].slice(-2 * l2);
                    both2Patterns[subPattern] = (both2Patterns[subPattern] || "") + output + input;
                }
            }
            bothPatterns[bothPattern] = (bothPatterns[bothPattern] || "") + output + input;
        }

        bothHist += output + input;
        myHist += output;
        oppHist += input;

        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            const result = score[c + input] || 0;
            performance[i] = [result === 1 ? performance[i][0] + 1 : 0, performance[i][1] + result];
        }

        output = randomChoice(["R", "P", "S"]);
        candidates.fill(output);

        const idx = performance.reduce((bestIdx, p, i) => {
            const score = Math.pow(p[0], 3) + p[1];
            const bestScore = Math.pow(performance[bestIdx][0], 3) + performance[bestIdx][1];
            return score > bestScore ? i : bestIdx;
        }, 0);

        for (let length = Math.min(5, myHist.length); length > 0; length--) {
            const pattern = bothPatterns[bothHist.slice(-2 * length)];
            if (pattern) {
                const opp = pattern.slice(-1);
                const my = pattern.slice(-2, -1);
                candidates[0] = beat[opp];
                candidates[1] = cede[my];
                candidates[2] = opp;
                candidates[3] = my;
                candidates[4] = cede[opp];
                candidates[5] = beat[my];

                for (let l2 = Math.min(5, pattern.length); l2 > 0; l2--) {
                    const subPattern = both2Patterns[pattern.slice(-2 * l2)];
                    if (subPattern) {
                        const opp2 = subPattern.slice(-1);
                        const my2 = subPattern.slice(-2, -1);
                        candidates[6] = beat[opp2];
                        candidates[7] = cede[my2];
                        candidates[8] = opp2;
                        candidates[9] = my2;
                        candidates[10] = cede[opp2];
                        candidates[11] = beat[my2];
                        break;
                    }
                }
                break;
            }
        }

        for (let length = Math.min(5, myHist.length); length > 0; length--) {
            const pattern = myPatterns[myHist.slice(-length)];
            if (pattern) {
                const opp = pattern.slice(-1);
                const my = pattern.slice(-2, -1);
                candidates[24] = beat[opp];
                candidates[25] = cede[my];
                candidates[26] = opp;
                candidates[27] = my;
                candidates[28] = cede[opp];
                candidates[29] = beat[my];

                for (let l2 = Math.min(5, pattern.length); l2 > 0; l2--) {
                    const subPattern = my2Patterns[pattern.slice(-2 * l2)];
                    if (subPattern) {
                        const opp2 = subPattern.slice(-1);
                        const my2 = subPattern.slice(-2, -1);
                        candidates[30] = beat[opp2];
                        candidates[31] = cede[my2];
                        candidates[32] = opp2;
                        candidates[33] = my2;
                        candidates[34] = cede[opp2];
                        candidates[35] = beat[my2];
                        break;
                    }
                }
                break;
            }
        }

        for (let length = Math.min(5, oppHist.length); length > 0; length--) {
            const pattern = oppPatterns[oppHist.slice(-length)];
            if (pattern) {
                const opp = pattern.slice(-1);
                const my = pattern.slice(-2, -1);
                candidates[12] = beat[opp];
                candidates[13] = cede[my];
                candidates[14] = opp;
                candidates[15] = my;
                candidates[16] = cede[opp];
                candidates[17] = beat[my];

                for (let l2 = Math.min(5, pattern.length); l2 > 0; l2--) {
                    const subPattern = opp2Patterns[pattern.slice(-2 * l2)];
                    if (subPattern) {
                        const opp2 = subPattern.slice(-1);
                        const my2 = subPattern.slice(-2, -1);
                        candidates[18] = beat[opp2];
                        candidates[19] = cede[my2];
                        candidates[20] = opp2;
                        candidates[21] = my2;
                        candidates[22] = cede[opp2];
                        candidates[23] = beat[my2];
                        break;
                    }
                }
                break;
            }
        }

        output = candidates[idx];
        return output;
    };
}