'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn, Upload, X, Plus, ArrowLeft, MapPin, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { submitTradeIn } from '@/lib/api';
import type { TradeInCondition } from '@/lib/types/trade-in';
import ShippingAddressModal from '@/components/checkout/ShippingAddressModal';
import { StickyBar } from '@/components/ui/sticky-bar';

const CONDITIONS: TradeInCondition[] = ['Mint', 'Excellent', 'Very Good', 'Good', 'Fair'];

export default function TradeInSubmitPage() {
  const router = useRouter();
  const { isAuthenticated, setShowLoginModal, setShowRegisterModal, user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [condition, setCondition] = useState<TradeInCondition>('Excellent');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 sm:px-4">
        <LogIn className="mb-5 h-12 w-12 text-primary" />
        <h1 className="font-heading text-3xl leading-[0.98]">Sign in first</h1>
        <p className="mt-3 text-base leading-[1.5] text-foreground/78">
          Trade-ins are tied to your account so you can track the quote and get a
          prepaid label. It takes a minute to make one.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowLoginModal(true)}
            className="font-btn flex h-12 items-center justify-center bg-primary px-8 text-[13px] text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="font-btn flex h-12 items-center justify-center border border-foreground px-8 text-[13px] text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            Create account
          </button>
        </div>
      </div>
    );
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).slice(0, 8 - photos.length);
    setPhotos((prev) => [...prev, ...next].slice(0, 8));
  };

  const removePhoto = (idx: number) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim()) {
      showToast('Please fill in brand and model', 'error');
      return;
    }
    if (!user?.shippingAddress) {
      showToast('Please add a shipping address to your profile before submitting', 'error');
      setAddressModalOpen(true);
      return;
    }
    if (photos.length === 0) {
      showToast('Please add at least one photo', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('Brand', brand.trim());
      fd.append('Model', model.trim());
      fd.append('Condition', condition);
      fd.append('Notes', notes.trim());
      photos.forEach((p) => fd.append('Photos', p));
      const result = await submitTradeIn(fd);
      router.push(`/trade-in/${result.id}/submitted`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submit failed';
      showToast(message, 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-4">
      <Link
        href="/trade-in"
        className="label-mono inline-flex min-h-11 items-center text-foreground/60 transition-colors hover:text-primary"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />Back
      </Link>
      <h1 className="font-heading mt-2 text-[clamp(30px,8vw,34px)] leading-[0.95]">
        Tell me about your guitar
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        <section>
          <h2 className="label-mono mb-3 text-primary">The guitar</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="brand" className="mb-2 block text-sm font-semibold">Brand</Label>
              <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Gibson, Fender, Martin..." maxLength={100} required
                className="h-12 border-foreground/35 text-base md:h-9 md:text-sm" />
            </div>
            <div>
              <Label htmlFor="model" className="mb-2 block text-sm font-semibold">Model</Label>
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Les Paul Standard, Stratocaster..." maxLength={100} required
                className="h-12 border-foreground/35 text-base md:h-9 md:text-sm" />
            </div>
            <div>
              <Label htmlFor="condition" className="mb-2 block text-sm font-semibold">Condition</Label>
              <select id="condition" value={condition} onChange={(e) => setCondition(e.target.value as TradeInCondition)}
                className="h-12 w-full border border-foreground/35 bg-background px-3 text-base focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary md:h-9 md:text-sm">
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label htmlFor="notes" className="text-sm font-semibold">Notes (optional)</Label>
                <span className="label-mono-sm text-muted-foreground">{notes.length}/1000</span>
              </div>
              <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Any modifications, issues, or details I should know about?" rows={4} maxLength={1000}
                className="w-full border border-foreground/35 bg-background px-3.5 py-3 text-base leading-[1.5] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary md:text-sm" />
            </div>
          </div>
        </section>
        <section>
          <h2 className="label-mono mb-3 text-primary">Photos — the more the better</h2>

          {photos.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center border-[1.5px] border-dashed border-foreground/35 px-5 py-8 text-center transition-colors hover:border-primary"
            >
              <Upload className="h-6 w-6 text-primary" />
              <span className="mt-3 text-base font-semibold text-foreground">
                Add photos of the guitar
              </span>
              <span className="mt-1 text-sm leading-[1.45] text-foreground/65">
                Up to 8, 5MB each. Front, back, headstock, and anything that isn&apos;t perfect.
              </span>
              <span className="font-btn mt-4 flex h-12 items-center justify-center border border-foreground px-5 text-[13px] text-foreground">
                Choose from library
              </span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-[4/5] overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(p)} alt={`photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute top-0 right-0 flex h-11 w-11 items-center justify-center bg-foreground/70 text-background"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {photos.length < 8 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Add photo"
                  className="flex aspect-[4/5] flex-col items-center justify-center gap-1.5 border-[1.5px] border-dashed border-foreground/35 text-foreground/60 transition-colors hover:border-primary hover:text-primary"
                >
                  <Plus className="h-6 w-6" />
                  <span className="label-mono-sm">Add</span>
                </button>
              )}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
        </section>
        <section>
          <h2 className="label-mono mb-3 text-primary">Where to reach you</h2>
          <div className="border border-foreground/15 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4" />
                Return address
              </Label>
              <button
                type="button"
                onClick={() => setAddressModalOpen(true)}
                className="label-mono-sm flex min-h-11 items-center text-primary"
              >
                {user?.shippingAddress ? 'Edit' : 'Add address'}
              </button>
            </div>
            {user?.shippingAddress ? (
              <div className="space-y-0.5 text-sm text-foreground/78">
                <p className="font-medium text-foreground">{user.shippingAddress.fullName}</p>
                <p>{user.shippingAddress.line1}</p>
                {user.shippingAddress.line2 && <p>{user.shippingAddress.line2}</p>}
                <p>{user.shippingAddress.city}, {user.shippingAddress.state} {user.shippingAddress.postalCode}</p>
                <p>{user.shippingAddress.country}</p>
              </div>
            ) : (
              <div className="bg-muted-foreground p-4 text-foreground">
                <p className="label-mono flex items-center gap-2 text-foreground/60">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Heads up
                </p>
                <p className="mt-1.5 text-[15px] leading-[1.5]">
                  I need an address to generate your prepaid shipping label.{' '}
                  <button
                    type="button"
                    onClick={() => setAddressModalOpen(true)}
                    className="font-semibold underline"
                  >
                    Add one now.
                  </button>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Desktop keeps the in-page button; phones get it in the sticky bar. */}
        <Button type="submit" disabled={submitting} className="hidden w-full bg-primary py-6 text-lg font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 md:flex">
          {submitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Submitting...</> : 'Submit for review'}
        </Button>

        <StickyBar>
          <button
            type="submit"
            disabled={submitting}
            className="font-btn flex h-13 w-full items-center justify-center gap-2 bg-primary text-[13px] text-primary-foreground disabled:opacity-50"
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : 'Get my quote'}
          </button>
        </StickyBar>
      </form>

      <ShippingAddressModal
        isOpen={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        initialAddress={user?.shippingAddress}
        onSave={async () => {
          await refreshUser();
          setAddressModalOpen(false);
        }}
      />
    </div>
  );
}
