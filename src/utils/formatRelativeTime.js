const formatRelativeTime = (neoDateTime) => {
    const date = new Date(
        neoDateTime.year,
        neoDateTime.month - 1,
        neoDateTime.day,
        neoDateTime.hour,
        neoDateTime.minute,
        neoDateTime.second,
        neoDateTime.nanosecond / 1000000
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