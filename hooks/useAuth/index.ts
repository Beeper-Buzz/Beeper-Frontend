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
