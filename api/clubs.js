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
                data = await session.executeWrite(async tx => {
                    return await tx.run(`
                    MATCH (p:Player {uid: $founderID})
                    CREATE (p)-[:MEMBER {role: 'Founder'}]->(c:Club $props)
                    `, {
                        founderID: req.body.founderID,
                        props: {
                            name: req.body.name,
                            tag: req.body.tag,
                            availability: req.body.availability,
                        }
                    });
                });
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
                    RETURN c.name AS name
                    `, { searchTerm: req.body.searchTerm });
                });
                data = data.records.map((record) => ({
                    name: record.get("name")
                }));
                resultBody = { clubs: data };
                break;
            case 'user':
                data = await session.executeRead(async tx => {
                    return await tx.run(`
                    MATCH (p:Player {uid: $uid})-[r:MEMBER]->(c:Club)
                    RETURN c.name AS name,
                        c.tag AS tag,
                        r.role AS memberRole
                    `, { uid: req.body.uid });
                });

                data = data.records.map((record) => ({
                    name: record.get("name"),
                    tag: record.get("tag"),
                    role: record.get("memberRole")
                }));
                resultBody = { clubs: data };
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