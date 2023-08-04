import { AuthTokenAttr } from "@spree/storefront-api-v2-sdk/types/interfaces/Authentication";
import { spreeClient } from "../../config/spree";

interface SpreeUser {
  email: string;
  password: string;
  password_confirmation: string;
}

export const createAccount = async (user: SpreeUser) => {
  try {
    const response = await spreeClient.account.create({ user });
    if (response.isSuccess()) {
      const data = response.success();
      console.warn("DATA: ", data);
    } else {
      const error = response.fail();
      console.warn("REQUEST FAILED: ", error);
    }
  } catch (err) {
    console.warn("AUTH FAIL: ", err);
  }
};

interface LoginUser {
  email: string;
  password: string;
}

export const login = async (user: LoginUser) => {
  console.log(user);
  try {
    const response = await spreeClient.authentication.getToken({
      username: user.email,
      password: user.password
    });
    if (response.isSuccess()) {
      const data = response.success();
      console.warn("DATA: ", data);
    } else {
      const error = response.fail();
      console.warn("REQUEST FAILED: ", error);
    }
  } catch (err) {
    console.warn("AUTH FAIL: ", err);
  }
};
