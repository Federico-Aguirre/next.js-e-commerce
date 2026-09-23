import type {
  CheckoutFormData,
  FormErrors,
} from '@/lib/checkout/checkoutSchema';

type CheckoutFormProps = {
  formData: CheckoutFormData;
  formErrors: FormErrors;
  loading: boolean;
  cartIsEmpty: boolean;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
};

type FieldProps = {
  label: string;
  id: keyof CheckoutFormData;
  type?: string;
  placeholder?: string;
  value: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function InputField({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  error,
  onChange,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-gray-700"
      >
        {label}
      </label>

      <input
        id={id}
        type={type}
        name={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-1 ${
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-sky-500 focus:ring-sky-500'
        }`}
      />

      {error && (
        <p className="mt-1 text-xs font-medium text-red-500">{error}</p>
      )}
    </div>
  );
}

export default function CheckoutForm({
  formData,
  formErrors,
  loading,
  cartIsEmpty,
  onChange,
  onSubmit,
}: CheckoutFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <InputField
        label="Número de Tarjeta"
        id="cardNumber"
        value={formData.cardNumber}
        error={formErrors.cardNumber}
        placeholder="5031 7557 3453 0604"
        onChange={onChange}
      />

      <InputField
        label="Nombre del Titular"
        id="cardholderName"
        value={formData.cardholderName}
        error={formErrors.cardholderName}
        placeholder="APRO"
        onChange={onChange}
      />

      <div className="flex gap-3">
        <div className="flex-1">
          <InputField
            label="Mes (MM)"
            id="cardExpirationMonth"
            value={formData.cardExpirationMonth}
            error={formErrors.cardExpirationMonth}
            placeholder="11"
            onChange={onChange}
          />
        </div>

        <div className="flex-1">
          <InputField
            label="Año (YYYY)"
            id="cardExpirationYear"
            value={formData.cardExpirationYear}
            error={formErrors.cardExpirationYear}
            placeholder="2030"
            onChange={onChange}
          />
        </div>

        <div className="flex-1">
          <InputField
            label="CVV"
            id="securityCode"
            value={formData.securityCode}
            error={formErrors.securityCode}
            placeholder="123"
            onChange={onChange}
          />
        </div>
      </div>

      <InputField
        label="Email"
        id="email"
        type="email"
        value={formData.email}
        error={formErrors.email}
        placeholder="test@testuser.com"
        onChange={onChange}
      />

      <div className="flex gap-3">
        <div className="w-[35%]">
          <label
            htmlFor="docType"
            className="mb-1.5 block text-sm font-semibold text-gray-700"
          >
            Tipo Doc
          </label>

          <select
            id="docType"
            name="docType"
            value={formData.docType}
            onChange={onChange}
            className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-1 ${
              formErrors.docType
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-sky-500 focus:ring-sky-500'
            }`}
          >
            <option value="DNI">DNI</option>
          </select>

          {formErrors.docType && (
            <p className="mt-1 text-xs font-medium text-red-500">
              {formErrors.docType}
            </p>
          )}
        </div>

        <div className="w-[65%]">
          <InputField
            label="Número Doc"
            id="docNumber"
            value={formData.docNumber}
            error={formErrors.docNumber}
            placeholder="12345678"
            onChange={onChange}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || cartIsEmpty}
        className="mt-2 w-full rounded-lg bg-sky-500 px-4 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? 'Procesando...' : 'Realizar Compra'}
      </button>
    </form>
  );
}
