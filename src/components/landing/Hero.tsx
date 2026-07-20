import Link from "next/link";

const serif = { fontFamily: "var(--font-serif)" } as const;

const quadrants = [
  { dot: "#dc2626", name: "Do First", sub: "Urgent & Important" },
  { dot: "#ca8a04", name: "Schedule", sub: "Important & Not Urgent" },
  { dot: "#2563eb", name: "Delegate", sub: "Urgent & Not Important" },
  { dot: "#16a34a", name: "Eliminate", sub: "Not Urgent & Not Important" },
];

export function Hero() {
  return (
    <>
      {/* Navigation */}
      <nav className="mx-auto max-w-[1200px] px-6 md:px-10 py-[22px] flex items-center justify-between">
        <div className="flex items-baseline gap-3.5">
          <span style={serif} className="text-[26px] font-medium">EisenQ</span>
          <span className="text-[11px] tracking-[0.14em] uppercase" style={{ color: "#a89a80" }}>Decide &amp; Do</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/sign-in" className="text-[14px] font-medium px-3.5 py-2.5" style={{ color: "#5f5747" }}>
            Sign in
          </Link>
          <Link href="/sign-up" className="cta text-[14px] font-semibold px-5 py-2.5 rounded-[11px]" style={{ color: "#faf6ee", background: "#2c2419" }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-[900px] px-6 md:px-10 pt-14 pb-10 text-center">
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-[12.5px] mb-[26px]"
          style={{ background: "#faf6ec", border: "1px solid #e8dece", color: "#7f6a45" }}>
          <span className="w-[7px] h-[7px] rounded-full" style={{ background: "#7f6a45" }} />
          The prioritization engine
        </div>
        <h1 className="hero-h1 text-[44px] md:text-[68px] font-medium leading-[1.04] tracking-[-0.01em] mb-[22px]"
          style={{ ...serif, textWrap: "balance" }}>
          Decide what <span className="italic" style={{ color: "#7f6a45" }}>truly matters</span>.
        </h1>
        <p className="text-[18px] md:text-[19px] leading-[1.55] mx-auto mb-[34px] max-w-[600px]"
          style={{ color: "#6a6252", textWrap: "pretty" }}>
          Master your tasks with the Eisenhower Matrix. Prioritize by urgency and importance,
          focus on what moves the needle, and let go of the noise.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mb-[52px]">
          <Link href="/sign-up" className="cta inline-flex items-center gap-2 text-[16px] font-semibold px-[26px] py-[14px] rounded-[12px]"
            style={{ color: "#faf6ee", background: "#2c2419" }}>
            Start for free <span className="text-[17px]">→</span>
          </Link>
          <Link href="/sign-in" className="cta text-[16px] font-semibold px-[26px] py-[14px] rounded-[12px]"
            style={{ color: "#2c2419", background: "#faf6ec", border: "1px solid #e3d9c8" }}>
            Sign in
          </Link>
        </div>

        {/* Matrix preview */}
        <div className="mx-auto max-w-[560px] rounded-[20px] p-3.5"
          style={{ background: "#fffdf8", border: "1px solid #ece1cf", boxShadow: "0 30px 70px -34px rgba(70,55,30,0.4)" }}>
          <div className="grid grid-cols-2 gap-2.5">
            {quadrants.map((q) => (
              <div key={q.name} className="text-left rounded-[12px] p-4" style={{ background: "#faf6ec", border: "1px solid #f0e8d8" }}>
                <span className="inline-block w-[9px] h-[9px] rounded-full mb-2.5" style={{ background: q.dot }} />
                <div style={serif} className="text-[18px]">{q.name}</div>
                <div className="text-[11px] tracking-[0.08em] uppercase mt-0.5" style={{ color: "#b6a88c" }}>{q.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
