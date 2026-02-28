import * as React from "react";
import Link from "next/link";
import { Formik, Field, useFormikContext } from "formik";
import { FormikInput } from "../FormikWrappers";
import { Button } from "@components/ui";
import { resetPasswordForm } from "../AuthForm/constants";

export const ResetPassword = () => {
  const SubmitButton = () => {
    const { submitForm, isSubmitting } = useFormikContext();
    return (
      <Button onClick={submitForm} disabled={isSubmitting} className="neon-btn w-full">
        Reset Password
      </Button>
    );
  };

  return (
    <div className="glass-panel mx-auto my-10 w-full max-w-md p-8 sm:p-10">
      <h1 className="mb-6 text-center font-pressstart text-sm text-neon-cyan">
        {resetPasswordForm.title}
      </h1>
      <Formik
        initialValues={resetPasswordForm.fields}
        validationSchema={resetPasswordForm.validate}
        onSubmit={(values, { setSubmitting }) => {
          resetPasswordForm
            .onSubmit(values)
            .then(() => {
              setSubmitting(false);
            })
            .catch(() => {
              setSubmitting(false);
            });
        }}
      >
        {({ handleSubmit }) => (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Field
                type="email"
                name="username"
                component={FormikInput}
                label="Email"
                placeholder="Email"
              />
            </div>
            <SubmitButton />
            <p className="mt-4 text-center font-body text-sm text-white/50">
              <Link
                href="/login"
                className="text-neon-cyan transition-colors hover:underline"
              >
                Login
              </Link>
              <span className="mx-2 text-white/30">|</span>
              <Link
                href="/signup"
                className="text-neon-cyan transition-colors hover:underline"
              >
                Sign Up
              </Link>
            </p>
          </form>
        )}
      </Formik>
    </div>
  );
};
