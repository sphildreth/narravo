// SPDX-License-Identifier: Apache-2.0
import { getUserDetails, getAdminVisibility } from "@/app/(admin)/admin/users/actions";
import { notFound } from "next/navigation";
import Link from "next/link";

interface UserDetailPageProps {
  params: {
    id: string;
  };
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const [user, adminInfo] = await Promise.all([
    getUserDetails(params.id),
    getAdminVisibility(),
  ]);
  
  if (!user) {
    notFound();
  }

  const adminEmailMatch = adminInfo.adminEmails.find(email => 
    email.toLowerCase() === user.email?.toLowerCase()
  );

  return (
    <main className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link 
            href="/admin/users"
            className="text-blue-600 hover:underline"
          >
            ← Back to Users
          </Link>
        </div>
        <h1 className="text-2xl font-bold">User Details</h1>
        <p className="text-muted-foreground">
          {user.name || user.email || "Anonymous User"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <p className="text-sm">{user.name || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <p className="text-sm font-mono">{user.email || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">User ID</label>
                <p className="text-xs font-mono">{user.id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  user.isAdmin ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                }`}>
                  {user.isAdmin ? "Admin" : "User"}
                </span>
              </div>
            </div>

            {/* Admin Details */}
            {user.isAdmin && adminEmailMatch && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Admin Access Details
                </h3>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Admin access granted via ADMIN_EMAILS environment variable
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Matching email: {adminEmailMatch}
                </p>
              </div>
            )}
          </div>

          {/* Recent Comments */}
          {user.recentComments.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">
                Recent Comments ({user.recentComments.length} of {user.commentsCount})
              </h2>
              <div className="space-y-4">
                {user.recentComments.map((comment) => (
                  <div key={comment.id} className="border border-border rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        href={`/${comment.postSlug}`}
                        target="_blank"
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {comment.postTitle}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          comment.status === "approved" ? "bg-green-100 text-green-800" :
                          comment.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                          comment.status === "spam" ? "bg-red-100 text-red-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {comment.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div 
                      className="text-sm prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
                    />
                  </div>
                ))}
              </div>
              
              {user.commentsCount > user.recentComments.length && (
                <div className="mt-4 text-center">
                  <Link
                    href={`/admin/moderation?search=${encodeURIComponent(user.email || '')}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View all {user.commentsCount} comments in moderation →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Statistics */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Statistics</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Comments</span>
                <span className="text-sm font-semibold">{user.commentsCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Reactions</span>
                <span className="text-sm font-semibold">{user.reactionsCount}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => {
                  // This would need to be moved to a client component for functionality
                  alert("Export functionality requires client-side implementation");
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Export User Data
              </button>
              
              {!user.isAdmin && (
                <button
                  onClick={() => {
                    // This would need to be moved to a client component for functionality
                    alert("Anonymization functionality requires client-side implementation");
                  }}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Anonymize User
                </button>
              )}
              
              <Link
                href={`/admin/moderation?search=${encodeURIComponent(user.email || '')}`}
                className="block w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center"
              >
                View Comments
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}