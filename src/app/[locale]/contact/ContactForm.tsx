'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { m, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { sendContactForm } from '@/actions/contactAction';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { contactSchema } from '@/lib/schemas/contactSchema';
import type { ContactFormData } from '@/lib/schemas/contactSchema';

// Maps server errors to valid next-intl keys without dynamic string interpolation
const SERVER_ERROR_KEYS = {
  rateLimitExceeded: 'messages.rateLimitExceeded',
  invalidData: 'messages.invalidData',
  submittedTooFast: 'messages.submittedTooFast',
  serviceError: 'messages.serviceError',
} as const;

// Maps Zod validation errors to valid next-intl keys
const FORM_ERROR_KEYS = {
  nameRequired: 'errors.nameRequired',
  invalidEmail: 'errors.invalidEmail',
  affairRequired: 'errors.affairRequired',
  messageTooShort: 'errors.messageTooShort',
} as const;

// Type guards to narrow types safely without using 'as' type assertions
const isFormErrorKey = (key: string): key is keyof typeof FORM_ERROR_KEYS =>
  key in FORM_ERROR_KEYS;

const isServerErrorKey = (key: string): key is keyof typeof SERVER_ERROR_KEYS =>
  key in SERVER_ERROR_KEYS;

export default function ContactForm() {
  const t = useTranslations('contact');
  const shouldReduceMotion = useReducedMotion();

  const [serverStatus, setServerStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message?: string;
  }>({ type: 'idle' });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      affair: '',
      consultation: '',
      hp_company: '',
      formTimestamp: 0,
    },
  });

  // Records the mount time directly into the form state when loading on the client.
  useEffect(() => {
    setValue('formTimestamp', Date.now());
  }, [setValue]);

  // Resolves form validation error messages safely
  const getFormErrorMessage = (errorMessage?: string) => {
    if (!errorMessage) {
      return null;
    }
    if (isFormErrorKey(errorMessage)) {
      return t(FORM_ERROR_KEYS[errorMessage]);
    }
    return errorMessage;
  };

  const onSubmit = async (data: ContactFormData) => {
    setServerStatus({ type: 'idle' });

    const response = await sendContactForm(data);

    if (response.success) {
      setServerStatus({ type: 'success', message: t('messages.success') });
      reset();
    } else {
      const translationKey =
        response.error && isServerErrorKey(response.error)
          ? SERVER_ERROR_KEYS[response.error]
          : 'messages.serverError';

      setServerStatus({ type: 'error', message: t(translationKey) });
    }
  };

  return (
    <m.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 md:p-8"
    >
      <Form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('sendMessage')}
        </h2>

        {/* Honeypot */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="hp_company">Do not fill this field</label>
          <input
            id="hp_company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...register('hp_company')}
          />
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">{t('name')}</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            aria-required="true"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
            {...register('name')}
          />
          {errors.name && (
            <p
              id="name-error"
              role="alert"
              className="mt-1 text-xs text-red-500"
            >
              {getFormErrorMessage(errors.name.message)}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-required="true"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p
              id="email-error"
              role="alert"
              className="mt-1 text-xs text-red-500"
            >
              {getFormErrorMessage(errors.email.message)}
            </p>
          )}
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label htmlFor="affair">{t('affair')}</Label>
          <Input
            id="affair"
            type="text"
            autoComplete="off"
            aria-required="true"
            aria-invalid={!!errors.affair}
            aria-describedby={errors.affair ? 'affair-error' : undefined}
            {...register('affair')}
          />
          {errors.affair && (
            <p
              id="affair-error"
              role="alert"
              className="mt-1 text-xs text-red-500"
            >
              {getFormErrorMessage(errors.affair.message)}
            </p>
          )}
        </div>

        {/* Message */}
        <div className="space-y-2">
          <Label htmlFor="consultation">{t('message')}</Label>
          <Textarea
            id="consultation"
            rows={4}
            aria-required="true"
            aria-invalid={!!errors.consultation}
            aria-describedby={
              errors.consultation ? 'consultation-error' : undefined
            }
            {...register('consultation')}
          />
          {errors.consultation && (
            <p
              id="consultation-error"
              role="alert"
              className="mt-1 text-xs text-red-500"
            >
              {getFormErrorMessage(errors.consultation.message)}
            </p>
          )}
        </div>

        {/* Server status */}
        <div aria-live="polite" aria-atomic="true">
          {serverStatus.type === 'success' && (
            <p className="text-sm font-medium text-emerald-500">
              {serverStatus.message}
            </p>
          )}
          {serverStatus.type === 'error' && (
            <p className="text-sm font-medium text-red-500">
              {serverStatus.message}
            </p>
          )}
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? t('sending') : t('send')}
        </Button>
      </Form>
    </m.div>
  );
}
