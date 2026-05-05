# Lead Status Design Reference

## Fields

A lead has three independent classification fields, plus tags.

### `lead_temperature`

The AI's read of how sales-ready the lead is.

| Value | Meaning |
|---|---|
| `hot` | Ready to book — asking about price, payment, or appointment |
| `cold` | Interested but not ready yet |
| `not_interested` | Refused, price objection, low intent |
| `unknown` | First message, not yet classified |

### `service_interest`

What service the lead is asking about.

| Value | Meaning |
|---|---|
| `consultation` | Interested in a doctor consultation |
| `treatment_program` | Interested in a treatment/wellness program |
| `unclear` | Cannot determine from message |

### `workflow_status`

The operational state managed by the team (not set by AI except for `needs_human`).

| Value | Meaning |
|---|---|
| `new` | Just created, no action taken |
| `needs_human` | AI flagged for human review |
| `payment_link_sent` | Team sent payment link |
| `booked` | Appointment confirmed |
| `converted` | Paid / became official patient |
| `lost` | Confirmed not proceeding |

### `tags`

Array. Multiple tags per lead allowed.

- `price_question`
- `booking_question`
- `payment_question`
- `consultation_interest`
- `program_interest`
- `medical_question`
- `lab_or_file_sent`
- `urgent_symptoms`
- `objection_price`
- `follow_up_needed`
- `country_or_timezone_needed`
- `needs_sales`
- `needs_doctor`
- `needs_customer_service`

## Migration Note

`consultation_lead` and `program_lead` are replaced by `service_interest = consultation` and `service_interest = treatment_program`. Do not use them as `lead_temperature` values.
