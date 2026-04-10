import React from "react";
import { useRouter } from "next/router";
import { CreditCard, ShieldCheck } from "lucide-react";
import { Layout } from "../../components/Layout";
import { Loading } from "../../components/Loading";
import { Button } from "@components/ui";
import { useCreditCards } from "@hooks/useAccounts";
import { useAuth } from "@config/auth";

const cardBrandLogos: Record<string, string> = {
  visa: "VISA",
  mastercard: "MC",
  amex: "AMEX",
  discover: "DISC",
  jcb: "JCB",
  diners_club: "DINR"
};

const PaymentMethodsPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isLoading } = useCreditCards();

  if (!user) {
    if (typeof window !== "undefined") {
      router.push("/login?redirect=/account/payment");
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

  const cards = (data as any)?.data || [];

  return (
    <Layout>
      <div className="section-container py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="neon-text-magenta font-pressstart text-2xl sm:text-3xl">
            Payment Methods
          </h1>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-lg border border-neon-cyan/20 bg-neon-cyan/[0.04] p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-neon-cyan" />
          <p className="font-body text-xs text-white/60">
            Cards are saved at checkout and processed securely by Stripe. Beeper
            never stores full card numbers — only the last 4 digits and
            expiration for your convenience.
          </p>
        </div>

        {cards.length === 0 ? (
          <div className="glass-panel flex flex-col items-center justify-center px-5 py-20 text-center">
            <CreditCard className="mb-4 h-12 w-12 text-white/30" />
            <h2 className="mb-2 font-title text-lg text-white">
              No saved payment methods
            </h2>
            <p className="mb-6 font-body text-sm text-white/50">
              Add a card during checkout and it will appear here.
            </p>
            <Button onClick={() => router.push("/")}>Shop Now</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card: any) => {
              const a = card.attributes;
              const brand =
                cardBrandLogos[a.cc_type?.toLowerCase()] ||
                a.cc_type?.toUpperCase() ||
                "CARD";
              return (
                <div
                  key={card.id}
                  className="glass-panel relative flex h-44 flex-col justify-between overflow-hidden p-5"
                >
                  {a.default && (
                    <span className="absolute right-4 top-4 rounded-full border border-neon-lime/40 bg-neon-lime/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neon-lime">
                      Default
                    </span>
                  )}
                  <div>
                    <div className="font-pressstart text-sm text-neon-cyan">
                      {brand}
                    </div>
                  </div>
                  <div>
                    <div className="mb-3 font-mono text-xl tracking-widest text-white">
                      •••• •••• •••• {a.last_digits}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-[10px] uppercase text-white/40">
                          Holder
                        </div>
                        <div className="font-body text-xs text-white/80">
                          {a.name || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase text-white/40">
                          Expires
                        </div>
                        <div className="font-mono text-xs text-white/80">
                          {String(a.month).padStart(2, "0")}/
                          {String(a.year).slice(-2)}
                        </div>
                      </div>
                    </div>
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

export default PaymentMethodsPage;
