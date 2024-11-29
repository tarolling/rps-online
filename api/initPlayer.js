export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
    }

    if ('NEO4J_URI' in process.env) {
        let uri = true;
    }

    if ('NEO4J_USERNAME' in process.env) {
        let username = true;
    }

    // mock data for leaderboard
    const leaderboard = [
        { player: 'Alice', score: 1200 },
        { player: 'Bob', score: 1150 },
        { player: 'Charlie', score: 1100 },
        { player: uri, score: username }
    ];
    res.status(200).json(leaderboard);
}