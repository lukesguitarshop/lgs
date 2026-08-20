import ReviewForm from './ReviewForm';

export default function ReviewPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <ReviewForm />
    </div>
  );
}

export const metadata = {
  title: 'Leave a Review',
  description: 'Tell Luke how your order went — a star rating and a few words.',
};
