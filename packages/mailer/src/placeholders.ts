/** The only {{placeholders}} each template may use. Shared by the console (which edits templates) and the apps that send them. */
export const TEMPLATE_PLACEHOLDERS: Record<string, string[]> = {
  invoice_issued: ["admin_name", "club_name", "invoice_number", "period", "amount", "due_date", "pay_link", "payment_instructions", "company_name"],
  subscription_past_due: ["admin_name", "club_name", "invoice_number", "period", "amount", "due_date", "pay_link", "payment_instructions", "company_name"],
  dues_reminder: ["player_name", "club_name", "amount", "due_date", "timing", "pay_link"],
  welcome_admin: ["admin_name", "club_name"],
};
