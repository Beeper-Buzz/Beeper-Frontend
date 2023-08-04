// src/lib/auth.ts

import { initReactQueryAuth } from "react-query-auth";
import { IAccount } from "@spree/storefront-api-v2-sdk/types/interfaces/Account";
import { spreeClient } from "./spree";

interface LoginUser {
  username: string;
  password: string;
}

interface SpreeUser {
  user: {
    email: string;
    password: string;
    password_confirmation: string;
  };
}

const authConfig = {
  loadUser: async () => {
    const storage = (await import("./storage")).default;
    const token = await storage.getToken();
    console.warn("TOKEN: ", token);
    if (token?.access_token && token?.token_type === "Bearer") {
      const response = await spreeClient.account.accountInfo({
        bearerToken: token.access_token
      });
      if (response.isSuccess()) {
        console.warn("USER LOADED: ", response.success());
        return response.success();
      }
      console.warn(response.fail());
      return null;
    }
    return null;
  },
  loginFn: async (data: unknown) => {
    const response = await spreeClient.authentication.getToken(
      data as LoginUser
    );
    if (response.isSuccess()) {
      const result = response.success();
      const storage = (await import("./storage")).default;
      storage.setToken(result);
      const user = await authConfig.loadUser();
      return user;
    } else {
      console.warn(response.fail());
      return null;
    }
  },
  registerFn: async (data: unknown) => {
    const response = await spreeClient.account.create(data as SpreeUser);
    if (response.isSuccess()) {
      console.warn("REGISTER SUCCESS: ", response.success());
      // register does not receive a token
      // so we can decide to either run the login automatically or ask the user to login
      // also this is where there should be some notification about confirming their email

      return response.success();
    } else {
<<<<<<< HEAD
      console.warn(response.fail());
      return null;
=======
      console.warn("FAILED REGISTER: ", response.fail());
      Promise.reject(response.fail());
>>>>>>> 6452f9e (Fix login function, setup react-query-auth hooks for getting the user object, logging in, registering, and logging out.)
    }
  },
  logoutFn: async () => {
    const storage = (await import("./storage")).default;
    storage.clearToken();
  }
};

<<<<<<< HEAD
export const { AuthProvider, useAuth } = initReactQueryAuth<
  IAccount | null,
  string
>(authConfig);
=======
export const { AuthProvider, useAuth } = initReactQueryAuth<IAccount | null, string>(authConfig);
>>>>>>> 6452f9e (Fix login function, setup react-query-auth hooks for getting the user object, logging in, registering, and logging out.)
