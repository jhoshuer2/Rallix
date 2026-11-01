-- Add the pay link to the default invoice and past-due templates. Appends only, and only if the staff have not already added it, so edited templates are never overwritten.
UPDATE templates SET body = body || E'\n\n' || 'Pay online any time: {{pay_link}}', updated_at = now() WHERE key IN ('invoice_issued', 'subscription_past_due') AND body NOT LIKE '%{{pay_link}}%'
