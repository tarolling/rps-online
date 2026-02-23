import styles from './Avatar.module.css';

type AvatarProps = {
    src?: string | null;
    username?: string;
    size?: 'sm' | 'md' | 'lg';
};

export default function Avatar({ src, username = '?', size = 'md' }: AvatarProps) {
    const initial = username.charAt(0).toUpperCase();

    return (
        <div className={`${styles.avatar} ${styles[size]}`}>
            {src
                ? <img src={src} alt={username} className={styles.img} />
                : <span className={styles.initial}>{initial}</span>
            }
        </div>
    );
}