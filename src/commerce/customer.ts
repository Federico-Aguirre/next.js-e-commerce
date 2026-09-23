import type { Address } from './contracts';

export type CustomerProfile = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
};

export type CustomerAddress = Address & {
  countryCode?: string;
  phone?: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
};

export type CustomerRepository = {
  getCustomer: (customerId: string) => Promise<CustomerProfile | null>;
  listAddresses: (customerId: string) => Promise<readonly CustomerAddress[]>;
  saveAddress: (address: CustomerAddress) => Promise<void>;
};
