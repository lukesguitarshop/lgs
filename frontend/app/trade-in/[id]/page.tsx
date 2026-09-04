'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Package, CheckCircle2, XCircle, Clock, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { ImageLightbox } from '@/components/ImageLightbox';
import { getTradeIn, acceptTradeInOffer, declineTradeInOffer } from '@/lib/api';
import type { TradeInRequestDto } from '@/lib/types/trade-in';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

export default function TradeInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<TradeInRequestDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptType, setAcceptType] = useState<'cash' | 'credit' | null>(null);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [acting, setActing] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    getTradeIn(id).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [id, isAuthenticated]);

  if (!isAuthenticated) {
    return <div className="max-w-2xl mx-auto text-center py-16 px-4"><h1 className="mobile-h1 mb-4 text-2xl font-bold">Sign in to view your trade-in</h1></div>;
  }
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!data) return <div className="text-center py-16">Trade-in not found.</div>;

  const handleAcceptCash = async () => {
    if (!paypalEmail.trim()) { showToast('PayPal email required', 'error'); return; }
    setActing(true);
    try {
      const updated = await acceptTradeInOffer(id, 'cash', paypalEmail.trim());
      setData(updated); setAcceptType(null);
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setActing(false); }
  };
  const handleAcceptCredit = async () => {
    setActing(true);
    try {
      const updated = await acceptTradeInOffer(id, 'credit');
      setData(updated); setAcceptType(null);
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setActing(false); }
  };
  const handleDecline = async () => {
    if (!confirm('Decline this offer?')) return;
    setActing(true);
    try { setData(await declineTradeInOffer(id)); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setActing(false); }
  };

  const offer = data.activeOffer;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-4">
      <Link href="/account/trade-ins" className="inline-flex items-center text-foreground/70 hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />My trade-ins
      </Link>
      <h1 className="mobile-h1 mb-2 text-3xl font-bold text-foreground">{data.brand} {data.model}</h1>
      <p className="text-foreground/70 mb-6">{data.condition} · Submitted {new Date(data.createdAt).toLocaleDateString()}</p>

      {data.photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {data.photos.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
            >
              <Image src={p.url} alt={`photo ${i + 1}`} fill sizes="200px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Status-specific body */}
      {data.status === 'submitted' && (
        <div className="border border-foreground/15 bg-muted/50 p-6">
          <Clock className="h-8 w-8 text-primary mb-2" />
          <h2 className="text-xl font-semibold mb-2">Under review</h2>
          <p className="text-foreground/78">We'll email you within 24 hours.</p>
        </div>
      )}

      {data.status === 'offered' && offer && !offer.isExpired && !offer.acceptedAt && !offer.declinedAt && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your offer</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-background border border-foreground/15 rounded-lg p-6">
              <h3 className="font-medium text-foreground/78 mb-1">Cash offer</h3>
              <p className="text-3xl font-bold text-foreground mb-4">{formatPrice(offer.cashOffer)}</p>
              <p className="text-sm text-foreground/70 mb-4">Paid via PayPal after inspection.</p>
              <Button onClick={() => setAcceptType('cash')} disabled={acting} className="w-full bg-foreground text-background hover:bg-foreground/90">Accept cash</Button>
            </div>
            <div className="relative border-2 border-primary bg-background p-6">
              <span className="label-mono-sm absolute top-0 right-0 bg-primary px-2 py-1 text-primary-foreground">BETTER VALUE</span>
              <h3 className="font-medium text-foreground/78 mb-1">Store credit</h3>
              <p className="text-3xl font-bold text-primary mb-4">{formatPrice(offer.storeCreditOffer)}</p>
              <p className="text-sm text-foreground/70 mb-4">Spend it on anything in the shop. Credit issued after inspection.</p>
              <Button onClick={handleAcceptCredit} disabled={acting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">{acting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept credit'}</Button>
            </div>
          </div>
          <p className="text-xs text-foreground/60">Offer expires {new Date(offer.expiresAt).toLocaleDateString()}. Final offer subject to inspection.</p>
          <Button onClick={handleDecline} disabled={acting} variant="outline">Decline both</Button>

          {acceptType === 'cash' && (
            <div className="bg-background border border-foreground/15 rounded-lg p-4 mt-4">
              <label className="block text-sm font-medium mb-2">Your PayPal email</label>
              <input type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} className="w-full border rounded px-3 py-2 mb-3" />
              <div className="flex gap-2">
                <Button onClick={handleAcceptCash} disabled={acting} className="bg-foreground text-background">Confirm</Button>
                <Button onClick={() => setAcceptType(null)} variant="outline">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {data.status === 'offered' && offer && offer.isExpired && (
        <div className="bg-muted-foreground p-6 text-foreground">
          <h2 className="text-xl font-semibold mb-2">Offer expired</h2>
          <p>This offer has expired. Email us if you'd like a new one.</p>
        </div>
      )}

      {data.status === 'accepted' && (
        <div className="space-y-4 bg-foreground p-6 text-background">
          <Package className="h-8 w-8 text-background" />
          <h2 className="text-xl font-semibold">Ship it our way</h2>
          {data.shipping?.labelUrl ? (
            <a href={data.shipping.labelUrl} target="_blank" rel="noopener" className="inline-flex items-center bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold">
              <Download className="h-4 w-4 mr-2" />Download prepaid label (PDF)
            </a>
          ) : (
            <p className="text-foreground/78">We'll upload your prepaid label within 1 business day. Check back shortly.</p>
          )}
          <div className="bg-background rounded p-4 border">
            <h3 className="font-semibold mb-2">Packing checklist</h3>
            <ul className="list-disc list-inside text-sm text-foreground/78 space-y-1">
              <li>Use a hardshell or gig case if available</li>
              <li>Wrap with bubble wrap, especially headstock</li>
              <li>Use a sturdy double-walled box</li>
              <li>Loosen the strings before shipping</li>
              <li>Drop off at the carrier on the label</li>
            </ul>
          </div>
        </div>
      )}

      {data.status === 'received' && (
        <div className="border border-foreground/15 bg-muted/50 p-6">
          <CheckCircle2 className="h-8 w-8 text-primary mb-2" />
          <h2 className="text-xl font-semibold mb-2">We got your guitar</h2>
          <p>Inspecting now. We'll update you within 1–2 business days.</p>
        </div>
      )}

      {data.status === 'inspected' && (
        <div className="border border-foreground/15 bg-muted/50 p-6">
          <h2 className="text-xl font-semibold mb-2">Inspection complete</h2>
          <p>Your payout is being processed.</p>
        </div>
      )}

      {data.status === 'completed' && (
        <div className="bg-foreground p-6 text-background">
          <CheckCircle2 className="h-8 w-8 text-background mb-2" />
          <h2 className="text-xl font-semibold mb-2">All done</h2>
          {offer?.acceptedType === 'credit' ? (
            <p>Your store credit has been added. <Link href="/account/credit" className="font-semibold text-background underline underline-offset-2">View balance</Link></p>
          ) : (
            <p>Your PayPal payment has been sent. Thanks for trading!</p>
          )}
        </div>
      )}

      {data.status === 'rejected' && (
        <div className="bg-muted/50 border border-foreground/15 rounded-lg p-6">
          <XCircle className="h-8 w-8 text-foreground/60 mb-2" />
          <h2 className="text-xl font-semibold mb-2">We&apos;re unable to make an offer</h2>
          <p>Thanks for thinking of us. We can&apos;t take this one — feel free to submit other guitars in the future.</p>
        </div>
      )}

      {(data.status === 'declined' || data.status === 'expired' || data.status === 'cancelled') && (
        <div className="bg-muted/50 border border-foreground/15 rounded-lg p-6">
          <XCircle className="h-8 w-8 text-foreground/60 mb-2" />
          <h2 className="text-xl font-semibold mb-2 capitalize">{data.status}</h2>
          <p>This trade-in is closed.</p>
        </div>
      )}

      <ImageLightbox
        images={data.photos.map(p => p.url)}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
        alt={`${data.brand} ${data.model} photo`}
      />
    </div>
  );
}
