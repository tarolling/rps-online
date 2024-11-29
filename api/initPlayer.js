export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const uri = 'NEO4J_URI' in process.env;
    const username = 'NEO4J_USERNAME' in process.env;

    // mock data for leaderboard
    const leaderboard = [
        { player: 'Alice', score: 1200 },
        { player: 'Bob', score: 1150 },
        { player: 'Charlie', score: 1100 },
        { player: uri ? 'NEO4J_URI is set' : 'NEO4J_URI is not set', score: uri ? 100 : 0 },
        { player: username ? 'NEO4J_URI is set' : 'NEO4J_URI is not set', score: username ? 100 : 0 }
    ];
    res.status(200).json(leaderboard);
}