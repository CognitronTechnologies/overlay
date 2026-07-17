'use client';

import { useState } from 'react';

type ContactFormData = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export default function ContactForm() {

  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: 'General enquiry',
    message: '',
  });


  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');


  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement |
      HTMLTextAreaElement |
      HTMLSelectElement
    >
  ) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }


  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setStatus('submitting');


    console.log(formData);


    /*
      Future:

      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/contact`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        }
      );

    */


    setTimeout(() => {
      setStatus('success');

      setFormData({
        name: '',
        email: '',
        subject: 'General enquiry',
        message: '',
      });

    }, 800);
  }


  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '3.5rem 1.5rem',
      }}
    >

      <section style={{ marginBottom: '2.5rem' }}>

        <h1
          style={{
            fontSize: '2rem',
            lineHeight: 1.2,
            marginBottom: '1rem',
            fontWeight: 600,
          }}
        >
          Contact Overlay Bets
        </h1>


        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
          }}
        >
          Have a question, need support, or want to discuss working with
          Overlay Bets? Send us a message and our team will get back to you.
        </p>

      </section>


      <form
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gap: '1.25rem',
        }}
      >

        <label>
          Name

          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            style={inputStyle}
          />

        </label>


        <label>
          Email

          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={inputStyle}
          />

        </label>


        <label>
          Subject

          <select
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            style={selectStyle}
          >

            <option>
              General enquiry
            </option>

            <option>
              Account support
            </option>

            <option>
              Tipster partnership
            </option>

            <option>
              Business enquiry
            </option>

            <option>
              Press enquiry
            </option>

            <option>
              Careers
            </option>

          </select>

        </label>


        <label>
          Message

          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows={6}
            required
            style={inputStyle}
          />

        </label>


        <button
          className="btn btn--primary btn--lg"
          disabled={status === 'submitting'}
        >
          {status === 'submitting'
            ? 'Sending...'
            : 'Send message'}
        </button>


        {status === 'success' && (
          <p style={{ color: 'var(--accent)' }}>
            Message sent successfully.
          </p>
        )}

      </form>

    </main>
  );
}


const inputStyle = {
  display: 'block',
  width: '100%',
  marginTop: '0.5rem',
  padding: '0.8rem 1rem',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'inherit',
  fontSize: '1rem',
  boxSizing: 'border-box' as const,
};


const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
};