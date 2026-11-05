/**
 * Choose columns (design v2 §4.1: it lives in the title-row ⋯ menu now, not in the table toolbar). A small pop-up
 * with one checkbox per optional column; at least one stays on. The choice is kept per browser
 * (`usePersistentColumns`), as before.
 */

import { useState } from "react";
import type { DataTableColumn } from "../../ui";
import { Button, Checkbox, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, PopupTitle } from "../../ui";
import { IconColumns } from "../../ui/icons";

export interface ColumnsDialogProps {
  isOpen: boolean;
  columns: DataTableColumn[];
  selected: Set<string>;
  onSave: (keys: Set<string>) => void;
  onClose: () => void;
}

export function ColumnsDialog({ isOpen, columns, selected, onSave, onClose }: ColumnsDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} width="sm">
      <ModalContent>
        {(close) => <ColumnsForm columns={columns} selected={selected} onSave={onSave} onClose={close} />}
      </ModalContent>
    </Modal>
  );
}

function ColumnsForm({ columns, selected, onSave, onClose }: Omit<ColumnsDialogProps, "isOpen">) {
  const [draft, setDraft] = useState(() => new Set(selected));
  const toggle = (key: string, on: boolean) =>
    setDraft((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  return (
    <>
      <ModalHeader>
        <PopupTitle icon={<IconColumns aria-hidden />} description="The store name always shows.">
          Which columns should show?
        </PopupTitle>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-3">
          {columns.map((column) => (
            <Checkbox
              key={column.key}
              isSelected={draft.has(column.key)}
              onValueChange={(on) => toggle(column.key, on)}
              isDisabled={draft.size === 1 && draft.has(column.key)}
            >
              {column.label}
            </Checkbox>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onPress={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onPress={() => {
            onSave(draft);
            onClose();
          }}
        >
          Show columns
        </Button>
      </ModalFooter>
    </>
  );
}
