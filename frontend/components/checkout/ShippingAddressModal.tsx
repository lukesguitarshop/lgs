'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StateBlock } from '@/components/ui/state-block';
import { Loader2 } from 'lucide-react';
import { ShippingAddress, saveShippingAddress } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';

interface ShippingAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAddress?: ShippingAddress | null;
  onSave: (address: ShippingAddress) => void;
}

// Mono crimson on phones (`.mobile-label` is inert from md up), today's Archivo label
// on desktop.
const labelClass = 'mobile-label mb-2 block text-sm font-medium text-foreground/78 md:mb-1';
const fieldErrorClass = 'mt-1 text-[13px] text-primary';

function Required() {
  return <span className="text-primary">*</span>;
}

export default function ShippingAddressModal({
  isOpen,
  onClose,
  initialAddress,
  onSave,
}: ShippingAddressModalProps) {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<ShippingAddress>({
    fullName: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});

  // Initialize form with existing address or user's name
  useEffect(() => {
    if (initialAddress) {
      setAddress({
        fullName: initialAddress.fullName || '',
        line1: initialAddress.line1 || '',
        line2: initialAddress.line2 || '',
        city: initialAddress.city || '',
        state: initialAddress.state || '',
        postalCode: initialAddress.postalCode || '',
        country: initialAddress.country || '',
      });
    } else if (user?.fullName) {
      setAddress(prev => ({
        ...prev,
        fullName: prev.fullName || user.fullName || '',
      }));
    }
  }, [initialAddress, user?.fullName, isOpen]);

  const handleChange = (field: keyof ShippingAddress, value: string) => {
    setAddress(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const errors: Partial<Record<keyof ShippingAddress, string>> = {};

    if (!address.fullName.trim()) errors.fullName = 'Full name is required';
    if (!address.line1.trim()) errors.line1 = 'Address is required';
    if (!address.city.trim()) errors.city = 'City is required';
    if (!address.state.trim()) errors.state = 'State is required';
    if (!address.postalCode.trim()) errors.postalCode = 'Postal code is required';
    if (!address.country.trim()) errors.country = 'Country is required';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    setError(null);

    try {
      await saveShippingAddress(address);
      await refreshUser();
      onSave(address);
      onClose();
    } catch (err) {
      console.error('Failed to save address:', err);
      setError('Failed to save address. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialAddress ? 'Edit Shipping Address' : 'Add Shipping Address'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {error && <StateBlock variant="error">{error}</StateBlock>}

          <div>
            <label htmlFor="address-fullName" className={labelClass}>
              Full Name <Required />
            </label>
            <Input
              id="address-fullName"
              value={address.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              placeholder="John Doe"
              className={fieldErrors.fullName ? 'border-primary' : ''}
            />
            {fieldErrors.fullName && (
              <p className={fieldErrorClass}>{fieldErrors.fullName}</p>
            )}
          </div>

          <div>
            <label htmlFor="address-line1" className={labelClass}>
              Address Line 1 <Required />
            </label>
            <Input
              id="address-line1"
              value={address.line1}
              onChange={(e) => handleChange('line1', e.target.value)}
              placeholder="123 Main Street"
              className={fieldErrors.line1 ? 'border-primary' : ''}
            />
            {fieldErrors.line1 && (
              <p className={fieldErrorClass}>{fieldErrors.line1}</p>
            )}
          </div>

          <div>
            <label htmlFor="address-line2" className={labelClass}>
              Address Line 2
            </label>
            <Input
              id="address-line2"
              value={address.line2 || ''}
              onChange={(e) => handleChange('line2', e.target.value)}
              placeholder="Apt, Suite, Unit (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="address-city" className={labelClass}>
                City <Required />
              </label>
              <Input
                id="address-city"
                value={address.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="New York"
                className={fieldErrors.city ? 'border-primary' : ''}
              />
              {fieldErrors.city && (
                <p className={fieldErrorClass}>{fieldErrors.city}</p>
              )}
            </div>
            <div>
              <label htmlFor="address-state" className={labelClass}>
                State <Required />
              </label>
              <Input
                id="address-state"
                value={address.state}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="NY"
                className={fieldErrors.state ? 'border-primary' : ''}
              />
              {fieldErrors.state && (
                <p className={fieldErrorClass}>{fieldErrors.state}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="address-postalCode" className={labelClass}>
                Postal Code <Required />
              </label>
              <Input
                id="address-postalCode"
                value={address.postalCode}
                onChange={(e) => handleChange('postalCode', e.target.value)}
                placeholder="10001"
                className={fieldErrors.postalCode ? 'border-primary' : ''}
              />
              {fieldErrors.postalCode && (
                <p className={fieldErrorClass}>{fieldErrors.postalCode}</p>
              )}
            </div>
            <div>
              <label htmlFor="address-country" className={labelClass}>
                Country <Required />
              </label>
              <Input
                id="address-country"
                value={address.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="United States"
                className={fieldErrors.country ? 'border-primary' : ''}
              />
              {fieldErrors.country && (
                <p className={fieldErrorClass}>{fieldErrors.country}</p>
              )}
            </div>
          </div>

          <div className="grid gap-2 pt-4 border-t sm:flex sm:justify-end sm:gap-3">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Address'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
