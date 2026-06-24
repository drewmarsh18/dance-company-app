"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export function AuthForm() {
  const router = useRouter()
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-up")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSignUp = mode === "sign-up"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        })
        if (error) throw new Error(error.message ?? "Could not create account")
      } else {
        const { error } = await authClient.signIn.email({ email, password })
        if (error) throw new Error(error.message ?? "Could not sign in")
      }
      // Landing page ("/") redirects to the correct area based on role.
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Jordan Dancer"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignUp ? "new-password" : "current-password"}
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
          {loading && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          {isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-4 text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "New to College Dance Prep?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(isSignUp ? "sign-in" : "sign-up")
            setError(null)
          }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  )
}
