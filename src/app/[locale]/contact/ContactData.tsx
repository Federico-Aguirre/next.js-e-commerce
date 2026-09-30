import React from 'react';

type ContactDataProps = {
  locale?: string;
};

export default function ContactData({ locale = 'es' }: ContactDataProps) {
  const contactInfo = {
    address: '100 Ocean Drive, Suite 200, Miami, FL 33139, Estados Unidos',
    mapEmbedUrl:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3592.836886475654!2d-80.1325!3d25.7781!2m3!1f02f0!0f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88d9b48e3e333333%3A0x123456789!2s100%20Ocean%20Dr%2C%20Miami%20Beach%2C%20FL%2033139!5e0!3m2!1ses!2sus!4v1700000000000!5m2!1ses!2sus',
    mapDirectUrl:
      'https://www.google.com/maps/search/?api=1&query=100+Ocean+Drive,+Suite+200,+Miami,+FL+33139',
    supportEmail: 'soporte@tu-ecommerce.com',
    primaryWhatsapp: {
      display: '+1 (305) 555-0142',
      number: '13055550142',
    },
    secondaryWhatsapp: {
      display: '+1 (305) 555-0198',
      number: '13055550198',
    },
  };

  const waMessage = encodeURIComponent(
    locale === 'en'
      ? 'Hello, I would like to make an inquiry.'
      : '¡Hola! Me gustaría hacer una consulta.',
  );

  return (
    <div className="w-full max-w-xl space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {locale === 'en' ? 'Information & Location' : 'Información y Ubicación'}
      </h2>

      {/* 1. Iframe de Google Maps */}
      <div className="h-60 w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <iframe
          src={contactInfo.mapEmbedUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen={false}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Ubicación en Google Maps"
        />
      </div>

      {/* 4. Dirección de Google Maps */}
      <div>
        <p className="mb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          {locale === 'en' ? 'Office Address' : 'Dirección de la Oficina'}
        </p>
        <a
          href={contactInfo.mapDirectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 text-sm text-zinc-800 underline hover:text-blue-600 dark:text-zinc-200 dark:hover:text-blue-400"
        >
          <span aria-hidden="true">📍</span>
          <span>{contactInfo.address}</span>
        </a>
      </div>

      <div className="space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        {/* 2. WhatsApp Web */}
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            WhatsApp Web
          </p>
          <div className="space-y-2 text-sm">
            <a
              href={`https://wa.me/${contactInfo.primaryWhatsapp.number}?text=${waMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              <span aria-hidden="true">💬</span>
              <span>Principal: {contactInfo.primaryWhatsapp.display}</span>
            </a>

            <a
              href={`https://wa.me/${contactInfo.secondaryWhatsapp.number}?text=${waMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              <span aria-hidden="true">💬</span>
              <span>Secundario: {contactInfo.secondaryWhatsapp.display}</span>
            </a>
          </div>
        </div>

        {/* 3. Soporte Técnico */}
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            {locale === 'en' ? 'Technical Support' : 'Soporte Técnico'}
          </p>
          <a
            href={`mailto:${contactInfo.supportEmail}`}
            className="flex items-center gap-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            <span aria-hidden="true">✉️</span>
            <span>{contactInfo.supportEmail}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
