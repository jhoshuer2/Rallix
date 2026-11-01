import { generatePayToken } from "@rallix/payments";

export const clubAppUrl = () => (process.env.CLUB_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const payLinkUrl = (token: string) => `${clubAppUrl()}/pay/invoice/${token}`;
export const newPayToken = () => generatePayToken();
