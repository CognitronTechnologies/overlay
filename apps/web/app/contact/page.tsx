import type { Metadata } from 'next';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact Overlay Bets',
  description:
    'Get in touch with Overlay Bets for support, partnerships, tipster enquiries, and general questions about our verified sports betting marketplace.',
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return <ContactForm />;
}