"use client";

import { FormEvent, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Languages,
  Leaf,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, getApiErrorMessage } from "@/lib/api";

type AuthMode = "login" | "register";

const initialRegistration = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  password: "",
  password_confirm: "",
};

export function LoginExperience() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registration, setRegistration] = useState(initialRegistration);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await apiRequest(
        "/auth/login/",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
        false,
      );
      window.location.assign("/dashboard");
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (registration.password !== registration.password_confirm) {
      setError("The password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(
        "/auth/register/",
        {
          method: "POST",
          body: JSON.stringify(registration),
        },
        false,
      );
      window.location.assign("/dashboard");
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-svh bg-background text-foreground lg:grid lg:grid-cols-[minmax(22rem,0.92fr)_1.08fr]">
      <section className="relative hidden min-h-svh overflow-hidden bg-[#062e2a] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="dapp-grid absolute inset-0 opacity-35" aria-hidden="true" />
        <div className="absolute -right-32 top-16 size-96 rounded-full bg-emerald-400/15 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-[#e7b340] text-[#062e2a] shadow-lg shadow-black/20">
            <Leaf className="size-6" strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">DAPP</p>
            <p className="text-sm text-emerald-100/70">Digital Agricultural Procurement Platform</p>
          </div>
        </div>

        <div className="relative max-w-xl space-y-8">
          <p className="w-fit rounded-full border border-emerald-100/20 bg-white/10 px-4 py-2 text-sm font-medium text-emerald-50 backdrop-blur">
            Trusted records from request to settlement
          </p>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.04em] xl:text-6xl">
            Your crop journey,
            <span className="block text-[#f2c45c]">clearly tracked.</span>
          </h1>
          <p className="max-w-lg text-lg leading-8 text-emerald-50/75">
            Register crop availability, receive an approved arrival token, and track
            physical procurement, payment settlement, notifications, and grievance resolution.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["01", "Arrival token"],
              ["02", "Verified procurement"],
              ["03", "Settlement proof"],
            ].map(([number, label]) => (
              <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold tracking-[0.18em] text-[#f2c45c]">{number}</p>
                <p className="mt-2 text-sm font-medium text-white">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-5 text-sm text-emerald-50/65">
          <span className="flex items-center gap-2"><ShieldCheck className="size-4" /> Secure access</span>
          <span className="flex items-center gap-2"><Languages className="size-4" /> Multilingual-ready</span>
        </div>
      </section>

      <section className="flex min-h-svh items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-lg">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Leaf className="size-5" />
            </div>
            <div>
              <p className="font-bold">DAPP</p>
              <p className="text-xs text-muted-foreground">Digital Agricultural Procurement Platform</p>
            </div>
          </div>

          <div className="mb-8">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Secure portal access</p>
            <h2 className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">Welcome to DAPP</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Farmers can create an account. Procurement officers and administrators use accounts issued by an administrator.
            </p>
          </div>

          <Tabs value={mode} onValueChange={(value) => { setMode(value as AuthMode); setError(null); }}>
            <TabsList className="mb-6 grid h-11 w-full grid-cols-2 bg-muted/80">
              <TabsTrigger value="login" className="text-sm">Sign in</TabsTrigger>
              <TabsTrigger value="register" className="text-sm">Farmer registration</TabsTrigger>
            </TabsList>

            {error ? (
              <Alert variant="destructive" className="mb-5">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <TabsContent value="login">
              <form className="space-y-5" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email address</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="login-password">Password</Label>
                    <span className="text-xs text-muted-foreground">Minimum 8 characters</span>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12"
                    required
                  />
                </div>
                <Button className="h-12 w-full text-base" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in…" : "Sign in securely"}
                  {!isSubmitting ? <ArrowRight className="size-4" /> : null}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form className="space-y-5" onSubmit={handleRegister}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input
                      id="first-name"
                      autoComplete="given-name"
                      value={registration.first_name}
                      onChange={(event) => setRegistration({ ...registration, first_name: event.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input
                      id="last-name"
                      autoComplete="family-name"
                      value={registration.last_name}
                      onChange={(event) => setRegistration({ ...registration, last_name: event.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email address</Label>
                  <Input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    value={registration.email}
                    onChange={(event) => setRegistration({ ...registration, email: event.target.value })}
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone-number">Mobile number</Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                    value={registration.phone_number}
                    onChange={(event) => setRegistration({ ...registration, phone_number: event.target.value })}
                    className="h-11"
                    pattern="[6-9][0-9]{9}"
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={registration.password}
                      onChange={(event) => setRegistration({ ...registration, password: event.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={registration.password_confirm}
                      onChange={(event) => setRegistration({ ...registration, password_confirm: event.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                </div>
                <Button className="h-12 w-full text-base" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account…" : "Create farmer account"}
                  {!isSubmitting ? <ArrowRight className="size-4" /> : null}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-7 grid gap-3 border-t pt-6 text-sm text-muted-foreground sm:grid-cols-2">
            <p className="flex items-center gap-2"><LockKeyhole className="size-4 text-primary" /> HTTP-only session cookies</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" /> Role-based access control</p>
          </div>
        </div>
      </section>
    </main>
  );
}
