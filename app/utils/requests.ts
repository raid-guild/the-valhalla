import axios from "axios";

export type ValhallaFile = {
  Key: string;
};

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (axios.isAxiosError(error)) {
    const apiMessage = error.response?.data?.error;
    if (typeof apiMessage === "string" && apiMessage.length > 0) {
      return apiMessage;
    }
  }

  return fallbackMessage;
};

export const getValhallaFiles = async (signature: string) => {
  try {
    const data = await axios.post<{ response: ValhallaFile[] }>("/api/files", {
      signature,
    });
    return data.data.response;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Unable to fetch Valhalla files right now."),
    );
  }
};

export const getValhallaFile = async (signature: string, key: string) => {
  try {
    const data = await axios.post("/api/channel", {
      key,
      signature,
    });
    return data.data.channel;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Unable to fetch this Valhalla file right now.",
      ),
    );
  }
};
