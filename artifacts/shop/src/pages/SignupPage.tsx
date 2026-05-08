import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { sendOtp, verifyOtp } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ShieldCheck, CheckCircle2, Store, MessageCircle, Share2 } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type Stage = "form" | "otp";

export function SignupPage() {
  const [, setLocation] = useLocation();
  const { signUp } = useAuth();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ variant: "destructive", title: "Please enter your name." }); return; }
    if (!email.trim()) { toast({ variant: "destructive", title: "Please enter your email." }); return; }
    if (password.length < 6) { toast({ variant: "destructive", title: "Password must be at least 6 characters." }); return; }
    if (!termsAccepted) { toast({ variant: "destructive", title: "Please accept the Terms and Conditions." }); return; }

    setLoading(true);
    try {
      await sendOtp(email.trim());
      setStage("otp");
      toast({ title: "Code sent!", description: `Check your inbox at ${email}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not send code", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndCreate = async () => {
    if (otp.length !== 6) { toast({ variant: "destructive", title: "Please enter the 6-digit code." }); return; }

    setLoading(true);
    try {
      await verifyOtp(email.trim(), otp);
      await signUp(email.trim(), password, name.trim());
      toast({ title: "Account created!", description: "Welcome to Advize Store." });
      setLocation("/onboarding");
    } catch (e: any) {
      if (e?.code === "auth/email-already-in-use") {
        setAlreadyRegistered(true);
      } else {
        toast({ variant: "destructive", title: "Verification failed", description: e.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      await sendOtp(email.trim());
      setOtp("");
      toast({ title: "New code sent!", description: "Check your inbox." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not resend", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const FEATURES = [
    { icon: Store,         text: "Your own branded storefront link" },
    { icon: MessageCircle, text: "WhatsApp-powered customer orders" },
    { icon: Share2,        text: "Share anywhere — no app needed" },
  ];

  return (
    <div className="min-h-[100dvh] flex bg-background">

      {/* ── Left brand panel (desktop only) ─────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 bg-primary/5 border-r flex-col items-center justify-center p-12">
        <div className="max-w-sm w-full">
          <a href="/" className="flex items-center gap-3 mb-10">
            <div className="bg-primary/10 p-2.5 rounded-2xl">
              <Store className="w-7 h-7 text-primary" />
            </div>
            <span className="text-xl font-bold">Advize Store</span>
          </a>
          <h2 className="text-3xl font-bold mb-3 leading-tight">Sell online in 5 minutes</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            No website, no coding, no complexity. Create your store and start getting orders today.
          </p>
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-muted/10 lg:bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4 lg:hidden">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
          <p className="text-muted-foreground mt-1 text-sm">Start selling in minutes</p>
        </div>

        <div className="bg-card p-6 rounded-3xl border shadow-sm space-y-5">
          {alreadyRegistered ? (
            <div className="text-center space-y-4 py-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-1">
                <ShieldCheck className="w-7 h-7 text-yellow-600 dark:text-yellow-400" />
              </div>
              <p className="font-semibold text-foreground text-base">This email is already registered</p>
              <p className="text-sm text-muted-foreground">
                Looks like <span className="font-medium text-foreground">{email}</span> already has an Advize Store account.
              </p>
              <Button asChild className="w-full h-11 rounded-xl">
                <Link href="/login">Sign in instead</Link>
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground w-full"
                onClick={() => { setAlreadyRegistered(false); setStage("form"); setOtp(""); }}
              >
                Use a different email
              </button>
            </div>
          ) : stage === "form" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  placeholder="Priya Sharma"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-11 rounded-xl"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-11 rounded-xl"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="h-11 rounded-xl pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(v => !v)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={e => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary cursor-pointer"
                />
                <span className="text-sm text-muted-foreground leading-snug">
                  I have read and agree to the{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-primary font-medium underline underline-offset-2 hover:opacity-80"
                    onClick={e => e.stopPropagation()}
                  >
                    Terms and Conditions
                  </Link>
                </span>
              </label>

              <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading || !termsAccepted}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send verification code
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <p className="font-semibold text-foreground">Enter the 6-digit code</p>
                <p className="text-sm text-muted-foreground">Sent to <span className="font-medium">{email}</span></p>
              </div>

              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                className="w-full h-11 rounded-xl"
                onClick={handleVerifyAndCreate}
                disabled={loading || otp.length !== 6}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verify & Create Account
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => { setStage("form"); setOtp(""); }}
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={handleResend}
                  disabled={loading}
                >
                  Resend code
                </button>
              </div>
            </div>
          )}

          {!alreadyRegistered && (
            <div className="text-center text-sm text-muted-foreground pt-2">
              Already have an account?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
