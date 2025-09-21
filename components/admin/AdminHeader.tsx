// SPDX-License-Identifier: Apache-2.0
import Link from "next/link";

export default function AdminHeader() {
  return (
    <div className="flex items-center justify-end space-x-4">
      <Link
        href="/admin/posts/new"
        className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
      >
        New Post
      </Link>
      <Link
        href="/admin/moderation?status=pending"
        className="px-3 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
      >
        Review Pending
      </Link>
    </div>
  );
}
