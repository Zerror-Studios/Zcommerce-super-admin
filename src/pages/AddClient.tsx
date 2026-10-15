import { addToast } from "@heroui/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientStatus, PlanName } from "../types";
import { PageHeader } from "../components/common/PageHeader";
import { useClients } from "../providers/ClientsProvider";
import { Button as UiButton, Card, Input, Select, SelectItem } from "../components/ui";

const planMrr: Record<PlanName, number> = {
  Free: 0,
  Starter: 29,
  Pro: 99,
  Enterprise: 299,
};

/** Add store (docs/design/04-super-admin.md §3.3): 720px form, ghost Cancel + primary "Add store". */
export function AddClient() {
  const navigate = useNavigate();
  const { addClient } = useClients();
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [plan, setPlan] = useState<PlanName>("Starter");
  const [status, setStatus] = useState<ClientStatus>("trial");

  const handleCreate = () => {
    const store = storeName.trim();
    const owner = ownerName.trim();
    const email = ownerEmail.trim().toLowerCase();

    if (!store) {
      addToast({ title: "Enter a store name.", color: "danger" });
      return;
    }
    if (!owner) {
      addToast({ title: "Enter the owner's name.", color: "danger" });
      return;
    }
    if (!email || !email.includes("@")) {
      addToast({ title: "Enter a valid owner email.", color: "danger" });
      return;
    }

    const now = new Date().toISOString();
    const mrr = status === "suspended" ? 0 : planMrr[plan];
    const id = `cli-${Date.now()}`;

    addClient({
      id,
      storeName: store,
      ownerName: owner,
      ownerEmail: email,
      plan,
      status,
      mrr,
      orders30d: 0,
      revenue: 0,
      growthPercent: 0,
      lastActive: now,
      joinedDate: now.slice(0, 10),
      usage: { products: 0, storageGb: 0, bandwidthGb: 0 },
      notes: "",
    });

    addToast({ title: `${store} added.` });
    navigate(`/stores/${id}`);
  };

  return (
    <div className="mx-auto max-w-content-form">
      <PageHeader back={{ href: "/stores", label: "Stores" }} title="Add store" />

      <div className="flex flex-col gap-4">
        <Card title="Store details">
          <div className="flex flex-col gap-4">
            <Input
              label="Store name"
              placeholder="Drift Skate Co."
              value={storeName}
              onValueChange={setStoreName}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Owner name"
                placeholder="Leo Martinez"
                value={ownerName}
                onValueChange={setOwnerName}
              />
              <Input
                label="Owner email"
                type="email"
                placeholder="leo@store.com"
                value={ownerEmail}
                onValueChange={setOwnerEmail}
              />
            </div>
          </div>
        </Card>

        <Card title="Subscription">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Plan"
              selectedKeys={new Set([plan])}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                if (
                  value === "Free" ||
                  value === "Starter" ||
                  value === "Pro" ||
                  value === "Enterprise"
                ) {
                  setPlan(value);
                }
              }}
              disallowEmptySelection
            >
              <SelectItem key="Free">Free</SelectItem>
              <SelectItem key="Starter">Starter</SelectItem>
              <SelectItem key="Pro">Pro</SelectItem>
              <SelectItem key="Enterprise">Enterprise</SelectItem>
            </Select>
            <Select
              label="Status"
              selectedKeys={new Set([status])}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                if (
                  value === "active" ||
                  value === "trial" ||
                  value === "suspended"
                ) {
                  setStatus(value);
                }
              }}
              disallowEmptySelection
            >
              <SelectItem key="trial">Trial</SelectItem>
              <SelectItem key="active">Live</SelectItem>
              <SelectItem key="suspended">Suspended</SelectItem>
            </Select>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <UiButton variant="ghost" onPress={() => navigate("/stores")}>
            Cancel
          </UiButton>
          <UiButton variant="primary" onPress={handleCreate}>
            Add store
          </UiButton>
        </div>
      </div>
    </div>
  );
}
