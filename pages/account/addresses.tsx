import React, { useState } from "react";
import { useRouter } from "next/router";
import { MapPin, Plus, Trash2, Pencil, X } from "lucide-react";
import { Layout } from "../../components/Layout";
import { Loading } from "../../components/Loading";
import { Button } from "@components/ui";
import {
  useAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress
} from "@hooks/useAccounts";
import { useAuth } from "@config/auth";

type AddressForm = {
  firstname: string;
  lastname: string;
  address1: string;
  address2: string;
  city: string;
  state_name: string;
  zipcode: string;
  country_iso: string;
  phone: string;
  company: string;
};

const emptyAddress: AddressForm = {
  firstname: "",
  lastname: "",
  address1: "",
  address2: "",
  city: "",
  state_name: "",
  zipcode: "",
  country_iso: "US",
  phone: "",
  company: ""
};

const inputClass =
  "neon-focus w-full rounded-lg border border-glass-border bg-surface-deep px-4 py-3 font-body text-sm text-white transition-colors placeholder:text-white/30 focus:outline-none";

const AddressesPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading } = useAddresses();
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const deleteAddress = useDeleteAddress();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddressForm>(emptyAddress);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    if (typeof window !== "undefined") {
      router.push("/login?redirect=/account/addresses");
    }
    return null;
  }

  if (isLoading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  const addresses = (data as any)?.data || [];

  const resetForm = () => {
    setForm(emptyAddress);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const startEdit = (addr: any) => {
    const a = addr.attributes;
    setForm({
      firstname: a.firstname || "",
      lastname: a.lastname || "",
      address1: a.address1 || "",
      address2: a.address2 || "",
      city: a.city || "",
      state_name: a.state_name || "",
      zipcode: a.zipcode || "",
      country_iso: a.country_iso || "US",
      phone: a.phone || "",
      company: a.company || ""
    });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await updateAddress.mutateAsync({ id: editingId, address: form });
      } else {
        await createAddress.mutateAsync(form);
      }
      resetForm();
    } catch (err: any) {
      setError(err?.message || "Failed to save address");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    try {
      await deleteAddress.mutateAsync(id);
    } catch (err: any) {
      setError(err?.message || "Failed to delete address");
    }
  };

  return (
    <Layout>
      <div className="section-container py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="neon-text-magenta font-pressstart text-2xl sm:text-3xl">
            Addresses
          </h1>
          {!showForm && (
            <Button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Address
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-neon-pink/30 bg-neon-pink/10 p-3 font-body text-sm text-neon-pink">
            {error}
          </div>
        )}

        {showForm && (
          <div className="glass-panel mb-8 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-pressstart text-xs uppercase tracking-wider text-neon-cyan">
                {editingId ? "Edit Address" : "New Address"}
              </h2>
              <button
                onClick={resetForm}
                className="text-white/60 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  className={inputClass}
                  placeholder="First name"
                  value={form.firstname}
                  onChange={(e) =>
                    setForm({ ...form, firstname: e.target.value })
                  }
                  required
                />
                <input
                  className={inputClass}
                  placeholder="Last name"
                  value={form.lastname}
                  onChange={(e) =>
                    setForm({ ...form, lastname: e.target.value })
                  }
                  required
                />
              </div>
              <input
                className={inputClass}
                placeholder="Company (optional)"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Street address"
                value={form.address1}
                onChange={(e) => setForm({ ...form, address1: e.target.value })}
                required
              />
              <input
                className={inputClass}
                placeholder="Apt, suite, unit (optional)"
                value={form.address2}
                onChange={(e) => setForm({ ...form, address2: e.target.value })}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <input
                  className={inputClass}
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  required
                />
                <input
                  className={inputClass}
                  placeholder="State"
                  value={form.state_name}
                  onChange={(e) =>
                    setForm({ ...form, state_name: e.target.value })
                  }
                  required
                />
                <input
                  className={inputClass}
                  placeholder="ZIP"
                  value={form.zipcode}
                  onChange={(e) =>
                    setForm({ ...form, zipcode: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  className={inputClass}
                  placeholder="Country (ISO e.g. US)"
                  value={form.country_iso}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      country_iso: e.target.value.toUpperCase()
                    })
                  }
                  required
                />
                <input
                  className={inputClass}
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="neon-btn"
                  disabled={createAddress.isLoading || updateAddress.isLoading}
                >
                  {createAddress.isLoading || updateAddress.isLoading
                    ? "Saving..."
                    : editingId
                      ? "Update Address"
                      : "Save Address"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-glass-border px-4 py-2 font-body text-sm text-white/70 hover:bg-white/[0.05]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {addresses.length === 0 ? (
          <div className="glass-panel flex flex-col items-center justify-center px-5 py-20 text-center">
            <MapPin className="mb-4 h-12 w-12 text-white/30" />
            <h2 className="mb-2 font-title text-lg text-white">
              No saved addresses
            </h2>
            <p className="font-body text-sm text-white/50">
              Add an address to speed up checkout.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {addresses.map((addr: any) => {
              const a = addr.attributes;
              return (
                <div
                  key={addr.id}
                  className="glass-panel flex flex-col justify-between p-6"
                >
                  <div>
                    <p className="mb-1 font-title text-sm font-semibold text-white">
                      {a.firstname} {a.lastname}
                    </p>
                    {a.company && (
                      <p className="mb-1 font-body text-xs text-white/60">
                        {a.company}
                      </p>
                    )}
                    <p className="font-body text-sm text-white/70">
                      {a.address1}
                    </p>
                    {a.address2 && (
                      <p className="font-body text-sm text-white/70">
                        {a.address2}
                      </p>
                    )}
                    <p className="font-body text-sm text-white/70">
                      {a.city}, {a.state_name} {a.zipcode}
                    </p>
                    <p className="font-body text-sm text-white/70">
                      {a.country_iso}
                    </p>
                    {a.phone && (
                      <p className="mt-2 font-mono text-xs text-white/50">
                        {a.phone}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => startEdit(addr)}
                      className="flex items-center gap-1.5 rounded-lg border border-glass-border px-3 py-1.5 font-body text-xs text-white/70 transition-colors hover:border-neon-cyan hover:text-neon-cyan"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(addr.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-neon-pink/30 bg-neon-pink/5 px-3 py-1.5 font-body text-xs text-neon-pink transition-colors hover:bg-neon-pink/15"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AddressesPage;
