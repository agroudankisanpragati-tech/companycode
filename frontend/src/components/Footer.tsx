import Link from 'next/link';
import Image from 'next/image';
import { FaFacebook, FaYoutube, FaInstagram, FaPhone, FaEnvelope } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const sections = [
    {
      title: 'Popular',
      links: [
        // { label: 'Crop Advisory', href: '/crop-advisory' },
        // { label: 'Weather Forecast', href: '/weather' },
        // { label: 'Market Prices', href: '/mandi-prices' },
        // { label: 'Disease Detection', href: '/disease-detection' },
        // { label: 'Farmer Dashboard', href: '/dashboard/farmer' },
        // { label: 'Contact Us', href: '/contact' },
      ]
    },
    {
      title: 'Company',
      links: [
        // { label: 'About', href: '/about' },
        { label: 'Careers', href: '/careers' },
        { label: 'Gallery', href: '/gallery' },
        { label: 'Blog', href: '/blog' },
        { label: 'Schemes', href: '/schemes' },
        { label: 'Shops', href: '/shops' },
      ]
    },
  ];

  return (
    <footer className="border-t border-emerald-100 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_32%),linear-gradient(180deg,_#ffffff_0%,_#f0fdf4_100%)] text-slate-800">
      <div className="section-container py-10 sm:py-12 lg:py-14">
        <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.15fr_1fr_0.95fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Agroudan Kisan Pragati Logo"
                width={48}
                height={48}
                className="rounded-2xl bg-white p-1 shadow-sm ring-1 ring-emerald-100"
              />
              <div>
                <h3 className="text-lg font-bold text-emerald-900">Agroudan Kisan Pragati</h3>
                <p className="text-sm text-slate-600">Simple tools for farmers and shops.</p>
              </div>
            </div>

            <p className="max-w-md text-sm leading-6 text-slate-600">
              Crop advice, weather, mandi prices, schemes, and marketplace support.
            </p>

            <div className="flex flex-wrap gap-3 text-sm text-slate-700">
              <a href="tel:+916378095181" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-50">
                <FaPhone size={13} className="text-emerald-600" />
                +91 6378095181
              </a>
              <a href="mailto:agroudankisanpragati@gmail.com" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-50">
                <FaEnvelope size={13} className="text-emerald-600" />
                Email Us
              </a>
            </div>

            <div className="flex gap-3">
              {[
                { icon: FaFacebook, href: 'https://www.facebook.com/profile.php?id=61589122658245', label: 'Facebook' },
                { icon: FaXTwitter, href: 'https://x.com/agroudankisan', label: 'X' },
                { icon: FaInstagram, href: 'https://www.instagram.com/agroudankisanpragati/', label: 'Instagram' },
                { icon: FaYoutube, href: 'https://www.youtube.com/@AGROUDANKISANPRAGATI', label: 'YouTube' },
              ].map((social) => {
                const Icon = social.icon;
                return (
                  <Link
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="grid h-10 w-10 place-items-center rounded-full border border-emerald-200 bg-white text-emerald-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-600 hover:text-white"
                  >
                    <Icon size={16} />
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Quick Links</h4>
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              {sections.flatMap((section) => section.links).map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <span>{link.label}</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">About</h4>
            <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="space-y-2 text-sm text-slate-700">
                <p><span className="font-semibold text-emerald-700">Location:</span> Jaipur, Rajasthan</p>
                <p><span className="font-semibold text-emerald-700">Focus:</span> Farmers, shops, weather, schemes</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-emerald-100 pt-4 text-center text-xs text-slate-500 md:flex-row md:items-center md:justify-between md:text-left">
          <p>© {currentYear} Agroudan Kisan Pragati LLP.</p>
          <div className="flex flex-wrap justify-center gap-4 md:justify-end">
            <Link href="#" className="transition-colors hover:text-emerald-700">Privacy</Link>
            <Link href="#" className="transition-colors hover:text-emerald-700">Terms</Link>
            <Link href="#" className="transition-colors hover:text-emerald-700">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
