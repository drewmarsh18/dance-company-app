"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock } from "lucide-react"

export function ParentSignUpForm({ email }: { email: string }) {
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name: name.trim() || email.split("@")[0],
      })
      if (error) throw new Error(error.message ?? "Could not create account")
      window.location.href = "/"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Input
            id="email"
            type="email"
            value={email}
            readOnly
            className="pr-9 bg-muted cursor-not-allowed text-muted-foreground"
          />
          <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">
          This is the email linked to your child&apos;s account — it cannot be changed here.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="e.g. Sarah Johnson"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Create a password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={loading} className="mt-1">
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Create account &amp; view my child&apos;s profile
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <a href="/" className="text-primary underline-offset-4 hover:underline">
          Sign in instead
        </a>
      </p>
    </form>
  )
}
