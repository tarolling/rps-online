import neo4j, { DateTime } from "neo4j-driver";

/**
 * 
 * @param {DateTime} neoDateTime The time to be formatted
 * @returns A formatted string
 */
const formatRelativeTime = (neoDateTime) => {
    const date = new Date(
        Date.UTC(
            neo4j.integer.toNumber(neoDateTime.year),
            neo4j.integer.toNumber(neoDateTime.month) - 1,
            neo4j.integer.toNumber(neoDateTime.day),
            neo4j.integer.toNumber(neoDateTime.hour),
            neo4j.integer.toNumber(neoDateTime.minute),
            neo4j.integer.toNumber(neoDateTime.second),
            neo4j.integer.toNumber(neoDateTime.nanosecond) / 1000000
        )
    );

    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60,
        second: 1
    };

    if (diffInSeconds < 0) {
        return 'in the future';
    }

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const count = Math.floor(diffInSeconds / secondsInUnit);

        if (count > 0) {
            if (unit === 'second' && count < 10) {
                return 'just now';
            }

            const plural = count === 1 ? '' : 's';
            return `${count} ${unit}${plural} ago`;
        }
    }

    return 'just now';
};

export default formatRelativeTime;