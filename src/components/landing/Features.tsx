import Image from "next/image";
import { CheckCircle, Target, Calendar, BarChart3, Zap } from "lucide-react";

const serif = { fontFamily: "var(--font-serif)" } as const;

const features = [
  { icon: Target, title: "Eisenhower Matrix", color: "#dc2626", tint: "#fbeded",
    description: "Prioritize by urgency and importance with the proven decision matrix." },
  { icon: Calendar, title: "Smart scheduling", color: "#ca8a04", tint: "#fbf2e0",
    description: "Plan day, week, or month with an integrated calendar for timed tasks." },
  { icon: BarChart3, title: "Progress tracking", color: "#16a34a", tint: "#edf5ef",
    description: "Monitor productivity with task statistics and completion tracking." },
  { icon: Zap, title: "Quick actions", color: "#2563eb", tint: "#eef2fb",
    description: "Add tasks instantly to any quadrant with quick-add and shortcuts." },
  { icon: CheckCircle, title: "Priority levels", color: "#7f6a45", tint: "#f0e8d8",
    description: "Tag tasks high, medium, or low for an extra layer of control." },
];

export function Features() {
  return (
    <section className="mx-auto max-w-[1100px] px-6 md:px-10 pt-20 pb-10">
      <div className="text-center mb-[52px]">
        <h2 className="sec-h2 text-[30px] md:text-[44px] font-medium mb-3.5" style={serif}>
          Everything you need to <span className="italic" style={{ color: "#7f6a45" }}>stay focused</span>
        </h2>
        <p className="text-[17px] max-w-[560px] mx-auto" style={{ color: "#6a6252" }}>
          A complete task system built around the Eisenhower Matrix — for maximum clarity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]">
        {features.map((f) => (
          <div key={f.title} className="lift rounded-[16px] p-6" style={{ background: "#fffdf8", border: "1px solid #ece1cf" }}>
            <div className="w-11 h-11 rounded-[12px] flex items-center justify-center mb-4" style={{ background: f.tint, color: f.color }}>
              <f.icon className="w-[22px] h-[22px]" strokeWidth={1.8} />
            </div>
            <h3 className="text-[20px] mb-1.5" style={serif}>{f.title}</h3>
            <p className="text-[14px] leading-[1.55]" style={{ color: "#6a6252" }}>{f.description}</p>
          </div>
        ))}
        <div className="lift rounded-[16px] p-6 flex flex-col justify-center" style={{ background: "#faf6ec", border: "1px solid #ece1cf" }}>
          <div className="text-[20px] mb-1.5" style={serif}>Routines &amp; more</div>
          <p className="text-[14px] leading-[1.55]" style={{ color: "#6a6252" }}>
            Daily routines, weather-aware planning, goals, and payments due — all in one calm view.
          </p>
        </div>
      </div>

      {/* Product shot */}
      <div className="mt-11 rounded-[18px] p-3.5" style={{ background: "#fffdf8", border: "1px solid #ece1cf", boxShadow: "0 30px 70px -40px rgba(70,55,30,0.4)" }}>
        <div className="flex gap-[7px] px-2 pt-1.5 pb-3">
          <span className="w-[11px] h-[11px] rounded-full" style={{ background: "#e0d5c1" }} />
          <span className="w-[11px] h-[11px] rounded-full" style={{ background: "#e0d5c1" }} />
          <span className="w-[11px] h-[11px] rounded-full" style={{ background: "#e0d5c1" }} />
        </div>
        <Image
          src="/screenshots/dashboard.png"
          alt="The EisenQ dashboard"
          width={1360}
          height={1000}
          className="rounded-[12px] w-full h-auto"
          style={{ border: "1px solid #ece1cf" }}
          priority
        />
      </div>
    </section>
  );
}
