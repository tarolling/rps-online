import { getDriver } from '@/lib/neo4j';
import neo4j from 'neo4j-driver';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const url = request.nextUrl;
    const playerId = url.searchParams.get('playerId');

    const session = getDriver().session({ database: 'neo4j' });

    try {
        const response = await session.executeRead(async tx => {
            if (playerId) {
                const data = await tx.run(`
                    MATCH (p:Player {uid: $playerId})-[r:PLAYED]-(opp:Player)
                    ORDER BY r.timestamp DESC
                    LIMIT 3
                    RETURN opp.uid AS uid,
                        opp.username AS username,
                        r.winnerId AS winnerId,
                        r.playerOneScore AS playerOneScore,
                        r.playerTwoScore AS playerTwoScore,
                        r.timestamp AS date,
                        CASE
                            WHEN startNode(r) = p THEN 1
                            ELSE 2
                        END AS player
                `, { playerId });

                return data.records.map(record => ({
                    opponentID: record.get('uid'),
                    opponentUsername: record.get('username'),
                    result: record.get('winnerId') === playerId ? 'Win' : 'Loss',
                    playerScore: neo4j.integer.toNumber(record.get('player')) === 1 ? neo4j.integer.toNumber(record.get('playerOneScore')) : neo4j.integer.toNumber(record.get('playerTwoScore')),
                    opponentScore: neo4j.integer.toNumber(record.get('player')) === 2 ? neo4j.integer.toNumber(record.get('playerOneScore')) : neo4j.integer.toNumber(record.get('playerTwoScore')),
                    date: record.get('date'),
                }));
            } else {
                const data = await tx.run(`
                    MATCH (p1:Player)-[r:PLAYED]->(p2:Player)
                    ORDER BY r.timestamp DESC
                    LIMIT 3
                    RETURN p1.uid AS playerOneId,
                        p1.username AS playerOneUsername,
                        p2.uid AS playerTwoId, 
                        p2.username AS playerTwoUsername,
                        r.winnerId AS winner,
                        r.playerOneScore AS playerOneScore,
                        r.playerTwoScore AS playerTwoScore,
                        r.timestamp AS timestamp
                `);

                return data.records.map(record => {
                    const playerOneScore = neo4j.integer.toNumber(record.get('playerOneScore'));
                    const playerTwoScore = neo4j.integer.toNumber(record.get('playerTwoScore'));
                    return {
                        player1: record.get('playerOneUsername'),
                        player2: record.get('playerTwoUsername'),
                        winner: record.get('winner') === record.get('playerOneId') ? record.get('playerOneUsername') : record.get('playerTwoUsername'),
                        score: `${playerOneScore}-${playerTwoScore}`,
                        timestamp: record.get('timestamp'),
                    };
                });
            }
        });

        return NextResponse.json(response);
    } catch (err) {
        console.error('Error fetching recent games:', err);
        return NextResponse.json({ error: 'Failed to fetch recent games.' }, { status: 500 });
    } finally {
        await session.close();
    }
}