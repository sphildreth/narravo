"use client";
// SPDX-License-Identifier: Apache-2.0

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  anonymizeUser, 
  exportUserData, 
  deleteUser,
  getUserDetails,
  type UsersFilter, 
  type UsersSortOptions,
  type UserWithStats 
} from "@/app/(admin)/admin/users/actions";

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  totalPages: number;
}

interface UsersData {
  items: UserWithStats[];
  pagination: PaginationInfo;
}

interface UsersManagerProps {
  initialData: UsersData;
  filter: UsersFilter;
  sort: UsersSortOptions;
  page: number;
}

export default function UsersManager({ initialData, filter, sort, page }: UsersManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { items, pagination } = initialData;

  // Update URL with new search parameters
  const updateUrl = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    // Reset to page 1 when filters change
    if (updates.search !== undefined || updates.isAdmin !== undefined) {
      params.set("page", "1");
    }

    const newUrl = `/admin/users?${params.toString()}`;
    router.push(newUrl);
  };

  // Handle user anonymization
  const handleAnonymizeUser = async (user: UserWithStats) => {
    const confirmText = `ANONYMIZE`;
    const userInput = prompt(
      `Are you sure you want to anonymize user "${user.name || user.email}"?\n\n` +
      `This will:\n` +
      `• Delete the user account\n` +
      `• Make their ${user.commentsCount} comments anonymous\n` +
      `• Remove their ${user.reactionsCount} reactions\n` +
      `• This action CANNOT be undone\n\n` +
      `Type "${confirmText}" to confirm:`
    );

    if (userInput !== confirmText) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("userId", user.id);
      formData.append("confirmation", confirmText);
      
      const result = await anonymizeUser(formData);
      
      if (result.success) {
        alert(result.message);
        router.refresh();
      } else {
        alert(result.error || "Failed to anonymize user");
      }
    } catch (error) {
      console.error("Anonymization error:", error);
      alert("An error occurred while anonymizing the user");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle hard delete user
  const handleDeleteUser = async (user: UserWithStats) => {
    const confirmText = `DELETE`;
    const userInput = prompt(
      `Are you sure you want to DELETE user "${user.name || user.email}"?\n\n` +
      `This will:\n` +
      `• Permanently delete the user account\n` +
      `• Permanently delete their ${user.commentsCount} comment(s)\n` +
      `• Remove their ${user.reactionsCount} reactions\n` +
      `• This action CANNOT be undone\n\n` +
      `Type "${confirmText}" to confirm:`
    );

    if (userInput !== confirmText) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("userId", user.id);
      formData.append("confirmation", confirmText);

      const result = await deleteUser(formData);

      if (result.success) {
        alert(result.message);
        router.refresh();
      } else {
        alert(result.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Delete user error:", error);
      alert("An error occurred while deleting the user");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle user data export
  const handleExportUserData = async (user: UserWithStats) => {
    setIsProcessing(true);
    try {
      const result = await exportUserData(user.id);
      
      if (result.success && result.data) {
        // Create and download JSON file
        const dataStr = JSON.stringify(result.data, null, 2);
        const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `user-data-${user.email || user.id}-${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement("a");
        linkElement.setAttribute("href", dataUri);
        linkElement.setAttribute("download", exportFileDefaultName);
        linkElement.click();
      } else {
        alert(result.error || "Failed to export user data");
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("An error occurred while exporting user data");
    } finally {
      setIsProcessing(false);
    }
  };

  // Load user details for modal
  const handleViewUserDetails = async (user: UserWithStats) => {
    setIsProcessing(true);
    try {
      const details = await getUserDetails(user.id);
      if (details) {
        setSelectedUser(details);
      } else {
        alert("User not found");
      }
    } catch (error) {
      console.error("Error loading user details:", error);
      alert("Failed to load user details");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium mb-1">
              Search
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search name or email..."
              defaultValue={filter.search || ""}
              onChange={(e) => updateUrl({ search: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
            />
          </div>

          {/* Admin Filter */}
          <div>
            <label htmlFor="isAdmin" className="block text-sm font-medium mb-1">
              User Type
            </label>
            <select
              id="isAdmin"
              defaultValue={filter.isAdmin !== undefined ? filter.isAdmin.toString() : ""}
              onChange={(e) => updateUrl({ isAdmin: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
            >
              <option value="">All Users</option>
              <option value="true">Admins Only</option>
              <option value="false">Regular Users</option>
            </select>
          </div>

          {/* Sort Field */}
          <div>
            <label htmlFor="sortField" className="block text-sm font-medium mb-1">
              Sort By
            </label>
            <select
              id="sortField"
              defaultValue={sort.field}
              onChange={(e) => updateUrl({ sortField: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
            >
              <option value="email">Email</option>
              <option value="name">Name</option>
              <option value="commentsCount">Comments</option>
              <option value="reactionsCount">Reactions</option>
            </select>
          </div>
          
          {/* Sort Direction */}
          <div>
            <label htmlFor="sortDirection" className="block text-sm font-medium mb-1">
              Order
            </label>
            <select
              id="sortDirection"
              defaultValue={sort.direction}
              onChange={(e) => updateUrl({ sortDirection: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md text-sm"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-3 py-3 text-left font-medium">User</th>
                <th className="px-3 py-3 text-left font-medium">Email</th>
                <th className="px-3 py-3 text-left font-medium">Role</th>
                <th className="px-3 py-3 text-left font-medium">Comments</th>
                <th className="px-3 py-3 text-left font-medium">Reactions</th>
                <th className="px-3 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <tr key={user.id} className="border-b border-border hover:bg-muted/20">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      {user.image && (
                        <img 
                          src={user.image} 
                          alt={user.name || "User avatar"}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div>
                        <div className="font-medium">
                          {user.name || "Anonymous"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ID: {user.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <code className="text-xs">{user.email || "—"}</code>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.isAdmin
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {user.isAdmin ? "Admin" : "User"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm font-medium">{user.commentsCount}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm font-medium">{user.reactionsCount}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewUserDetails(user)}
                        disabled={isProcessing}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleExportUserData(user)}
                        disabled={isProcessing}
                        className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 disabled:opacity-50"
                      >
                        Export
                      </button>
                      {!user.isAdmin && (
                        <>
                          <button
                            onClick={() => handleAnonymizeUser(user)}
                            disabled={isProcessing}
                            className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50"
                          >
                            Anonymize
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={isProcessing}
                            className="text-xs px-2 py-1 bg-red-200 text-red-900 rounded hover:bg-red-300 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No users found matching your criteria.
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
            {pagination.total} users
          </div>
          
          <div className="flex items-center gap-2">
            {pagination.page > 1 && (
              <button
                onClick={() => updateUrl({ page: (pagination.page - 1).toString() })}
                className="px-3 py-1 text-sm border border-border rounded hover:bg-muted/20"
              >
                Previous
              </button>
            )}
            
            <span className="px-3 py-1 text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            
            {pagination.page < pagination.totalPages && (
              <button
                onClick={() => updateUrl({ page: (pagination.page + 1).toString() })}
                className="px-3 py-1 text-sm border border-border rounded hover:bg-muted/20"
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">User Details</h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <p className="text-sm">{selectedUser.name || "—"}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <p className="text-sm font-mono">{selectedUser.email || "—"}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <p className="text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      selectedUser.isAdmin ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {selectedUser.isAdmin ? "Admin" : "User"}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">User ID</label>
                  <p className="text-xs font-mono">{selectedUser.id}</p>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Comments</label>
                  <p className="text-lg font-semibold">{selectedUser.commentsCount}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Reactions</label>
                  <p className="text-lg font-semibold">{selectedUser.reactionsCount}</p>
                </div>
              </div>

              {/* Recent Comments */}
              {selectedUser.recentComments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Recent Comments</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedUser.recentComments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/${comment.postSlug}`}
                              target="_blank"
                              className="text-sm font-medium text-blue-600 hover:underline"
                            >
                              {comment.postTitle}
                            </Link>
                            {comment.postSlug && (
                              <Link
                                href={`/${comment.postSlug}#comment-${comment.id}`}
                                target="_blank"
                                className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                              >
                                View Post
                              </Link>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            comment.status === "approved" ? "bg-green-100 text-green-800" :
                            comment.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                            comment.status === "spam" ? "bg-red-100 text-red-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {comment.status}
                          </span>
                        </div>
                        <div 
                          className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => handleExportUserData(selectedUser)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Export Data
                </button>
                {!selectedUser.isAdmin && (
                  <>
                    <button
                      onClick={() => handleAnonymizeUser(selectedUser)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Anonymize User
                    </button>
                    <button
                      onClick={() => handleDeleteUser(selectedUser)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-50"
                    >
                      Delete User
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedUser(null)}
                  className="ml-auto px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}