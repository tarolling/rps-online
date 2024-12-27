import neo4j from "neo4j-driver";

let driver;
try {
    driver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
    );
} catch (error) {
    console.error('Failed to create driver:', error);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { methodType } = req.body;
    let session;
    try {
        if (!driver) {
            return res.status(503).json({ error: 'Database connection not available' });
        }

        session = driver.session({ database: 'neo4j' });
        let data;
        let resultBody = { success: true };

        switch (methodType) {
            case 'create':
                break;
            case 'join':
                break;
            case 'leave':
                break;
            case 'search':
                data = await session.executeRead(async tx => {
                    return await tx.run(`
                    MATCH (c:Club)
                    WHERE toLower(c.name) CONTAINS toLower($searchTerm)
                    RETURN c.id AS id, c.name AS name
                    `, { searchTerm: req.body.searchTerm });
                });

                resultBody = { clubs: data.records };
                break;
            case 'user':
                break;
            default:
                throw new Error("Method type not specified");
        }

        res.status(200).json(resultBody);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error });
    } finally {
        if (session) await session.close();
    }


}