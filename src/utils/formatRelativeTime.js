import { DateTime } from "neo4j-driver";

/**
 * 
 * @param {DateTime} neoDateTime The time to be formatted
 * @returns A formatted string
 */
const formatRelativeTime = (neoDateTime) => {
    console.log('erm what this');
    for (const [k, v] of Object.entries(neoDateTime)) {
        console.log(`${k}: ${v}`);
    }
    const date = neoDateTime.toStandardDate();

    console.log('neo date', date.toDateString());

    const now = Date.now();
    now.to
    const diffInSeconds = Math.floor((now - date) / 1000);
    console.log('diff in seconds:', diffInSeconds);

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