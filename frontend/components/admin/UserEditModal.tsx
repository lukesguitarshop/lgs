'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { updateAdminUser } from '@/lib/api';
import type {
  AdminUser,
  UpdateUserRequest,
  AdminUserShippingAddress,
} from '@/lib/types/admin-user';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUser | null;
  onSave: (updatedUser: AdminUser) => void;
}

export function UserEditModal({
  isOpen,
  onClose,
  user,
  onSave,
}: UserEditModalProps) {
  // Form state
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  // Shipping address state
  const [showShippingAddress, setShowShippingAddress] = useState(false);
  const [shippingFullName, setShippingFullName] = useState('');
  const [shippingLine1, setShippingLine1] = useState('');
  const [shippingLine2, setShippingLine2] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [shippingCountry, setShippingCountry] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when user changes
  useEffect(() => {
    if (user && isOpen) {
      setEmail(user.email || '');
      setFullName(user.fullName);
      setIsAdmin(user.isAdmin);
      setEmailVerified(user.emailVerified);
      setIsGuest(user.isGuest);

      if (user.shippingAddress) {
        setShowShippingAddress(true);
        setShippingFullName(user.shippingAddress.fullName);
        setShippingLine1(user.shippingAddress.line1);
        setShippingLine2(user.shippingAddress.line2 || '');
        setShippingCity(user.shippingAddress.city);
        setShippingState(user.shippingAddress.state);
        setShippingPostalCode(user.shippingAddress.postalCode);
        setShippingCountry(user.shippingAddress.country);
      } else {
        setShowShippingAddress(false);
        setShippingFullName('');
        setShippingLine1('');
        setShippingLine2('');
        setShippingCity('');
        setShippingState('');
        setShippingPostalCode('');
        setShippingCountry('');
      }

      setError(null);
    }
  }, [user, isOpen]);

  const handleSave = async () => {
    if (!user) return;

    setError(null);
    setSaving(true);

    try {
      const updateData: UpdateUserRequest = {};

      // Only include changed fields
      if (email !== (user.email || '')) {
        updateData.email = email || undefined;
      }
      if (fullName !== user.fullName) {
        updateData.fullName = fullName;
      }
      if (isAdmin !== user.isAdmin) {
        updateData.isAdmin = isAdmin;
      }
      if (emailVerified !== user.emailVerified) {
        updateData.emailVerified = emailVerified;
      }
      if (isGuest !== user.isGuest) {
        updateData.isGuest = isGuest;
      }

      // Handle shipping address
      if (showShippingAddress) {
        const newShippingAddress: AdminUserShippingAddress = {
          fullName: shippingFullName,
          line1: shippingLine1,
          line2: shippingLine2 || null,
          city: shippingCity,
          state: shippingState,
          postalCode: shippingPostalCode,
          country: shippingCountry,
        };

        // Check if shipping address changed
        const oldAddr = user.shippingAddress;
        if (
          !oldAddr ||
          oldAddr.fullName !== newShippingAddress.fullName ||
          oldAddr.line1 !== newShippingAddress.line1 ||
          oldAddr.line2 !== newShippingAddress.line2 ||
          oldAddr.city !== newShippingAddress.city ||
          oldAddr.state !== newShippingAddress.state ||
          oldAddr.postalCode !== newShippingAddress.postalCode ||
          oldAddr.country !== newShippingAddress.country
        ) {
          updateData.shippingAddress = newShippingAddress;
        }
      } else if (user.shippingAddress) {
        // Clear shipping address
        updateData.clearShippingAddress = true;
      }

      const updatedUser = await updateAdminUser(user.id, updateData);
      onSave(updatedUser);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update user'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <Input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-3 gap-4">
            {/* Is Admin */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#df5e15] focus:ring-[#df5e15]"
              />
              <span className="text-sm text-gray-700">Admin</span>
            </label>

            {/* Email Verified */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={emailVerified}
                onChange={(e) => setEmailVerified(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#df5e15] focus:ring-[#df5e15]"
              />
              <span className="text-sm text-gray-700">Verified</span>
            </label>

            {/* Is Guest */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isGuest}
                onChange={(e) => setIsGuest(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#df5e15] focus:ring-[#df5e15]"
              />
              <span className="text-sm text-gray-700">Guest</span>
            </label>
          </div>

          {/* Shipping Address Section */}
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setShowShippingAddress(!showShippingAddress)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
            >
              <span className="font-medium text-gray-700">
                Shipping Address
              </span>
              {showShippingAddress ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {showShippingAddress && (
              <div className="p-3 pt-0 space-y-3 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    value={shippingFullName}
                    onChange={(e) => setShippingFullName(e.target.value)}
                    placeholder="Recipient name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 1
                  </label>
                  <Input
                    type="text"
                    value={shippingLine1}
                    onChange={(e) => setShippingLine1(e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 2
                  </label>
                  <Input
                    type="text"
                    value={shippingLine2}
                    onChange={(e) => setShippingLine2(e.target.value)}
                    placeholder="Apt, Suite, etc. (optional)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <Input
                      type="text"
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State/Province
                    </label>
                    <Input
                      type="text"
                      value={shippingState}
                      onChange={(e) => setShippingState(e.target.value)}
                      placeholder="State"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code
                    </label>
                    <Input
                      type="text"
                      value={shippingPostalCode}
                      onChange={(e) => setShippingPostalCode(e.target.value)}
                      placeholder="12345"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <Input
                      type="text"
                      value={shippingCountry}
                      onChange={(e) => setShippingCountry(e.target.value)}
                      placeholder="USA"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Read-only info */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>
              <strong>ID:</strong> {user?.id}
            </p>
            <p>
              <strong>Created:</strong>{' '}
              {user?.createdAt &&
                new Date(user.createdAt).toLocaleString()}
            </p>
            {user?.guestSessionId && (
              <p>
                <strong>Guest Session:</strong> {user.guestSessionId}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#df5e15] hover:bg-[#c54d0a] text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
