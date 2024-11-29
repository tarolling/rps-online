import neo4j from "neo4j-driver";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = await req.json();

    let driver, session;
    try {
        driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD))
        const serverInfo = await driver.getServerInfo()
    } catch (err) {
        console.error(`Connection error\n${err}\nCause: ${err.cause}`)
        await driver.close()
        return
    }

    session = driver.session({ database: 'neo4j' })
    const username = await session.executeWrite(async tx => {
        let result

        result = await tx.run(`
        MERGE (p:Player {id: $id, username: $username})
        ON CREATE
            SET p.created = timestamp()
            SET p.lastSeen = timestamp()
        ON MATCH
            SET p.lastSeen = timestamp()
        RETURN p.username AS username
        `, { id: id, username: "TEST" }
        )

        if (!result || result.records.length === 0) {
            res.status(503)
            throw new Error('Unable to modify player.')
        }
        return result.records[0].get('username')
    });

    console.log(`User ${username} added!`)

    await session.close()
    await driver.close()
    res.status(200);
}