import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Hero, Features, HowItWorks, Benefits, Contact, CTA, Footer } from "~/components/landing";

export default async function LandingPage() {
  const { userId } = await auth();

  // Redirect logged-in users directly to the dashboard
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gray-950">
      <Hero />
      <Features />
      <HowItWorks />
      <Benefits />
      <Contact />
      <CTA />
      <Footer />
    </main>
  );
}
