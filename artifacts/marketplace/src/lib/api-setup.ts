import { setAuthTokenGetter } from "@workspace/api-client-react";

// Set up the API client to use the token from localStorage
export function setupApi() {
  setAuthTokenGetter(() => {
    return localStorage.getItem("token");
  });
}
