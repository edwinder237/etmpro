import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";

export function CTA() {
  const highlights = [
    "Free to use",
    "No credit card required",
    "Start in seconds",
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        {/* Background Decoration */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 blur-3xl -z-10"></div>

          {/* Content */}
          <div className="relative bg-gray-900/80 border border-gray-800 rounded-3xl p-12 md:p-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Ready to Take Control of
              <span className="text-blue-500"> Your Tasks</span>?
            </h2>
            <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
              Join thousands of productive individuals who use EisenQ to prioritize
              their work and focus on what truly matters.
            </p>

            {/* Highlights */}
            <div className="flex flex-wrap items-center justify-center gap-6 mb-10">
              {highlights.map((highlight, index) => (
                <div key={index} className="flex items-center gap-2 text-gray-300">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>{highlight}</span>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-blue-600/25"
            >
              Get Started for Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
