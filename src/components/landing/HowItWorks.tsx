import Image from "next/image";

export function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Add Your Tasks",
      description: "Quickly capture tasks using the quick-add input or the detailed task form with priority, due date, and description.",
      screenshot: "/screenshots/add-task.png",
    },
    {
      number: "02",
      title: "Categorize by Quadrant",
      description: "Assign each task to the appropriate quadrant based on its urgency and importance using the Eisenhower Matrix.",
      screenshot: "/screenshots/matrix-info.png",
    },
    {
      number: "03",
      title: "Schedule & Plan",
      description: "Use the calendar view to schedule your tasks and plan your day, week, or month ahead.",
      screenshot: "/screenshots/calendar-sidebar.png",
    },
    {
      number: "04",
      title: "Track & Complete",
      description: "Check off tasks as you complete them and monitor your progress with built-in statistics.",
      screenshot: "/screenshots/tasks-view.png",
    },
  ];

  return (
    <section className="py-24 px-6 bg-gray-900/30">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            How It <span className="text-blue-500">Works</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Get started in minutes with a simple, intuitive workflow designed
            to help you focus on what matters most.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-24">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12`}
            >
              {/* Content */}
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-block text-6xl font-bold text-blue-600/20 mb-4">
                  {step.number}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  {step.title}
                </h3>
                <p className="text-lg text-gray-400 max-w-md">
                  {step.description}
                </p>
              </div>

              {/* Screenshot */}
              <div className="flex-1 w-full max-w-lg">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 shadow-xl hover:border-gray-700 transition-colors">
                  <Image
                    src={step.screenshot}
                    alt={step.title}
                    width={600}
                    height={400}
                    className="rounded-lg w-full h-auto"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
