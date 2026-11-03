import { normalizeBaseUrl } from "@rallix/config/env";
import { generatePayToken } from "@rallix/payments";

export const clubAppUrl = () => normalizeBaseUrl(process.env.CLUB_APP_URL) ?? "http://localhost:3000";
export const payLinkUrl = (token: string) => `${clubAppUrl()}/pay/invoice/${token}`;
export const newPayToken = () => generatePayToken();
