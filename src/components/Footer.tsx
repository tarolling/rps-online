'use client'

import Image from "next/image"
import styles from "./footer.module.css"
import Link from "next/link";

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles["footer-content"]}>
                <div className={styles["footer-section"]}>
                    <Link href="/">
                        <Image src="/logo.png" alt="RPS logo" width={50} height={50} className="footer-logo"></Image>
                    </Link>
                    <p className="footer-tagline">Play. Compete. Conquer.</p>
                </div>

                <div className={styles["footer-section"]}>
                    <h3>Navigation</h3>
                    <Link href='/' className={styles["footer-link"]}>
                        Home
                    </Link>
                    <Link href='/dashboard' className={styles["footer-link"]}>
                        Dashboard
                    </Link>
                    <Link href='/leaderboard' className={styles["footer-link"]}>
                        Leaderboard
                    </Link>
                    <Link href='/play' className={styles["footer-link"]}>
                        Play
                    </Link>
                    <Link href='/rules' className={styles["footer-link"]}>
                        Rules
                    </Link>
                    <Link href='/clubs' className={styles["footer-link"]}>
                        Clubs
                    </Link>
                    <Link href='/tournaments' className={styles["footer-link"]}>
                        Tournaments
                    </Link>
                </div>

                <div className={styles["footer-section"]}>
                    <h3>Community</h3>
                    <a
                        href="https://discord.gg/9msWyzbf84"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles["footer-social-link"]}
                    >
                        Discord
                    </a>
                    <a
                        href="https://github.com/tarolling/rps-online"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles["footer-social-link"]}
                    >
                        GitHub
                    </a>
                    <a
                        href="https://www.instagram.com/rankedrps/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles["footer-social-link"]}
                    >
                        Instagram
                    </a>
                    <a
                        href="https://x.com/RankedRPS"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles["footer-social-link"]}
                    >
                        X
                    </a>
                    <a
                        href="https://www.reddit.com/r/RankedRPS/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles["footer-social-link"]}
                    >
                        Reddit
                    </a>
                </div>
            </div>
            <div className={styles["footer-bottom"]}>
                <p>&copy; {new Date().getFullYear()} Ranked RPS. All rights reserved.</p>
            </div>
        </footer>
    );
}