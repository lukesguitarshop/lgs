'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { StickyBar } from '@/components/ui/sticky-bar';

/**
 * Topic chips. These prefill the subject rather than replacing it — the field stays
 * editable, and anyone who wants to write their own subject still can.
 */
const TOPICS = [
  'A specific guitar',
  'Trade-in',
  'Shipping',
  'Something else',
] as const;

const inputClass =
  'h-12 w-full border border-foreground/35 bg-background px-3.5 text-base text-foreground transition-colors placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export default function ContactPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>(TOPICS[0]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      subject: formData.get('subject') as string,
      message: formData.get('message') as string,
    };

    try {
      await api.post('/contact', data);
      setSuccess(true);
      form.reset();
    } catch (err) {
      setError('Failed to send message. Please try again later.');
      console.error('Contact form error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto px-5 py-8 sm:px-4">
        <div className="mx-auto max-w-xl">
          <div className="bg-foreground p-6 text-background">
            <p className="label-mono text-muted-foreground">Sent</p>
            <h1 className="font-heading mt-2 text-3xl">Message sent</h1>
            <p className="mt-2 text-[15px] leading-[1.5] text-background/85">
              Thanks for reaching out — I&apos;ll get back to you as soon as I can.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(false)}
            className="font-btn mt-4 flex h-12 w-full items-center justify-center border border-foreground text-[13px] text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-5 py-8 sm:px-4">
      <div className="mx-auto max-w-xl">
        <h1 className="font-heading text-[clamp(32px,9.6vw,36px)] leading-[0.95] text-foreground">
          Questions?
        </h1>
        <p className="mt-3 text-base leading-[1.5] text-foreground/78">
          Ask me anything about a listing — more photos, measurements, a video or audio
          demo. I&apos;d rather answer before you buy than after.
        </p>

        <div className="mt-5 flex items-center gap-2.5 bg-muted-foreground/22 p-4">
          <span aria-hidden className="block h-2 w-2 shrink-0 bg-primary" />
          <p className="label-mono text-foreground">Typical reply — under 4 hours</p>
        </div>

        {error && (
          <div className="mt-5 bg-primary p-4 text-primary-foreground">
            <p className="label-mono text-primary-foreground/70">Can&apos;t continue</p>
            <p className="mt-1.5 text-[15px]">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8">
          <fieldset>
            <legend className="label-mono mb-3 text-primary">
              What&apos;s this about?
            </legend>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map(t => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={topic === t}
                  onClick={() => setTopic(t)}
                  className={`label-mono flex h-11 items-center border px-3.5 transition-colors ${
                    topic === t
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-foreground/30 text-foreground/70 hover:border-primary hover:text-primary'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </fieldset>

          {/* The chip writes the subject; the field stays visible and editable. */}
          <input type="hidden" name="subject" value={topic} />

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="label-mono mb-2 block text-primary">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className={inputClass}
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="label-mono mb-2 block text-primary">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className={inputClass}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="message" className="label-mono mb-2 block text-primary">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                className="min-h-[120px] w-full resize-none border border-foreground/35 bg-background px-3.5 py-3 text-base leading-[1.5] text-foreground transition-colors placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="What are you after?"
              />
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-[1.5] text-foreground/60">
            I read every message myself. No list, no autoresponder — you can also email{' '}
            <a
              href="mailto:lukesguitarshop@gmail.com"
              className="text-primary underline"
            >
              lukesguitarshop@gmail.com
            </a>
            .
          </p>

          {/* Desktop keeps the in-page button; phones get it in the sticky bar. */}
          <button
            type="submit"
            disabled={isLoading}
            className="font-btn mt-6 hidden h-12 w-full items-center justify-center bg-primary text-[13px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 md:flex"
          >
            {isLoading ? 'Sending…' : 'Send it'}
          </button>

          <StickyBar>
            <button
              type="submit"
              disabled={isLoading}
              className="font-btn flex h-13 w-full items-center justify-center bg-primary text-[13px] text-primary-foreground transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Sending…' : 'Send it'}
            </button>
          </StickyBar>
        </form>
      </div>
    </div>
  );
}
