export default async function handler(req, res) {
    if (req.method === 'GET') {
        // mock data for leaderboard
        const leaderboard = [
            { player: 'Alice', score: 1200 },
            { player: 'Bob', score: 1150 },
            { player: 'Charlie', score: 1100 },
        ];
        res.status(200).json(leaderboard);
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
