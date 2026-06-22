import { expect, within } from "storybook/test";
import { BalanceContext } from "./BalanceContext";

export default {
  title: "Manager/BalanceContext",
  component: BalanceContext,
  tags: ["autodocs"],
};

export const Fresh = {
  args: {
    balance: 6,
    isStale: false,
    isRevalidating: false,
    staleSnapshot: null,
  },
};

export const Revalidating = {
  args: {
    isRevalidating: true,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Revalidando balance/)).toBeInTheDocument();
  },
};

// Required state: manager-approval-with-stale-balance — the manager clicked
// "Aprobar", the forced revalidation (TRD §3.2) found the balance moved
// since the list loaded, and the UI now requires an explicit second
// confirmation instead of approving against a number that just changed.
export const ManagerApprovalWithStaleBalance = {
  args: {
    balance: 10,
    isRevalidating: false,
    staleSnapshot: { previous: 6, current: 10 },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/El balance cambió de 6 a 10 días/)
    ).toBeInTheDocument();
  },
};
