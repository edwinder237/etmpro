import Link from "next/link";

const serif = { fontFamily: "var(--font-serif)" } as const;

const highlights = ["Free to use", "No credit card", "Start in seconds"];

export function CTA() {
  return (
    <section className="mx-auto max-w-[900px] px-6 md:px-10 pt-5 pb-20">
      <div className="rounded-[24px] px-6 md:px-10 py-16 text-center" style={{ background: "#2c2419" }}>
        <h2 className="text-[32px] md:text-[40px] font-medium mb-4" style={{ ...serif, color: "#faf6ee", textWrap: "balance" }}>
          Ready to take control of <span className="italic" style={{ color: "#e5cf9f" }}>your tasks</span>?
        </h2>
        <p className="text-[17px] max-w-[520px] mx-auto mb-[26px]" style={{ color: "#c9beac" }}>
          Prioritize your work, protect your focus, and end each day knowing you did what mattered.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-[22px] mb-[30px] text-[14px]" style={{ color: "#c9beac" }}>
          {highlights.map((h) => (
            <span key={h} className="flex items-center gap-2"><span style={{ color: "#7ec99a" }}>✓</span> {h}</span>
          ))}
        </div>
        <Link href="/sign-up" className="cta inline-flex items-center gap-2 text-[16px] font-semibold px-[30px] py-[15px] rounded-[12px]"
          style={{ color: "#2c2419", background: "#f1ecdc" }}>
          Get started for free <span className="text-[17px]">→</span>
        </Link>
      </div>
    </section>
  );
}
