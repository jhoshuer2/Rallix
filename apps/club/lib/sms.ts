/**
 * OTP delivery. Development prints the code to the server console.
 * Production needs a real provider (for example Termii or Africa's Talking); until one is
 * wired, sending throws so a deploy can never silently skip delivering codes.
 */
export async function sendSms(to: string, message: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[sms:dev] to ${to}: ${message}`);
    return;
  }
  throw new Error("SMS provider not configured. Set one up in apps/club/lib/sms.ts before going to production.");
}
