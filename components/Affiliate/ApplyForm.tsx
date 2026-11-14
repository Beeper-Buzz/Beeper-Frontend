import React, { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@lib/utils";
import { apiErrorMessage } from "@lib/api/v1";
import { normalizeRefCode } from "@lib/affiliate/ref";
import { formatBps } from "@lib/affiliate/stats";
import {
  AFFILIATE_CHANNELS,
  DEFAULT_COMMISSION_BPS,
  DEFAULT_COOKIE_DAYS
} from "@lib/affiliate/terms";
import {
  useAffiliateCodeAvailable,
  useApplyAffiliate
} from "@hooks/useAffiliate";
import { Panel, fieldClass, hintClass, labelClass } from "./ui";

const useDebounced = <T,>(value: T, ms: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
};

const CodeStatus: React.FC<{ raw: string; debounced: string }> = ({
  raw,
  debounced
}) => {
  const valid = normalizeRefCode(raw);
  const { data, isFetching, isError } = useAffiliateCodeAvailable(debounced);

  if (!raw.trim()) {
    return (
      <p className={hintClass}>
        Leave it blank to use your profile handle. 4–24 letters, numbers or
        dashes.
      </p>
    );
  }
  if (!valid) {
    return (
      <p className={cn(hintClass, "text-neon-amber")}>
        Use 4–24 letters, numbers or dashes.
      </p>
    );
  }
  if (raw !== debounced || isFetching) {
    return (
      <p className={cn(hintClass, "flex items-center gap-1.5")}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Checking…
      </p>
    );
  }
  if (isError || !data) {
    return (
      <p className={hintClass}>
        Couldn&apos;t check this code. We&apos;ll check it when you apply.
      </p>
    );
  }
  return data.available ? (
    <p className={cn(hintClass, "flex items-center gap-1.5 text-neon-lime")}>
      <Check className="h-3.5 w-3.5" aria-hidden />
      {valid} is available
    </p>
  ) : (
    <p className={cn(hintClass, "flex items-center gap-1.5 text-neon-pink")}>
      <X className="h-3.5 w-3.5" aria-hidden />
      {valid} is taken. Try another.
    </p>
  );
};

export const ApplyForm: React.FC<{ defaultEmail?: string }> = ({
  defaultEmail = ""
}) => {
  const [code, setCode] = useState("");
  const [website, setWebsite] = useState("");
  const [audience, setAudience] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [payoutEmail, setPayoutEmail] = useState(defaultEmail);
  const [formError, setFormError] = useState<string | null>(null);
  const debouncedCode = useDebounced(code, 400);
  const availability = useAffiliateCodeAvailable(debouncedCode);
  const apply = useApplyAffiliate();

  useEffect(() => {
    if (defaultEmail && !payoutEmail) setPayoutEmail(defaultEmail);
    // Only fill the default once the account loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEmail]);

  const toggleChannel = (c: string) =>
    setChannels((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]
    );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const normalized = normalizeRefCode(code);
    if (code.trim() && !normalized) {
      setFormError("Your code needs 4–24 letters, numbers or dashes.");
      return;
    }
    if (normalized && availability.data?.available === false) {
      setFormError(`${normalized} is taken. Pick another code.`);
      return;
    }
    if (!audience.trim()) {
      setFormError("Tell us about your audience.");
      return;
    }
    if (channels.length === 0) {
      setFormError("Pick at least one place you'll share your link.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payoutEmail.trim())) {
      setFormError("Enter the email address we should pay you at.");
      return;
    }
    apply.mutate(
      {
        ...(normalized ? { code: normalized } : {}),
        website: website.trim(),
        audience: audience.trim(),
        channels,
        message: message.trim(),
        payout_email: payoutEmail.trim()
      },
      {
        onError: (err) =>
          setFormError(
            apiErrorMessage(err, "Your application didn't go through.")
          )
      }
    );
  };

  return (
    <Panel title="Apply to the affiliate program" id="affiliate-apply">
      <p className="mb-6 max-w-prose font-body-bold text-sm leading-6 text-white/70">
        Earn {formatBps(DEFAULT_COMMISSION_BPS)} of every order placed through
        your link within {DEFAULT_COOKIE_DAYS} days of the click. We review
        every application by hand.
      </p>

      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <div>
          <label htmlFor="aff-code" className={labelClass}>
            Your code
          </label>
          <div className="flex items-stretch overflow-hidden rounded-md border border-white/15 bg-white/[0.04] focus-within:border-neon-cyan">
            <span className="flex select-none items-center whitespace-nowrap border-r border-white/10 px-2.5 font-mono-semibold text-[13px] text-white/40 xs:px-3">
              ?ref=
            </span>
            <input
              id="aff-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase())}
              maxLength={24}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="yourname"
              aria-describedby="aff-code-status"
              className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono-semibold text-[16px] leading-5 text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
          <div id="aff-code-status" aria-live="polite">
            <CodeStatus raw={code} debounced={debouncedCode} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="aff-website" className={labelClass}>
              Website or main profile
            </label>
            <input
              id="aff-website"
              type="url"
              inputMode="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="aff-email" className={labelClass}>
              Payout email
            </label>
            <input
              id="aff-email"
              type="email"
              autoComplete="email"
              value={payoutEmail}
              onChange={(e) => setPayoutEmail(e.target.value)}
              required
              className={fieldClass}
            />
            <p className={hintClass}>Where we send your commission.</p>
          </div>
        </div>

        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className={labelClass}>Where you&apos;ll share it</legend>
          <div className="flex flex-wrap gap-2">
            {AFFILIATE_CHANNELS.map((c) => {
              const on = channels.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleChannel(c)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 font-body-bold text-[13px] leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/40",
                    on
                      ? "border-neon-cyan bg-neon-cyan/10 text-neon-cyan"
                      : "border-white/15 bg-transparent text-white/60 hover:border-white/30 hover:text-white"
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="aff-audience" className={labelClass}>
            Your audience
          </label>
          <textarea
            id="aff-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Who follows you, and roughly how many people."
            className={cn(fieldClass, "resize-y")}
          />
        </div>

        <div>
          <label htmlFor="aff-message" className={labelClass}>
            Anything else <span className="text-white/40">(optional)</span>
          </label>
          <textarea
            id="aff-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="How you plan to feature Beeper."
            className={cn(fieldClass, "resize-y")}
          />
        </div>

        {formError && (
          <p
            role="alert"
            className="m-0 rounded-md border border-neon-pink/40 bg-neon-pink/10 px-3 py-2 font-body-bold text-sm text-neon-pink"
          >
            {formError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={apply.isLoading}
            className="neon-btn text-xs disabled:pointer-events-none disabled:opacity-50"
          >
            {apply.isLoading ? "Applying…" : "Apply"}
          </button>
          <p className="m-0 font-body-bold text-xs text-white/50">
            By applying you agree to the program terms below.
          </p>
        </div>
      </form>
    </Panel>
  );
};

export default ApplyForm;
