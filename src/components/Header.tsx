"use client";

import { useState } from "react";
import styles from "./header.module.css";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Avatar from "@/components/Avatar";
import { postJSON } from "@/lib/api";

export default function Header() {
  const router = useRouter();
  const { user, username, avatarUrl } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    await postJSON("/api/logout", {});
    router.refresh();
    router.push("/login");
  };

  return (
    <div className={styles.header}>
      <div className={styles.headerLogo}>
        <Link href="/">
          <Image src="/logo.png" alt="RPS logo" className={styles.logo} width={60} height={60} />
        </Link>
      </div>

      {/* Hamburger Menu Button */}
      <button
        className={`${styles.hamburgerMenu} ${isMobileMenuOpen ? styles.open : ""}`}
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle navigation menu"
      >
        <span></span><span></span><span></span>
      </button>

      {/* Navigation Links */}
      <nav className={`${styles.headerNav} ${isMobileMenuOpen ? styles.mobileOpen : ""}`}>
        <Link href="/" className={styles.navLink}>Home</Link>
        <Link href="/dashboard" className={styles.navLink}>Dashboard</Link>
        <Link href="/leaderboard" className={styles.navLink}>Leaderboard</Link>
        <Link href="/play" className={styles.navLink}>Play</Link>
        <Link href="/rules" className={styles.navLink}>Rules</Link>
        <Link href="/clubs" className={styles.navLink}>Clubs</Link>
        <Link href="/tournaments" className={styles.navLink}>Tournaments</Link>
        <Link href="/friends" className={styles.navLink}>Friends</Link>

        <div className={styles.mobileAuth}>
          {user ? (
            <>
              <Link href={`/profile/${user.uid}`} className={styles.navLink}>Profile</Link>
              <button onClick={handleLogout} className={styles.navLink}>Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className={styles.navLink}>Log In</Link>
              <Link href="/register" className={styles.navLink}>Register</Link>
            </>
          )}
        </div>
      </nav>

      {/* Desktop User Menu */}
      <div className={styles.headerUser}>
        {user ? (
          <div className={styles.profileDropdown} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
            <div className={styles.profilePic}>
              <Avatar src={avatarUrl} username={username ?? user.email ?? "?"} size="sm" />
            </div>
            <div className={`${styles.dropdownContent} ${isDropdownOpen ? styles.show : ""}`}>
              <Link href={`/profile/${user.uid}`} className={styles.dropdownItem}>Profile</Link>
              <button onClick={handleLogout} className={styles.dropdownItem}>Log Out</button>
            </div>
          </div>
        ) : (
          <div className={styles.authButtons}>
            <Link href="/login"><button>Log In</button></Link>
            <Link href="/register"><button>Register</button></Link>
          </div>
        )}
      </div>
    </div>
  );
}