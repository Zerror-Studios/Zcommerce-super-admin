import { addToast, Card, CardBody, Input, Select, SelectItem } from "@heroui/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientStatus, PlanName } from "../types";
import { PageHeader } from "../components/common/PageHeader";
import { useClients } from "../providers/ClientsProvider";
import { Button as UiButton } from "../components/ui";

const planMrr: Record<PlanName, number> = {
  Free: 0,
  Starter: 29,
  Pro: 99,
  Enterprise: 299,
};

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
      addToast({ title: "Store name required", color: "danger" });
      return;
    }
    if (!owner) {
      addToast({ title: "Owner name required", color: "danger" });
      return;
    }
    if (!email || !email.includes("@")) {
      addToast({ title: "Valid owner email required", color: "danger" });
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

    addToast({
      title: "Client added",
      description: `${store} was added to the platform.`,
      color: "success",
    });
    navigate(`/clients/${id}`);
  };

  return (
    <div>
      <PageHeader
        title="Add client"
        description="Create a new client store on the Zcommerce platform."
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Clients", href: "/clients" },
          { label: "Add client" },
        ]}
      />

      <Card shadow="none" className="max-w-3xl border border-line bg-surface">
        <CardBody className="gap-6 p-6">
          <section className="space-y-4">
            <div>
              <h2 className="text-subtitle font-bold">Store details</h2>
              <p className="text-caption text-default-500">
                Basic information for the new client store
              </p>
            </div>
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
          </section>

          <section className="space-y-4 border-t border-default-100 pt-6">
            <div>
              <h2 className="text-subtitle font-bold">Subscription</h2>
              <p className="text-caption text-default-500">
                Starting plan and account status
              </p>
            </div>
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
                <SelectItem key="active">Active</SelectItem>
                <SelectItem key="suspended">Suspended</SelectItem>
              </Select>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-default-100 pt-6">
            <UiButton variant="outline" size="sm" onPress={() => navigate("/clients")}>
              Cancel
            </UiButton>
            <UiButton variant="primary" size="sm" onPress={handleCreate}>
              Add client
            </UiButton>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
