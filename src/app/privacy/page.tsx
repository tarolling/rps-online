import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import styles from "./PrivacyPage.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Ranked RPS Online collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="app">
      <Header />
      <main className={styles.main}>

        <h1 className={styles.pageTitle}>Privacy Policy</h1>
        <p className={styles.lastUpdated}>Last updated: September 8, 2026</p>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Overview</h2>
          <p>
            Ranked RPS (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates Ranked RPS Online, a ranked
            Rock-Paper-Scissors matchmaking website (the &quot;Services&quot;). This Policy explains what data we
            collect when you use the Services, how we use it, and the choices you have. Using the Services is
            considered agreement to the terms of this Policy.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Information We Collect</h2>
          <p>When you create an account and play, we collect:</p>
          <ul>
            <li>
              <strong>Account information</strong> — your email address and username, and (if you sign in with
              Google or Apple, or an email/password) whatever identifiers those providers or your sign-up require.
              Authentication is handled by Firebase Authentication.
            </li>
            <li>
              <strong>Gameplay and rating data</strong> — your username, join date, last-seen date, skill ratings
              per game mode, match history, club membership, and earned titles. This is stored permanently so we
              can maintain rankings, leaderboards, and match history.
            </li>
            <li>
              <strong>Live game state</strong> — while a match is in progress (active games, matchmaking queue
              entries), we store temporary game data that is deleted once the match ends.
            </li>
            <li>
              <strong>Billing information</strong> — if you subscribe to a premium plan, our payment processor,
              Stripe, handles your payment details. We store only a Stripe customer/subscription identifier
              linking your account to your subscription status; we never see or store your full card details.
            </li>
          </ul>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Cookies &amp; Analytics</h2>
          <p>
            We use one strictly necessary cookie to keep you signed in. This cookie is required for the Services
            to function and is not optional.
          </p>
          <p>
            With your consent (given through the cookie banner shown on your first visit), we also use
            privacy-friendly analytics (Vercel Analytics and Speed Insights) to understand how the Services are
            used. These are only loaded if you accept, and you can change your choice at any time by clearing
            your browser&apos;s site data for this site.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Operate matchmaking, scoring, and ranking systems.</li>
            <li>Maintain leaderboards, match history, clubs, and titles.</li>
            <li>Provide and manage premium subscription features.</li>
            <li>Secure accounts and investigate abuse, cheating, or violations of our Terms of Service.</li>
            <li>Communicate with you about your account, such as email verification.</li>
          </ul>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>How Data Is Stored and Shared</h2>
          <p>
            Account authentication is handled by Firebase (Google). Live game state is stored in Firebase&apos;s
            Realtime Database. Permanent player, match, and rating data is stored in a Neo4j database we operate.
            Subscription billing is handled by Stripe. We do not sell your data, and we do not share it with any
            third party except these service providers (as necessary to operate the Services) or where required
            by law.
          </p>
          <p>
            No method of storage or transmission is completely secure, and we cannot guarantee absolute security.
            If we become aware of a data breach affecting your account, we will notify you through the contact
            information associated with your account.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Your Rights</h2>
          <p>
            You may request to view the data we hold about your account, or request that it be deleted, at any
            time by contacting us at the email below. We will respond to and process reasonable requests as
            quickly as we&apos;re able to.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Underage Users</h2>
          <p>
            The Services are not intended for use by anyone under the age of 13, or under the age of legal
            consent for their country. We do not knowingly collect information from anyone under 13. If we learn
            that we have collected personal information from a user under 13, we will take steps to delete that
            information.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. If we make material changes, we will update the
            &quot;Last updated&quot; date above. Continued use of the Services after a change constitutes
            acceptance of the updated Policy.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>Contact Us</h2>
          <p>
            If you have questions about this Policy or how your data is handled, contact us at{" "}
            <a href="mailto:bjoensy16@outlook.com">bjoensy16@outlook.com</a>. See also our{" "}
            <Link href="/terms">Terms of Service</Link>.
          </p>
        </section>

      </main>
      <Footer />
    </div>
  );
}
