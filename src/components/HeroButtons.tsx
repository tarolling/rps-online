"use client";
import Link from "next/link";
import styles from "@/app/page.module.css";

export default function HeroButtons() {
    return (
        <div className={styles.heroButtons}>
            <Link href="/rules" className={styles.secondaryButton}>Learn the Rules</Link>
            <Link href="/dashboard" className={styles.ctaButton}>Play Now</Link>
        </div>
    );
}