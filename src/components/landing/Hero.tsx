import Link from "next/link";
import { EisenqLogo } from "~/components/icons/EisenqLogo";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="w-full px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EisenqLogo size={36} />
          <span className="text-xl font-semibold text-white">EisenQ</span>
          <span className="text-gray-400 text-sm hidden sm:inline">Decide & Do</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/10 border border-blue-600/20 rounded-full text-blue-400 text-sm mb-8">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            The Prioritization Engine
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Decide What
            <span className="text-blue-500"> Truly Matters</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Master your tasks with the Eisenhower Matrix. Prioritize by urgency
            and importance, focus on what moves the needle, and eliminate the noise.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/sign-up"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 flex items-center gap-2 shadow-lg shadow-blue-600/25"
            >
              Start for Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/sign-in"
              className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold text-lg transition-colors border border-gray-700"
            >
              Sign In
            </Link>
          </div>

          {/* Matrix Preview */}
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
            <div className="p-4 bg-red-600/20 border border-red-600/30 rounded-xl">
              <div className="w-3 h-3 bg-red-500 rounded-full mb-2"></div>
              <p className="text-sm font-medium text-red-400">Do First</p>
              <p className="text-xs text-gray-500">Urgent & Important</p>
            </div>
            <div className="p-4 bg-yellow-600/20 border border-yellow-600/30 rounded-xl">
              <div className="w-3 h-3 bg-yellow-500 rounded-full mb-2"></div>
              <p className="text-sm font-medium text-yellow-400">Schedule</p>
              <p className="text-xs text-gray-500">Important & Not Urgent</p>
            </div>
            <div className="p-4 bg-blue-600/20 border border-blue-600/30 rounded-xl">
              <div className="w-3 h-3 bg-blue-500 rounded-full mb-2"></div>
              <p className="text-sm font-medium text-blue-400">Delegate</p>
              <p className="text-xs text-gray-500">Urgent & Not Important</p>
            </div>
            <div className="p-4 bg-green-600/20 border border-green-600/30 rounded-xl">
              <div className="w-3 h-3 bg-green-500 rounded-full mb-2"></div>
              <p className="text-sm font-medium text-green-400">Eliminate</p>
              <p className="text-xs text-gray-500">Not Urgent & Not Important</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-gray-600 rounded-full flex items-start justify-center p-2">
          <div className="w-1.5 h-3 bg-gray-500 rounded-full"></div>
        </div>
      </div>
    </section>
  );
}
