export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { playerId, choice } = req.body;

        // mock opponent choice and result logic
        const choices = ['rock', 'paper', 'scissors'];
        const opponentChoice = choices[Math.floor(Math.random() * choices.length)];
        let result = 'draw';

        if ((choice === 'rock' && opponentChoice === 'scissors') ||
            (choice === 'scissors' && opponentChoice === 'paper') ||
            (choice === 'paper' && opponentChoice === 'rock')) {
            result = 'win';
        } else if (choice !== opponentChoice) {
            result = 'lose';
        }

        // sim saving the game result to Neo4j
        res.status(200).json({ result, opponentChoice });
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
