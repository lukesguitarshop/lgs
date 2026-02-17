'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { ShippingAddress, saveShippingAddress } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';

interface ShippingAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAddress?: ShippingAddress | null;
  onSave: (address: ShippingAddress) => void;
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
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={address.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              placeholder="John Doe"
              className={fieldErrors.fullName ? 'border-red-500' : ''}
            />
            {fieldErrors.fullName && (
              <p className="text-red-500 text-sm mt-1">{fieldErrors.fullName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 1 <span className="text-red-500">*</span>
            </label>
            <Input
              value={address.line1}
              onChange={(e) => handleChange('line1', e.target.value)}
              placeholder="123 Main Street"
              className={fieldErrors.line1 ? 'border-red-500' : ''}
            />
            {fieldErrors.line1 && (
              <p className="text-red-500 text-sm mt-1">{fieldErrors.line1}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 2
            </label>
            <Input
              value={address.line2 || ''}
              onChange={(e) => handleChange('line2', e.target.value)}
              placeholder="Apt, Suite, Unit (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <Input
                value={address.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="New York"
                className={fieldErrors.city ? 'border-red-500' : ''}
              />
              {fieldErrors.city && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.city}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <Input
                value={address.state}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="NY"
                className={fieldErrors.state ? 'border-red-500' : ''}
              />
              {fieldErrors.state && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.state}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Postal Code <span className="text-red-500">*</span>
              </label>
              <Input
                value={address.postalCode}
                onChange={(e) => handleChange('postalCode', e.target.value)}
                placeholder="10001"
                className={fieldErrors.postalCode ? 'border-red-500' : ''}
              />
              {fieldErrors.postalCode && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.postalCode}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country <span className="text-red-500">*</span>
              </label>
              <Input
                value={address.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="United States"
                className={fieldErrors.country ? 'border-red-500' : ''}
              />
              {fieldErrors.country && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.country}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#df5e15] hover:bg-[#c54d0a] text-white"
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
