import { expect, fn, userEvent, within } from "storybook/test";
import { ApproveDenyButtons } from "./ApproveDenyButtons";
import { BalanceContext } from "./BalanceContext";
import { card } from "@/lib/ui";

export default {
  title: "Manager/ApproveDenyButtons",
  component: ApproveDenyButtons,
  tags: ["autodocs"],
  args: {
    onApprove: fn(),
    onConfirmApprove: fn(),
    onDeny: fn(),
  },
};

export const Idle = {
  args: { phase: "idle", disabled: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const approve = canvas.getByRole("button", { name: "Aprobar" });
    await userEvent.click(approve);
    await expect(args.onApprove).toHaveBeenCalledOnce();

    const deny = canvas.getByRole("button", { name: "Denegar" });
    await userEvent.click(deny);
    await expect(args.onDeny).toHaveBeenCalledOnce();
  },
};

export const Revalidating = {
  args: { phase: "revalidating", disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Revalidando…" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Denegar" })).toBeDisabled();
  },
};

// Required state companion: manager-approval-with-stale-balance — once the
// revalidation reveals a changed balance, the row swaps to a single explicit
// confirmation action instead of the original "Aprobar".
export const StaleConfirm = {
  args: { phase: "stale-confirm", disabled: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();

    const confirm = canvas.getByRole("button", { name: "Confirmar aprobación" });
    await userEvent.click(confirm);
    await expect(args.onConfirmApprove).toHaveBeenCalledOnce();
  },
};

// Full row composition for manager-approval-with-stale-balance: the warning
// from BalanceContext and the swapped-to-confirm button never render in
// isolation in the real app (RequestRow always shows them together) — this
// story is what a manager actually sees on screen for that state.
export const RequestRowWithStaleBalance = {
  render: (args) => (
    <div className={`${card} flex max-w-sm flex-col gap-3`}>
      <p className="font-medium text-gray-900">Luis Gómez — 2 días — Ciudad de México</p>
      <BalanceContext balance={10} staleSnapshot={{ previous: 6, current: 10 }} />
      <ApproveDenyButtons {...args} />
    </div>
  ),
  args: { phase: "stale-confirm", disabled: false },
};

export const Disabled = {
  args: { phase: "idle", disabled: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const approve = canvas.getByRole("button", { name: "Aprobar" });
    await expect(approve).toBeDisabled();
    await userEvent.click(approve, { pointerEventsCheck: 0 });
    await expect(args.onApprove).not.toHaveBeenCalled();
  },
};
