const serif = { fontFamily: "var(--font-serif)" } as const;

const benefits = [
  { rail: "#dc2626", title: "Focus on what matters",
    description: "Stop pouring time into low-value work. See what truly moves the needle and do that first." },
  { rail: "#ca8a04", title: "Reduce overwhelm",
    description: "Break the pile into four clear moves — do, schedule, delegate, or let go." },
  { rail: "#2563eb", title: "Track your progress",
    description: "Completed, high-priority, and weekly progress — visible at a glance." },
  { rail: "#16a34a", title: "Build better habits",
    description: "Daily and weekly routines keep the small, important things from slipping." },
];

const explained = [
  { rail: "#dc2626", name: "Do First", bold: "Urgent & Important.", rest: "Crises and deadlines that need action now." },
  { rail: "#ca8a04", name: "Schedule", bold: "Important & Not Urgent.", rest: "Long-term goals and growth — give them time." },
  { rail: "#2563eb", name: "Delegate", bold: "Urgent & Not Important.", rest: "Hand off or minimize when you can." },
  { rail: "#16a34a", name: "Eliminate", bold: "Not Urgent & Not Important.", rest: "Time-wasters — cut them loose." },
];

export function Benefits() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 md:px-10 py-20">
      <div className="text-center mb-[52px]">
        <h2 className="sec-h2 text-[30px] md:text-[44px] font-medium mb-3.5" style={serif}>
          Why <span className="italic" style={{ color: "#7f6a45" }}>EisenQ</span>?
        </h2>
        <p className="text-[17px] max-w-[560px] mx-auto" style={{ color: "#6a6252" }}>
          A calmer way to run your day — built on a method that&apos;s stood the test of time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px]">
        {benefits.map((b) => (
          <div key={b.title} className="rounded-[16px] p-7" style={{ background: "#fffdf8", border: "1px solid #ece1cf", borderTop: `3px solid ${b.rail}` }}>
            <h3 className="text-[22px] mb-2" style={serif}>{b.title}</h3>
            <p className="text-[15px] leading-[1.6]" style={{ color: "#6a6252" }}>{b.description}</p>
          </div>
        ))}
      </div>

      {/* Matrix explained */}
      <div className="mt-9 rounded-[18px] p-[34px]" style={{ background: "#faf6ec", border: "1px solid #ece1cf" }}>
        <h3 className="text-[26px] text-center mb-6" style={serif}>The Eisenhower Matrix, explained</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {explained.map((q) => (
            <div key={q.name} className="p-5" style={{ borderLeft: `2px solid ${q.rail}` }}>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: q.rail }} />
                <span className="font-semibold text-[15px]">{q.name}</span>
              </div>
              <p className="text-[14px] leading-[1.55]" style={{ color: "#6a6252" }}>
                <b className="font-semibold" style={{ color: "#2c2419" }}>{q.bold}</b> {q.rest}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
