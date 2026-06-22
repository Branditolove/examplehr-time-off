import { expect, within } from "storybook/test";
import { BalanceCard } from "./BalanceCard";

export default {
  title: "Employee/BalanceCard",
  component: BalanceCard,
  tags: ["autodocs"],
};

export const Ready = {
  args: {
    locationName: "Ciudad de México",
    status: "ready",
    balance: 12,
  },
};

// Each location gets a different accent dot color (purely cosmetic, picked
// by index via accentFor in lib/ui.js) so a list of balances is scannable.
export const SecondLocationAccent = {
  args: {
    locationName: "Bogotá",
    status: "ready",
    balance: 5,
    accentIndex: 1,
  },
};

export const LocationAccentPalette = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-sm">
      {["Ciudad de México", "Bogotá", "Lima", "Santiago"].map((locationName, index) => (
        <BalanceCard
          key={locationName}
          locationName={locationName}
          status="ready"
          balance={10 + index}
          accentIndex={index}
        />
      ))}
    </div>
  ),
};

// Required state: loading
export const Loading = {
  args: {
    locationName: "Ciudad de México",
    status: "loading",
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Cargando…")).toBeInTheDocument();
  },
};

// Required state: empty
export const Empty = {
  args: {
    locationName: "Bogotá",
    status: "empty",
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Sin balance registrado")).toBeInTheDocument();
  },
};

// Required state: stale — the 30s trust window (TRD §4.1) has elapsed and a
// background refetch hasn't landed yet.
export const Stale = {
  args: {
    locationName: "Ciudad de México",
    status: "ready",
    balance: 9,
    isStale: true,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Posiblemente desactualizado")).toBeInTheDocument();
  },
};

// Required state: balance-refreshed-mid-session — a background poll, the
// anniversary bonus, or another tab just changed this number (TRD §5.2).
export const RefreshedMidSession = {
  args: {
    locationName: "Ciudad de México",
    status: "ready",
    balance: 13,
    justRefreshed: true,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("Actualizado")).toBeInTheDocument();
  },
};

// Required state: HCM-silently-wrong — the post-submit verification refetch
// (TRD §6.2) found that the HCM's reported balance doesn't match what's
// actually persisted.
export const HcmSilentlyWrong = {
  args: {
    locationName: "Ciudad de México",
    status: "ready",
    balance: 8,
    integritySuspect: true,
    expectedBalance: 6,
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Inconsistencia: HCM reportó 6, real 8")
    ).toBeInTheDocument();
  },
};
