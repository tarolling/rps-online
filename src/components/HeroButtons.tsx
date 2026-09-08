"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "@/app/page.module.css";
import { signInAsGuest } from "@/lib/guestAuth";

export default function HeroButtons() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handlePlayAsGuest = async () => {
    setLoading(true);
    try {
      await signInAsGuest();
      router.push("/play?guest=1");
    } catch (err) {
      console.error("Guest sign-in failed:", err);
      setLoading(false);
    }
  };

  return (
    <div className={styles.heroButtons}>
      <Link href="/rules" className={styles.secondaryButton}>Learn the Rules</Link>
      <Link href="/play" className={styles.ctaButton}>Play Now</Link>
      <button className={styles.ctaButton} onClick={handlePlayAsGuest} disabled={loading}>
        {loading ? "Starting…" : "Play as Guest"}
      </button>
    </div>
  );
}
