'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Users,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Mail,
  UserX,
} from 'lucide-react';
import { getAdminUsers, deleteAdminUser } from '@/lib/api';
import type { AdminUser } from '@/lib/types/admin-user';
import { UserEditModal } from './UserEditModal';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [adminFilter, setAdminFilter] = useState<string>('all');
  const [guestFilter, setGuestFilter] = useState<string>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const perPage = 20;

  // Modal state
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (page = currentPage) => {
    setLoading(true);
    setFetchError(null);
    try {
      const isAdminValue =
        adminFilter === 'admins'
          ? true
          : adminFilter === 'non-admins'
          ? false
          : undefined;
      const isGuestValue =
        guestFilter === 'guests'
          ? true
          : guestFilter === 'registered'
          ? false
          : undefined;
      const emailVerifiedValue =
        verifiedFilter === 'verified'
          ? true
          : verifiedFilter === 'unverified'
          ? false
          : undefined;

      const data = await getAdminUsers(
        searchQuery || undefined,
        isAdminValue,
        isGuestValue,
        emailVerifiedValue,
        page,
        perPage
      );
      setUsers(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.total);
      setCurrentPage(data.page);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || 'Failed to load users';
      console.error('Failed to fetch users:', errorMessage);
      setFetchError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, adminFilter, guestFilter, verifiedFilter, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    fetchUsers(1);
  }, [searchQuery, adminFilter, guestFilter, verifiedFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
  };

  const handleUserUpdated = (updatedUser: AdminUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    setActionLoading(deletingUser.id);
    try {
      await deleteAdminUser(deletingUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      setTotalItems((prev) => prev - 1);
      setDeletingUser(null);
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert(
        err instanceof Error ? err.message : 'Failed to delete user'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Manage all users in the system
          </p>
        </div>
        <Button
          onClick={() => fetchUsers()}
          disabled={loading}
          variant="outline"
          className="text-sm"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Fetch Error Message */}
      {fetchError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
          <strong>Error loading users:</strong> {fetchError}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-gray-100">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-10 w-64"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Admin:</label>
            <select
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-[#df5e15] focus:border-transparent outline-none"
            >
              <option value="all">All</option>
              <option value="admins">Admins Only</option>
              <option value="non-admins">Non-Admins</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Type:</label>
            <select
              value={guestFilter}
              onChange={(e) => setGuestFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-[#df5e15] focus:border-transparent outline-none"
            >
              <option value="all">All</option>
              <option value="registered">Registered</option>
              <option value="guests">Guests</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Verified:</label>
            <select
              value={verifiedFilter}
              onChange={(e) => setVerifiedFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-[#df5e15] focus:border-transparent outline-none"
            >
              <option value="all">All</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4">
        <span className="text-sm text-gray-500">
          Showing {users?.length ?? 0} of {totalItems} users (Page {currentPage}{' '}
          of {totalPages})
        </span>
      </div>

      {/* Users List */}
      {loading && users.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-8">
          <Users className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No users found</p>
          <p className="text-gray-400 text-sm">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <>
          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    User
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Created
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    {/* User Info */}
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.fullName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {user.email || (
                            <span className="italic">
                              Guest ({user.guestSessionId?.slice(0, 8)}...)
                            </span>
                          )}
                        </p>
                      </div>
                    </td>

                    {/* Status Badges */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {user.isAdmin && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                            <ShieldCheck className="h-3 w-3" />
                            Admin
                          </span>
                        )}
                        {user.isGuest && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                            <UserX className="h-3 w-3" />
                            Guest
                          </span>
                        )}
                        {!user.isGuest && user.emailVerified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <Mail className="h-3 w-3" />
                            Verified
                          </span>
                        )}
                        {!user.isGuest && !user.emailVerified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                            <Mail className="h-3 w-3" />
                            Unverified
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8"
                          onClick={() => handleEditUser(user)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeletingUser(user)}
                          disabled={actionLoading === user.id}
                        >
                          {actionLoading === user.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchUsers(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? 'default' : 'outline'}
                      size="sm"
                      className={`w-9 ${
                        pageNum === currentPage
                          ? 'bg-[#df5e15] hover:bg-[#c54d0d]'
                          : ''
                      }`}
                      onClick={() => fetchUsers(pageNum)}
                      disabled={loading}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchUsers(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      <UserEditModal
        isOpen={editingUser !== null}
        onClose={() => setEditingUser(null)}
        user={editingUser}
        onSave={handleUserUpdated}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={deletingUser !== null}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDeleteUser}
        loading={actionLoading === deletingUser?.id}
        userName={deletingUser?.fullName || ''}
        userEmail={deletingUser?.email || null}
      />
    </div>
  );
}
