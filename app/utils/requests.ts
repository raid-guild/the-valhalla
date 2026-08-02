import axios from "axios";

export type ValhallaFile = {
  Key: string;
};

export type AuthSession =
  { authenticated: true; address: string } | { authenticated: false };

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const getApiError = (error: unknown, fallbackMessage: string) => {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.error;
    if (typeof apiMessage === "string" && apiMessage.length > 0) {
      return new ApiRequestError(apiMessage, error.response?.status);
    }

    return new ApiRequestError(fallbackMessage, error.response?.status);
  }

  return new ApiRequestError(fallbackMessage);
};

export const getAuthSession = async () => {
  try {
    const data = await axios.get<AuthSession>("/api/auth/session");
    return data.data;
  } catch (error) {
    throw getApiError(error, "Unable to restore your session right now.");
  }
};

export const createAuthMessage = async (address: string, chainId: number) => {
  try {
    const data = await axios.post<{ message: string }>("/api/auth/message", {
      address,
      chainId,
    });
    return data.data.message;
  } catch (error) {
    throw getApiError(error, "Unable to start wallet verification.");
  }
};

export const verifyAuthMessage = async (message: string, signature: string) => {
  try {
    const data = await axios.post<AuthSession>("/api/auth/verify", {
      message,
      signature,
    });
    return data.data;
  } catch (error) {
    throw getApiError(error, "Unable to verify this wallet right now.");
  }
};

export const logoutAuthSession = async () => {
  try {
    await axios.post("/api/auth/logout");
  } catch (error) {
    throw getApiError(error, "Unable to end your session right now.");
  }
};

export const getValhallaFiles = async () => {
  try {
    const data = await axios.post<{ response: ValhallaFile[] }>("/api/files");
    return data.data.response;
  } catch (error) {
    throw getApiError(error, "Unable to fetch Valhalla files right now.");
  }
};

export const getValhallaFile = async (key: string) => {
  try {
    const data = await axios.post<{ channel: string }>("/api/channel", {
      key,
    });
    return data.data.channel;
  } catch (error) {
    throw getApiError(error, "Unable to fetch this Valhalla file right now.");
  }
};
