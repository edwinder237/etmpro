import Image from "next/image";
import { CheckCircle, Target, Calendar, Repeat, BarChart3, Zap } from "lucide-react";

export function Features() {
  const features = [
    {
      icon: Target,
      title: "Eisenhower Matrix",
      description: "Prioritize tasks by urgency and importance using the proven Eisenhower decision matrix.",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      icon: Calendar,
      title: "Smart Scheduling",
      description: "Plan your day, week, or month with an integrated calendar view for scheduled tasks.",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      icon: Repeat,
      title: "Routine Tasks",
      description: "Create templates for recurring tasks and add them to your matrix with a single click.",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: BarChart3,
      title: "Progress Tracking",
      description: "Monitor your productivity with task statistics and completion tracking.",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      icon: Zap,
      title: "Quick Actions",
      description: "Add tasks instantly to any quadrant with quick-add inputs and keyboard shortcuts.",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: CheckCircle,
      title: "Priority Levels",
      description: "Tag tasks with high, medium, or low priority for additional organization control.",
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Everything You Need to
            <span className="text-blue-500"> Stay Focused</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            A complete task management system built around the Eisenhower Matrix
            methodology for maximum productivity.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-gray-700 transition-colors group"
            >
              <div className={`w-12 h-12 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Screenshot Showcase */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent z-10 pointer-events-none"></div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <Image
              src="/screenshots/dashboard.png"
              alt="EisenQ Dashboard"
              width={1200}
              height={800}
              className="rounded-lg"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
