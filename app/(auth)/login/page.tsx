"use client";
import { signIn } from "next-auth/react";
export default function Login() {
  return (
    <main className="max-w-md mx-auto p-6 space-y-2">
      <h1 className="text-xl font-bold mb-2">Sign in</h1>
      <button className="border rounded px-3 py-2 w-full" onClick={() => signIn("github")}>Sign in with GitHub</button>
      <button className="border rounded px-3 py-2 w-full" onClick={() => signIn("google")}>Sign in with Google</button>
    </main>
  );
}
