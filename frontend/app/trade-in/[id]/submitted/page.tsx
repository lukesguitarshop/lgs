import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export default async function SubmittedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-xl mx-auto text-center py-16 px-4">
      <CheckCircle2 className="mx-auto mb-6 h-20 w-20 text-foreground" />
      <h1 className="text-3xl font-bold text-foreground mb-4">Thanks — we got it</h1>
      <p className="text-foreground/70 mb-8">
        We'll email you within 24 hours with two offers: a cash offer and a higher store-credit offer.
      </p>
      <Link href={`/trade-in/${id}`} className="inline-block bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-4 rounded-lg">
        View your request
      </Link>
    </div>
  );
}
