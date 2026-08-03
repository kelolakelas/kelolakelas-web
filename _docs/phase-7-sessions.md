# Fase 7: Session Management

Frontend routes:

- `/dashboard/tenant/sessions` shows an informative unavailable state because the gateway has no `GET /api/v1/sessions` endpoint.
- `/dashboard/tenant/sessions/[id]` uses the available `GET /api/v1/sessions/:id/attendees` endpoint.
- Rescheduling uses `POST /api/v1/sessions/:id/reschedule`.
- Tutor substitution uses `PATCH /api/v1/sessions/:id/substitute-tutor`.

## Backend endpoint needed

Add `GET /api/v1/sessions` to the API Gateway and academic service. The response should use the existing envelope and support pagination, for example:

```json
{
  "status": "success",
  "data": {
    "items": [],
    "pagination": {}
  }
}
```

Recommended query parameters are `page`, `page_size`, `class_id`, `status`, `from`, `to`, and `tutor_id`.