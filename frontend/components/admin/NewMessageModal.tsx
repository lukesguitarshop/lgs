'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Search,
  Send,
  User,
  Mail,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { api, getAdminUsers } from '@/lib/api';
import type { AdminUser } from '@/lib/types/admin-user';

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated?: () => void;
}

interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  messageText: string;
  createdAt: string;
  isRead: boolean;
  isMine: boolean;
}

export function NewMessageModal({
  isOpen,
  onClose,
  onConversationCreated,
}: NewMessageModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<'select' | 'compose'>('select');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch non-admin registered users (exclude guests and other admins)
      const data = await getAdminUsers(
        searchQuery || undefined,
        false, // isAdmin = false (non-admins only)
        false, // isGuest = false (registered users only)
        undefined, // emailVerified - any
        1,
        20
      );
      setUsers(data.items);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (isOpen && step === 'select') {
      fetchUsers();
    }
  }, [isOpen, step, fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  const handleSelectUser = (user: AdminUser) => {
    setSelectedUser(user);
    setStep('compose');
    setError(null);
  };

  const handleBack = () => {
    setStep('select');
    setMessageText('');
    setError(null);
  };

  const handleSend = async () => {
    if (!selectedUser || !messageText.trim()) return;

    setSending(true);
    setError(null);

    try {
      const response = await api.authPost<MessageResponse>('/messages', {
        recipientId: selectedUser.id,
        messageText: messageText.trim(),
      });

      // Navigate to the conversation
      router.push(`/messages/${response.conversationId}`);

      // Notify parent to refresh conversations
      onConversationCreated?.();

      // Reset and close
      handleClose();
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedUser(null);
    setMessageText('');
    setSearchInput('');
    setSearchQuery('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Select User to Message' : 'New Message'}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
            {error}
          </div>
        )}

        {step === 'select' ? (
          <div className="space-y-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by name or email..."
                  className="pl-10"
                />
              </div>
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>
            </form>

            {/* User List */}
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No users found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {user.fullName}
                        </p>
                        <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </p>
                      </div>
                      {user.isAdmin && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected User */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="h-5 w-5 text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {selectedUser?.fullName}
                </p>
                <p className="text-sm text-gray-500">{selectedUser?.email}</p>
              </div>
              <Check className="h-5 w-5 text-green-600" />
            </div>

            {/* Message Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                onClick={handleSend}
                disabled={!messageText.trim() || sending}
                className="bg-[#df5e15] hover:bg-[#c54d0a] text-white"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
