import React, { useState } from 'react';

async function LeaderboardPage() {
    const hello = await fetch('/api/leaderboard', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    console.log(`hello response: ${hello}`)

    // const [players, setPlayers] = useState('');

    // const refresh = async () => {
    //     let temp = await fetch('/api/leaderboard', {
    //         method: 'GET',
    //         headers: {
    //             'Content-Type': 'application/json',
    //         },
    //     });
    //     setPlayers(temp);
    // };

    return (
        <div>
            <h1>leaderboard in progress...</h1>
            {/* <button onClick={refresh()}>click me</button>
            {players && <p>You chose: {players}</p>} */}
        </div>
    )
}

export default LeaderboardPage;