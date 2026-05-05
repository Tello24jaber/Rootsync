# Lead Statuses & Tags Reference

## Lead Statuses

| Status | Meaning |
|---|---|
| `new` | First message, not yet classified |
| `hot_lead` | Ready to book, asks for payment/link/appointment |
| `cold_lead` | Interested but not ready yet |
| `not_interested` | Refused, low-intent "maybe later", price objection |
| `needs_human` | Requires human review |
| `consultation_lead` | Interested in doctor consultation |
| `program_lead` | Interested in treatment program |
| `payment_link_sent` | Payment link was sent |
| `booked` | Appointment booked |
| `converted` | Paid / became official patient or subscriber |

## Priority Logic

| Condition | Priority |
|---|---|
| `hot_lead` | high |
| `needs_human` | high |
| `payment_link_sent` | high |
| `program_lead` | high or medium |
| `cold_lead` | medium |
| `not_interested` | low |

## Tags

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

A lead has **one status** and **multiple tags**.
