import Image from "next/image";

const serif = { fontFamily: "var(--font-serif)" } as const;

const steps = [
  { number: "01", title: "Add your tasks", screenshot: "/screenshots/add-task.png",
    description: "Capture tasks with the quick-add input or the detailed form — priority, due date, description." },
  { number: "02", title: "Sort by quadrant", screenshot: "/screenshots/matrix-info.png",
    description: "Assign each task to a quadrant by urgency and importance — the matrix does the deciding." },
  { number: "03", title: "Schedule & plan", screenshot: "/screenshots/calendar-week.png",
    description: "Use the calendar to schedule tasks across day, week, and month views." },
  { number: "04", title: "Track & complete", screenshot: "/screenshots/tasks-view.png",
    description: "Check tasks off as you go and watch your progress build across the week." },
];

export function HowItWorks() {
  return (
    <section style={{ background: "#ece3d2" }} className="mt-16">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10 py-20">
        <div className="text-center mb-14">
          <h2 className="sec-h2 text-[30px] md:text-[44px] font-medium mb-3.5" style={serif}>
            How it <span className="italic" style={{ color: "#7f6a45" }}>works</span>
          </h2>
          <p className="text-[17px] max-w-[560px] mx-auto" style={{ color: "#6a6252" }}>
            Get started in minutes with a simple, intuitive workflow.
          </p>
        </div>

        <div className="flex flex-col gap-14">
          {steps.map((step, i) => (
            <div key={step.number} className={`flex flex-col ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-10`}>
              <div className="flex-1 text-center lg:text-left">
                <div style={{ ...serif, color: "#d8ccb6" }} className="text-[56px] leading-none">{step.number}</div>
                <h3 style={serif} className="text-[28px] mt-2 mb-2.5">{step.title}</h3>
                <p className="text-[16px] leading-[1.55] max-w-[400px] mx-auto lg:mx-0" style={{ color: "#6a6252" }}>{step.description}</p>
              </div>
              <div className="flex-1 w-full">
                <div className="rounded-[14px] p-2.5 overflow-hidden" style={{ background: "#fffdf8", border: "1px solid #e0d5c1" }}>
                  <Image src={step.screenshot} alt={step.title} width={600} height={400} className="rounded-[10px] w-full h-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
