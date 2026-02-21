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
                    MATCH (:Player {uid: $playerId})-[r:PLAYED]-(p2:Player)
                    ORDER BY r.timestamp DESC
                    LIMIT 3
                    RETURN p2.uid AS uid,
                        p2.username AS username,
                        r.result AS result,
                        r.playerScore AS playerScore,
                        r.opponentScore AS opponentScore,
                        r.timestamp AS date
                `, { playerId });

                return data.records.map(record => ({
                    opponentID: record.get('uid'),
                    opponentUsername: record.get('username'),
                    result: record.get('result') === 'W' ? 'Win' : 'Loss',
                    playerScore: neo4j.integer.toNumber(record.get('playerScore')),
                    opponentScore: neo4j.integer.toNumber(record.get('opponentScore')),
                    date: record.get('date'),
                }));
            } else {
                const data = await tx.run(`
                    MATCH (p1:Player)-[r:PLAYED]->(p2:Player)
                    WHERE p1.username < p2.username
                    ORDER BY r.timestamp DESC
                    LIMIT 3
                    RETURN p1.username AS player1,
                        p2.username AS player2,
                        r.result AS result,
                        r.playerScore AS playerScore,
                        r.opponentScore AS opponentScore,
                        r.timestamp AS timestamp
                `);

                return data.records.map(record => {
                    const playerScore = neo4j.integer.toNumber(record.get('playerScore'));
                    const opponentScore = neo4j.integer.toNumber(record.get('opponentScore'));
                    return {
                        player1: record.get('player1'),
                        player2: record.get('player2'),
                        winner: record.get('result') === 'W' ? record.get('player1') : record.get('player2'),
                        score: `${playerScore}-${opponentScore}`,
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