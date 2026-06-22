// Small set of shared Tailwind class strings — not a design system, just
// avoiding copy-pasted utility soup across the half-dozen components that
// render a card, an input, or a button.

export const card =
  "rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md";

// Per-location accent so balance cards are scannable at a glance instead of
// uniform gray boxes — purely cosmetic, picked by index, not semantic.
const accentPalette = [
  { bar: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-600" },
  { bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-600" },
  { bar: "bg-amber-500", chip: "bg-amber-50 text-amber-600" },
  { bar: "bg-sky-500", chip: "bg-sky-50 text-sky-600" },
];

export function accentFor(index) {
  return accentPalette[index % accentPalette.length];
}

export const input =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

export const label = "text-xs font-medium uppercase tracking-wide text-gray-500";

const buttonVariants = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  warning: "bg-amber-500 text-white hover:bg-amber-600",
  outline: "border border-gray-300 text-gray-700 hover:bg-gray-50",
};

export function button(variant = "primary") {
  return `inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]}`;
}

const badgeTones = {
  warning: "bg-amber-100 text-amber-800",
  info: "bg-blue-100 text-blue-800",
  danger: "bg-red-100 text-red-800",
  success: "bg-emerald-100 text-emerald-800",
};

export function badge(tone) {
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeTones[tone]}`;
}
