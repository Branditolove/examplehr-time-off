import { expect, within } from "storybook/test";
import { RequestFeedback } from "./RequestFeedback";
import { BalanceCard } from "./BalanceCard";

export default {
  title: "Employee/RequestFeedback",
  component: RequestFeedback,
  tags: ["autodocs"],
};

// Required state: optimistic-pending — the mutation is in flight; the
// balance card (composed alongside, for context) already shows the
// optimistic deduction synchronously, no network round trip needed for that
// part (TRD §3.1/§3.3).
export const OptimisticPending = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-sm">
      <BalanceCard locationName="Ciudad de México" status="ready" balance={9} />
      <RequestFeedback status="pending" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/balance ya se actualizó de forma provisional/)).toBeInTheDocument();
    await expect(canvas.getByText("9")).toBeInTheDocument();
  },
};

// Required state: HCM-rejected — the HCM responded 409 to the submit.
export const HcmRejected = {
  args: { status: "insufficient-balance" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/HCM rechazó la solicitud: balance insuficiente/)
    ).toBeInTheDocument();
  },
};

// Conflict — distinct from insufficient-balance: the HCM rejected because the
// balance changed (asOf mismatch) between the client's last read and this
// submit, not because the requested days actually exceed it.
export const Conflict = {
  args: { status: "conflict" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/El balance cambió en el HCM antes de que tu solicitud llegara/)
    ).toBeInTheDocument();
  },
};

// Required state: insufficient-balance — shown here with the originating
// numbers for context.
export const InsufficientBalance = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-sm">
      <BalanceCard locationName="Bogotá" status="ready" balance={2} accentIndex={1} />
      <p className="text-xs text-gray-500">Solicitud de 5 días contra un balance de 2.</p>
      <RequestFeedback status="insufficient-balance" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("2")).toBeInTheDocument();
    await expect(canvas.getByText(/balance insuficiente/)).toBeInTheDocument();
  },
};

// Required state: optimistic-rolled-back — the HCM rejected the request
// after the optimistic deduction was already applied; onError restored the
// pre-mutation balance (TRD §3.3). The card shows the value back to normal.
export const OptimisticRolledBack = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-sm">
      <BalanceCard locationName="Ciudad de México" status="ready" balance={12} />
      <RequestFeedback status="insufficient-balance" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("12")).toBeInTheDocument();
    await expect(canvas.getByText(/se revirtió al valor real/)).toBeInTheDocument();
  },
};
