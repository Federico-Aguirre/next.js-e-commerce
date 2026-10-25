import { StoreLegalConfig } from '@/utils/StoreLegalConfig';

type ContactDataProps = {
  locale?: string;
};

export default function ContactData({ locale = 'es' }: ContactDataProps) {
  // Prefer the public/legal contact details, falling back to the store's configured
  // pickup and shipping-origin details instead of displaying sample Miami contact data.
  const address = (
    StoreLegalConfig.address ||
    process.env.STORE_PICKUP_ADDRESS?.trim() ||
    [
      process.env.SHIPPING_ORIGIN_STREET?.trim(),
      process.env.SHIPPING_ORIGIN_NUMBER?.trim(),
      process.env.SHIPPING_ORIGIN_FLOOR?.trim(),
      process.env.SHIPPING_ORIGIN_APARTMENT?.trim(),
      process.env.SHIPPING_ORIGIN_CITY?.trim(),
      process.env.SHIPPING_ORIGIN_STATE?.trim(),
      process.env.SHIPPING_ORIGIN_POSTAL_CODE?.trim(),
      process.env.SHIPPING_ORIGIN_COUNTRY?.trim(),
    ]
      .filter(Boolean)
      .join(', ')
  ).trim();
  const supportEmail = (
    StoreLegalConfig.email ||
    process.env.SHIPPING_ORIGIN_EMAIL?.trim() ||
    ''
  ).trim();
  const phone = (StoreLegalConfig.phone || process.env.SHIPPING_ORIGIN_PHONE?.trim() || '').trim();
  const whatsappNumber = phone.replace(/\D/g, '');
  const displayPhone =
    whatsappNumber.startsWith('54') &&
    whatsappNumber.length === 12 &&
    whatsappNumber.slice(2, 4) === '11'
      ? `+54 11 ${whatsappNumber.slice(4, 8)}-${whatsappNumber.slice(8)}`
      : phone;
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const mapDirectUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  const waMessage = encodeURIComponent(
    locale === 'en'
      ? 'Hello, I would like to make an inquiry.'
      : '¡Hola! Me gustaría hacer una consulta.',
  );

  return (
    <aside
      aria-labelledby="contact-information-title"
      className="h-full w-full space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <h2 id="contact-information-title" className="text-xl font-semibold text-foreground">
        {locale === 'en' ? 'Information & Location' : 'Información y Ubicación'}
      </h2>

      {address && (
        <>
          <div className="h-60 w-full overflow-hidden rounded-lg border border-border">
            <iframe
              src={mapEmbedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={
                locale === 'en'
                  ? 'Store location on Google Maps'
                  : 'Ubicación de la tienda en Google Maps'
              }
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {locale === 'en' ? 'Store Address' : 'Dirección de la tienda'}
            </p>
            <a
              href={mapDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm text-foreground underline hover:text-primary"
            >
              <span aria-hidden="true">📍</span>
              <span>{address}</span>
            </a>
          </div>
        </>
      )}

      {(whatsappNumber || supportEmail) && (
        <div className="space-y-4 border-t border-border pt-4">
          {whatsappNumber && (
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                WhatsApp
              </p>
              <a
                href={`https://wa.me/${whatsappNumber}?text=${waMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 font-medium text-success hover:underline"
              >
                <span aria-hidden="true">💬</span>
                <span>{displayPhone}</span>
              </a>
            </div>
          )}

          {supportEmail && (
            <div>
              <p className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {locale === 'en' ? 'Email Support' : 'Correo electrónico'}
              </p>
              <a
                href={`mailto:${supportEmail}`}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <span aria-hidden="true">✉️</span>
                <span>{supportEmail}</span>
              </a>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
