'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Upload, X } from 'lucide-react';
import { createAdminListing, type CreatedAdminListing } from '@/lib/api';
import { resizeImage } from '@/lib/resize-image';

// Kept in step with ManualListingRules on the API.
const MAX_PHOTOS = 25;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const CONDITIONS = ['Brand New', 'Mint', 'Excellent', 'Very Good', 'Good', 'Fair', 'Poor'];
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 20000;

interface PickedPhoto {
  file: File;
  url: string;
}

interface NewListingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (listing: CreatedAdminListing) => void;
}

/**
 * A listing typed in by hand, for a guitar that isn't on Reverb. It goes live on the
 * shop as soon as it is created, and the Reverb scraper leaves it alone.
 */
export function NewListingDialog({ isOpen, onClose, onCreated }: NewListingDialogProps) {
  const [title, setTitle] = useState('');
  const [condition, setCondition] = useState('Excellent');
  const [price, setPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview URLs are released when the dialog goes away, however it was closed.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setTitle('');
    setCondition('Excellent');
    setPrice('');
    setPurchasePrice('');
    setDescription('');
    setPhotos([]);
    setPhotoError(null);
    setError(null);
  };

  // Closing by accident (a stray tap on the backdrop) keeps what was typed; only a
  // created listing clears the form.
  const handleOpenChange = (open: boolean) => {
    if (!open && !saving) onClose();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const room = MAX_PHOTOS - photos.length;
    const problems: string[] = [];
    if (picked.length > room) problems.push(`Only ${MAX_PHOTOS} photos fit, so the extras were left out.`);

    setPreparing(true);
    const accepted: PickedPhoto[] = [];
    for (const original of picked.slice(0, room)) {
      if (!PHOTO_TYPES.includes(original.type)) {
        problems.push(`${original.name} isn't a JPEG, PNG, GIF, or WebP photo.`);
        continue;
      }
      const file = await resizeImage(original);
      if (file.size > MAX_PHOTO_BYTES) {
        problems.push(`${original.name} is over 10MB. Pick a smaller photo.`);
        continue;
      }
      accepted.push({ file, url: URL.createObjectURL(file) });
    }
    setPreparing(false);
    setPhotos((prev) => [...prev, ...accepted].slice(0, MAX_PHOTOS));
    setPhotoError(problems.length ? problems.join(' ') : null);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
    setPhotoError(null);
  };

  const makeCover = (idx: number) =>
    setPhotos((prev) => [prev[idx], ...prev.filter((_, i) => i !== idx)]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || preparing) return;

    const priceNum = Number(price);
    const paidNum = purchasePrice.trim() === '' ? null : Number(purchasePrice);
    if (!title.trim()) return setError('Give the listing a title.');
    if (!Number.isFinite(priceNum) || priceNum <= 0) return setError('Enter a price above zero.');
    if (paidNum !== null && (!Number.isFinite(paidNum) || paidNum < 0)) {
      return setError('What you paid should be a number, or left blank.');
    }
    if (photos.length === 0) return setError('Add at least one photo.');

    setError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('Title', title.trim());
      fd.append('Condition', condition);
      fd.append('Price', String(priceNum));
      if (paidNum !== null) fd.append('PurchasePrice', String(paidNum));
      fd.append('Description', description.trim());
      photos.forEach((p) => fd.append('Photos', p.file, p.file.name));
      const created = await createAdminListing(fd);
      reset();
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The listing was not created. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New listing</DialogTitle>
          <p className="text-sm text-gray-600">
            For a guitar that isn&apos;t on Reverb. It goes live on the shop as soon as you create it.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-listing-title">Title</Label>
            <Input
              id="new-listing-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Gibson Les Paul Standard '60s 2021 Iced Tea"
              maxLength={MAX_TITLE}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-listing-condition">Condition</Label>
              <select
                id="new-listing-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="h-12 w-full border border-foreground/35 bg-background px-3 text-base focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary md:h-9 md:border-input md:text-sm"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-listing-price">Price ($)</Label>
              <Input
                id="new-listing-price"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="2499"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-listing-paid">What you paid ($)</Label>
              <Input
                id="new-listing-paid"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-gray-500">
            What you paid is never shown to customers. It fills in the purchase price on this
            guitar&apos;s Finances transaction; left blank, the asking price is used until you edit it there.
          </p>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="new-listing-description">Description</Label>
              <span className="text-xs text-gray-500">{description.length}/{MAX_DESCRIPTION}</span>
            </div>
            <Textarea
              id="new-listing-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Year, specs, condition notes, what's included. Leave a blank line between paragraphs."
              rows={7}
              maxLength={MAX_DESCRIPTION}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Photos</Label>
              <span className="text-xs text-gray-500">{photos.length}/{MAX_PHOTOS}</span>
            </div>
            {photos.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center border-[1.5px] border-dashed border-foreground/35 px-5 py-8 text-center transition-colors hover:border-primary"
              >
                <Upload className="h-6 w-6 text-primary" />
                <span className="mt-3 text-sm font-semibold">Add photos</span>
                <span className="mt-1 text-xs text-gray-500">
                  Up to {MAX_PHOTOS}. The first one is the cover shown on the shop.
                </span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {photos.map((p, i) => (
                  <div key={p.url} className="relative aspect-[4/5] overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label={`Remove photo ${i + 1}`}
                      className="absolute top-0 right-0 flex h-9 w-9 items-center justify-center bg-foreground/70 text-background"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {i === 0 ? (
                      <span className="absolute bottom-0 left-0 right-0 bg-primary px-1 py-1 text-center text-[11px] font-semibold text-primary-foreground">
                        Cover
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => makeCover(i)}
                        className="absolute bottom-0 left-0 right-0 bg-foreground/70 px-1 py-1 text-center text-[11px] text-background hover:bg-foreground"
                      >
                        Make cover
                      </button>
                    )}
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Add photos"
                    className="flex aspect-[4/5] flex-col items-center justify-center gap-1.5 border-[1.5px] border-dashed border-foreground/35 text-foreground/60 transition-colors hover:border-primary hover:text-primary"
                  >
                    <Plus className="h-6 w-6" />
                    <span className="text-xs">Add</span>
                  </button>
                )}
              </div>
            )}
            {preparing && (
              <p className="flex items-center gap-2 text-xs text-gray-500" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />Getting the photos ready
              </p>
            )}
            {photoError && <p className="text-sm text-amber-700" role="alert">{photoError}</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept={PHOTO_TYPES.join(',')}
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
              data-testid="new-listing-photos"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || preparing}>
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading photos…</>
              ) : (
                'Create listing'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
