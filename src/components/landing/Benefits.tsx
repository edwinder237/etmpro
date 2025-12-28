import { Focus, TrendingDown, LineChart, RefreshCw } from "lucide-react";

export function Benefits() {
  const benefits = [
    {
      icon: Focus,
      title: "Focus on What Matters",
      description: "Stop wasting time on low-priority tasks. The Eisenhower Matrix helps you identify and tackle what truly moves the needle.",
      color: "from-red-500 to-orange-500",
    },
    {
      icon: TrendingDown,
      title: "Reduce Overwhelm",
      description: "Break down your workload into clear categories. Know exactly what to do first, schedule, delegate, or eliminate.",
      color: "from-yellow-500 to-amber-500",
    },
    {
      icon: LineChart,
      title: "Track Your Progress",
      description: "See your productivity stats at a glance. Monitor completed tasks, high-priority items, and weekly progress.",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: RefreshCw,
      title: "Build Better Habits",
      description: "Create routine tasks for recurring activities. Build consistency and never forget important regular tasks.",
      color: "from-green-500 to-emerald-500",
    },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Why <span className="text-blue-500">EisenQ</span>?
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Join thousands of productive individuals who have transformed their
            task management with the power of the Eisenhower Matrix.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="relative p-8 bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden group hover:border-gray-700 transition-colors"
            >
              {/* Gradient Accent */}
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${benefit.color}`}></div>

              {/* Icon */}
              <div className={`w-14 h-14 bg-gradient-to-r ${benefit.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <benefit.icon className="w-7 h-7 text-white" />
              </div>

              <h3 className="text-2xl font-semibold text-white mb-3">
                {benefit.title}
              </h3>
              <p className="text-gray-400 text-lg">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        {/* Matrix Explanation */}
        <div className="mt-20 p-8 bg-gray-900/50 border border-gray-800 rounded-2xl">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">
            The Eisenhower Matrix Explained
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-red-600/10 border border-red-600/30 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <h4 className="text-lg font-semibold text-red-400">Do First</h4>
              </div>
              <p className="text-gray-400">
                <span className="text-white font-medium">Urgent & Important:</span> Crises, deadlines, and problems that need immediate action. Handle these tasks right away.
              </p>
            </div>

            <div className="p-6 bg-yellow-600/10 border border-yellow-600/30 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                <h4 className="text-lg font-semibold text-yellow-400">Schedule</h4>
              </div>
              <p className="text-gray-400">
                <span className="text-white font-medium">Important & Not Urgent:</span> Long-term goals, planning, and personal development. Schedule dedicated time for these.
              </p>
            </div>

            <div className="p-6 bg-blue-600/10 border border-blue-600/30 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <h4 className="text-lg font-semibold text-blue-400">Delegate</h4>
              </div>
              <p className="text-gray-400">
                <span className="text-white font-medium">Urgent & Not Important:</span> Interruptions and some meetings. Delegate these when possible or minimize time spent.
              </p>
            </div>

            <div className="p-6 bg-green-600/10 border border-green-600/30 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <h4 className="text-lg font-semibold text-green-400">Eliminate</h4>
              </div>
              <p className="text-gray-400">
                <span className="text-white font-medium">Not Urgent & Not Important:</span> Time-wasters and trivial activities. Eliminate or drastically reduce these tasks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
