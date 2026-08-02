import type { GhlWebhookEnvelopeV1 } from '@repo/contracts';

export const webhookEnvelopeFixture: GhlWebhookEnvelopeV1 = {
  envelope_version: '1.0',
  source: 'GHL_N8N',
  event_id: 'test-event-001',
  event_type: 'contact.updated',
  occurred_at: '2026-08-02T18:00:00.000Z',

  snapshot: {
    schema_version: '2.0',
    snapshot_type: 'contact',

    external: {
      contact_id: 'contact-001',
      location_id: 'co3lqbHo94L7ZEYwP1u9',
      location_name: 'distribuidoronline.com',
    },

    contact: {
      first_name: 'Jose',
      last_name: 'Castilla',
      full_name: 'Jose Castilla',
      email: '',
      primary_phone: '51972151151',
      secondary_phone: '',
      dni: '',
      customer_city: 'Huancayo',
      product: 'Portabilidad',
      country: 'PE',
      contact_type: 'lead',
      tags: '',
    },

    owner: {
      external_id: '',
      name: 'Jimena C.',
      email: '',
      phone: '',
    },

    attribution: {
      first: {
        session_source: 'Paid Social',
        medium: 'whatsapp',
        url: '',
        ctwa_clid: 'test-ctwa',
        ad_id: '120247757657320016',
        ad_name: 'Cambiate a Movistar',
      },

      last: {
        session_source: 'Paid Social',
        medium: 'whatsapp',
        url: '',
        ctwa_clid: 'test-ctwa',
        ad_id: '120247757657320016',
        ad_name: 'Cambiate a Movistar',
      },
    },

    dates: {
      created_at_utc: '2026-08-02T17:42:26.969Z',

      created_at_lima: '2026-08-02 12:42:26',

      lead_business_date: '2026-08-02',

      event_at_utc: '2026-08-02T18:00:00.000Z',

      event_at_lima: '2026-08-02 13:00:00',

      event_business_date: '2026-08-02',

      timezone: 'America/Lima',
    },
  },
};
