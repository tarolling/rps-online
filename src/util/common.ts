export enum GameState {
    Waiting = "WAITING",
    InProgress = "IN_PROGRESS",
    Finished = "FINISHED"
}

export enum Choice {
    Rock = "ROCK",
    Paper = "PAPER",
    Scissors = "SCISSORS"
};

export const GameResults = {
    WIN: 'W',
    LOSS: 'L',
    WIN_AFK: 'W_AFK',
    LOSS_AFK: 'L_AFK',
    DRAW_AFK: 'D_AFK'
};