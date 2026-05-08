import { Link, useLocation } from "wouter";
import { Store, Menu, LayoutDashboard, LogIn, LogOut, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

export function Navbar() {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container max-w-5xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 group" data-testid="link-home">
          <div className="bg-primary/10 p-2 rounded-xl group-hover:bg-primary/20 transition-colors">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">Advize Store</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                data-testid="link-nav-dashboard"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Button
                variant="outline"
                className="rounded-full px-5"
                onClick={handleSignOut}
                data-testid="btn-nav-signout"
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="rounded-full px-5" data-testid="btn-nav-signin">
                <Link href="/login">
                  <LogIn className="h-4 w-4 mr-1.5" />
                  Sign In
                </Link>
              </Button>
              <Button asChild className="rounded-full px-6 shadow-sm" data-testid="btn-nav-signup">
                <Link href="/signup">
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Sign Up
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="btn-mobile-menu">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl p-2">
              {user ? (
                <>
                  <DropdownMenuItem asChild className="rounded-lg mb-1 cursor-pointer">
                    <Link href="/dashboard" className="flex items-center w-full">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="rounded-lg cursor-pointer text-destructive focus:text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild className="rounded-lg mb-1 cursor-pointer">
                    <Link href="/login" className="flex items-center w-full">
                      <LogIn className="mr-2 h-4 w-4" />
                      <span>Sign In</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-lg cursor-pointer bg-primary/10 text-primary focus:bg-primary/20 focus:text-primary">
                    <Link href="/signup" className="flex items-center w-full font-medium">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Sign Up
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
