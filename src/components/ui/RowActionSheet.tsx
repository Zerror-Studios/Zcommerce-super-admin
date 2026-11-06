/* SYNCED FILE (zcom-ui-consistency): keep byte-identical in store-dashboard and super-admin */
import { Listbox, ListboxItem, ListboxSection, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { Modal } from "./Modal";
import type { RowMenuItem } from "./RowMenu";

export interface RowActionSheetProps {
  /** The row's actions, as for the ⋯ menu (destructive ones go last, in red, after a divider). */
  items: RowMenuItem[] | null;
  /** The sheet title: the row's name ("#1880 · Tanya Khan"). */
  title?: string;
  onClose: () => void;
}

/**
 * Phone row actions (round 2 §8.4): a phone card has no ⋯ circle; a long press or a swipe left on the card opens
 * its actions in this bottom sheet (the kit Modal's phone mode: grab handle, drag down to close, 44px close).
 * Each action is a 48px row with its 16px icon.
 */
export function RowActionSheet({ items, title = "Actions", onClose }: RowActionSheetProps) {
  const list = items ?? [];
  const regular = list.filter((item) => !item.destructive);
  const destructive = list.filter((item) => item.destructive);
  const byKey = new Map(list.map((item) => [item.key, item]));
  const disabledKeys = list.filter((item) => item.disabled).map((item) => item.key);

  const renderItem = (item: RowMenuItem) => {
    const Icon = item.icon;
    return (
      <ListboxItem
        key={item.key}
        href={item.href}
        description={item.description}
        startContent={Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : undefined}
        className={item.destructive ? "zc-action-sheet__item zc-action-sheet__item--danger" : "zc-action-sheet__item"}
      >
        {item.label}
      </ListboxItem>
    );
  };

  return (
    <Modal isOpen={items != null} onClose={onClose} size="sm" sheet>
      <ModalContent>
        {(close) => (
          <>
            <ModalHeader>{title}</ModalHeader>
            <ModalBody className="zc-action-sheet">
              <Listbox
                aria-label={title}
                disabledKeys={disabledKeys}
                onAction={(key) => {
                  const item = byKey.get(String(key));
                  close();
                  item?.onSelect?.();
                }}
              >
                {destructive.length && regular.length ? (
                  [
                    <ListboxSection key="actions" showDivider>
                      {regular.map(renderItem)}
                    </ListboxSection>,
                    <ListboxSection key="destructive">{destructive.map(renderItem)}</ListboxSection>,
                  ]
                ) : (
                  [...regular, ...destructive].map(renderItem)
                )}
              </Listbox>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
