import { useMutation } from "@apollo/client";
import { addToast } from "@heroui/react";
import { useRef, useState, type Key } from "react";
import type { PaymentReportRow } from "../../types/reports";
import { isUserInputError, mutationFailureCopy } from "../../lib/mutation-errors";
import { PLATFORM_PERMISSIONS } from "../../lib/permissions";
import { APPLY_COUPON_TO_INVOICE, RECORD_INVOICE_PAYMENT, VOID_INVOICE } from "../../graphql/billing";
import { useAuth } from "../../providers/AuthProvider";
import { IconMore } from "../ui/icons";
import {
  Button as UiButton,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  menuItemDangerClasses,
  toastError,
} from "../ui";

/** What the actions need; Collections rows and invoice rows both fit (PRD-017 FR-4.3). */
export type InvoiceActionRow = Pick<PaymentReportRow, "id" | "amount" | "status" | "transactionId">;

export interface InvoiceRowActionsProps {
  row: InvoiceActionRow;
  /** Re-reads the collections after a change. */
  onChanged: () => Promise<unknown>;
}

type Dialog = "payment" | "void" | "coupon" | null;

/**
 * Invoice row menu (PRD-005 FR-5.2; also Billing › Invoices and the store's invoices, PRD-017 FR-4.3):
 * record a payment, apply a discount, void. Open invoices only; each asks first and re-reads after.
 */
export function InvoiceRowActions({ row, onChanged }: InvoiceRowActionsProps) {
  const { can } = useAuth();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Blocks a second submit before the `busy` re-render lands; the server
  // also returns the same payment for a repeated record (PRD-014 FR-0.10).
  const inFlight = useRef(false);
  const [amount, setAmount] = useState(String(row.amount));
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [recordPayment] = useMutation(RECORD_INVOICE_PAYMENT);
  const [voidInvoice] = useMutation(VOID_INVOICE);
  const [applyCoupon] = useMutation(APPLY_COUPON_TO_INVOICE);

  const open = row.status === "pending" || row.status === "overdue";
  // Every action here needs billing:manage (review C-M5).
  if (!open || !can(PLATFORM_PERMISSIONS.BILLING_MANAGE)) return null;

  const run = async (work: () => Promise<unknown>, done: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
      await onChanged();
      addToast({ title: done });
      setDialog(null);
    } catch (err) {
      const message = mutationFailureCopy(err);
      if (message && isUserInputError(err)) setError(message);
      else if (message) toastError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const onAction = (key: Key) => {
    if (key === "payment" || key === "void" || key === "coupon") setDialog(key);
  };

  return (
    <>
      <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <IconButton aria-label={`Actions for invoice ${row.transactionId}`} showTooltip={false} size="sm">
              <IconMore aria-hidden className="size-4" />
            </IconButton>
          </DropdownTrigger>
          <DropdownMenu aria-label="Invoice actions" onAction={onAction}>
            <DropdownItem key="payment">Record payment</DropdownItem>
            <DropdownItem key="coupon">Apply discount code</DropdownItem>
            <DropdownItem key="void" className={menuItemDangerClasses}>
              Void invoice
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      <Modal isOpen={dialog === "payment"} onClose={() => setDialog(null)} width="sm">
        <ModalContent>
          <ModalHeader>Record payment for {row.transactionId}</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input label="Amount (₹)" type="number" min={1} value={amount} onValueChange={setAmount} />
              <Input label="Paid on" type="date" value={paidAt} onValueChange={setPaidAt} />
              <Input label="Reference" placeholder="UPI-12345" value={reference} onValueChange={setReference} isInvalid={!!error} errorMessage={error ?? undefined} />
            </div>
          </ModalBody>
          <ModalFooter>
            <UiButton variant="ghost" onPress={() => setDialog(null)}>Cancel</UiButton>
            <UiButton
              variant="primary"
              isLoading={busy}
              isDisabled={busy}
              onPress={() =>
                void run(
                  () =>
                    recordPayment({
                      variables: {
                        id: row.id,
                        amount: Number(amount),
                        paidAt: new Date(`${paidAt}T12:00:00Z`).toISOString(),
                        reference,
                      },
                    }),
                  "Payment recorded.",
                )
              }
            >
              Record payment
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={dialog === "coupon"} onClose={() => setDialog(null)} width="sm">
        <ModalContent>
          <ModalHeader>Apply a discount code</ModalHeader>
          <ModalBody>
            <Input label="Code" placeholder="LAUNCH25" value={code} onValueChange={(value) => setCode(value.toUpperCase())} isInvalid={!!error} errorMessage={error ?? undefined} />
          </ModalBody>
          <ModalFooter>
            <UiButton variant="ghost" onPress={() => setDialog(null)}>Cancel</UiButton>
            <UiButton
              variant="primary"
              isLoading={busy}
              onPress={() => void run(() => applyCoupon({ variables: { invoiceId: row.id, code } }), "Discount applied.")}
            >
              Apply
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={dialog === "void"} onClose={() => setDialog(null)} width="sm">
        <ModalContent>
          <ModalHeader>Void invoice {row.transactionId}?</ModalHeader>
          <ModalBody>
            <p className="text-body text-fg-muted">The store no longer owes this amount. This can't be undone.</p>
            <Textarea label="Reason" value={reason} onValueChange={setReason} isInvalid={!!error} errorMessage={error ?? undefined} className="mt-3" />
          </ModalBody>
          <ModalFooter>
            <UiButton variant="ghost" onPress={() => setDialog(null)}>Cancel</UiButton>
            <UiButton
              variant="danger"
              isLoading={busy}
              onPress={() => void run(() => voidInvoice({ variables: { id: row.id, reason } }), "Invoice voided.")}
            >
              Void invoice
            </UiButton>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
