import Footer from "@/components/Footer";
import Header from "@/components/Header";

export default function RulesPage() {
    return (
        <div>
            <Header />
            <div style={{ padding: '20px' }}>
                <h1>Rules</h1>
                <ol>
                    <li>Don&#39;t be stupid.</li>
                    <li>Games are first to 4 wins.</li>
                </ol>
            </div>
            <Footer />
        </div>
    )
}