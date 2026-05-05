'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn, Upload, X, ArrowLeft, MapPin, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { submitTradeIn } from '@/lib/api';
import type { TradeInCondition } from '@/lib/types/trade-in';
import ShippingAddressModal from '@/components/checkout/ShippingAddressModal';

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
      <div className="max-w-2xl mx-auto text-center py-16 px-4">
        <LogIn className="w-24 h-24 mx-auto text-gray-300 mb-6" />
        <h1 className="text-2xl font-bold text-[#020E1C] mb-4">Sign In Required</h1>
        <p className="text-gray-600 mb-8">Please sign in or create an account to submit a trade-in.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={() => setShowLoginModal(true)} className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold px-8 py-4">Sign In</Button>
          <Button onClick={() => setShowRegisterModal(true)} variant="outline" className="font-semibold px-8 py-4">Create Account</Button>
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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/trade-in" className="inline-flex items-center text-gray-600 hover:text-[#020E1C] mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />Back
      </Link>
      <h1 className="text-3xl font-bold text-[#020E1C] mb-6">Tell us about your guitar</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Gibson, Fender, Martin..." maxLength={100} required />
        </div>
        <div>
          <Label htmlFor="model">Model</Label>
          <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Les Paul Standard, Stratocaster..." maxLength={100} required />
        </div>
        <div>
          <Label htmlFor="condition">Condition</Label>
          <select id="condition" value={condition} onChange={(e) => setCondition(e.target.value as TradeInCondition)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-[#FFFFF3] focus:outline-none focus:ring-2 focus:ring-[#6E0114]">
            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notes">Notes (optional)</Label>
            <span className="text-xs text-gray-500">{notes.length}/1000</span>
          </div>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any modifications, issues, or details we should know about?" rows={4} maxLength={1000}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6E0114]" />
        </div>
        <div>
          <Label>Photos (up to 8, 5MB each)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(p)} alt={`photo ${i + 1}`} className="w-full h-full object-cover" />
                <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {photos.length < 8 && (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-[#6E0114] hover:text-[#6E0114]">
                <Upload className="h-6 w-6" /><span className="text-xs">Add photo</span>
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
        </div>
        {/* Return address */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Return address (for shipping label)
            </Label>
            <button
              type="button"
              onClick={() => setAddressModalOpen(true)}
              className="text-sm text-[#6E0114] hover:underline font-medium"
            >
              {user?.shippingAddress ? 'Edit' : 'Add address'}
            </button>
          </div>
          {user?.shippingAddress ? (
            <div className="text-sm text-gray-700 space-y-0.5">
              <p className="font-medium">{user.shippingAddress.fullName}</p>
              <p>{user.shippingAddress.line1}</p>
              {user.shippingAddress.line2 && <p>{user.shippingAddress.line2}</p>}
              <p>{user.shippingAddress.city}, {user.shippingAddress.state} {user.shippingAddress.postalCode}</p>
              <p>{user.shippingAddress.country}</p>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>An address is required so we can generate your prepaid shipping label. <button type="button" onClick={() => setAddressModalOpen(true)} className="underline font-medium">Add one now.</button></span>
            </div>
          )}
        </div>

        <Button type="submit" disabled={submitting} className="w-full bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold py-6 text-lg disabled:opacity-50">
          {submitting ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Submitting...</> : 'Submit for review'}
        </Button>
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
