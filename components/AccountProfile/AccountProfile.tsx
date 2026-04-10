import { useRouter } from "next/router";
import { Formik, Form, Field } from "formik";
import { object, string } from "yup";

import { useAccountInfo, useUpdateAccount } from "@hooks/useAccounts";
import { FormikInput } from "../FormikWrappers";
import { Layout } from "../Layout";
import { Loading } from "../Loading";
import { Alert } from "../Alerts";

const ProfileSchema = object().shape({
  first_name: string(),
  last_name: string(),
  email: string().email("Invalid email address").required("Email is required"),
  display_name: string(),
  bio: string().max(280, "Bio must be 280 characters or less")
});

export const AccountProfile = () => {
  const router = useRouter();
  const { data: account, isLoading } = useAccountInfo();
  const updateAccount = useUpdateAccount();
  const isWelcome = router.query.welcome === "true";

  if (isLoading) {
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  }

  const attrs = account?.data?.attributes || ({} as any);

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-12">
        {isWelcome && (
          <div className="mb-8 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 p-4 text-center">
            <h2 className="font-pressstart text-sm text-neon-cyan mb-2">
              Welcome to Beeper!
            </h2>
            <p className="text-xs text-white/60">
              Complete your profile below, or skip and come back later.
            </p>
          </div>
        )}

        <h1 className="neon-text-magenta font-pressstart text-2xl sm:text-3xl mb-8">
          Your Profile
        </h1>

        <Formik
          initialValues={{
            first_name: attrs.first_name || "",
            last_name: attrs.last_name || "",
            email: attrs.email || "",
            display_name: "",
            bio: "",
            address: "",
            unit: ""
          }}
          validationSchema={ProfileSchema}
          enableReinitialize
          onSubmit={async (values, { setSubmitting }) => {
            try {
              await updateAccount.mutateAsync({
                first_name: values.first_name,
                last_name: values.last_name,
                email: values.email
              });
              Alert.fire({ icon: "success", title: "Profile updated!" });
            } catch (err: any) {
              Alert.fire({
                icon: "error",
                title: "Update failed",
                text: err.message
              });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="space-y-6">
              {/* Basic Info */}
              <div className="glass-panel p-6">
                <h2 className="font-micro5 text-xs tracking-widest text-white/50 mb-4">
                  BASIC INFO
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    name="first_name"
                    component={FormikInput}
                    label="First Name"
                  />
                  <Field
                    name="last_name"
                    component={FormikInput}
                    label="Last Name"
                  />
                </div>
                <div className="mt-4">
                  <Field
                    name="email"
                    type="email"
                    component={FormikInput}
                    label="Email"
                  />
                </div>
                <div className="mt-4">
                  <Field
                    name="display_name"
                    component={FormikInput}
                    label="Display Name (public)"
                  />
                </div>
                <div className="mt-4">
                  <Field
                    name="bio"
                    component={FormikInput}
                    label="Bio (public, 280 chars)"
                  />
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-white/30">
                  Display name & bio appear on your public profile
                </p>
              </div>

              {/* Shipping (optional) */}
              <div className="glass-panel p-6">
                <h2 className="font-micro5 text-xs tracking-widest text-white/50 mb-2">
                  SHIPPING ADDRESS
                </h2>
                <p className="text-xs text-white/40 mb-4">
                  Optional — you can add this at checkout.
                </p>
                <Field name="address" component={FormikInput} label="Address" />
                <div className="mt-4">
                  <Field
                    name="unit"
                    component={FormikInput}
                    label="Apt / Unit"
                  />
                </div>
              </div>

              {/* Creator Section (stub — requires Phase 3 backend) */}
              <div className="glass-panel p-6 opacity-50">
                <h2 className="font-micro5 text-xs tracking-widest text-white/50 mb-2">
                  CREATOR PROFILE
                </h2>
                <p className="text-xs text-white/40">
                  Coming soon — sell sample packs, presets, and visualizers on
                  Beeper.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="neon-btn text-xs disabled:pointer-events-none disabled:opacity-40"
                >
                  {isSubmitting ? "Saving..." : "Save Profile"}
                </button>
                {isWelcome && (
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="text-xs text-white/40 hover:text-white transition-colors"
                  >
                    Skip for now
                  </button>
                )}
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </Layout>
  );
};
