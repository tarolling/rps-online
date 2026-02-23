// how long in seconds to wait before the game until a forfeit is granted
export const WAITING_TIMEOUT: number = 15;

// how long in seconds to wait during the game until a forfeit is granted
export const DISCONNECT_TIMEOUT: number = 10;

export enum GameState {
    Waiting = "WAITING",
    InProgress = "IN_PROGRESS",
    Finished = "FINISHED",
    Cancelled = "CANCELLED",
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