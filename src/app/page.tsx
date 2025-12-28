import { auth } from "@clerk/nextjs/server";
import { Hero, Features, HowItWorks, Benefits, CTA, Footer } from "~/components/landing";

export default async function LandingPage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <main className="min-h-screen bg-gray-950">
      <Hero isSignedIn={isSignedIn} />
      <Features />
      <HowItWorks />
      <Benefits />
      <CTA isSignedIn={isSignedIn} />
      <Footer />
    </main>
  );
}
