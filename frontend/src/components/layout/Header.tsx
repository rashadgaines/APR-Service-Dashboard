'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Bell, AlertTriangle, Info, AlertCircle, Menu, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { AlertsResponse } from '@/types';

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/markets', label: 'Markets' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/reimbursements', label: 'Reimbursements' },
];

export function Header() {
  const pathname = usePathname();
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const data = await apiClient.getAlerts<AlertsResponse>();
        setAlerts(data);
      } catch {
        // Silently handle fetch errors - alerts will show as empty
      }
    };

    fetchAlerts();
    // Refresh alerts every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const criticalCount = alerts?.breakdown.critical || 0;
  const warningCount = alerts?.breakdown.warning || 0;
  const totalAlerts = alerts?.total || 0;

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <header className="bg-background/80 backdrop-blur-md border-b border-border/50 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-50">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center group transition-opacity hover:opacity-80">
          <Image
            src="/gondor logo.svg"
            alt="Gondor Logo"
            width={136}
            height={29}
            className="h-7 sm:h-8 w-auto"
            priority
          />
        </Link>

        <div className="flex items-center space-x-2 sm:space-x-8">
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2">
            {navLinks.map((link) => {
              const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="h-6 w-px bg-border/50 hidden md:block" />

          {/* Alerts Bell */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="relative p-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Bell className="w-5 h-5" />
              {totalAlerts > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-background">
                  {totalAlerts > 9 ? '9+' : totalAlerts}
                </span>
              )}
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-3 w-72 sm:w-80 bg-card border border-border/50 rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-border/50 bg-muted/30">
                  <h3 className="font-serif font-semibold text-card-foreground text-lg">Alerts</h3>
                  <div className="flex gap-4 mt-2">
                    <span className="flex items-center space-x-1.5 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span>{criticalCount} Critical</span>
                    </span>
                    <span className="flex items-center space-x-1.5 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                      <span>{warningCount} Warning</span>
                    </span>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {alerts?.alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="p-4 border-b border-border/50 last:border-b-0 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start space-x-3">
                        {getAlertIcon(alert.severity)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-card-foreground leading-snug">{alert.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1.5 uppercase font-medium">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {(!alerts?.alerts || alerts.alerts.length === 0) && (
                    <div className="p-8 text-center text-muted-foreground italic text-sm">
                      No active alerts
                    </div>
                  )}
                </div>

                <div className="p-4 bg-muted/30 text-center">
                  <Link
                    href="/alerts"
                    className="text-xs font-semibold text-primary hover:underline uppercase tracking-wider"
                    onClick={() => setShowDropdown(false)}
                  >
                    Manage all alerts
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden mt-3 pt-3 border-t border-border/50">
          <div className="flex flex-col space-y-1">
            {navLinks.map((link) => {
              const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {showDropdown && (
        <div
          className="fixed inset-0 z-40 bg-background/0"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </header>
  );
}
