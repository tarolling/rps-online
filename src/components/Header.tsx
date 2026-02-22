'use client'

import { useState } from 'react';
import styles from '../styles/header.module.css'
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function Header() {
    const router = useRouter();
    const { user } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        await signOut(auth);
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/logout`, { method: 'POST' }); // clear session cookie
        router.push('/login');
    }

    return (
        <div className={styles.header}>
            <div className={styles["header-logo"]}>
                <Link href="/">
                    <Image src="/logo.png" alt="RPS logo" className={styles.logo} width={60} height={60}></Image>
                </Link>
            </div>

            {/* Hamburger Menu Button */}
            <button
                className={`${styles['hamburger-menu']} ${isMobileMenuOpen ? styles.open : ''}`}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle navigation menu"
            >
                <span></span><span></span><span></span>
            </button>

            {/* Navigation Links */}
            <nav className={`${styles['header-nav']} ${isMobileMenuOpen ? styles['mobile-open'] : ''}`}>
                <Link href="/" className={styles.navLink}>Home</Link>
                <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
                <Link href="/leaderboard" className={styles.navLink}>Leaderboard</Link>
                <Link href="/play" className={styles.navLink}>Play</Link>
                <Link href="/rules" className={styles.navLink}>Rules</Link>
                <Link href="/clubs" className={styles.navLink}>Clubs</Link>
                <Link href="/tournaments" className={styles.navLink}>Tournaments</Link>

                <div className={styles['mobile-auth']}>
                    {user ? (
                        <>
                            <Link href={`/profile/${user.uid}`} className={styles.navLink}>
                                <button>Profile</button>
                            </Link>
                            <button onClick={handleLogout} className={styles.navLink}>Logout</button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className={styles.navLink}>
                                <button>Log In</button>
                            </Link>
                            <Link href="/register" className={styles.navLink}>
                                <button>Register</button>
                            </Link>
                        </>
                    )}
                </div>
            </nav>

            {/* Desktop User Menu */}
            <div className={styles.headerUser}>
                {user ? (
                    <div className={styles['profile-dropdown']} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                        <Image
                            src={user.photoURL ?? '/logo.png'}
                            alt="Profile"
                            className={styles['profile-pic']}
                            width={40} height={40}
                        />
                        <div className={`${styles['dropdown-content']} ${isDropdownOpen ? styles.show : ''}`}>
                            <Link href={`/profile/${user.uid}`} className={styles['dropdown-item']}>Profile</Link>
                            <button onClick={handleLogout} className={styles['dropdown-item']}>Log Out</button>
                        </div>
                    </div>
                ) : (
                    <div className={styles['auth-buttons']}>
                        <Link href="/login">
                            <button>Log In</button>
                        </Link>
                        <Link href="/register">
                            <button>Register</button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}