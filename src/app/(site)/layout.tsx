import Header from "@/components/Header";
import Footer from "@/components/Footer";

/** Public marketing site + legacy admin console keep the original chrome. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-grow container mx-auto px-6 py-8">{children}</main>
      <Footer />
    </>
  );
}
