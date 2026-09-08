import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import styles from "./TermsPage.module.css";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms and conditions governing your use of Ranked RPS Online.",
};

export default function TermsPage() {
  return (
    <div className="app">
      <Header />
      <main className={styles.main}>

        <h1 className={styles.pageTitle}>Terms of Service</h1>
        <p className={styles.lastUpdated}>Last updated: September 8, 2026</p>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>1. Agreement to Our Terms</h2>
          <p>
            We are Ranked RPS (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; &quot;our&quot;). We operate
            the website Ranked RPS Online at ranked-rps.com (the &quot;Website&quot;), together with any other
            related products and services that refer or link to these Terms of Service (collectively, the
            &quot;Services&quot;).
          </p>
          <p>
            Ranked RPS offers players a unique twist on the classic game of Rock-Paper-Scissors, featuring a
            complete matchmaking system, ranks and skill ratings, clubs you can join or create to compete against
            other clubs, and multiple game modes ranging from lightning-fast to slower, more analytical play.
          </p>
          <p>
            By accessing or using the Services, you agree that you have read, understood, and agreed to be bound
            by these Terms. If you do not agree, you must not use the Services. The Services are intended for
            users who are at least 13 years of age; if you are a minor in your jurisdiction, you must have a
            parent or guardian&apos;s permission to use the Services. You can contact us at{" "}
            <a href="mailto:bjoensy16@outlook.com">bjoensy16@outlook.com</a>.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>2. Intellectual Property Rights</h2>
          <p>
            We own or license all intellectual property rights in the Services, including the source code,
            databases, functionality, software, designs, text, and graphics (the &quot;Content&quot;), as well as
            our trademarks and logos (the &quot;Marks&quot;). The Content and Marks are provided &quot;as is&quot;
            for your personal, non-commercial use only.
          </p>
          <p>
            Subject to your compliance with these Terms, we grant you a non-exclusive, non-transferable, revocable
            license to access the Services for personal, non-commercial use. Except as permitted here, no part of
            the Services, Content, or Marks may be copied, reproduced, republished, uploaded, distributed, sold,
            or otherwise exploited for commercial purposes without our prior written permission.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>3. User Representations and Registration</h2>
          <p>By using the Services, you represent and warrant that:</p>
          <ul>
            <li>All registration information you submit is true, accurate, current, and complete.</li>
            <li>You have the legal capacity to agree to these Terms.</li>
            <li>You are not under the age of 13, and if a minor in your jurisdiction, you have parental permission to use the Services.</li>
            <li>You will not access the Services through automated or non-human means, whether through a bot, script, or otherwise.</li>
            <li>Your use of the Services will not violate any applicable law or regulation.</li>
          </ul>
          <p>
            You may be required to register to use the Services. You are responsible for maintaining the
            confidentiality of your password and for all activity under your account. We reserve the right to
            reclaim or change a username we determine, in our sole discretion, to be inappropriate or objectionable.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>4. Prohibited Activities</h2>
          <p>
            You may not access or use the Services for any purpose other than that for which we make them
            available. As a user of the Services, you agree not to:
          </p>
          <ul>
            <li>Use alternate accounts to &quot;boost&quot; your skill rating, or otherwise cheat or engage in behavior that violates the integrity of the ranking system.</li>
            <li>Systematically retrieve data from the Services to build a collection or database without our written permission.</li>
            <li>Circumvent, disable, or otherwise interfere with security-related features of the Services.</li>
            <li>Harass, abuse, threaten, or harm another user, or use information obtained from the Services to do so.</li>
            <li>Impersonate another user or person, or use another user&apos;s account.</li>
            <li>Upload or transmit viruses, spam, or any material that disrupts or interferes with the operation of the Services.</li>
            <li>Use any automated system, script, bot, or scraper to access the Services, except standard search engine indexing.</li>
            <li>Attempt to decompile, reverse engineer, or otherwise derive the source code of the Services, except as permitted by applicable law.</li>
            <li>Use the Services to advertise, sell goods or services, or otherwise compete with us commercially.</li>
            <li>Sell or otherwise transfer your account.</li>
          </ul>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>5. User Contributions</h2>
          <p>
            If we provide the ability to submit content (such as club names, profile customization, or support
            messages), you represent that your contributions do not infringe any third party&apos;s rights, are
            not false, misleading, unlawful, harassing, or obscene, and do not otherwise violate these Terms or
            applicable law. We do not claim ownership of your contributions, but by submitting feedback or
            suggestions about the Services, you agree we may use them without compensation to you.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>6. Services Management</h2>
          <p>
            We reserve the right, but not the obligation, to monitor the Services for violations of these Terms,
            take appropriate action against anyone who violates the law or these Terms (including suspending or
            terminating accounts), and otherwise manage the Services to protect our rights and property and
            facilitate their proper functioning.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>7. Privacy Policy</h2>
          <p>
            We care about data privacy and security. By using the Services, you agree to be bound by our{" "}
            <Link href="/privacy">Privacy Policy</Link>, which is incorporated into these Terms by reference.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>8. Premium Features and Payments</h2>
          <p>
            Some features of the Services may be offered as a paid premium subscription. Payments are processed
            by Stripe, and your use of Stripe&apos;s payment services is subject to Stripe&apos;s own terms. We
            do not store your full payment card details. Subscription pricing, billing frequency, and
            cancellation terms will be presented to you at the time of purchase.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>9. Term and Termination</h2>
          <p>
            These Terms remain in effect while you use the Services. We reserve the right, in our sole discretion
            and without notice or liability, to deny access to and use of the Services to any person for any
            reason, including breach of these Terms, and to terminate your account and delete any content or
            information you posted, at any time.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>10. Modifications and Interruptions</h2>
          <p>
            We may change, modify, or remove the contents of the Services at any time without notice, and we have
            no obligation to update any information on the Services. We cannot guarantee the Services will be
            available at all times; we may experience hardware, software, or other issues, or need to perform
            maintenance, resulting in interruptions or delays.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>11. Governing Law and Disputes</h2>
          <p>
            These Terms and your use of the Services are governed by the laws of the State of Illinois, without
            regard to its conflict of law principles, and any disputes will be subject to the exclusive
            jurisdiction of the state and federal courts located in Illinois.
          </p>
          <p>
            If a dispute arises, we encourage you to first contact us at{" "}
            <a href="mailto:bjoensy16@outlook.com">bjoensy16@outlook.com</a> so we can try to resolve it
            informally before pursuing any formal action.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>12. Corrections</h2>
          <p>
            There may be information on the Services that contains typographical errors, inaccuracies, or
            omissions. We reserve the right to correct any such errors and update information on the Services at
            any time, without prior notice.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>13. Disclaimer</h2>
          <p>
            THE SERVICES ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS. YOUR USE OF THE
            SERVICES IS AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES,
            EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES, INCLUDING THE IMPLIED WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
            SERVICES WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>14. Limitation of Liability</h2>
          <p>
            IN NO EVENT WILL WE OR OUR OFFICERS, DIRECTORS, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY
            DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST
            PROFITS, LOST REVENUE, OR LOSS OF DATA, ARISING FROM YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN
            ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>15. Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold us harmless, including our officers, agents, and employees,
            from any loss, damage, liability, or claim (including reasonable attorneys&apos; fees) arising out of
            your use of the Services, your breach of these Terms, or your violation of the rights of a third
            party.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>16. User Data</h2>
          <p>
            We maintain certain data that you transmit to the Services for the purpose of managing their
            performance, as well as data relating to your use of the Services. Although we perform routine
            backups, you are solely responsible for all data relating to activity you have undertaken using the
            Services, and we have no liability to you for any loss or corruption of such data.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>17. Electronic Communications</h2>
          <p>
            Visiting the Services, sending us emails, and completing online forms constitute electronic
            communications. You consent to receive electronic communications from us, and agree that any
            agreements, notices, and other communications we provide electronically satisfy any legal requirement
            that such communications be in writing.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>18. Miscellaneous</h2>
          <p>
            These Terms, together with our Privacy Policy, constitute the entire agreement between you and us
            regarding the Services. Our failure to enforce any right or provision of these Terms is not a waiver
            of that right or provision. If any provision of these Terms is found unlawful or unenforceable, the
            remaining provisions remain in full force and effect. These Terms create no joint venture, partnership,
            employment, or agency relationship between you and us.
          </p>
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>19. Contact Us</h2>
          <p>
            To resolve a complaint regarding the Services, or for any other questions, contact us at{" "}
            <a href="mailto:bjoensy16@outlook.com">bjoensy16@outlook.com</a>.
          </p>
        </section>

      </main>
      <Footer />
    </div>
  );
}
