import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Formik, Field, ErrorMessage } from "formik";
import styled from "@emotion/styled";

import { loginForm } from "../AuthForm/constants";
import { useAuth } from "../../config/auth";

import { FormikInput } from "../FormikWrappers";

import { LoginWrapper, FormWrapper, InputWrapper, Subtext } from "./Login.styles";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const router = useRouter();
  return (
    <LoginWrapper>
      <h1>{loginForm.title}</h1>
      <Formik
        initialValues={loginForm.fields}
        validationSchema={loginForm.validate}
        onSubmit={(values, { setSubmitting }) => {
          login(values)
            .then(() => {
              setSubmitting(false);
              router.push("/");
            })
            .catch(() => {
              setSubmitting(false);
            });
        }}
      >
        {({ isSubmitting }) => (
          <FormWrapper>
            <InputWrapper>
              <Field
                type="email"
                name="username"
                placeholder="Email"
                component={FormikInput}
                label="Email"
              />
            </InputWrapper>
            <InputWrapper>
              <Field
                type="password"
                name="password"
                placeholder="Password"
                component={FormikInput}
                label="Password"
              />
            </InputWrapper>
            <button type="submit" disabled={isSubmitting}>
              Submit
            </button>
            <Subtext>
              <Link href="/authenticate/signup">Register</Link>
              &nbsp;&nbsp;|&nbsp;&nbsp;
              <Link href="/reset-password">Reset Password</Link>
            </Subtext>
          </FormWrapper>
        )}
      </Formik>
    </LoginWrapper>
  );
};
