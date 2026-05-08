import { Link } from "wouter";
import { ArrowRight, Store, Share2, MessageCircle, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="px-4 py-20 sm:px-6 lg:py-32 flex flex-col items-center text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium bg-muted/50 text-muted-foreground mb-8">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
            Built for first-time sellers
          </div>
          
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6">
            Start Selling in <span className="text-primary relative whitespace-nowrap">
              <span className="relative z-10">5 Minutes</span>
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-secondary" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="transparent" strokeLinecap="round"/>
              </svg>
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
            No website, no coding, no complexity. Just a beautiful storefront that connects directly to your WhatsApp.
          </p>
          
          {user ? (
            <Button asChild size="lg" className="h-14 px-8 text-lg rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-1" data-testid="btn-hero-dashboard">
              <Link href="/dashboard">
                Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button asChild size="lg" className="h-14 px-8 text-lg rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 w-full sm:w-auto" data-testid="btn-hero-signup">
                <Link href="/signup">
                  <UserPlus className="mr-2 h-5 w-5" />
                  Get Started Free
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full w-full sm:w-auto" data-testid="btn-hero-signin">
                <Link href="/login">
                  <LogIn className="mr-2 h-5 w-5" />
                  Sign In
                </Link>
              </Button>
            </div>
          )}
          <p className="mt-4 text-sm text-muted-foreground">100% free to set up. No credit card required.</p>
        </section>

        {/* Features Section */}
        <section className="px-4 py-16 sm:px-6 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Everything you need to succeed</h2>
            
            <div className="grid sm:grid-cols-3 gap-8">
              <div className="bg-card p-8 rounded-3xl border shadow-sm flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary">
                  <Store className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold mb-3">Easy Setup</h3>
                <p className="text-muted-foreground">Add your business name, upload products, and you're ready to go. It's that simple.</p>
              </div>
              
              <div className="bg-card p-8 rounded-3xl border shadow-sm flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-secondary/30 rounded-2xl flex items-center justify-center mb-6 text-secondary-foreground">
                  <Share2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold mb-3">Share Your Link</h3>
                <p className="text-muted-foreground">Get a beautiful, mobile-friendly link to share on Instagram, Facebook, or anywhere else.</p>
              </div>
              
              <div className="bg-card p-8 rounded-3xl border shadow-sm flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                  <MessageCircle className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold mb-3">Orders on WhatsApp</h3>
                <p className="text-muted-foreground">Customers browse your store and send orders directly to your WhatsApp. No missed messages.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="bg-background py-8 border-t text-center text-muted-foreground">
        <p>© {new Date().getFullYear()} Advize Technology Private Limited. All rights reserved.</p>
        <p className="mt-2 text-xs">
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Terms and Conditions
          </Link>
        </p>
      </footer>
    </div>
  );
}
