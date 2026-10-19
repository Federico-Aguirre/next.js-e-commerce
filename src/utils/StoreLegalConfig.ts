import { StoreConfig } from '@/utils/StoreConfig';

/**
 * Legal identity is deliberately configurable per deployed store.
 * Do not invent a tax ID or legal address; complete these values before launch.
 */
export const StoreLegalConfig = {
  publicName: process.env.STORE_PUBLIC_NAME?.trim() || StoreConfig.name,
  legalName: process.env.STORE_LEGAL_NAME?.trim() || '',
  taxId: process.env.STORE_LEGAL_TAX_ID?.trim() || '',
  address: process.env.STORE_LEGAL_ADDRESS?.trim() || '',
  email: process.env.STORE_LEGAL_EMAIL?.trim() || process.env.CONTACT_RECIPIENT_EMAIL?.trim() || '',
  phone: process.env.STORE_LEGAL_PHONE?.trim() || '',
  supportHours: process.env.STORE_LEGAL_HOURS?.trim() || '',
};

export const missingStoreLegalDetails = [
  !StoreLegalConfig.legalName && 'STORE_LEGAL_NAME',
  !StoreLegalConfig.taxId && 'STORE_LEGAL_TAX_ID',
  !StoreLegalConfig.address && 'STORE_LEGAL_ADDRESS',
  !StoreLegalConfig.email && 'STORE_LEGAL_EMAIL (o CONTACT_RECIPIENT_EMAIL)',
  !StoreLegalConfig.phone && 'STORE_LEGAL_PHONE',
  !StoreLegalConfig.supportHours && 'STORE_LEGAL_HOURS',
].filter((key): key is string => Boolean(key));
