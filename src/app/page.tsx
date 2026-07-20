import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Hero, Features, HowItWorks, Benefits, CTA, Footer } from "~/components/landing";

export default async function LandingPage() {
  const { userId } = await auth();

  // Redirect logged-in users directly to the dashboard
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="paper-light min-h-screen">
      <Hero />
      <Features />
      <HowItWorks />
      <Benefits />
      <CTA />
      <Footer />
    </main>
  );
}
