'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, Loader2 } from 'lucide-react';
import { createAdminUser } from '@/lib/api';
import type { AdminUser, NewUserAccountType } from '@/lib/types/admin-user';

interface UserCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (user: AdminUser) => void;
}

const ACCOUNT_TYPES: { value: NewUserAccountType; label: string; hint: string }[] = [
  { value: 'customer', label: 'Customer', hint: 'A normal shopper account.' },
  {
    value: 'seller',
    label: 'Seller',
    hint: 'Can connect their own Reverb account and list their guitars on the site. No admin access.',
  },
];

// No look-alike characters (0/O, 1/l/I), since this gets read out or retyped.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generatePassword(length = 14) {
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  let out = '';
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const b of bytes) {
      if (b < limit && out.length < length) out += PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length];
    }
  }
  return out;
}

export function UserCreateModal({ isOpen, onClose, onCreated }: UserCreateModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<NewUserAccountType>('customer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept after a successful create so the password can still be copied and passed on.
  const [created, setCreated] = useState<{ user: AdminUser; password: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFullName('');
    setEmail('');
    setPassword(generatePassword());
    setAccountType('customer');
    setError(null);
    setCreated(null);
  }, [isOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const user = await createAdminUser({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        accountType,
      });
      setCreated({ user, password });
      onCreated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const selectedType = ACCOUNT_TYPES.find((t) => t.value === accountType)!;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{created ? 'User created' : 'New User'}</DialogTitle>
        </DialogHeader>

        {created ? (
          <>
            <div className="space-y-4 py-4">
              <p className="flex items-center gap-2 text-sm text-green-800">
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                {created.user.fullName} can sign in now. No email was sent, so pass these on yourself.
              </p>
              <dl className="space-y-2 rounded-md border border-gray-200 bg-white p-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-mono break-all text-right">{created.user.email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Password</dt>
                  <dd className="font-mono break-all text-right">{created.password}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Type</dt>
                  <dd>{created.user.isSeller ? 'Seller' : 'Customer'}</dd>
                </div>
              </dl>
              <p className="text-xs text-gray-500">
                The password is not shown again after you close this. They can change it with &quot;Forgot
                password&quot; on the sign-in screen.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={onClose} className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]">
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>
              )}

              <div>
                <label htmlFor="new-user-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <Input
                  id="new-user-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={40}
                  required
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="new-user-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input
                  id="new-user-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label htmlFor="new-user-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="flex gap-2">
                  <Input
                    id="new-user-password"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    autoComplete="off"
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
                    Generate
                  </Button>
                </div>
                <p className="mt-1 text-xs text-gray-500">At least 8 characters. You will need to pass it on to them.</p>
              </div>

              <div>
                <label htmlFor="new-user-type" className="block text-sm font-medium text-gray-700 mb-1">
                  Account type
                </label>
                <select
                  id="new-user-type"
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as NewUserAccountType)}
                  className="h-12 w-full border border-gray-300 bg-transparent px-3 text-base outline-none focus:ring-2 focus:ring-[#6E0114] md:h-9 md:text-sm"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">{selectedType.hint}</p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create User
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
