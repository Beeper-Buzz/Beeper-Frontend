import { IAccount } from "@spree/storefront-api-v2-sdk/types/interfaces/Account";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { spreeClient } from "@config/spree";
import { QueryKeys } from "@hooks/queryKeys";
import constants from "@utilities/constants";

// Fetch account info
export const fetchAccountInfo = async () => {
  const storage = (await import("../../config/storage")).default;
  const token = await storage.getToken();

  if (!token?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await spreeClient.account.accountInfo({
    bearerToken: token.access_token
  });

  console.log("Account Info Response:", response);

  if (response.isSuccess()) {
    return response.success();
  } else {
    throw new Error(response.fail().message || "Failed to fetch account info");
  }
};

// Update account info
export const updateAccountInfo = async (params: {
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  password_confirmation?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  website?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  soundcloud?: string;
  bandcamp?: string;
}) => {
  const storage = (await import("../../config/storage")).default;
  const token = await storage.getToken();

  if (!token?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await spreeClient.account.update(
    { bearerToken: token.access_token },
    { user: params }
  );

  if (response.isSuccess()) {
    return response.success();
  } else {
    throw new Error(response.fail().message || "Failed to update account");
  }
};

// Fetch addresses
export const fetchAddresses = async () => {
  const storage = (await import("../../config/storage")).default;
  const token = await storage.getToken();

  if (!token?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await spreeClient.account.addressesList({
    bearerToken: token.access_token
  });

  if (response.isSuccess()) {
    return response.success();
  } else {
    throw new Error(response.fail().message || "Failed to fetch addresses");
  }
};

// Create a new address
export const createAddress = async (address: any) => {
  const storage = (await import("../../config/storage")).default;
  const token = await storage.getToken();

  if (!token?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await spreeClient.account.createAddress(
    { bearerToken: token.access_token },
    { address }
  );

  if (response.isSuccess()) {
    return response.success();
  } else {
    throw new Error(response.fail().message || "Failed to create address");
  }
};

// Update an existing address
export const updateAddressInfo = async (params: {
  id: string;
  address: any;
}) => {
  const storage = (await import("../../config/storage")).default;
  const token = await storage.getToken();

  if (!token?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await spreeClient.account.updateAddress(
    { bearerToken: token.access_token },
    params.id,
    { address: params.address }
  );

  if (response.isSuccess()) {
    return response.success();
  } else {
    throw new Error(response.fail().message || "Failed to update address");
  }
};

// Delete an address
export const deleteAddress = async (id: string) => {
  const storage = (await import("../../config/storage")).default;
  const token = await storage.getToken();

  if (!token?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await spreeClient.account.removeAddress(
    { bearerToken: token.access_token },
    id
  );

  if (response.isSuccess()) {
    return response.success();
  } else {
    throw new Error(response.fail().message || "Failed to delete address");
  }
};

// Fetch credit cards
export const fetchCreditCards = async () => {
  const storage = (await import("../../config/storage")).default;
  const token = await storage.getToken();

  if (!token?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await spreeClient.account.creditCardsList({
    bearerToken: token.access_token
  });

  if (response.isSuccess()) {
    return response.success();
  } else {
    throw new Error(response.fail().message || "Failed to fetch credit cards");
  }
};

// Hook to fetch account info
export const useAccountInfo = () => {
  return useQuery(QueryKeys.ACCOUNT, fetchAccountInfo, {
    staleTime: 30000,
    retry: 1
  });
};

// Hook to update account info
export const useUpdateAccount = () => {
  const queryClient = useQueryClient();

  return useMutation(updateAccountInfo, {
    onSuccess: () => {
      queryClient.invalidateQueries(QueryKeys.ACCOUNT);
    }
  });
};

// Hook to fetch addresses
export const useAddresses = () => {
  return useQuery(QueryKeys.ACCOUNT_ADDRESSES, fetchAddresses, {
    staleTime: 30000,
    retry: 1
  });
};

// Hook to create an address
export const useCreateAddress = () => {
  const queryClient = useQueryClient();
  return useMutation(createAddress, {
    onSuccess: () => {
      queryClient.invalidateQueries(QueryKeys.ACCOUNT_ADDRESSES);
    }
  });
};

// Hook to update an address
export const useUpdateAddress = () => {
  const queryClient = useQueryClient();
  return useMutation(updateAddressInfo, {
    onSuccess: () => {
      queryClient.invalidateQueries(QueryKeys.ACCOUNT_ADDRESSES);
    }
  });
};

// Hook to delete an address
export const useDeleteAddress = () => {
  const queryClient = useQueryClient();
  return useMutation(deleteAddress, {
    onSuccess: () => {
      queryClient.invalidateQueries(QueryKeys.ACCOUNT_ADDRESSES);
    }
  });
};

// Hook to fetch credit cards
export const useCreditCards = () => {
  return useQuery(QueryKeys.ACCOUNT_CREDIT_CARDS, fetchCreditCards, {
    staleTime: 30000,
    retry: 1
  });
};
