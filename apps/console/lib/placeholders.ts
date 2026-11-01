/** The only {{placeholders}} each template may use. Anything else is refused at save time, so a send can't fail later. */
export const PLACEHOLDERS: Record<string, string[]> = {
  invoice_issued: ["admin_name", "club_name", "invoice_number", "period", "amount", "due_date", "pay_link", "payment_instructions", "company_name"],
  subscription_past_due: ["admin_name", "club_name", "invoice_number", "period", "amount", "due_date", "pay_link", "payment_instructions", "company_name"],
  dues_reminder: ["player_name", "club_name", "amount", "due_date"],
  welcome_admin: ["admin_name", "club_name"],
};
