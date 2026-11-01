import { PageHead } from "../../../components/ui";
import { SettingsForm, TemplateForm } from "../../../components/Forms";
import { getSettings, listTemplates } from "../../../lib/queries";
import { PLACEHOLDERS as placeholders } from "../../../lib/placeholders";

const sample: Record<string, string> = { admin_name: "Innocent", player_name: "Ade", club_name: "Paris Arena", invoice_number: "RLX-2026-0001", period: "2026-11", amount: "₦6,000", due_date: "28 Nov 2026", payment_instructions: "Pay to the account on the invoice.", company_name: "Rallix", pay_link: "https://app.rallix.app/pay/invoice/AbCd…" };
const render = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => sample[k] ?? `{{${k}}}`);

export default async function Templates() {
  const [templates, s] = await Promise.all([listTemplates(), getSettings()]);
  return (
    <>
      <PageHead title="Templates" sub="Messages Rallix sends, and how invoices look. Changes apply to anything sent or printed afterwards." />
      <h2 className="cs-h2" style={{ marginTop: 0 }}>Invoice branding</h2>
      <SettingsForm companyName={s!.company_name} address={s!.address} email={s!.email} phone={s!.phone} invoicePrefix={s!.invoice_prefix} vatPercent={s!.vat_percent} footerNote={s!.footer_note} paymentInstructions={s!.payment_instructions} />
      <h2 className="cs-h2">Messages</h2>
      <div className="cs-grid">
        {templates.map((t) => (
          <div key={t.id} className="cs-grid cs-grid--2" style={{ alignItems: "start" }}>
            <TemplateForm id={t.id} name={t.name} kind={t.kind} subject={t.subject} body={t.body} placeholders={placeholders[t.key] ?? []} />
            <section className="cs-card" aria-label={`Preview of ${t.name}`}>
              <p className="cs-eyebrow">Preview with sample data</p>
              {t.subject ? <p><strong>{render(t.subject)}</strong></p> : null}
              <p className="cs-pre">{render(t.body)}</p>
            </section>
          </div>
        ))}
      </div>
    </>
  );
}
