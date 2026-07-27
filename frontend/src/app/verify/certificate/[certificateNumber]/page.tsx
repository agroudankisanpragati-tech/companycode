'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const ASSET_BASE = API.replace(/\/api$/, '');

type CertData = {
  _id: string;
  internId: string;
  certificateNumber: string;
  name: string;
  collegeName: string;
  internshipDomain: string;
  internshipType: 'Paid' | 'Unpaid';
  duration: string;
  startDate: string;
  endDate: string;
  certificateDescription: string;
  verificationUrl: string;
  qrCodeUrl: string;
  pdfUrl: string;
  createdAt: string;
};

export default function VerifyCertificatePage() {
  const params = useParams();
  const certNumber = params?.certificateNumber as string;

  const [cert, setCert]     = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!certNumber) return;
    fetch(`${API}/career/verify/${certNumber}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) setCert(data.data);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [certNumber]);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-400/20 border-t-green-400" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-white mb-2">Certificate Not Found</h1>
        <p className="text-slate-400 text-sm max-w-sm">
          The certificate number <span className="font-mono text-red-400">{certNumber}</span> does not exist or has been revoked.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-green-500/15 border border-green-500/30 px-4 py-2 text-green-400 text-sm font-semibold mb-4">
            <span className="text-lg">✅</span> Certificate Verified
          </div>
          <h1 className="text-2xl font-bold text-white">AgroUdan Kisan Pragati LLP</h1>
          <p className="text-slate-400 text-sm mt-1">Empowering Farmers, Empowering India</p>
        </div>

        {/* Certificate Card */}
        <div className="rounded-3xl border border-green-500/20 bg-slate-900/80 backdrop-blur overflow-hidden shadow-2xl shadow-green-900/10">
          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-green-500 via-emerald-400 to-green-600" />

          <div className="p-6 md:p-8 space-y-6">
            {/* Cert title */}
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">Internship Certificate</p>
              <h2 className="text-3xl font-bold text-white">{cert!.name}</h2>
              <p className="text-slate-400 text-sm mt-1">{cert!.collegeName}</p>
            </div>

            {/* Description */}
            <p className="text-slate-300 text-sm leading-relaxed text-center border-t border-b border-white/5 py-4">
              {cert!.certificateDescription}
            </p>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4">
              <Detail label="Internship Domain"  value={cert!.internshipDomain} />
              <Detail label="Duration"           value={cert!.duration} />
              <Detail label="Internship Type"    value={cert!.internshipType}
                badge={cert!.internshipType === 'Paid' ? 'green' : 'amber'} />
              <Detail label="Issue Date"         value={fmt(cert!.createdAt)} />
              <Detail label="Start Date"         value={fmt(cert!.startDate)} />
              <Detail label="End Date"           value={fmt(cert!.endDate)} />
              <div className="col-span-2">
                <Detail label="Certificate Number" value={cert!.certificateNumber} mono />
              </div>
            </div>

            {/* QR + Download */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-4">
              {cert!.qrCodeUrl && (
                <div className="text-center">
                  <img src={`${ASSET_BASE}${cert!.qrCodeUrl}`} alt="QR Code"
                    className="w-24 h-24 rounded-xl bg-white p-1 mx-auto" />
                  <p className="text-xs text-slate-500 mt-1">Scan to verify</p>
                </div>
              )}
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                {cert!.pdfUrl && (
                  <a href={`${ASSET_BASE}${cert!.pdfUrl}`} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-500 px-5 py-2.5 text-sm font-semibold text-white transition">
                    ⬇ Download Certificate PDF
                  </a>
                )}
                <p className="text-xs text-slate-500 text-center">
                  Intern ID: <span className="font-mono text-slate-400">{cert!.internId}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-950/60 px-6 py-3 text-center">
            <p className="text-xs text-slate-500">
              This certificate is digitally issued by AgroUdan Kisan Pragati LLP and can be verified at{' '}
              <span className="text-green-400">{cert!.verificationUrl}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, mono, badge }: {
  label: string; value: string; mono?: boolean; badge?: 'green' | 'amber';
}) {
  return (
    <div className="rounded-xl bg-slate-800/50 p-3">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      {badge ? (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge === 'green' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
          {value}
        </span>
      ) : (
        <p className={`text-white font-semibold text-sm ${mono ? 'font-mono' : ''}`}>{value}</p>
      )}
    </div>
  );
}
