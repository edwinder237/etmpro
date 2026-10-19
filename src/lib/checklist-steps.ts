// Rules for checklist steps, shared by the server (completion gate, writing
// edits back to Myndlist) and the dashboard (counts, gate hints), so both sides
// always agree on what "done" means.
//
// Deliberately free of imports: it runs in the browser and on the server, and
// can be exercised directly with `node` in a quick test.
//
// The rules mirror Myndlist's own `progress` object (docs/API.md there):
// - Optional steps can be ticked but never hold back completion.
// - Blank steps (no text) are ignored everywhere.
// - A list with only optional steps completes when all of them are ticked.

export interface StepLike {
  text: string;
  done: boolean;
  optional?: boolean;
}

export function isBlankStep(step: { text: string }): boolean {
  return !step.text.trim();
}

export interface StepProgress {
  /** Required steps ticked. */
  done: number;
  /** Required steps. */
  total: number;
  optionalDone: number;
  optionalTotal: number;
  /** 0–100, from required steps (from optional ones when there are only optional steps). */
  percent: number;
  complete: boolean;
}

export function stepProgress(steps: readonly StepLike[]): StepProgress {
  let done = 0;
  let total = 0;
  let optionalDone = 0;
  let optionalTotal = 0;
  for (const step of steps) {
    if (isBlankStep(step)) continue;
    if (step.optional) {
      optionalTotal++;
      if (step.done) optionalDone++;
    } else {
      total++;
      if (step.done) done++;
    }
  }
  const [countedDone, countedTotal] = total > 0 ? [done, total] : [optionalDone, optionalTotal];
  return {
    done,
    total,
    optionalDone,
    optionalTotal,
    percent: countedTotal === 0 ? 0 : Math.round((countedDone / countedTotal) * 100),
    complete: countedTotal > 0 && countedDone === countedTotal,
  };
}

/**
 * Steps still standing between a gated checklist and completion: required,
 * non-blank and unticked. A list with only optional steps never blocks.
 */
export function requiredStepsLeft(steps: readonly StepLike[]): number {
  return steps.filter((s) => !isBlankStep(s) && !s.optional && !s.done).length;
}

// ---------------------------------------------------------------------------
// Writing edits back to Myndlist without losing anything.
//
// This app shows a checklist as one flat list, while Myndlist keeps sections,
// item ids, notes and optional flags. Replacing the whole checklist with a flat
// list (what this app used to do) destroyed all of that. Instead, the edited
// list is merged into the checklist as it currently is in Myndlist:
// - A step that came from a Myndlist item keeps that item: same id, section,
//   note and done state. Its text and optional flag take the edited values.
// - A new step is placed right after the step before it, in that step's section.
// - An item with no matching step was removed by the user and is dropped.
// - Rows with no text (hidden in this app) are dropped, unless they hold a note.
// - Sections keep their order, titles and collapsed state, even if emptied.
// - Moving a step across sections in this flat view keeps it in its own
//   section; only its order within that section changes.
// ---------------------------------------------------------------------------

export interface MyndlistItemShape {
  id: string;
  text: string;
  done: boolean;
  note?: string;
  optional?: boolean;
}

export interface MyndlistSectionShape {
  id: string;
  title: string;
  collapsed?: boolean;
  items: MyndlistItemShape[];
}

export interface EditedStep {
  /** Id of the Myndlist item this step came from, when known. */
  sourceItemId?: string | null;
  text: string;
  /** Leave undefined to keep the item's current flag. */
  optional?: boolean;
}

/** An item as sent to Myndlist: new items have no id yet, Myndlist assigns one. */
export interface OutgoingItem {
  id?: string;
  text: string;
  done: boolean;
  note: string;
  optional: boolean;
}

export interface OutgoingSection {
  id?: string;
  title: string;
  collapsed: boolean;
  items: OutgoingItem[];
}

export function mergeStepsIntoSections(
  sections: readonly MyndlistSectionShape[],
  steps: readonly EditedStep[],
  newSectionTitle = "Steps",
): OutgoingSection[] {
  const located = new Map<string, { sectionIndex: number; item: MyndlistItemShape }>();
  sections.forEach((section, sectionIndex) => {
    for (const item of section.items ?? []) located.set(item.id, { sectionIndex, item });
  });

  const kept = steps.filter((s) => !isBlankStep(s));
  const claimed = new Set<string>();
  const resolved: Array<string | null> = kept.map((step) => {
    const id = step.sourceItemId;
    if (id && located.has(id) && !claimed.has(id)) {
      claimed.add(id);
      return id;
    }
    return null;
  });

  // Steps without a usable id (copies attached before ids were recorded) are
  // matched to a still-unclaimed item with the same text, first come first served.
  const byText = new Map<string, string[]>();
  for (const [id, { item }] of located) {
    if (claimed.has(id)) continue;
    const key = item.text.trim();
    byText.set(key, [...(byText.get(key) ?? []), id]);
  }
  kept.forEach((step, i) => {
    if (resolved[i]) return;
    const queue = byText.get(step.text.trim());
    const id = queue?.shift();
    if (id) {
      claimed.add(id);
      resolved[i] = id;
    }
  });

  const out: OutgoingSection[] = sections.map((s) => ({
    id: s.id,
    title: s.title,
    collapsed: Boolean(s.collapsed),
    items: [],
  }));
  if (out.length === 0) out.push({ title: newSectionTitle, collapsed: false, items: [] });

  let currentSection = 0;
  kept.forEach((step, i) => {
    const id = resolved[i];
    const origin = id ? located.get(id) : undefined;
    if (origin) {
      currentSection = origin.sectionIndex;
      out[currentSection]!.items.push({
        id: origin.item.id,
        text: step.text,
        done: Boolean(origin.item.done),
        note: origin.item.note ?? "",
        optional: step.optional ?? Boolean(origin.item.optional),
      });
    } else {
      out[currentSection]!.items.push({
        text: step.text,
        done: false,
        note: "",
        optional: step.optional ?? false,
      });
    }
  });

  // Rows with no text never reach this app's flat view, so they cannot have been
  // edited here. Empty ones are dropped; one that still carries a note is kept,
  // at the end of its section, rather than silently losing the note.
  sections.forEach((section, sectionIndex) => {
    for (const item of section.items ?? []) {
      if (isBlankStep(item) && item.note?.trim() && !claimed.has(item.id)) {
        out[sectionIndex]!.items.push({
          id: item.id,
          text: item.text,
          done: Boolean(item.done),
          note: item.note,
          optional: Boolean(item.optional),
        });
      }
    }
  });

  return out;
}
