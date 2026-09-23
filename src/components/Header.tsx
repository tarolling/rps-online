"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./header.module.css";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Avatar from "@/components/Avatar";
import { signOutEverywhere } from "@/lib/session";
import { subscribeRequestsData } from "@/lib/friends";
import { subscribeMyTurnAsyncGames } from "@/lib/matchmaking";

export default function Header() {
  const router = useRouter();
  const { user, username, avatarUrl, status } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [incomingRequestCount, setIncomingRequestCount] = useState(0);
  const [myTurnGameCount, setMyTurnGameCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const signedIn = status === "authenticated" || status === "guest";

  useEffect(() => {
    document.body.classList.toggle("menuOpen", isMobileMenuOpen);
    return () => document.body.classList.remove("menuOpen");
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!user) {
      setIncomingRequestCount(0);
      setMyTurnGameCount(0);
      return;
    }
    const unsubRequests = subscribeRequestsData(user.uid, (data) => {
      setIncomingRequestCount(Object.keys(data.incoming).length);
    });
    const unsubAsyncGames = subscribeMyTurnAsyncGames(user.uid, setMyTurnGameCount);
    return () => {
      unsubRequests();
      unsubAsyncGames();
    };
  }, [user]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    // signOutEverywhere never throws, so we always navigate and never strand
    // the user half signed out. No router.refresh(): nothing server-rendered
    // reads the session cookie. Not resetting loggingOut on success either,
    // since navigation unmounts this.
    await signOutEverywhere();
    router.replace("/");
  };

  return (
    <div className={styles.header}>
      <div className={styles.headerLogo}>
        <Link href="/">
          <Image src="/logo.png" alt="RPS logo" className={styles.logo} width={60} height={60} loading="eager" />
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
        {/* Dashboard, Clubs, Tournaments and Friends all sit behind the proxy's
            login gate, so only link them for someone who can actually open
            them. Guests can't: they have a session but no Player record. */}
        {status === "authenticated" && (
          <Link href="/dashboard" className={styles.navLink}>
            Dashboard
            {myTurnGameCount > 0 && <span className={styles.navBadge}>{myTurnGameCount}</span>}
          </Link>
        )}
        <Link href="/leaderboard" className={styles.navLink}>Leaderboard</Link>
        <Link href="/play" className={styles.navLink}>Play</Link>
        <Link href="/rules" className={styles.navLink}>Rules</Link>
        {status === "authenticated" && (
          <>
            <Link href="/clubs" className={styles.navLink}>Clubs</Link>
            <Link href="/tournaments" className={styles.navLink}>Tournaments</Link>
            <Link href="/friends" className={styles.navLink}>
              Friends
              {incomingRequestCount > 0 && <span className={styles.navBadge}>{incomingRequestCount}</span>}
            </Link>
          </>
        )}

        <div className={styles.mobileAuth}>
          {status === "loading" ? null : signedIn ? (
            <>
              {status === "authenticated" && user && <Link href={`/profile/${user.uid}`} className={styles.navLink}>Profile</Link>}
              <button onClick={handleLogout} className={styles.navLink} disabled={loggingOut}>
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
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
        {/* Gated on `status`, not `user`: while auth is still resolving, `user`
            is null and indistinguishable from signed-out, which used to flash
            the Log In / Register buttons on every load for signed-in users.
            The placeholder holds the same space so the header doesn't shift. */}
        {status === "loading" ? (
          <div className={styles.authPlaceholder} aria-hidden />
        ) : signedIn && user ? (
          <div className={styles.profileDropdown} onClick={() => setIsDropdownOpen(!isDropdownOpen)} ref={dropdownRef}>
            <div className={styles.profilePic}>
              <Avatar src={avatarUrl} username={username ?? user.email ?? "?"} size="sm" />
            </div>
            <div className={`${styles.dropdownContent} ${isDropdownOpen ? styles.show : ""}`}>
              {status === "authenticated" && <Link href={`/profile/${user.uid}`} className={styles.dropdownItem}>Profile</Link>}
              <button onClick={handleLogout} className={styles.dropdownItem} disabled={loggingOut}>
                {loggingOut ? "Logging out..." : "Log Out"}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.authButtons}>
            <Link href="/login" className={styles.loginLink}>Log In</Link>
            <Link href="/register" className={styles.registerButton}>Register</Link>
          </div>
        )}
      </div>
    </div>
  );
}